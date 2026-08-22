using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
#if UNITYGLTF_PRESENT
using UnityGLTF;
#endif

/// <summary>
/// Runtime layout export for ARDesignScene:
///   • Keeps a <see cref="PlacedItem"/> registry synced from
///     <see cref="FurniturePlacementController"/> (does not duplicate placement logic)
///   • Gathers confirmed room shell + live ARMeshManager chunks
///   • Writes a timestamped .glb under Application.persistentDataPath
///   • Optionally opens the OS share sheet (NativeShare) so the user can save/send it
///
/// Exporter backend:
///   • If UNITYGLTF_PRESENT is defined → Khronos UnityGLTF (GLTFSceneExporter)
///   • Otherwise → the project's built-in <see cref="GlbExporter"/> (already proven on-device)
///
/// PLATFORM PERMISSIONS
///   • Android: writing under Application.persistentDataPath needs NO extra storage
///     permission (app sandbox). Sharing uses the OS share sheet / FileProvider —
///     NativeShare ships its own AndroidManifest merge. CAMERA is already required for AR.
///   • iOS: add a usage description only if you also write to Photos; sharing a file via
///     UIActivityViewController does not need Photos permission. File stays in the app sandbox.
/// </summary>
[DefaultExecutionOrder(-70)]
public class RoomExportManager : MonoBehaviour
{
    [Serializable]
    public class PlacedItem
    {
        public string instanceId;
        public string prefabId;
        public string displayName;
        public GameObject instance;
        public Vector3 position;
        public Quaternion rotation;
        public Vector3 scale;

        public void CaptureTransform()
        {
            if (instance == null) return;
            var t = instance.transform;
            position = t.position;
            rotation = t.rotation;
            scale = t.localScale;
        }
    }

    public sealed class ExportProgress
    {
        public bool running;
        public bool success;
        public string path;
        public string fileName;
        public string message;
        public string error;
        public int furnitureCount;
        public int roomMeshCount;
    }

    [SerializeField] private FurniturePlacementController placementController;
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARMeshManager meshManager;
    [SerializeField] private LayoutExportService legacyExportService;

    [Header("Output")]
    [SerializeField] private string outputFolder = "exports";
    [SerializeField] private string fileNamePrefix = "room-layout";
    [SerializeField] private bool includeRoomGeometry = true;
    [SerializeField] private bool includeLiveArMeshes = true;
    [SerializeField] private bool shareAfterExport = true;
    [SerializeField] private bool preferUnityGltfWhenAvailable = true;

    [Header("Textures (GlbExporter fallback)")]
    [SerializeField] private bool embedTextures = true;
    [SerializeField] private int maxTextureSize = 1024;

    readonly List<PlacedItem> placedItems = new();

    /// <summary>Live registry — updated whenever furniture is placed / moved / deleted.</summary>
    public IReadOnlyList<PlacedItem> PlacedItems => placedItems;

    public bool IsExporting { get; private set; }

    /// <summary>Fired when export starts (show spinner).</summary>
    public event Action ExportStarted;

    /// <summary>Fired when export finishes (hide spinner, show toast).</summary>
    public event Action<ExportProgress> ExportFinished;

    void Awake()
    {
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (meshManager == null) meshManager = FindFirstObjectByType<ARMeshManager>();
        if (legacyExportService == null) legacyExportService = FindFirstObjectByType<LayoutExportService>();
    }

    void OnEnable()
    {
        if (placementController == null) return;
        placementController.FurniturePlaced += OnFurniturePlaced;
        placementController.FurnitureRemoved += OnFurnitureRemoved;
        RebuildRegistryFromController();
    }

    void OnDisable()
    {
        if (placementController == null) return;
        placementController.FurniturePlaced -= OnFurniturePlaced;
        placementController.FurnitureRemoved -= OnFurnitureRemoved;
    }

    void LateUpdate()
    {
        // Keep transforms fresh after drag / pinch without duplicating manipulator logic.
        for (var i = 0; i < placedItems.Count; i++)
            placedItems[i]?.CaptureTransform();
    }

    // ── Registry (hooks existing placement system) ────────────────────────────

    void OnFurniturePlaced(PlacedFurniture furniture)
    {
        if (furniture == null) return;
        UpsertItem(furniture);
    }

    void OnFurnitureRemoved(string instanceId)
    {
        placedItems.RemoveAll(item => item == null || item.instanceId == instanceId || item.instance == null);
    }

    void RebuildRegistryFromController()
    {
        placedItems.Clear();
        if (placementController == null) return;
        foreach (var furniture in placementController.Instances)
            UpsertItem(furniture);
    }

    void UpsertItem(PlacedFurniture furniture)
    {
        if (furniture == null) return;

        PlacedItem item = null;
        for (var i = 0; i < placedItems.Count; i++)
        {
            if (placedItems[i] != null && placedItems[i].instanceId == furniture.InstanceId)
            {
                item = placedItems[i];
                break;
            }
        }

        if (item == null)
        {
            item = new PlacedItem();
            placedItems.Add(item);
        }

        item.instanceId = furniture.InstanceId;
        item.prefabId = furniture.ModelId;
        item.displayName = string.IsNullOrEmpty(furniture.ModelId) ? furniture.InstanceId : furniture.ModelId;
        item.instance = furniture.gameObject;
        item.CaptureTransform();
    }

    // ── Room geometry ─────────────────────────────────────────────────────────

    /// <summary>
    /// Collects static room meshes for export: confirmed corner/plane shell first,
    /// then any live ARMeshManager chunks (usually empty on ARCore today).
    /// </summary>
    public List<(string name, Mesh mesh, Matrix4x4 localToWorld, Color color)> GatherRoomMeshes()
    {
        var list = new List<(string, Mesh, Matrix4x4, Color)>();

        if (includeRoomGeometry)
        {
            var room = scanController != null ? scanController.ConfirmedRoom : null;
            if (room != null)
            {
                foreach (var surface in room.surfaces)
                {
                    if (surface?.mesh == null) continue;
                    list.Add((surface.name, surface.mesh, Matrix4x4.identity, surface.color));
                }
            }
        }

        if (includeLiveArMeshes && meshManager != null)
            AppendArMeshManagerChunks(meshManager, list);

        return list;
    }

    static void AppendArMeshManagerChunks(
        ARMeshManager manager,
        List<(string name, Mesh mesh, Matrix4x4 localToWorld, Color color)> list)
    {
        // ARMeshManager parents mesh filters under its transform hierarchy.
        var filters = manager.GetComponentsInChildren<MeshFilter>(true);

        var index = 0;
        foreach (var filter in filters)
        {
            if (filter == null || filter.sharedMesh == null) continue;
            if (filter.GetComponentInParent<PlacedFurniture>() != null) continue;

            list.Add((
                $"ARMesh_{index++}",
                filter.sharedMesh,
                filter.transform.localToWorldMatrix,
                new Color(0.72f, 0.74f, 0.76f, 1f)));
        }
    }

    // ── Public UI hook ────────────────────────────────────────────────────────

    /// <summary>
    /// Wire this to your Export toolbar button.
    /// Runs on the main thread (Mesh/Texture APIs are not thread-safe).
    /// </summary>
    public void ExportLayout()
    {
        if (IsExporting)
        {
            Debug.LogWarning("[RoomExportManager] Export already running.");
            return;
        }

        IsExporting = true;
        ExportStarted?.Invoke();

        var progress = new ExportProgress { running = true, message = "Exporting layout…" };
        try
        {
            RebuildRegistryFromController();

            var fileName = $"{fileNamePrefix}-{DateTime.Now:yyyyMMdd-HHmmss}.glb";
            var directory = Path.Combine(Application.persistentDataPath, outputFolder);
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, fileName);

            bool wrote;
            string error;
            int roomCount;
            int furnitureCount;

#if UNITYGLTF_PRESENT
            if (preferUnityGltfWhenAvailable)
            {
                wrote = TryExportWithUnityGltf(path, out roomCount, out furnitureCount, out error);
                if (!wrote)
                {
                    Debug.LogWarning($"[RoomExportManager] UnityGLTF export failed ({error}) — falling back to GlbExporter.");
                    wrote = TryExportWithGlbExporter(path, out roomCount, out furnitureCount, out error);
                }
            }
            else
            {
                wrote = TryExportWithGlbExporter(path, out roomCount, out furnitureCount, out error);
            }
#else
            wrote = TryExportWithGlbExporter(path, out roomCount, out furnitureCount, out error);
#endif

            progress.running = false;
            progress.success = wrote;
            progress.path = wrote ? path : null;
            progress.fileName = wrote ? fileName : null;
            progress.roomMeshCount = roomCount;
            progress.furnitureCount = furnitureCount;
            progress.error = wrote ? null : error;
            progress.message = wrote
                ? $"Saved {fileName}"
                : (string.IsNullOrEmpty(error) ? "Export failed." : error);

            if (wrote)
            {
                Debug.Log($"[RoomExportManager] Exported → {path}");
                if (shareAfterExport)
                    ShareExportedFile(path, fileName);
            }
            else
            {
                Debug.LogError($"[RoomExportManager] {progress.error}");
            }
        }
        catch (Exception e)
        {
            progress.running = false;
            progress.success = false;
            progress.error = e.Message;
            progress.message = e.Message;
            Debug.LogError($"[RoomExportManager] Export exception: {e}");
        }
        finally
        {
            IsExporting = false;
            ExportFinished?.Invoke(progress);
        }
    }

    /// <summary>Same as <see cref="ExportLayout"/> but returns the RN/bridge payload shape.</summary>
    public ExportResultPayload ExportLayoutPayload()
    {
        ExportResultPayload payload = null;
        void Capture(ExportProgress p)
        {
            payload = new ExportResultPayload
            {
                success = p.success,
                path = p.path ?? string.Empty,
                fileName = p.fileName ?? string.Empty,
                byteLength = p.success && !string.IsNullOrEmpty(p.path) && File.Exists(p.path)
                    ? new FileInfo(p.path).Length
                    : 0,
                furnitureCount = p.furnitureCount,
                roomMeshCount = p.roomMeshCount,
                error = p.error ?? string.Empty,
            };
        }

        ExportFinished += Capture;
        try
        {
            ExportLayout();
        }
        finally
        {
            ExportFinished -= Capture;
        }

        return payload ?? new ExportResultPayload
        {
            success = false,
            error = "Export did not complete.",
        };
    }

    // ── Exporters ─────────────────────────────────────────────────────────────

#if UNITYGLTF_PRESENT
    bool TryExportWithUnityGltf(string absolutePath, out int roomCount, out int furnitureCount, out string error)
    {
        roomCount = 0;
        furnitureCount = 0;
        error = null;

        GameObject exportRoot = null;
        try
        {
            exportRoot = BuildExportHierarchy(out roomCount, out furnitureCount);
            if (exportRoot == null)
            {
                error = "Nothing to export — confirm a room scan or place furniture first.";
                return false;
            }

            // Recentering helps external viewers open the file near the origin.
            var offset = ComputeOriginOffset();
            exportRoot.transform.position -= offset;

            var directory = Path.GetDirectoryName(absolutePath);
            var fileNameNoExt = Path.GetFileNameWithoutExtension(absolutePath);
            Directory.CreateDirectory(directory);

            var transforms = new[] { exportRoot.transform };
            var context = new ExportContext(GLTFSettings.GetOrCreateSettings());
            var exporter = new GLTFSceneExporter(transforms, context);

            // SaveGLB is void in current UnityGLTF — use the byte-array API and write ourselves.
            var bytes = exporter.SaveGLBToByteArray(fileNameNoExt);
            if (bytes == null || bytes.Length == 0)
            {
                error = "UnityGLTF SaveGLBToByteArray returned no data.";
                return false;
            }

            File.WriteAllBytes(absolutePath, bytes);
            return File.Exists(absolutePath);
        }
        catch (Exception e)
        {
            error = e.Message;
            return false;
        }
        finally
        {
            if (exportRoot != null)
                Destroy(exportRoot);
        }
    }

    GameObject BuildExportHierarchy(out int roomCount, out int furnitureCount)
    {
        roomCount = 0;
        furnitureCount = 0;

        var root = new GameObject("RoomLayoutExport");
        root.hideFlags = HideFlags.HideAndDontSave;

        var roomParent = new GameObject("Room");
        roomParent.transform.SetParent(root.transform, false);

        foreach (var (name, mesh, localToWorld, color) in GatherRoomMeshes())
        {
            var go = new GameObject(name);
            go.transform.SetParent(roomParent.transform, false);
            go.transform.position = localToWorld.MultiplyPoint3x4(Vector3.zero);
            go.transform.rotation = localToWorld.rotation;
            go.transform.localScale = localToWorld.lossyScale;

            var filter = go.AddComponent<MeshFilter>();
            filter.sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = CreateTempUnlit(color);
            roomCount++;
        }

        var furnitureParent = new GameObject("Furniture");
        furnitureParent.transform.SetParent(root.transform, false);

        foreach (var item in placedItems)
        {
            if (item?.instance == null) continue;
            if (!item.instance.activeInHierarchy) continue;
            var clone = Instantiate(item.instance, furnitureParent.transform, true);
            clone.name = string.IsNullOrEmpty(item.displayName) ? item.instanceId : item.displayName;
            StripNonExportables(clone);
            furnitureCount++;
        }

        if (roomCount == 0 && furnitureCount == 0)
        {
            Destroy(root);
            return null;
        }

        return root;
    }

    static void StripNonExportables(GameObject root)
    {
        foreach (var outline in root.GetComponentsInChildren<ARDragOutline>(true))
            Destroy(outline.gameObject);

        foreach (var t in root.GetComponentsInChildren<Transform>(true))
        {
            if (t == null) continue;
            var n = t.gameObject.name;
            if (n.Contains("Outline") || n.Contains("BlobShadow") || n.Contains("Indicator"))
                Destroy(t.gameObject);
        }

        foreach (var mb in root.GetComponentsInChildren<MonoBehaviour>(true))
        {
            if (mb == null) continue;
            // Keep renderers/filters; drop gameplay scripts from the clone.
            if (mb is PlacedFurniture or FurnitureManipulator)
                Destroy(mb);
        }
    }

    static Material CreateTempUnlit(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Unlit")
                     ?? Shader.Find("Unlit/Color")
                     ?? Shader.Find("Sprites/Default");
        var mat = new Material(shader) { color = color, name = "ExportTemp" };
        mat.hideFlags = HideFlags.HideAndDontSave;
        return mat;
    }
#endif

    bool TryExportWithGlbExporter(string absolutePath, out int roomCount, out int furnitureCount, out string error)
    {
        roomCount = 0;
        furnitureCount = 0;
        error = null;

        try
        {
            var entries = new List<GlbExporter.Entry>();

            foreach (var (name, mesh, localToWorld, color) in GatherRoomMeshes())
            {
                entries.Add(new GlbExporter.Entry
                {
                    name = name,
                    mesh = mesh,
                    localToWorld = localToWorld,
                    materials = null,
                    doubleSided = true,
                    fallbackColor = color,
                });
                roomCount++;
            }

            foreach (var item in placedItems)
            {
                if (item?.instance == null) continue;
                if (!item.instance.activeInHierarchy) continue;
                furnitureCount++;
                AppendFurnitureMeshes(entries, item);
            }

            if (entries.Count == 0)
            {
                error = "Nothing to export — confirm a room scan or place some furniture first.";
                return false;
            }

            var room = scanController != null ? scanController.ConfirmedRoom : null;
            var options = new GlbExporter.Options
            {
                originOffset = ComputeOriginOffset(),
                embedTextures = embedTextures,
                maxTextureSize = maxTextureSize,
                generator = $"ARInteriorDesignApp / RoomExportManager (Unity {Application.unityVersion})",
            };

            var glb = GlbExporter.Export(entries, options);
            foreach (var warning in glb.warnings)
                Debug.LogWarning($"[RoomExportManager] {warning}");

            if (glb.bytes == null || glb.bytes.Length == 0)
            {
                error = glb.warnings.Count > 0 ? glb.warnings[0] : "Exporter produced an empty file.";
                return false;
            }

            File.WriteAllBytes(absolutePath, glb.bytes);
            return true;
        }
        catch (Exception e)
        {
            error = e.Message;
            return false;
        }
    }

    static void AppendFurnitureMeshes(List<GlbExporter.Entry> entries, PlacedItem item)
    {
        var renderers = item.instance.GetComponentsInChildren<MeshRenderer>();
        foreach (var renderer in renderers)
        {
            if (renderer == null || !renderer.enabled) continue;
            if (!renderer.TryGetComponent<MeshFilter>(out var filter)) continue;
            if (filter.sharedMesh == null) continue;
            if (renderer.gameObject.name.Contains("Outline")) continue;
            if (renderer.gameObject.name.Contains("BlobShadow")) continue;

            entries.Add(new GlbExporter.Entry
            {
                name = $"{item.instanceId}_{item.prefabId}_{renderer.gameObject.name}",
                mesh = filter.sharedMesh,
                localToWorld = renderer.transform.localToWorldMatrix,
                materials = renderer.sharedMaterials,
                doubleSided = false,
                fallbackColor = Color.white,
            });
        }
    }

    Vector3 ComputeOriginOffset()
    {
        var room = scanController != null ? scanController.ConfirmedRoom : null;
        if (room != null && room.hasBounds)
            return new Vector3(room.bounds.center.x, room.floorY, room.bounds.center.z);

        if (placedItems.Count == 0) return Vector3.zero;

        var bounds = new Bounds(placedItems[0].position, Vector3.zero);
        for (var i = 0; i < placedItems.Count; i++)
        {
            if (placedItems[i]?.instance == null) continue;
            bounds.Encapsulate(placedItems[i].position);
        }

        return new Vector3(bounds.center.x, bounds.min.y, bounds.center.z);
    }

    // ── Share sheet ───────────────────────────────────────────────────────────

    void ShareExportedFile(string absolutePath, string fileName)
    {
        if (string.IsNullOrEmpty(absolutePath) || !File.Exists(absolutePath))
            return;

#if NATIVESHARE_PRESENT
        // NativeShare handles Android FileProvider + iOS UIActivityViewController.
        // No READ_EXTERNAL_STORAGE needed for app-sandbox files on modern Android.
        new NativeShare()
            .AddFile(absolutePath, "model/gltf-binary")
            .SetSubject("Room layout")
            .SetText($"AR room layout: {fileName}")
            .SetCallback((result, shareTarget) =>
                Debug.Log($"[RoomExportManager] Share result={result} target={shareTarget}"))
            .Share();
#else
        Debug.Log(
            $"[RoomExportManager] File saved at {absolutePath}. " +
            "Install NativeShare (com.yasirkula.nativeshare) and run " +
            "'AR Interior → AR Design → Sync Export Package Defines' to enable the share sheet.");
#endif
    }
}
