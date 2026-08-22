using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// ARPlan-style live edge outlines: closed LineRenderers from each ARPlane.boundary
/// while scanning. Solid plane meshes stay hidden via ScanVisualizationController.
/// </summary>
[DefaultExecutionOrder(-130)]
public class ARDesignEdgeVisualizer : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARPlaneManager planeManager;

    [Header("Style")]
    [SerializeField] private Color floorEdgeColor = new(1f, 1f, 1f, 0.95f);
    [SerializeField] private Color wallEdgeColor = new(0.72f, 0.55f, 0.95f, 0.9f);
    [SerializeField] private float floorLineWidth = 0.018f;
    [SerializeField] private float wallLineWidth = 0.014f;
    [SerializeField] private float floorLift = 0.008f;
    [SerializeField] private float minPlaneArea = 0.08f;
    [SerializeField] private bool showEdgeLengthLabels = true;
    [SerializeField] private float minLabelEdgeLength = 0.8f;

    readonly Dictionary<TrackableId, EdgeVisual> edges = new();
    Material floorMaterial;
    Material wallMaterial;
    Transform root;
    bool visible = true;

    sealed class EdgeVisual
    {
        public GameObject go;
        public LineRenderer line;
        public readonly List<GameObject> labels = new();
    }

    void OnEnable()
    {
        // Plane-boundary edges are replaced by corner-to-corner outlining.
        // Keep this component inert so old jagged outlines never come back.
        enabled = false;
    }

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();

        root = new GameObject("ARDesignEdges").transform;
        root.SetParent(transform, false);

        floorMaterial = CreateLineMaterial(floorEdgeColor);
        wallMaterial = CreateLineMaterial(wallEdgeColor);

        // Prefer the clean corner outline flow.
        enabled = false;
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhase;

        if (planeManager != null)
            planeManager.trackablesChanged.RemoveListener(OnPlanesChanged);
    }

    void OnDestroy()
    {
        ClearAll();
        if (floorMaterial != null) Destroy(floorMaterial);
        if (wallMaterial != null) Destroy(wallMaterial);
        if (root != null) Destroy(root.gameObject);
    }

    void LateUpdate()
    {
        if (!visible || planeManager == null) return;
        if (scanController != null &&
            scanController.Phase != RoomScanController.ScanPhase.Scanning &&
            scanController.Phase != RoomScanController.ScanPhase.ReadyToConfirm)
            return;

        foreach (var plane in planeManager.trackables)
            RefreshPlane(plane);
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        visible = phase == RoomScanController.ScanPhase.Scanning
                  || phase == RoomScanController.ScanPhase.ReadyToConfirm;

        if (!visible)
            ClearAll();
        else
            RefreshAll();
    }

    void OnPlanesChanged(ARTrackablesChangedEventArgs<ARPlane> args)
    {
        if (!visible) return;

        foreach (var plane in args.added)
            RefreshPlane(plane);

        foreach (var plane in args.updated)
            RefreshPlane(plane);

        foreach (var pair in args.removed)
            RemoveEdge(pair.Key);
    }

    void RefreshAll()
    {
        if (planeManager == null) return;
        foreach (var plane in planeManager.trackables)
            RefreshPlane(plane);
    }

    void RefreshPlane(ARPlane plane)
    {
        if (plane == null) return;

        if (plane.trackingState == TrackingState.None
            || plane.subsumedBy != null
            || plane.size.x * plane.size.y < minPlaneArea)
        {
            RemoveEdge(plane.trackableId);
            return;
        }

        var boundary = plane.boundary;
        if (!boundary.IsCreated || boundary.Length < 3)
        {
            RemoveEdge(plane.trackableId);
            return;
        }

        var isFloor = plane.alignment == PlaneAlignment.HorizontalUp;
        var isWall = plane.alignment == PlaneAlignment.Vertical;
        if (!isFloor && !isWall)
        {
            RemoveEdge(plane.trackableId);
            return;
        }

        if (!edges.TryGetValue(plane.trackableId, out var visual) || visual.go == null)
        {
            visual = CreateEdge(plane.trackableId, isFloor);
            edges[plane.trackableId] = visual;
        }

        var count = boundary.Length;
        var line = visual.line;
        line.positionCount = count;
        line.loop = true;

        var localToWorld = plane.transform.localToWorldMatrix;
        var lift = isFloor ? floorLift : 0.004f;

        for (var i = 0; i < count; i++)
        {
            var b = boundary[i];
            var world = localToWorld.MultiplyPoint3x4(new Vector3(b.x, 0f, b.y));
            world += plane.transform.up * lift;
            line.SetPosition(i, world);
        }

        if (showEdgeLengthLabels && isFloor)
            UpdateFloorLabels(visual, line, count);
        else
            ClearLabels(visual);
    }

    EdgeVisual CreateEdge(TrackableId id, bool isFloor)
    {
        var go = new GameObject(isFloor ? $"FloorEdge_{id}" : $"WallEdge_{id}");
        go.transform.SetParent(root, false);

        var line = go.AddComponent<LineRenderer>();
        line.useWorldSpace = true;
        line.loop = true;
        line.widthMultiplier = 1f;
        line.startWidth = isFloor ? floorLineWidth : wallLineWidth;
        line.endWidth = isFloor ? floorLineWidth : wallLineWidth;
        line.numCapVertices = 4;
        line.numCornerVertices = 4;
        line.alignment = LineAlignment.View;
        line.textureMode = LineTextureMode.Stretch;
        line.shadowCastingMode = ShadowCastingMode.Off;
        line.receiveShadows = false;
        line.allowOcclusionWhenDynamic = false;
        line.material = isFloor ? floorMaterial : wallMaterial;
        line.startColor = isFloor ? floorEdgeColor : wallEdgeColor;
        line.endColor = isFloor ? floorEdgeColor : wallEdgeColor;

        return new EdgeVisual { go = go, line = line };
    }

    void UpdateFloorLabels(EdgeVisual visual, LineRenderer line, int count)
    {
        ClearLabels(visual);

        for (var i = 0; i < count; i++)
        {
            var a = line.GetPosition(i);
            var b = line.GetPosition((i + 1) % count);
            var length = Vector3.Distance(a, b);
            if (length < minLabelEdgeLength) continue;

            var mid = (a + b) * 0.5f + Vector3.up * 0.05f;
            var label = CreateLabel(mid, $"{Mathf.RoundToInt(length * 100f)} cm");
            label.transform.SetParent(root, true);
            visual.labels.Add(label);
        }
    }

    static GameObject CreateLabel(Vector3 worldPos, string text)
    {
        var go = new GameObject("EdgeLabel");
        go.transform.position = worldPos;

        var canvas = go.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        canvas.sortingOrder = 20;

        var rt = canvas.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(160f, 40f);
        go.transform.localScale = Vector3.one * 0.0035f;

        var bg = new GameObject("Bg", typeof(RectTransform), typeof(UnityEngine.UI.Image));
        bg.transform.SetParent(go.transform, false);
        var bgImage = bg.GetComponent<UnityEngine.UI.Image>();
        bgImage.color = new Color(1f, 1f, 1f, 0.92f);
        var bgRt = bg.GetComponent<RectTransform>();
        bgRt.anchorMin = Vector2.zero;
        bgRt.anchorMax = Vector2.one;
        bgRt.offsetMin = Vector2.zero;
        bgRt.offsetMax = Vector2.zero;

        var label = ARDesignUiUtil.CreateText(bg.transform, text, 28, FontStyle.Bold, TextAnchor.MiddleCenter);
        label.color = new Color(0.45f, 0.25f, 0.75f, 1f);
        var labelRt = label.rectTransform;
        labelRt.anchorMin = Vector2.zero;
        labelRt.anchorMax = Vector2.one;
        labelRt.offsetMin = Vector2.zero;
        labelRt.offsetMax = Vector2.zero;

        go.AddComponent<ARDesignBillboard>();
        return go;
    }

    void RemoveEdge(TrackableId id)
    {
        if (!edges.TryGetValue(id, out var visual)) return;
        ClearLabels(visual);
        if (visual.go != null) Destroy(visual.go);
        edges.Remove(id);
    }

    void ClearAll()
    {
        foreach (var pair in edges)
        {
            ClearLabels(pair.Value);
            if (pair.Value.go != null) Destroy(pair.Value.go);
        }

        edges.Clear();
    }

    static void ClearLabels(EdgeVisual visual)
    {
        for (var i = 0; i < visual.labels.Count; i++)
        {
            if (visual.labels[i] != null)
                Destroy(visual.labels[i]);
        }

        visual.labels.Clear();
    }

    static Material CreateLineMaterial(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Unlit")
                     ?? Shader.Find("Unlit/Color")
                     ?? Shader.Find("Sprites/Default");
        var material = new Material(shader);
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        material.color = color;
        return material;
    }
}

/// <summary>Keeps world-space UI labels facing the camera.</summary>
public class ARDesignBillboard : MonoBehaviour
{
    void LateUpdate()
    {
        var cam = Camera.main;
        if (cam == null) return;
        transform.rotation = Quaternion.LookRotation(transform.position - cam.transform.position, Vector3.up);
    }
}
