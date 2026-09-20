using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
#if GLTFAST_PRESENT
using System.Threading.Tasks;
using GLTFast;
using GLTFast.Materials;
#endif

/// <summary>
/// Loads furniture GLB/glTF assets at runtime with an in-memory template cache
/// so re-selecting the same piece is instant and first loads hitch less.
/// </summary>
public class RuntimeGltfLoader : MonoBehaviour
{
#if GLTFAST_PRESENT
    [Tooltip("Seconds before a remote GLB download/parse is considered failed. GCS sofas are often 100–250 MB.")]
    [SerializeField] private float timeoutSeconds = 180f;

    [Tooltip("Max cached furniture templates kept in memory.")]
    [SerializeField] private int maxCachedTemplates = 8;

    [Tooltip("Generate mipmaps during import. Off = much faster first load on mobile.")]
    [SerializeField] private bool generateMipMaps = false;

    public static bool IsSupported => true;
#else
    public static bool IsSupported => false;
#endif

#if GLTFAST_PRESENT
    readonly Dictionary<string, GameObject> templateCache = new(StringComparer.Ordinal);
    readonly LinkedList<string> cacheOrder = new();
    readonly HashSet<string> inflightUrls = new(StringComparer.Ordinal);
    readonly Queue<string> prefetchQueue = new();
    int priorityLoadCount;
    bool prefetchPumpRunning;
    Transform cacheRoot;
#endif

    /// <summary>
    /// Loads <paramref name="url"/> and hands back a new GameObject containing the
    /// instantiated model, or null on failure. The callback always fires exactly once.
    /// Cached URLs return a clone immediately on the next frame.
    /// </summary>
    public void Load(string url, Action<GameObject, string> onComplete)
    {
        if (onComplete == null) return;

        if (string.IsNullOrWhiteSpace(url))
        {
            onComplete(null, "Empty glbUrl.");
            return;
        }

#if GLTFAST_PRESENT
        var key = NormalizeUrl(url);
        if (TryCloneCached(key, out var clone))
        {
            // Defer one frame so UI click handlers finish without hitching.
            StartCoroutine(CompleteNextFrame(clone, onComplete));
            return;
        }

        _ = LoadAsync(key, url, onComplete, storeInCache: true, isPriority: true);
#else
        onComplete(null,
            "glTFast is not installed. Add com.unity.cloud.gltfast via Package Manager and define GLTFAST_PRESENT.");
#endif
    }

    /// <summary>
    /// Queue a background warm-up. Never competes with a user-selected download —
    /// runs only when no priority loads are in flight.
    /// </summary>
    public void Prefetch(string url)
    {
#if GLTFAST_PRESENT
        if (string.IsNullOrWhiteSpace(url)) return;
        var key = NormalizeUrl(url);
        if (templateCache.ContainsKey(key) || inflightUrls.Contains(key)) return;
        if (prefetchQueue.Contains(key)) return;
        prefetchQueue.Enqueue(key);
        if (!prefetchPumpRunning)
            StartCoroutine(PrefetchPump());
#endif
    }

    public bool IsCached(string url)
    {
#if GLTFAST_PRESENT
        if (string.IsNullOrWhiteSpace(url)) return false;
        return templateCache.ContainsKey(NormalizeUrl(url));
#else
        return false;
#endif
    }

    public bool HasActivePriorityLoad
    {
        get
        {
#if GLTFAST_PRESENT
            return priorityLoadCount > 0;
#else
            return false;
#endif
        }
    }

#if GLTFAST_PRESENT
    IEnumerator PrefetchPump()
    {
        prefetchPumpRunning = true;
        while (prefetchQueue.Count > 0)
        {
            // Wait until the user's selected model finishes so we don't steal bandwidth.
            while (priorityLoadCount > 0)
                yield return null;

            var key = prefetchQueue.Dequeue();
            if (templateCache.ContainsKey(key) || inflightUrls.Contains(key))
                continue;

            var pending = true;
            _ = LoadAsync(key, key, (_, __) => { pending = false; }, storeInCache: true, isPriority: false);
            while (pending)
                yield return null;
        }
        prefetchPumpRunning = false;
    }

    IEnumerator CompleteNextFrame(GameObject clone, Action<GameObject, string> onComplete)
    {
        yield return null;
        if (clone == null)
            onComplete(null, "Cached template was destroyed.");
        else
            onComplete(clone, null);
    }

    async Task LoadAsync(string key, string url, Action<GameObject, string> onComplete, bool storeInCache, bool isPriority)
    {
        GameObject root = null;
        var handedOff = false;
        if (isPriority) priorityLoadCount++;
        inflightUrls.Add(key);

        try
        {
            // Another request may have finished while we were queued.
            if (TryCloneCached(key, out var existing))
            {
                onComplete?.Invoke(existing, null);
                return;
            }

            // Always build furniture with project FurnitureUnlit during import.
            // UniversalRPMaterialGenerator uses Shader Graph variants that strip on
            // Android → magenta InternalErrorShader, and then albedo is unreachable.
            IMaterialGenerator materialGenerator = new FurnitureUnlitMaterialGenerator();

            var importSettings = new ImportSettings
            {
                GenerateMipMaps = generateMipMaps,
                TexturesReadable = true,
                AnisotropicFilterLevel = 1,
            };

            var import = new GltfImport(materialGenerator: materialGenerator);
            var loadTask = import.Load(url, importSettings);
            var timeoutTask = Task.Delay(TimeSpan.FromSeconds(timeoutSeconds));

            if (await Task.WhenAny(loadTask, timeoutTask) == timeoutTask)
            {
                onComplete?.Invoke(null, $"Timed out after {timeoutSeconds:F0}s loading {url}");
                return;
            }

            if (!await loadTask)
            {
                onComplete?.Invoke(null, $"glTFast failed to parse {url}");
                return;
            }

            await Task.Yield();

            root = new GameObject("GltfModel");
            root.SetActive(false);
            if (!await import.InstantiateMainSceneAsync(root.transform))
            {
                Destroy(root);
                root = null;
                onComplete?.Invoke(null, $"glTFast failed to instantiate {url}");
                return;
            }

            await Task.Yield();
            // Wait for textures before caching — early convert-to-Unlit caused chalk-white sofas.
            StartCoroutine(FinalizeMaterialsAndDeliver(key, root, onComplete, storeInCache, isPriority));
            root = null;
            handedOff = true;
        }
        catch (Exception e)
        {
            if (root != null) Destroy(root);
            onComplete?.Invoke(null, e.Message);
        }
        finally
        {
            if (!handedOff)
            {
                inflightUrls.Remove(key);
                if (isPriority) priorityLoadCount = Mathf.Max(0, priorityLoadCount - 1);
            }
        }
    }

    IEnumerator FinalizeMaterialsAndDeliver(
        string key,
        GameObject root,
        Action<GameObject, string> onComplete,
        bool storeInCache,
        bool isPriority)
    {
        try
        {
            const int maxFrames = 120;
            for (var frame = 0; frame < maxFrames; frame++)
            {
                if (root == null)
                {
                    onComplete?.Invoke(null, "Model destroyed while preparing materials.");
                    yield break;
                }

                GltfUrpMaterialFixer.Apply(root);
                if (GltfUrpMaterialFixer.LooksReady(root) && frame >= 2)
                    break;

                yield return null;
            }

            if (root == null)
            {
                onComplete?.Invoke(null, "Model destroyed while preparing materials.");
                yield break;
            }

            GltfUrpMaterialFixer.Apply(root);

            GameObject deliver;
            if (storeInCache && GltfUrpMaterialFixer.LooksReady(root))
            {
                StoreTemplate(key, root);
                deliver = Instantiate(root);
                deliver.name = "GltfModel";
                deliver.SetActive(false);
                GltfUrpMaterialFixer.Apply(deliver);
            }
            else
            {
                // Don't cache chalk-white / pink templates.
                deliver = root;
                root = null;
                deliver.SetActive(false);
            }

            onComplete?.Invoke(deliver, null);
        }
        finally
        {
            inflightUrls.Remove(key);
            if (isPriority) priorityLoadCount = Mathf.Max(0, priorityLoadCount - 1);
        }
    }

    void StoreTemplate(string key, GameObject template)
    {
        EnsureCacheRoot();
        template.name = $"Cached_{SanitizeKey(key)}";
        template.transform.SetParent(cacheRoot, false);
        template.SetActive(false);

        if (templateCache.TryGetValue(key, out var previous) && previous != null)
            Destroy(previous);

        templateCache[key] = template;
        cacheOrder.Remove(key);
        cacheOrder.AddFirst(key);

        while (cacheOrder.Count > Mathf.Max(1, maxCachedTemplates))
        {
            var oldest = cacheOrder.Last.Value;
            cacheOrder.RemoveLast();
            if (templateCache.TryGetValue(oldest, out var go))
            {
                templateCache.Remove(oldest);
                if (go != null) Destroy(go);
            }
        }
    }

    bool TryCloneCached(string key, out GameObject clone)
    {
        clone = null;
        if (!templateCache.TryGetValue(key, out var template) || template == null)
        {
            templateCache.Remove(key);
            return false;
        }

        // Evict chalk-white / pink templates left from older builds.
        if (!GltfUrpMaterialFixer.LooksReady(template))
        {
            templateCache.Remove(key);
            cacheOrder.Remove(key);
            Destroy(template);
            return false;
        }

        cacheOrder.Remove(key);
        cacheOrder.AddFirst(key);

        clone = Instantiate(template);
        clone.name = "GltfModel";
        clone.SetActive(false);
        GltfUrpMaterialFixer.Apply(clone);
        return true;
    }

    void EnsureCacheRoot()
    {
        if (cacheRoot != null) return;
        var go = new GameObject("GltfTemplateCache");
        go.transform.SetParent(transform, false);
        go.SetActive(false);
        cacheRoot = go.transform;
    }

    static string NormalizeUrl(string url) => (url ?? string.Empty).Trim();

    static string SanitizeKey(string key)
    {
        if (string.IsNullOrEmpty(key)) return "model";
        var chars = key.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            var c = chars[i];
            if (!(char.IsLetterOrDigit(c) || c == '-' || c == '_'))
                chars[i] = '_';
        }
        var s = new string(chars);
        return s.Length > 48 ? s.Substring(s.Length - 48) : s;
    }

    void OnDestroy()
    {
        foreach (var kv in templateCache)
        {
            if (kv.Value != null) Destroy(kv.Value);
        }
        templateCache.Clear();
        cacheOrder.Clear();
    }
#endif
}
