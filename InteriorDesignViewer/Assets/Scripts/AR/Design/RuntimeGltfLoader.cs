using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
#if GLTFAST_PRESENT
using System.Threading.Tasks;
using GLTFast;
using GLTFast.Materials;
#endif

/// <summary>
/// Loads furniture GLB/glTF assets at runtime with:
///   • in-memory template cache (instant re-place)
///   • disk cache under persistentDataPath (survives reopen / scene reload)
/// so AR Furniture does not re-download the same sofas every session.
/// </summary>
public class RuntimeGltfLoader : MonoBehaviour
{
#if GLTFAST_PRESENT
    [Tooltip("Seconds before a remote GLB download/parse is considered failed. GCS sofas are often 100–250 MB.")]
    [SerializeField] private float timeoutSeconds = 180f;

    [Tooltip("Max cached furniture templates kept in memory.")]
    [SerializeField] private int maxCachedTemplates = 6;

    [Tooltip("Max background prefetches allowed in the queue (keeps memory safe).")]
    [SerializeField] private int maxPrefetchQueue = 2;

    [Tooltip("Generate mipmaps during import. Off = much faster first load on mobile.")]
    [SerializeField] private bool generateMipMaps = false;

    [Tooltip("Cache downloaded GLBs on disk so reopen skips the network.")]
    [SerializeField] private bool useDiskCache = true;

    public static bool IsSupported => true;

    // Static so templates survive component/scene teardown while the UaaL process lives.
    static readonly Dictionary<string, GameObject> templateCache = new(StringComparer.Ordinal);
    static readonly LinkedList<string> cacheOrder = new();
    static Transform persistentCacheRoot;
#else
    public static bool IsSupported => false;

    public static void PurgeUnreadyTemplates() { }
#endif

#if GLTFAST_PRESENT
    readonly HashSet<string> inflightUrls = new(StringComparer.Ordinal);
    readonly Queue<string> prefetchQueue = new();
    int priorityLoadCount;
    bool prefetchPumpRunning;
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
        // Cap queue so a bulk RN call cannot OOM the device.
        while (prefetchQueue.Count >= Mathf.Max(1, maxPrefetchQueue))
            prefetchQueue.Dequeue();
        prefetchQueue.Enqueue(key);
        if (!prefetchPumpRunning)
            StartCoroutine(PrefetchPump());
#endif
    }

    public bool IsCached(string url)
    {
#if GLTFAST_PRESENT
        if (string.IsNullOrWhiteSpace(url)) return false;
        var key = NormalizeUrl(url);
        if (templateCache.ContainsKey(key)) return true;
        return useDiskCache && File.Exists(DiskPathForKey(key));
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
            if (TryCloneCached(key, out var existing))
            {
                onComplete?.Invoke(existing, null);
                return;
            }

            IMaterialGenerator materialGenerator = new FurnitureUnlitMaterialGenerator();

            var importSettings = new ImportSettings
            {
                GenerateMipMaps = generateMipMaps,
                AnisotropicFilterLevel = 1,
            };

            // Prefer disk cache so reopen skips the network for large GCS sofas.
            var loadUri = await ResolveLoadUriAsync(key, url);

            var import = new GltfImport(materialGenerator: materialGenerator);
            var loadTask = import.Load(loadUri, importSettings);
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

    async Task<string> ResolveLoadUriAsync(string key, string url)
    {
        if (!useDiskCache)
            return url;

        var diskPath = DiskPathForKey(key);
        if (File.Exists(diskPath) && new FileInfo(diskPath).Length > 64)
            return ToFileUri(diskPath);

        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return url;

        try
        {
            var dir = Path.GetDirectoryName(diskPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            using var www = UnityEngine.Networking.UnityWebRequest.Get(url);
            www.timeout = Mathf.CeilToInt(timeoutSeconds);
            var op = www.SendWebRequest();
            while (!op.isDone)
                await Task.Yield();

#if UNITY_2020_1_OR_NEWER
            if (www.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
#else
            if (www.isNetworkError || www.isHttpError)
#endif
            {
                Debug.LogWarning($"[RuntimeGltfLoader] Disk cache download failed ({www.error}) — loading URL directly.");
                return url;
            }

            var bytes = www.downloadHandler?.data;
            if (bytes == null || bytes.Length < 64)
                return url;

            var tmp = diskPath + ".tmp";
            File.WriteAllBytes(tmp, bytes);
            if (File.Exists(diskPath))
                File.Delete(diskPath);
            File.Move(tmp, diskPath);
            Debug.Log($"[RuntimeGltfLoader] Cached {bytes.Length / (1024 * 1024f):0.0} MB → {diskPath}");
            return ToFileUri(diskPath);
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[RuntimeGltfLoader] Disk cache write failed: {e.Message}");
            return url;
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
            // Large sofas often bind albedo a few frames after InstantiateMainSceneAsync.
            const int maxFrames = 180;
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

            var ready = GltfUrpMaterialFixer.LooksReady(root);
            if (!ready)
            {
                Debug.LogWarning(
                    $"[RuntimeGltfLoader] Delivering '{key}' without confirmed albedo — " +
                    "colors may be missing. Will not cache this template.");
            }

            GameObject deliver;
            // Only cache textured/tinted templates so gray placeholders are never reused.
            if (storeInCache && ready)
            {
                StoreTemplate(key, root);
                deliver = Instantiate(root);
                deliver.name = "GltfModel";
                deliver.SetActive(false);
                GltfUrpMaterialFixer.Apply(deliver);
            }
            else
            {
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
        template.transform.SetParent(persistentCacheRoot, false);
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

    static void EnsureCacheRoot()
    {
        if (persistentCacheRoot != null) return;
        var go = new GameObject("GltfTemplateCache");
        DontDestroyOnLoad(go);
        go.SetActive(false);
        persistentCacheRoot = go.transform;
    }

    static string DiskPathForKey(string key)
    {
        var hash = Sha1Hex(key);
        return Path.Combine(Application.persistentDataPath, "glb-cache", hash + ".glb");
    }

    static string ToFileUri(string absolutePath)
    {
        var normalized = absolutePath.Replace('\\', '/');
        if (!normalized.StartsWith("/", StringComparison.Ordinal))
            normalized = "/" + normalized;
        return "file://" + normalized;
    }

    static string Sha1Hex(string input)
    {
        using var sha = SHA1.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input ?? string.Empty));
        var sb = new StringBuilder(bytes.Length * 2);
        for (var i = 0; i < bytes.Length; i++)
            sb.Append(bytes[i].ToString("x2"));
        return sb.ToString();
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
        // Keep static template + disk cache alive across scene SoftClose / LoadScene.
        // Templates live under DontDestroyOnLoad persistentCacheRoot.
    }

    /// <summary>
    /// Drop in-memory templates that never got albedo (solid gray placeholders).
    /// Next place reloads from disk/network with the fixed material path.
    /// </summary>
    public static void PurgeUnreadyTemplates()
    {
        var doomed = new List<string>();
        foreach (var kv in templateCache)
        {
            if (kv.Value == null || !GltfUrpMaterialFixer.LooksReady(kv.Value))
                doomed.Add(kv.Key);
        }

        foreach (var key in doomed)
        {
            if (templateCache.TryGetValue(key, out var go) && go != null)
                Destroy(go);
            templateCache.Remove(key);
            cacheOrder.Remove(key);
        }

        if (doomed.Count > 0)
            Debug.Log($"[RuntimeGltfLoader] Purged {doomed.Count} unready furniture template(s).");
    }

    void OnApplicationQuit()
    {
        foreach (var kv in templateCache)
        {
            if (kv.Value != null) Destroy(kv.Value);
        }
        templateCache.Clear();
        cacheOrder.Clear();
        if (persistentCacheRoot != null)
            Destroy(persistentCacheRoot.gameObject);
        persistentCacheRoot = null;
    }
#endif
}
