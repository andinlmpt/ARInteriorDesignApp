using System;
using UnityEngine;
#if GLTFAST_PRESENT
using System.Threading.Tasks;
using GLTFast;
#endif

/// <summary>
/// Loads furniture GLB/glTF assets at runtime so the catalog can grow without
/// rebuilding the app.
///
/// This is compiled against glTFast (com.unity.cloud.gltfast), which is NOT yet
/// in Packages/manifest.json. Everything is behind the GLTFAST_PRESENT scripting
/// define so the project keeps compiling until the package is installed; until
/// then <see cref="IsSupported"/> is false and callers fall back to the built-in
/// FurnitureCatalog prefabs.
///
/// Install with:  Window ▸ Package Manager ▸ + ▸ Add package by name
///                com.unity.cloud.gltfast
/// then run:      AR Interior ▸ AR Design ▸ Sync glTFast Scripting Define
/// </summary>
public class RuntimeGltfLoader : MonoBehaviour
{
#if GLTFAST_PRESENT
    [Tooltip("Seconds before a remote GLB download is considered failed.")]
    [SerializeField] private float timeoutSeconds = 30f;

    public static bool IsSupported => true;
#else
    public static bool IsSupported => false;
#endif

    /// <summary>
    /// Loads <paramref name="url"/> and hands back a new GameObject containing the
    /// instantiated model, or null on failure. The callback always fires exactly once.
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
        _ = LoadAsync(url, onComplete);
#else
        onComplete(null,
            "glTFast is not installed. Add com.unity.cloud.gltfast via Package Manager and define GLTFAST_PRESENT.");
#endif
    }

#if GLTFAST_PRESENT
    async Task LoadAsync(string url, Action<GameObject, string> onComplete)
    {
        GameObject root = null;

        try
        {
            var import = new GltfImport();
            var loadTask = import.Load(url);
            var timeoutTask = Task.Delay(TimeSpan.FromSeconds(timeoutSeconds));

            if (await Task.WhenAny(loadTask, timeoutTask) == timeoutTask)
            {
                onComplete(null, $"Timed out after {timeoutSeconds:F0}s loading {url}");
                return;
            }

            if (!await loadTask)
            {
                onComplete(null, $"glTFast failed to parse {url}");
                return;
            }

            root = new GameObject("GltfModel");
            if (!await import.InstantiateMainSceneAsync(root.transform))
            {
                Destroy(root);
                onComplete(null, $"glTFast failed to instantiate {url}");
                return;
            }

            onComplete(root, null);
        }
        catch (Exception e)
        {
            if (root != null) Destroy(root);
            onComplete(null, e.Message);
        }
    }
#endif
}
