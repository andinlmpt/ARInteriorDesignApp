using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// After confirm, builds a room shell used for placement colliders and (in planner
/// mode) a stylized visible mesh. In real-room mode renderers stay hidden so the
/// live AR camera shows the user's actual space.
/// </summary>
[DefaultExecutionOrder(-140)]
public class RoomMeshVisualizer : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private Transform roomRoot;

    [Header("Wall tiles (light, subtle grout)")]
    [SerializeField] private Color wallTile = new(0.94f, 0.94f, 0.93f, 1f);
    [SerializeField] private Color wallGrout = new(0.78f, 0.78f, 0.76f, 1f);
    [SerializeField] private float wallTileMeters = 0.32f;

    [Header("Floor tiles (darker contrast for furniture)")]
    [SerializeField] private Color floorTile = new(0.42f, 0.43f, 0.44f, 1f);
    [SerializeField] private Color floorGrout = new(0.62f, 0.63f, 0.64f, 1f);
    [SerializeField] private float floorTileMeters = 0.40f;

    [Header("Ceiling")]
    [SerializeField] private Color ceilingColor = new(0.97f, 0.97f, 0.96f, 1f);

    [Header("Texture")]
    [SerializeField] private int tileTextureResolution = 128;
    [SerializeField] [Range(1, 8)] private int groutPixels = 2;

    [Header("Orbit cutaway")]
    [Tooltip("Hide walls whose outward normal faces the camera (IKEA-style open room).")]
    [SerializeField] private bool orbitCutaway = true;
    [Tooltip("Meters past the wall/ceiling plane before it hides.")]
    [SerializeField] [Range(-0.35f, 0.5f)] private float cutawayDotThreshold = 0.05f;

    readonly List<GameObject> spawned = new();
    readonly List<RoomSurfaceTag> cutawaySurfaces = new();
    Material wallMaterial;
    Material floorMaterial;
    Material ceilingMaterial;
    Texture2D wallTiles;
    Texture2D floorTiles;
    ARDesignLayoutModeController layoutMode;
    Camera cutawayCamera;
    bool shellVisible = true;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();

        if (roomRoot == null)
        {
            var go = new GameObject("ConfirmedRoom");
            go.transform.SetParent(transform, false);
            roomRoot = go.transform;
        }

        BuildMaterials();
    }

    void OnEnable()
    {
        if (scanController != null)
            scanController.PhaseChanged += OnPhaseChanged;
        if (layoutMode != null)
            layoutMode.ViewModeChanged += OnViewModeChanged;
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhaseChanged;
        if (layoutMode != null)
            layoutMode.ViewModeChanged -= OnViewModeChanged;
    }

    void OnViewModeChanged(ARDesignLayoutModeController.ViewMode mode)
    {
        SetShellVisible(mode == ARDesignLayoutModeController.ViewMode.Planner);
    }

    /// <summary>
    /// Show/hide room shell renderers. Colliders stay active either way so
    /// furniture can still land on the confirmed floor.
    /// </summary>
    public void SetShellVisible(bool visible)
    {
        shellVisible = visible;
        for (var i = 0; i < spawned.Count; i++)
        {
            var go = spawned[i];
            if (go == null) continue;
            var renderer = go.GetComponent<MeshRenderer>();
            if (renderer != null)
                renderer.enabled = visible;
            // Keep GameObjects active so MeshColliders remain for raycasts.
            if (!go.activeSelf)
                go.SetActive(true);
        }

        // In real-room mode, skip cutaway hiding (nothing visible to cut).
        if (!visible)
        {
            for (var i = 0; i < cutawaySurfaces.Count; i++)
            {
                if (cutawaySurfaces[i] != null && !cutawaySurfaces[i].gameObject.activeSelf)
                    cutawaySurfaces[i].gameObject.SetActive(true);
            }
        }
    }

    void LateUpdate()
    {
        if (!shellVisible || !orbitCutaway || cutawaySurfaces.Count == 0) return;

        var cutawayOn = layoutMode != null && layoutMode.IsPlannerOrbitActive;
        if (!cutawayOn)
        {
            for (var i = 0; i < cutawaySurfaces.Count; i++)
            {
                if (cutawaySurfaces[i] != null && !cutawaySurfaces[i].gameObject.activeSelf)
                    cutawaySurfaces[i].gameObject.SetActive(true);
            }
            return;
        }

        if (cutawayCamera == null)
            cutawayCamera = Camera.main;
        if (cutawayCamera == null) return;

        var camPos = cutawayCamera.transform.position;

        for (var i = 0; i < cutawaySurfaces.Count; i++)
        {
            var surface = cutawaySurfaces[i];
            if (surface == null) continue;

            var outward = surface.outwardNormal;
            if (outward.sqrMagnitude < 1e-6f)
            {
                surface.gameObject.SetActive(true);
                continue;
            }

            outward.Normalize();
            bool hide;

            if (surface.kind == RoomGeometrySnapshot.SurfaceKind.Ceiling)
            {
                hide = (camPos.y - surface.midpoint.y) > cutawayDotThreshold;
            }
            else
            {
                outward.y = 0f;
                if (outward.sqrMagnitude < 1e-6f)
                {
                    surface.gameObject.SetActive(true);
                    continue;
                }

                outward.Normalize();
                var mid = surface.midpoint;
                mid.y = camPos.y;
                var toCam = camPos - mid;
                toCam.y = 0f;
                hide = Vector3.Dot(outward, toCam) > cutawayDotThreshold;
            }

            if (surface.gameObject.activeSelf == hide)
                surface.gameObject.SetActive(!hide);
        }
    }

    void OnDestroy()
    {
        Clear();
        DestroyMaterial(ref wallMaterial);
        DestroyMaterial(ref floorMaterial);
        DestroyMaterial(ref ceilingMaterial);
        if (wallTiles != null) Destroy(wallTiles);
        if (floorTiles != null) Destroy(floorTiles);
    }

    void OnPhaseChanged(RoomScanController.ScanPhase phase)
    {
        if (phase == RoomScanController.ScanPhase.Confirmed)
        {
            RebuildFromSnapshot(scanController?.ConfirmedRoom);
            // Default to real-room: hide shell until planner is selected.
            var showShell = layoutMode != null && layoutMode.IsPlannerOrbitActive;
            SetShellVisible(showShell);
        }
        else
            Clear();
    }

    public void RebuildFromSnapshot(RoomGeometrySnapshot snapshot)
    {
        Clear();
        if (snapshot == null || snapshot.IsEmpty) return;

        if (wallMaterial == null)
            BuildMaterials();

        if (layoutMode == null)
            layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();

        foreach (var surface in snapshot.surfaces)
        {
            if (surface?.mesh == null) continue;

            ApplySurfaceUVs(surface);

            var go = new GameObject(surface.name);
            go.transform.SetParent(roomRoot, false);

            var filter = go.AddComponent<MeshFilter>();
            filter.sharedMesh = surface.mesh;

            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = MaterialFor(surface.kind);
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            // Floor receives soft shadows so furniture feels grounded.
            renderer.receiveShadows = surface.kind == RoomGeometrySnapshot.SurfaceKind.Floor;

            // Only the floor needs a collider for placement/drag. Wall/ceiling
            // colliders fight live-AR floor probes and make furniture tremble.
            if (surface.kind == RoomGeometrySnapshot.SurfaceKind.Floor)
            {
                var collider = go.AddComponent<MeshCollider>();
                collider.sharedMesh = surface.mesh;
            }

            var tag = go.AddComponent<RoomSurfaceTag>();
            tag.kind = surface.kind;
            tag.outwardNormal = surface.outwardNormal;
            tag.midpoint = surface.midpoint.sqrMagnitude > 1e-6f
                ? surface.midpoint
                : surface.mesh.bounds.center;

            go.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            go.transform.localScale = Vector3.one;

            spawned.Add(go);
            if (tag.HasCutawayData)
                cutawaySurfaces.Add(tag);
        }

        // Honor current view immediately after rebuild.
        SetShellVisible(shellVisible);
        Debug.Log($"[RoomMeshVisualizer] Spawned {spawned.Count} room surfaces ({cutawaySurfaces.Count} cutaway), shellVisible={shellVisible}.");
    }

    public void Clear()
    {
        for (var i = spawned.Count - 1; i >= 0; i--)
        {
            if (spawned[i] != null)
                Destroy(spawned[i]);
        }

        spawned.Clear();
        cutawaySurfaces.Clear();
    }

    Material MaterialFor(RoomGeometrySnapshot.SurfaceKind kind)
    {
        return kind switch
        {
            RoomGeometrySnapshot.SurfaceKind.Floor => floorMaterial,
            RoomGeometrySnapshot.SurfaceKind.Ceiling => ceilingMaterial,
            _ => wallMaterial,
        };
    }

    void BuildMaterials()
    {
        wallTiles = CreateGroutTileTexture(tileTextureResolution, wallTile, wallGrout, groutPixels, "RoomWallTiles");
        floorTiles = CreateGroutTileTexture(tileTextureResolution, floorTile, floorGrout, groutPixels, "RoomFloorTiles");
        wallMaterial = CreateUnlit(Color.white, wallTiles);
        floorMaterial = CreateUnlit(Color.white, floorTiles);
        ceilingMaterial = CreateUnlit(ceilingColor, null);
    }

    static Material CreateUnlit(Color color, Texture2D albedo)
    {
        var shader = Shader.Find("Universal Render Pipeline/Unlit")
                     ?? Shader.Find("Unlit/Texture")
                     ?? Shader.Find("Unlit/Color")
                     ?? Shader.Find("Sprites/Default");

        var material = new Material(shader);

        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        if (material.HasProperty("_Color")) material.SetColor("_Color", color);

        if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0f);
        material.doubleSidedGI = true;

        if (albedo != null)
        {
            if (material.HasProperty("_BaseMap"))
            {
                material.SetTexture("_BaseMap", albedo);
                material.SetTextureScale("_BaseMap", Vector2.one);
            }

            if (material.HasProperty("_MainTex"))
            {
                material.SetTexture("_MainTex", albedo);
                material.SetTextureScale("_MainTex", Vector2.one);
            }

            material.mainTexture = albedo;
        }

        return material;
    }

    void ApplySurfaceUVs(RoomGeometrySnapshot.Surface surface)
    {
        if (surface?.mesh == null) return;

        var tileSize = surface.kind switch
        {
            RoomGeometrySnapshot.SurfaceKind.Floor => floorTileMeters,
            RoomGeometrySnapshot.SurfaceKind.Ceiling => floorTileMeters,
            _ => wallTileMeters,
        };
        if (tileSize <= 0.01f) return;

        var vertices = surface.mesh.vertices;
        if (vertices == null || vertices.Length == 0) return;

        var uvs = new Vector2[vertices.Length];
        var horizontal = surface.kind == RoomGeometrySnapshot.SurfaceKind.Floor
                         || surface.kind == RoomGeometrySnapshot.SurfaceKind.Ceiling;

        for (var i = 0; i < vertices.Length; i++)
        {
            var v = vertices[i];
            if (horizontal)
            {
                uvs[i] = new Vector2(v.x / tileSize, v.z / tileSize);
            }
            else
            {
                // Stable along-wall U from edge direction via world XZ projection.
                var along = Mathf.Abs(v.x) >= Mathf.Abs(v.z) ? v.x : v.z;
                uvs[i] = new Vector2(along / tileSize, v.y / tileSize);
            }
        }

        surface.mesh.SetUVs(0, uvs);
        surface.mesh.UploadMeshData(false);
    }

    /// <summary>
    /// Soft square tiles with thin grout — reads as ceramic, not a loud checkerboard.
    /// </summary>
    static Texture2D CreateGroutTileTexture(int resolution, Color tile, Color grout, int groutWidth, string name)
    {
        resolution = Mathf.ClosestPowerOfTwo(Mathf.Clamp(resolution, 32, 512));
        groutWidth = Mathf.Clamp(groutWidth, 1, resolution / 8);

        var tex = new Texture2D(resolution, resolution, TextureFormat.RGBA32, false)
        {
            filterMode = FilterMode.Bilinear,
            wrapMode = TextureWrapMode.Repeat,
            anisoLevel = 4,
            name = name,
        };

        var pixels = new Color[resolution * resolution];
        var edge = groutWidth;
        var far = resolution - groutWidth;

        for (var y = 0; y < resolution; y++)
        {
            for (var x = 0; x < resolution; x++)
            {
                var isGrout = x < edge || y < edge || x >= far || y >= far;
                // Soften the grout edge by one pixel so lines are not harsh.
                if (!isGrout && groutWidth > 0)
                {
                    var near =
                        x == edge || y == edge || x == far - 1 || y == far - 1;
                    if (near)
                    {
                        pixels[y * resolution + x] = Color.Lerp(tile, grout, 0.35f);
                        continue;
                    }
                }

                pixels[y * resolution + x] = isGrout ? grout : tile;
            }
        }

        tex.SetPixels(pixels);
        tex.Apply(false, false);
        return tex;
    }

    static void DestroyMaterial(ref Material material)
    {
        if (material == null) return;
        Destroy(material);
        material = null;
    }
}
