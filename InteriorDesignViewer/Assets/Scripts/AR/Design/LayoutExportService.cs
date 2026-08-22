using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

/// <summary>
/// Serializes the confirmed room scan plus every placed furniture instance into
/// a single self-contained .glb on disk and hands the path back to RN.
///
/// The file is written to Application.persistentDataPath, which on Android is
/// /storage/emulated/0/Android/data/&lt;package&gt;/files/ — the same sandbox the RN
/// half of the app runs in, so expo-file-system can read it straight back
/// without any extra permissions. Bytes are deliberately NOT pushed through the
/// Unity → RN string bridge: a scanned room plus a few textured models is
/// megabytes, and base64 over that channel will stall the UI thread.
///
/// The whole scene is recentred so the floor sits on Y=0 near the origin, which
/// is what makes the export land right-side-up and framed in external viewers
/// instead of drifting somewhere out in AR world space.
/// </summary>
public class LayoutExportService : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private FurniturePlacementController placementController;
    [SerializeField] private RoomExportManager roomExportManager;

    [Header("Output")]
    [Tooltip("Folder under Application.persistentDataPath where exports are written.")]
    [SerializeField] private string outputFolder = "exports";
    [Tooltip("Base file name. A timestamp is appended to keep exports distinct.")]
    [SerializeField] private string fileNamePrefix = "room-design";

    [Header("Content")]
    [Tooltip("Include the scanned room geometry alongside the furniture.")]
    [SerializeField] private bool includeRoomGeometry = true;
    [Tooltip("Pack furniture textures into the GLB. Off produces much smaller, flat-shaded files.")]
    [SerializeField] private bool embedTextures = true;
    [Tooltip("Textures larger than this are downscaled on the way in.")]
    [SerializeField] private int maxTextureSize = 1024;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (roomExportManager == null) roomExportManager = FindFirstObjectByType<RoomExportManager>();
    }

    /// <summary>
    /// Builds and writes the GLB. Prefers <see cref="RoomExportManager"/> when present
    /// (share sheet + UnityGLTF path); otherwise uses the built-in GlbExporter.
    /// </summary>
    public ExportResultPayload ExportLayout()
    {
        if (roomExportManager != null)
            return roomExportManager.ExportLayoutPayload();

        var result = new ExportResultPayload();

        try
        {
            var entries = new List<GlbExporter.Entry>();
            var room = scanController != null ? scanController.ConfirmedRoom : null;

            if (includeRoomGeometry && room != null)
            {
                foreach (var surface in room.surfaces)
                {
                    if (surface.mesh == null) continue;

                    entries.Add(new GlbExporter.Entry
                    {
                        name = surface.name,
                        mesh = surface.mesh,
                        // Snapshot geometry is already baked into world space.
                        localToWorld = Matrix4x4.identity,
                        materials = null,
                        doubleSided = true,
                        fallbackColor = surface.color,
                    });
                }

                result.roomMeshCount = room.surfaces.Count;
            }

            var furnitureCount = 0;
            if (placementController != null)
            {
                foreach (var furniture in placementController.Instances)
                {
                    if (furniture == null || !furniture.gameObject.activeInHierarchy) continue;

                    furnitureCount++;
                    AppendFurniture(entries, furniture);
                }
            }

            result.furnitureCount = furnitureCount;

            if (entries.Count == 0)
            {
                result.success = false;
                result.error = "Nothing to export — confirm a room scan or place some furniture first.";
                return result;
            }

            var options = new GlbExporter.Options
            {
                originOffset = ComputeOriginOffset(room, entries),
                embedTextures = embedTextures,
                maxTextureSize = maxTextureSize,
                generator = $"ARInteriorDesignApp (Unity {Application.unityVersion})",
            };

            var glb = GlbExporter.Export(entries, options);

            foreach (var warning in glb.warnings)
                Debug.LogWarning($"[LayoutExportService] {warning}");

            if (glb.bytes == null || glb.bytes.Length == 0)
            {
                result.success = false;
                result.error = glb.warnings.Count > 0 ? glb.warnings[0] : "Exporter produced an empty file.";
                return result;
            }

            var directory = Path.Combine(Application.persistentDataPath, outputFolder);
            Directory.CreateDirectory(directory);

            var fileName = $"{fileNamePrefix}-{DateTime.Now:yyyyMMdd-HHmmss}.glb";
            var path = Path.Combine(directory, fileName);
            File.WriteAllBytes(path, glb.bytes);

            result.success = true;
            result.path = path;
            result.fileName = fileName;
            result.byteLength = glb.bytes.Length;

            Debug.Log($"[LayoutExportService] Exported {glb.nodeCount} nodes / {glb.triangleCount} triangles " +
                      $"({glb.bytes.Length / 1024f:F1} KB) → {path}");

            return result;
        }
        catch (Exception e)
        {
            Debug.LogError($"[LayoutExportService] Export failed: {e}");
            result.success = false;
            result.error = e.Message;
            return result;
        }
    }

    static void AppendFurniture(List<GlbExporter.Entry> entries, PlacedFurniture furniture)
    {
        var renderers = furniture.GetComponentsInChildren<MeshRenderer>();

        foreach (var renderer in renderers)
        {
            if (renderer == null || !renderer.enabled) continue;
            if (!renderer.TryGetComponent<MeshFilter>(out var filter)) continue;
            if (filter.sharedMesh == null) continue;

            // The outline helper draws with a LineRenderer, but guard anyway so
            // no UI-only geometry leaks into the exported file.
            if (renderer.gameObject.name.Contains("Outline")) continue;
            if (renderer.gameObject.name.Contains("BlobShadow")) continue;

            entries.Add(new GlbExporter.Entry
            {
                name = $"{furniture.InstanceId}_{furniture.ModelId}_{renderer.gameObject.name}",
                mesh = filter.sharedMesh,
                localToWorld = renderer.transform.localToWorldMatrix,
                materials = renderer.sharedMaterials,
                doubleSided = false,
                fallbackColor = Color.white,
            });
        }
    }

    /// <summary>
    /// Puts the floor on Y=0 and the room roughly on the origin. Falls back to
    /// the furniture bounds when there is no room geometry to anchor to.
    /// </summary>
    static Vector3 ComputeOriginOffset(RoomGeometrySnapshot room, List<GlbExporter.Entry> entries)
    {
        if (room != null && room.hasBounds)
            return new Vector3(room.bounds.center.x, room.floorY, room.bounds.center.z);

        var hasBounds = false;
        var bounds = new Bounds();

        foreach (var entry in entries)
        {
            if (entry.mesh == null) continue;

            var worldCenter = entry.localToWorld.MultiplyPoint3x4(entry.mesh.bounds.center);
            var worldBounds = new Bounds(worldCenter, entry.localToWorld.MultiplyVector(entry.mesh.bounds.size));

            if (!hasBounds)
            {
                bounds = worldBounds;
                hasBounds = true;
            }
            else
            {
                bounds.Encapsulate(worldBounds);
            }
        }

        return hasBounds ? new Vector3(bounds.center.x, bounds.min.y, bounds.center.z) : Vector3.zero;
    }
}
