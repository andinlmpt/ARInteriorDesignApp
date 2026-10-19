using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Dots on the floor ARCore has found, shown while the scan waits for the floor point, so the
/// user can see where the floor is detected before anything is set (the plane meshes themselves
/// stay hidden, see <see cref="ScanVisualizationController"/>). The dots are fixed in the room,
/// not to the screen. Hidden the rest of the time. Once enough floor is found the dots turn green
/// (<see cref="IsReady"/>), which tells the user the floor is done and the floor point can be set.
/// </summary>
public class ARScanFloorGrid : MonoBehaviour
{
    [SerializeField] private float dotSpacing = 0.12f;
    [SerializeField] private Color dotColor = new(1f, 1f, 1f, 0.6f);
    [SerializeField] private Color readyColor = new(0.35f, 0.92f, 0.55f, 0.85f);
    [Tooltip("Horizontal planes closer than this below the camera are tables or beds, not the floor (m).")]
    [SerializeField] private float minBelowCamera = 0.7f;
    [SerializeField] private float refreshInterval = 0.2f;
    [Tooltip("Floor found (m²) before it counts as ready.")]
    [SerializeField] private float readyArea = 1.0f;
    [Tooltip("Ready stays on until the floor found drops below this (m²), so it doesn't flicker.")]
    [SerializeField] private float notReadyArea = 0.6f;

    readonly Dictionary<TrackableId, MeshFilter> meshes = new();
    readonly HashSet<TrackableId> seen = new();
    readonly List<TrackableId> stale = new();
    readonly List<Vector3> vertices = new();
    readonly List<Vector2> uvs = new();
    readonly List<int> triangles = new();

    ARPlaneManager planeManager;
    Camera arCamera;
    Transform root;
    Material material;
    Texture2D dotTexture;
    bool visible;
    float nextRefreshAt;

    /// <summary>Floor ARCore has found so far (m²); updated while the dots are shown.</summary>
    public float FloorArea { get; private set; }

    /// <summary>Enough floor is found to set the floor point: the dots are green.</summary>
    public bool IsReady { get; private set; }

    /// <summary>Any floor found yet (some dots showing).</summary>
    public bool HasFloor => FloorArea > 0.01f;

    public static ARScanFloorGrid EnsureOn(GameObject host)
    {
        var existing = host.GetComponent<ARScanFloorGrid>();
        return existing != null ? existing : host.AddComponent<ARScanFloorGrid>();
    }

    /// <summary>Show or hide the dots.</summary>
    public bool Visible
    {
        get => visible;
        set
        {
            if (visible == value) return;
            visible = value && material != null;
            if (root != null) root.gameObject.SetActive(visible);
            nextRefreshAt = 0f;
        }
    }

    void Awake()
    {
        planeManager = FindFirstObjectByType<ARPlaneManager>();
        arCamera = Camera.main;

        root = new GameObject("ScanFloorGrid").transform;
        root.SetParent(transform, false);
        root.gameObject.SetActive(false);

        var shader = Shader.Find("Sprites/Default");
        if (shader == null || !shader.isSupported) return;
        dotTexture = CreateDotTexture();
        material = new Material(shader) { mainTexture = dotTexture, color = dotColor };
        material.renderQueue = (int)RenderQueue.Transparent;
    }

    void OnDestroy()
    {
        foreach (var filter in meshes.Values)
        {
            if (filter != null && filter.sharedMesh != null) Destroy(filter.sharedMesh);
        }

        if (material != null) Destroy(material);
        if (dotTexture != null) Destroy(dotTexture);
    }

    void Update()
    {
        if (!visible || planeManager == null) return;
        if (Time.unscaledTime < nextRefreshAt) return;
        nextRefreshAt = Time.unscaledTime + refreshInterval;
        if (arCamera == null) arCamera = Camera.main;

        seen.Clear();
        var area = 0f;
        foreach (var plane in planeManager.trackables)
        {
            if (!IsFloor(plane)) continue;
            seen.Add(plane.trackableId);
            area += BoundaryArea(plane);
            if (!meshes.TryGetValue(plane.trackableId, out var filter) || filter == null)
            {
                filter = CreateMeshObject(plane.trackableId);
                meshes[plane.trackableId] = filter;
            }

            Rebuild(filter, plane);
        }

        stale.Clear();
        foreach (var pair in meshes)
        {
            if (!seen.Contains(pair.Key)) stale.Add(pair.Key);
        }

        foreach (var id in stale)
        {
            var filter = meshes[id];
            if (filter != null)
            {
                if (filter.sharedMesh != null) Destroy(filter.sharedMesh);
                Destroy(filter.gameObject);
            }

            meshes.Remove(id);
        }

        FloorArea = area;
        var ready = IsReady ? area >= notReadyArea : area >= readyArea;
        if (ready != IsReady)
        {
            IsReady = ready;
            if (material != null) material.color = ready ? readyColor : dotColor;
        }
    }

    /// <summary>Area inside a plane's outline (m²), from its points in the plane's own 2D frame.</summary>
    static float BoundaryArea(ARPlane plane)
    {
        var boundary = plane.boundary;
        if (!boundary.IsCreated || boundary.Length < 3) return 0f;
        var twice = 0f;
        for (var i = 0; i < boundary.Length; i++)
        {
            var a = boundary[i];
            var b = boundary[(i + 1) % boundary.Length];
            twice += a.x * b.y - b.x * a.y;
        }

        return Mathf.Abs(twice) * 0.5f;
    }

    bool IsFloor(ARPlane plane)
    {
        if (plane == null || plane.alignment != PlaneAlignment.HorizontalUp) return false;
        if (plane.trackingState != TrackingState.Tracking || plane.subsumedBy != null) return false;
        return arCamera == null || plane.center.y <= arCamera.transform.position.y - minBelowCamera;
    }

    MeshFilter CreateMeshObject(TrackableId id)
    {
        var go = new GameObject($"FloorDots_{id}", typeof(MeshFilter), typeof(MeshRenderer));
        go.transform.SetParent(root, false);
        var renderer = go.GetComponent<MeshRenderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;
        var filter = go.GetComponent<MeshFilter>();
        filter.sharedMesh = new Mesh { name = go.name };
        filter.sharedMesh.MarkDynamic();
        return filter;
    }

    /// <summary>ARCore floor outlines are convex, so a fan from the first point fills them.</summary>
    void Rebuild(MeshFilter filter, ARPlane plane)
    {
        var mesh = filter.sharedMesh;
        var boundary = plane.boundary;
        if (!boundary.IsCreated || boundary.Length < 3)
        {
            mesh.Clear();
            return;
        }

        vertices.Clear();
        uvs.Clear();
        triangles.Clear();
        var planeTransform = plane.transform;
        var local = filter.transform;
        for (var i = 0; i < boundary.Length; i++)
        {
            var world = planeTransform.TransformPoint(new Vector3(boundary[i].x, 0f, boundary[i].y));
            world.y += 0.004f;
            vertices.Add(local.InverseTransformPoint(world));
            uvs.Add(new Vector2(world.x, world.z) / dotSpacing);
        }

        for (var i = 1; i < boundary.Length - 1; i++)
        {
            triangles.Add(0);
            triangles.Add(i);
            triangles.Add(i + 1);
        }

        mesh.Clear();
        mesh.SetVertices(vertices);
        mesh.SetUVs(0, uvs);
        mesh.SetTriangles(triangles, 0);
        mesh.RecalculateBounds();
    }

    /// <summary>One soft round dot per tile; the texture repeats across the floor.</summary>
    static Texture2D CreateDotTexture()
    {
        const int size = 32;
        const float radius = 3.2f;
        var texture = new Texture2D(size, size, TextureFormat.RGBA32, true)
        {
            name = "ScanFloorDot",
            wrapMode = TextureWrapMode.Repeat,
            filterMode = FilterMode.Trilinear,
        };

        var pixels = new Color32[size * size];
        var c = (size - 1) * 0.5f;
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var d = Mathf.Sqrt((x - c) * (x - c) + (y - c) * (y - c));
                var a = Mathf.Clamp01(radius + 0.5f - d);
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255f));
            }
        }

        texture.SetPixels32(pixels);
        texture.Apply(true, true);
        return texture;
    }
}
