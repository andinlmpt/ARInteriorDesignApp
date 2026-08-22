using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

/// <summary>
/// ARPlan-style corner-to-corner room outline: tap floor corners in order,
/// draw thick white floor edges + vertical wall guides, then confirm.
/// </summary>
[DefaultExecutionOrder(-125)]
public class ARDesignCornerRoomBuilder : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private Camera arCamera;
    [SerializeField] private ARPlacementIndicator placementIndicator;

    [Header("Look")]
    [SerializeField] private Color edgeColor = new(1f, 1f, 1f, 0.98f);
    [SerializeField] private float floorLineWidth = 0.028f;
    [SerializeField] private float wallLineWidth = 0.022f;
    [SerializeField] private float wallHeight = 2.5f;
    [SerializeField] private float cornerMarkerSize = 0.06f;
    [SerializeField] private float closeSnapDistance = 0.35f;
    [SerializeField] private int maxCorners = 24;
    [SerializeField] private bool showEdgeMeasurements = true;
    [SerializeField] private bool keepMeasurementsAfterConfirm = false;

    readonly List<Vector3> corners = new();
    readonly List<ARRaycastHit> hits = new();
    readonly List<GameObject> markers = new();
    readonly List<GameObject> measurementLabels = new();

    LineRenderer floorLoop;
    LineRenderer previewSegment;
    LineRenderer[] wallGuides = Array.Empty<LineRenderer>();
    LineRenderer ceilingLoop;
    Material lineMaterial;
    Transform root;
    bool active;
    bool roomLocked;

    public IReadOnlyList<Vector3> Corners => corners;
    public int CornerCount => corners.Count;
    public bool CanConfirm => corners.Count >= 3;
    public float WallHeight => wallHeight;

    public event Action CornersChanged;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (raycastManager == null) raycastManager = FindFirstObjectByType<ARRaycastManager>();
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();
        if (arCamera == null) arCamera = Camera.main;
        if (placementIndicator == null) placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();

        root = new GameObject("CornerRoomOutline").transform;
        root.SetParent(transform, false);

        lineMaterial = CreateLineMaterial(edgeColor);
        floorLoop = CreateLine("FloorLoop", floorLineWidth, true);
        previewSegment = CreateLine("PreviewSegment", floorLineWidth, false);
        ceilingLoop = CreateLine("CeilingLoop", wallLineWidth, true);
        previewSegment.enabled = false;
        ceilingLoop.enabled = false;
    }

    void OnEnable()
    {
        EnhancedTouchSupport.Enable();
        if (scanController != null)
            scanController.PhaseChanged += OnPhase;
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhase;
    }

    void OnDestroy()
    {
        Clear();
        if (lineMaterial != null) Destroy(lineMaterial);
        if (root != null) Destroy(root.gameObject);
    }

    void Start()
    {
        if (scanController != null)
            OnPhase(scanController.Phase);
    }

    void Update()
    {
        if (!active) return;

        UpdatePreview();

        if (Touch.activeTouches.Count != 1) return;
        var touch = Touch.activeTouches[0];
        if (touch.phase != TouchPhase.Began) return;
        if (IsPointerOverUI(touch.touchId)) return;

        if (TryGetFloorHit(touch.screenPosition, out var hit))
            TryAddCorner(hit);
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        active = phase == RoomScanController.ScanPhase.Scanning
                 || phase == RoomScanController.ScanPhase.ReadyToConfirm;
        roomLocked = phase == RoomScanController.ScanPhase.Confirmed;

        if (phase == RoomScanController.ScanPhase.Confirmed)
        {
            previewSegment.enabled = false;
            if (keepMeasurementsAfterConfirm && corners.Count >= 2)
            {
                if (root != null) root.gameObject.SetActive(true);
                RebuildVisuals(closed: true);
                // Soften guide lines in planner — keep measurement chips.
                if (floorLoop != null) floorLoop.enabled = false;
                if (ceilingLoop != null) ceilingLoop.enabled = false;
                ClearWallGuides();
                for (var i = 0; i < markers.Count; i++)
                {
                    if (markers[i] != null) markers[i].SetActive(false);
                }
            }
            else
            {
                HidePreviewOnly();
            }

            return;
        }

        if (root != null)
            root.gameObject.SetActive(active);

        if (!active)
        {
            Clear();
            return;
        }

        if (floorLoop != null) floorLoop.enabled = true;
        for (var i = 0; i < markers.Count; i++)
        {
            if (markers[i] != null) markers[i].SetActive(true);
        }

        if (phase == RoomScanController.ScanPhase.Scanning && corners.Count == 0)
            Clear();

        placementIndicator?.StartTracking();
    }

    public void UndoLastCorner()
    {
        if (corners.Count == 0) return;
        corners.RemoveAt(corners.Count - 1);
        RebuildVisuals();
        CornersChanged?.Invoke();
    }

    public void Clear()
    {
        corners.Clear();
        ClearMeasurementLabels();
        RebuildVisuals();
        CornersChanged?.Invoke();
    }

    public void PrepareForRescan()
    {
        roomLocked = false;
        Clear();
        active = true;
        if (root != null) root.gameObject.SetActive(true);
        if (floorLoop != null) floorLoop.enabled = true;
    }

    void TryAddCorner(Vector3 worldPoint)
    {
        worldPoint.y = FindFloorY(worldPoint);

        // Close the loop by tapping near the first corner.
        if (corners.Count >= 3 && Vector3.Distance(Flat(worldPoint), Flat(corners[0])) <= closeSnapDistance)
        {
            RebuildVisuals(closed: true);
            CornersChanged?.Invoke();
            return;
        }

        if (corners.Count >= maxCorners) return;

        // Ignore accidental double-taps on the same spot.
        if (corners.Count > 0 && Vector3.Distance(Flat(worldPoint), Flat(corners[^1])) < 0.12f)
            return;

        corners.Add(worldPoint);
        RebuildVisuals();
        CornersChanged?.Invoke();
    }

    void UpdatePreview()
    {
        if (corners.Count == 0 || arCamera == null || raycastManager == null)
        {
            previewSegment.enabled = false;
            return;
        }

        var screen = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
        if (!TryGetFloorHit(screen, out var hit))
        {
            previewSegment.enabled = false;
            return;
        }

        hit.y = FindFloorY(hit);
        previewSegment.enabled = true;
        previewSegment.positionCount = 2;
        previewSegment.SetPosition(0, corners[^1] + Vector3.up * 0.01f);
        previewSegment.SetPosition(1, hit + Vector3.up * 0.01f);
    }

    void RebuildVisuals(bool closed = false)
    {
        // Markers
        while (markers.Count > corners.Count)
        {
            var last = markers[^1];
            markers.RemoveAt(markers.Count - 1);
            if (last != null) Destroy(last);
        }

        while (markers.Count < corners.Count)
        {
            var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = $"Corner_{markers.Count}";
            marker.transform.SetParent(root, false);
            marker.transform.localScale = Vector3.one * cornerMarkerSize;
            Destroy(marker.GetComponent<Collider>());
            var renderer = marker.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = lineMaterial;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            markers.Add(marker);
        }

        for (var i = 0; i < corners.Count; i++)
        {
            markers[i].SetActive(!roomLocked);
            markers[i].transform.position = corners[i] + Vector3.up * 0.02f;
        }

        // Floor loop
        if (corners.Count == 0)
        {
            floorLoop.positionCount = 0;
            ceilingLoop.enabled = false;
            ClearWallGuides();
            ClearMeasurementLabels();
            return;
        }

        var loopClosed = closed || corners.Count >= 3;
        floorLoop.loop = loopClosed;
        floorLoop.positionCount = corners.Count;
        floorLoop.enabled = !roomLocked;
        for (var i = 0; i < corners.Count; i++)
            floorLoop.SetPosition(i, corners[i] + Vector3.up * 0.012f);

        // Vertical wall guides + ceiling ring
        EnsureWallGuides(corners.Count);
        for (var i = 0; i < corners.Count; i++)
        {
            var a = corners[i] + Vector3.up * 0.012f;
            var b = a + Vector3.up * wallHeight;
            wallGuides[i].enabled = !roomLocked;
            wallGuides[i].positionCount = 2;
            wallGuides[i].SetPosition(0, a);
            wallGuides[i].SetPosition(1, b);
        }

        for (var i = corners.Count; i < wallGuides.Length; i++)
            wallGuides[i].enabled = false;

        if (corners.Count >= 2 && !roomLocked)
        {
            ceilingLoop.enabled = true;
            ceilingLoop.loop = loopClosed;
            ceilingLoop.positionCount = corners.Count;
            for (var i = 0; i < corners.Count; i++)
                ceilingLoop.SetPosition(i, corners[i] + Vector3.up * wallHeight);
        }
        else
        {
            ceilingLoop.enabled = false;
        }

        RebuildMeasurementLabels(loopClosed);
    }

    void RebuildMeasurementLabels(bool loopClosed)
    {
        ClearMeasurementLabels();
        if (!showEdgeMeasurements || corners.Count < 2) return;

        var edgeCount = loopClosed ? corners.Count : corners.Count - 1;
        for (var i = 0; i < edgeCount; i++)
        {
            var a = corners[i];
            var b = corners[(i + 1) % corners.Count];
            var lengthMeters = Vector3.Distance(Flat(a), Flat(b));
            if (lengthMeters < 0.05f) continue;

            var mid = (a + b) * 0.5f + Vector3.up * 0.08f;
            var cm = Mathf.RoundToInt(lengthMeters * 100f);
            var label = CreateMeasurementLabel(mid, $"{cm} cm");
            measurementLabels.Add(label);
        }

        // Wall height chip near first corner once the outline can form a room.
        if (loopClosed && corners.Count >= 3)
        {
            var heightPos = corners[0] + Vector3.up * (wallHeight * 0.5f);
            var heightCm = Mathf.RoundToInt(wallHeight * 100f);
            var heightLabel = CreateMeasurementLabel(heightPos, $"H {heightCm} cm");
            measurementLabels.Add(heightLabel);
        }
    }

    GameObject CreateMeasurementLabel(Vector3 worldPos, string text)
    {
        var go = new GameObject("MeasureLabel");
        go.transform.SetParent(root, false);
        go.transform.position = worldPos;

        var canvas = go.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        canvas.sortingOrder = 40;

        var rt = canvas.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(180f, 48f);
        go.transform.localScale = Vector3.one * 0.004f;

        var bg = ARDesignUiUtil.CreateRoundedImage(go.transform, new Color(1f, 1f, 1f, 0.94f), 24);
        bg.raycastTarget = false;
        var bgRt = bg.rectTransform;
        bgRt.anchorMin = Vector2.zero;
        bgRt.anchorMax = Vector2.one;
        bgRt.offsetMin = Vector2.zero;
        bgRt.offsetMax = Vector2.zero;

        var label = ARDesignUiUtil.CreateText(bg.transform, text, 30, FontStyle.Bold, TextAnchor.MiddleCenter);
        label.color = new Color(0.12f, 0.12f, 0.14f, 1f);
        label.raycastTarget = false;
        var labelRt = label.rectTransform;
        labelRt.anchorMin = Vector2.zero;
        labelRt.anchorMax = Vector2.one;
        labelRt.offsetMin = new Vector2(8f, 4f);
        labelRt.offsetMax = new Vector2(-8f, -4f);

        go.AddComponent<ARDesignBillboard>();
        return go;
    }

    void ClearMeasurementLabels()
    {
        for (var i = 0; i < measurementLabels.Count; i++)
        {
            if (measurementLabels[i] != null)
                Destroy(measurementLabels[i]);
        }

        measurementLabels.Clear();
    }

    void HidePreviewOnly()
    {
        previewSegment.enabled = false;
        if (root != null) root.gameObject.SetActive(false);
    }

    void EnsureWallGuides(int count)
    {
        if (wallGuides.Length >= count) return;
        var next = new LineRenderer[count];
        for (var i = 0; i < wallGuides.Length; i++)
            next[i] = wallGuides[i];
        for (var i = wallGuides.Length; i < count; i++)
            next[i] = CreateLine($"WallGuide_{i}", wallLineWidth, false);
        wallGuides = next;
    }

    void ClearWallGuides()
    {
        for (var i = 0; i < wallGuides.Length; i++)
        {
            if (wallGuides[i] != null)
                wallGuides[i].enabled = false;
        }
    }

    bool TryGetFloorHit(Vector2 screenPoint, out Vector3 world)
    {
        world = default;
        if (raycastManager == null) return false;

        hits.Clear();
        if (raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
        {
            for (var i = 0; i < hits.Count; i++)
            {
                var plane = planeManager != null ? planeManager.GetPlane(hits[i].trackableId) : null;
                if (plane != null && plane.alignment != PlaneAlignment.HorizontalUp)
                    continue;
                world = hits[i].pose.position;
                return true;
            }

            world = hits[0].pose.position;
            return true;
        }

        // Fallback: estimated floor plane under the camera.
        if (arCamera == null) return false;
        var ray = arCamera.ScreenPointToRay(screenPoint);
        var floorY = EstimateFloorY();
        if (Mathf.Abs(ray.direction.y) < 1e-4f) return false;
        var t = (floorY - ray.origin.y) / ray.direction.y;
        if (t < 0.2f || t > 12f) return false;
        world = ray.GetPoint(t);
        return true;
    }

    float EstimateFloorY()
    {
        if (corners.Count > 0) return corners[0].y;
        if (planeManager != null)
        {
            var best = float.PositiveInfinity;
            foreach (var plane in planeManager.trackables)
            {
                if (plane == null || plane.alignment != PlaneAlignment.HorizontalUp) continue;
                best = Mathf.Min(best, plane.transform.position.y);
            }

            if (!float.IsPositiveInfinity(best)) return best;
        }

        return arCamera != null ? arCamera.transform.position.y - 1.4f : 0f;
    }

    float FindFloorY(Vector3 point)
    {
        if (corners.Count > 0) return corners[0].y;
        return EstimateFloorY();
    }

    static Vector3 Flat(Vector3 v) => new(v.x, 0f, v.z);

    LineRenderer CreateLine(string name, float width, bool loop)
    {
        var go = new GameObject(name);
        go.transform.SetParent(root, false);
        var line = go.AddComponent<LineRenderer>();
        line.sharedMaterial = lineMaterial;
        line.useWorldSpace = true;
        line.loop = loop;
        line.widthMultiplier = 1f;
        line.startWidth = width;
        line.endWidth = width;
        line.numCapVertices = 4;
        line.numCornerVertices = 4;
        line.alignment = LineAlignment.View;
        line.shadowCastingMode = ShadowCastingMode.Off;
        line.receiveShadows = false;
        line.startColor = edgeColor;
        line.endColor = edgeColor;
        line.positionCount = 0;
        return line;
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

    static bool IsPointerOverUI(int touchId)
    {
        if (EventSystem.current == null) return false;
        return EventSystem.current.IsPointerOverGameObject(touchId);
    }
}
