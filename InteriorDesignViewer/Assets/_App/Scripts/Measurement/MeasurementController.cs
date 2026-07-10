using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;

/// <summary>
/// Tap-to-place room measurement on AR floor planes with live preview line.
/// Supports horizontal distance (D = X cm) and vertical height (H = X cm) tools.
/// </summary>
[DefaultExecutionOrder(100)]
public class MeasurementController : MonoBehaviour
{
    public enum MeasurementMode
    {
        Single,
        Chained,
    }

    public enum MeasurementTool
    {
        Distance,
        Height,
    }

    public enum HeightPhase
    {
        Idle,
        AwaitingBase,
        Extruding,
    }

    struct MeasurementSegment
    {
        public GameObject lineObject;
        public GameObject labelObject;
        public float distanceMeters;
    }

    struct HeightSegment
    {
        public GameObject lineObject;
        public GameObject labelObject;
        public float heightMeters;
    }

    [Header("AR")]
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private Camera arCamera;
    [SerializeField] private MeasurementScanController scanController;

    [Header("Prefabs")]
    [SerializeField] private GameObject pointMarkerPrefab;
    [SerializeField] private GameObject linePrefab;
    [SerializeField] private GameObject labelPrefab;

    [Header("Hierarchy")]
    [SerializeField] private Transform measurementRoot;

    [Header("Line appearance")]
    [SerializeField] private Color lineColor = new(0.478f, 0.561f, 0.482f, 1f);      // accent #7A8F7B Muted Sage
    [SerializeField] private Color previewLineColor = new(1f, 1f, 1f, 0.95f);          // white preview
    [SerializeField] private Color pointColor = new(0.843f, 0.698f, 0.416f, 1f);      // warning #D7B26A Soft Gold
    [SerializeField] private float lineWidth = 0.02f;
    [SerializeField] private float previewLineWidth = 0.015f;
    [SerializeField] private float pointScale = 0.06f;
    [Tooltip("Lifts lines and markers slightly above the floor to avoid z-fighting.")]
    [SerializeField] private float floorVisualInset = 0.015f;
    [SerializeField] private Material lineMaterialOverride;
    [SerializeField] private Material pointMaterialOverride;

    [Header("Height measurement")]
    [SerializeField] private float maxHeightMeters = 6f;

    // ── Distance state ──────────────────────────────────────────────────────
    readonly List<Vector3> placedPoints = new();
    readonly List<GameObject> pointMarkers = new();
    readonly List<MeasurementSegment> segments = new();

    GameObject previewLineObject;
    GameObject previewLabelObject;
    MeasurementLabel previewLabel;

    MeasurementMode mode = MeasurementMode.Single;
    bool awaitingNewPair;
    float lastPreviewStatusDistance = -1f;

    // ── Height state ─────────────────────────────────────────────────────────
    MeasurementTool activeTool = MeasurementTool.Distance;
    HeightPhase heightPhase = HeightPhase.Idle;
    Vector3 heightBasePos;
    GameObject heightBaseMarker;
    GameObject heightPreviewLine;
    GameObject heightPreviewLabelObject;
    MeasurementLabel heightPreviewLabelComponent;
    float liveHeightMeters;
    readonly List<HeightSegment> heightSegments = new();

    // ── Public properties ────────────────────────────────────────────────────
    public MeasurementMode Mode => mode;
    public MeasurementTool ActiveTool => activeTool;
    public HeightPhase CurrentHeightPhase => heightPhase;
    public float TotalDistanceMeters { get; private set; }
    public float LivePreviewDistanceMeters { get; private set; }
    public float LiveHeightMeters => liveHeightMeters;
    public int PointCount => placedPoints.Count;
    public bool IsLivePreviewActive { get; private set; }
    public bool IsHeightExtruding => activeTool == MeasurementTool.Height && heightPhase == HeightPhase.Extruding;

    // ── Events ────────────────────────────────────────────────────────────────
    public event Action<float> OnTotalDistanceChanged;
    public event Action<float> OnLiveDistanceChanged;
    public event Action<int> OnPointCountChanged;
    public event Action<string> OnStatusChanged;
    public event Action<float> OnLiveHeightChanged;
    public event Action<MeasurementTool> OnToolChanged;
    public event Action<HeightPhase> OnHeightPhaseChanged;

    Transform Root => measurementRoot != null ? measurementRoot : transform;

    void Awake()
    {
        if (scanController == null)
            scanController = FindFirstObjectByType<MeasurementScanController>();

        if (placementIndicator == null)
            placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();

        if (arCamera == null)
            arCamera = Camera.main;
    }

    void OnEnable()
    {
        if (scanController != null)
            scanController.OnPhaseChanged += HandleScanPhaseChanged;

        TryStartIndicatorTracking();
        PublishStatus(scanController != null && !scanController.IsScanComplete
            ? "Move phone to start scanning the floor."
            : GetToolInstructions());
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.OnPhaseChanged -= HandleScanPhaseChanged;

        HideLivePreview();
        HideHeightPreview();
        placementIndicator?.StopTracking();
    }

    void HandleScanPhaseChanged(MeasurementScanController.ScanPhase phase)
    {
        if (phase == MeasurementScanController.ScanPhase.Ready)
            TryStartIndicatorTracking();
    }

    void TryStartIndicatorTracking()
    {
        if (scanController != null && !scanController.IsScanComplete)
        {
            placementIndicator?.StopTracking();
            return;
        }

        placementIndicator?.StartTracking();
    }

    void Update()
    {
        if (activeTool == MeasurementTool.Distance)
        {
            UpdateLivePreview();

            if (!TryConsumeTap(out _))
                return;

            if (scanController != null && !scanController.IsScanComplete)
                return;

            if (placementIndicator == null || !placementIndicator.IsLockedOnFloor)
            {
                PublishStatus("Point the reticle at the floor before tapping.");
                return;
            }

            PlacePoint(placementIndicator.CurrentPose.position);
        }
        else
        {
            UpdateHeightExtrude();
            HandleHeightTap();
        }
    }

    // ── Tool switching ────────────────────────────────────────────────────────

    public void SetTool(MeasurementTool newTool)
    {
        if (activeTool == newTool)
            return;

        activeTool = newTool;
        ClearAll();

        if (newTool == MeasurementTool.Height)
        {
            heightPhase = HeightPhase.AwaitingBase;
            SetHeightPhase(HeightPhase.AwaitingBase);
            TryStartIndicatorTracking();
        }
        else
        {
            SetHeightPhase(HeightPhase.Idle);
            TryStartIndicatorTracking();
        }

        OnToolChanged?.Invoke(activeTool);
        PublishStatus(GetToolInstructions());
    }

    string GetToolInstructions()
    {
        if (activeTool == MeasurementTool.Height)
            return heightPhase == HeightPhase.AwaitingBase
                ? "Point at the floor, then tap to set the base."
                : "Move aim Up to extrude Height.";

        return mode == MeasurementMode.Chained
            ? "Chained mode — tap corners to measure a perimeter."
            : "Single mode — tap two points per measurement.";
    }

    // ── Distance mode ─────────────────────────────────────────────────────────

    public void SetMode(MeasurementMode newMode)
    {
        if (mode == newMode)
            return;

        mode = newMode;
        ClearAll();
        PublishStatus(mode == MeasurementMode.Chained
            ? "Chained mode — tap corners to measure a perimeter."
            : "Single mode — tap two points per measurement.");
    }

    public void ClearAll()
    {
        // Distance
        foreach (var marker in pointMarkers)
            if (marker != null) Destroy(marker);
        foreach (var segment in segments)
        {
            if (segment.lineObject != null) Destroy(segment.lineObject);
            if (segment.labelObject != null) Destroy(segment.labelObject);
        }
        placedPoints.Clear();
        pointMarkers.Clear();
        segments.Clear();
        awaitingNewPair = false;
        HideLivePreview();
        SetTotalDistance(0f);

        // Height
        ClearHeightVisuals();
        heightSegments.Clear();
        liveHeightMeters = 0f;
        OnLiveHeightChanged?.Invoke(0f);

        if (activeTool == MeasurementTool.Height)
        {
            SetHeightPhase(HeightPhase.AwaitingBase);
            TryStartIndicatorTracking();
        }

        PublishStatus("Cleared. " + GetToolInstructions());
    }

    public void UndoLastPoint()
    {
        if (activeTool == MeasurementTool.Height)
        {
            UndoLastHeight();
            return;
        }

        if (placedPoints.Count == 0)
            return;

        var lastMarker = pointMarkers[pointMarkers.Count - 1];
        if (lastMarker != null) Destroy(lastMarker);

        placedPoints.RemoveAt(placedPoints.Count - 1);
        pointMarkers.RemoveAt(pointMarkers.Count - 1);

        if (segments.Count > 0)
        {
            var lastSegment = segments[segments.Count - 1];
            if (lastSegment.lineObject != null) Destroy(lastSegment.lineObject);
            if (lastSegment.labelObject != null) Destroy(lastSegment.labelObject);
            SetTotalDistance(Mathf.Max(0f, TotalDistanceMeters - lastSegment.distanceMeters));
            segments.RemoveAt(segments.Count - 1);
        }

        if (mode == MeasurementMode.Single)
            awaitingNewPair = false;

        OnPointCountChanged?.Invoke(placedPoints.Count);
        PublishStatus(placedPoints.Count == 0
            ? "Point removed. Tap to place the first point."
            : "Last point removed.");
    }

    void PlacePoint(Vector3 worldPosition)
    {
        HideLivePreview();

        if (mode == MeasurementMode.Single && awaitingNewPair)
            ClearAll();

        SpawnMarker(worldPosition);
        placedPoints.Add(worldPosition);
        OnPointCountChanged?.Invoke(placedPoints.Count);

        if (placedPoints.Count < 2)
        {
            PublishStatus("Move to the second point — distance updates live.");
            return;
        }

        var start = placedPoints[placedPoints.Count - 2];
        var end = placedPoints[placedPoints.Count - 1];
        var distance = Vector3.Distance(start, end);
        CreateDistanceSegment(start, end, distance, finalized: true);
        SetTotalDistance(TotalDistanceMeters + distance);

        if (mode == MeasurementMode.Single)
        {
            awaitingNewPair = true;
            PublishStatus($"Segment: {FormatLive(distance)}. Tap again to start a new measurement.");
        }
        else
        {
            PublishStatus($"Segment: {FormatLive(distance)}. Total: {FormatMeters(TotalDistanceMeters)}. Tap next corner.");
        }
    }

    void UpdateLivePreview()
    {
        if (!ShouldShowLivePreview())
        {
            HideLivePreview();
            return;
        }

        var start = placedPoints[placedPoints.Count - 1];
        var end = placementIndicator.CurrentPose.position;
        var distance = Vector3.Distance(start, end);

        EnsureDistancePreviewObjects();
        MeasurementVisualUtility.ConfigureLine(
            previewLineObject.GetComponent<LineRenderer>(),
            start,
            end,
            previewLineColor,
            previewLineWidth,
            floorVisualInset,
            lineMaterialOverride);

        var midpoint = (start + end) * 0.5f + Vector3.up * (floorVisualInset + 0.04f);
        previewLabelObject.transform.position = midpoint;
        previewLabel.SetText(FormatLive(distance));

        IsLivePreviewActive = true;
        LivePreviewDistanceMeters = distance;
        OnLiveDistanceChanged?.Invoke(distance);

        if (!Mathf.Approximately(distance, lastPreviewStatusDistance))
        {
            lastPreviewStatusDistance = distance;
            PublishStatus("Move to set the next point — tap to confirm.");
        }
    }

    bool ShouldShowLivePreview()
    {
        if (scanController != null && !scanController.IsScanComplete) return false;
        if (placementIndicator == null || !placementIndicator.IsLockedOnFloor) return false;
        if (placedPoints.Count == 0) return false;
        if (mode == MeasurementMode.Single && awaitingNewPair) return false;
        return true;
    }

    void EnsureDistancePreviewObjects()
    {
        if (previewLineObject != null) return;

        previewLineObject = linePrefab != null
            ? Instantiate(linePrefab, Root)
            : CreateLineGo("MeasurementPreviewLine");

        if (labelPrefab != null)
        {
            previewLabelObject = Instantiate(labelPrefab, Root);
            previewLabel = previewLabelObject.GetComponent<MeasurementLabel>();
        }
        else
        {
            previewLabelObject = new GameObject("MeasurementPreviewLabel");
            previewLabelObject.transform.SetParent(Root, false);
            previewLabel = previewLabelObject.AddComponent<MeasurementLabel>();
        }
    }

    void HideLivePreview()
    {
        IsLivePreviewActive = false;
        LivePreviewDistanceMeters = 0f;
        lastPreviewStatusDistance = -1f;
        OnLiveDistanceChanged?.Invoke(0f);

        if (previewLineObject != null) { Destroy(previewLineObject); previewLineObject = null; }
        if (previewLabelObject != null) { Destroy(previewLabelObject); previewLabelObject = null; previewLabel = null; }
    }

    // ── Height mode ───────────────────────────────────────────────────────────

    void SetHeightPhase(HeightPhase phase)
    {
        heightPhase = phase;
        OnHeightPhaseChanged?.Invoke(heightPhase);
    }

    void HandleHeightTap()
    {
        if (heightPhase != HeightPhase.AwaitingBase)
            return;

        if (!TryConsumeTap(out _))
            return;

        if (scanController != null && !scanController.IsScanComplete)
            return;

        if (placementIndicator == null || !placementIndicator.IsLockedOnFloor)
        {
            PublishStatus("Point the reticle at the floor before tapping.");
            return;
        }

        // Lock base point
        heightBasePos = placementIndicator.CurrentPose.position;
        SpawnHeightBaseMarker(heightBasePos);
        placementIndicator.StopTracking();

        SetHeightPhase(HeightPhase.Extruding);
        PublishStatus("Move aim Up to extrude Height.");
    }

    void UpdateHeightExtrude()
    {
        if (heightPhase != HeightPhase.Extruding)
            return;

        if (arCamera == null)
            return;

        // Vertical plane through base, facing camera (billboard on XZ)
        var flatForward = Vector3.ProjectOnPlane(arCamera.transform.forward, Vector3.up);
        if (flatForward.sqrMagnitude < 0.0001f)
            flatForward = arCamera.transform.forward;
        flatForward.Normalize();

        var verticalPlane = new Plane(flatForward, heightBasePos);
        var screenCenter = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
        var ray = arCamera.ScreenPointToRay(screenCenter);

        if (!verticalPlane.Raycast(ray, out float enter))
            return; // keep last height

        var aimPoint = ray.GetPoint(enter);
        float heightMeters = Mathf.Clamp(aimPoint.y - heightBasePos.y, 0f, maxHeightMeters);
        liveHeightMeters = heightMeters;

        var topPos = heightBasePos + Vector3.up * heightMeters;

        // Ensure preview objects exist
        EnsureHeightPreviewObjects();

        // Update vertical line: base → top (no floor inset for vertical line)
        MeasurementVisualUtility.ConfigureVerticalLine(
            heightPreviewLine.GetComponent<LineRenderer>(),
            heightBasePos,
            topPos,
            previewLineColor,
            previewLineWidth,
            lineMaterialOverride);

        // Update world label at top
        heightPreviewLabelObject.transform.position = topPos + Vector3.up * 0.04f;
        heightPreviewLabelComponent.SetText(FormatHeightLive(heightMeters));

        OnLiveHeightChanged?.Invoke(heightMeters);
    }

    void EnsureHeightPreviewObjects()
    {
        if (heightPreviewLine == null)
        {
            heightPreviewLine = linePrefab != null
                ? Instantiate(linePrefab, Root)
                : CreateLineGo("HeightPreviewLine");
        }

        if (heightPreviewLabelObject == null)
        {
            if (labelPrefab != null)
            {
                heightPreviewLabelObject = Instantiate(labelPrefab, Root);
                heightPreviewLabelComponent = heightPreviewLabelObject.GetComponent<MeasurementLabel>();
            }
            else
            {
                heightPreviewLabelObject = new GameObject("HeightPreviewLabel");
                heightPreviewLabelObject.transform.SetParent(Root, false);
                heightPreviewLabelComponent = heightPreviewLabelObject.AddComponent<MeasurementLabel>();
            }
        }
    }

    void SpawnHeightBaseMarker(Vector3 worldPosition)
    {
        if (heightBaseMarker != null) Destroy(heightBaseMarker);

        var pos = worldPosition + Vector3.up * floorVisualInset;
        if (pointMarkerPrefab != null)
        {
            heightBaseMarker = Instantiate(pointMarkerPrefab, pos, Quaternion.identity, Root);
            heightBaseMarker.transform.localScale = Vector3.one * pointScale;
        }
        else
        {
            heightBaseMarker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            heightBaseMarker.name = "HeightBasePoint";
            heightBaseMarker.transform.SetParent(Root, false);
            heightBaseMarker.transform.position = pos;
            heightBaseMarker.transform.localScale = Vector3.one * pointScale;
            var col = heightBaseMarker.GetComponent<Collider>();
            if (col != null) Destroy(col);
        }

        MeasurementVisualUtility.ConfigurePoint(
            heightBaseMarker.GetComponentInChildren<Renderer>(),
            pointColor,
            pointMaterialOverride);
    }

    public void FinishHeightMeasurement()
    {
        if (heightPhase != HeightPhase.Extruding)
            return;

        // Destroy live preview objects (we'll create permanent ones)
        HideHeightPreview();

        var topPos = heightBasePos + Vector3.up * liveHeightMeters;

        // Permanent vertical line
        var lineGo = linePrefab != null
            ? Instantiate(linePrefab, Root)
            : CreateLineGo("HeightLine");

        MeasurementVisualUtility.ConfigureVerticalLine(
            lineGo.GetComponent<LineRenderer>(),
            heightBasePos,
            topPos,
            lineColor,
            lineWidth,
            lineMaterialOverride);

        // Permanent label
        GameObject labelGo = null;
        if (labelPrefab != null)
        {
            labelGo = Instantiate(labelPrefab, topPos + Vector3.up * 0.04f, Quaternion.identity, Root);
            var lbl = labelGo.GetComponent<MeasurementLabel>();
            if (lbl != null) lbl.SetText(FormatHeightLive(liveHeightMeters));
        }

        heightSegments.Add(new HeightSegment
        {
            lineObject = lineGo,
            labelObject = labelGo,
            heightMeters = liveHeightMeters,
        });

        // Transition back to AwaitingBase
        SetHeightPhase(HeightPhase.AwaitingBase);
        liveHeightMeters = 0f;
        OnLiveHeightChanged?.Invoke(0f);
        TryStartIndicatorTracking();
        PublishStatus("Height locked. Point at the floor and tap to measure another height.");
    }

    public void UndoLastHeight()
    {
        // Cancel mid-extrude first
        if (heightPhase == HeightPhase.Extruding)
        {
            HideHeightPreview();
            if (heightBaseMarker != null) { Destroy(heightBaseMarker); heightBaseMarker = null; }
            SetHeightPhase(HeightPhase.AwaitingBase);
            liveHeightMeters = 0f;
            OnLiveHeightChanged?.Invoke(0f);
            TryStartIndicatorTracking();
            PublishStatus("Cancelled. Point at the floor and tap to set a new base.");
            return;
        }

        if (heightSegments.Count == 0)
            return;

        var last = heightSegments[heightSegments.Count - 1];
        if (last.lineObject != null) Destroy(last.lineObject);
        if (last.labelObject != null) Destroy(last.labelObject);
        heightSegments.RemoveAt(heightSegments.Count - 1);
        PublishStatus("Last height removed.");
    }

    void ClearHeightVisuals()
    {
        HideHeightPreview();
        if (heightBaseMarker != null) { Destroy(heightBaseMarker); heightBaseMarker = null; }
        foreach (var seg in heightSegments)
        {
            if (seg.lineObject != null) Destroy(seg.lineObject);
            if (seg.labelObject != null) Destroy(seg.labelObject);
        }
    }

    void HideHeightPreview()
    {
        if (heightPreviewLine != null) { Destroy(heightPreviewLine); heightPreviewLine = null; }
        if (heightPreviewLabelObject != null)
        {
            Destroy(heightPreviewLabelObject);
            heightPreviewLabelObject = null;
            heightPreviewLabelComponent = null;
        }
    }

    // ── Shared helpers ────────────────────────────────────────────────────────

    void SpawnMarker(Vector3 worldPosition)
    {
        var markerPosition = worldPosition + Vector3.up * floorVisualInset;

        GameObject marker;
        if (pointMarkerPrefab != null)
        {
            marker = Instantiate(pointMarkerPrefab, markerPosition, Quaternion.identity, Root);
            marker.transform.localScale = Vector3.one * pointScale;
        }
        else
        {
            marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = "MeasurementPoint";
            marker.transform.SetParent(Root, false);
            marker.transform.position = markerPosition;
            marker.transform.localScale = Vector3.one * pointScale;
            var collider = marker.GetComponent<Collider>();
            if (collider != null) Destroy(collider);
        }

        MeasurementVisualUtility.ConfigurePoint(
            marker.GetComponentInChildren<Renderer>(),
            pointColor,
            pointMaterialOverride);

        pointMarkers.Add(marker);
    }

    void CreateDistanceSegment(Vector3 start, Vector3 end, float distanceMeters, bool finalized)
    {
        var lineObject = linePrefab != null
            ? Instantiate(linePrefab, Root)
            : CreateLineGo("MeasurementLine");

        MeasurementVisualUtility.ConfigureLine(
            lineObject.GetComponent<LineRenderer>(),
            start,
            end,
            finalized ? lineColor : previewLineColor,
            finalized ? lineWidth : previewLineWidth,
            floorVisualInset,
            lineMaterialOverride);

        GameObject labelObject = null;
        if (labelPrefab != null)
        {
            var midpoint = (start + end) * 0.5f + Vector3.up * (floorVisualInset + 0.04f);
            labelObject = Instantiate(labelPrefab, midpoint, Quaternion.identity, Root);
            var label = labelObject.GetComponent<MeasurementLabel>();
            if (label != null) label.SetText(FormatLive(distanceMeters));
        }

        segments.Add(new MeasurementSegment
        {
            lineObject = lineObject,
            labelObject = labelObject,
            distanceMeters = distanceMeters,
        });
    }

    GameObject CreateLineGo(string goName)
    {
        var go = new GameObject(goName);
        go.transform.SetParent(Root, false);
        go.AddComponent<LineRenderer>();
        return go;
    }

    void SetTotalDistance(float value)
    {
        TotalDistanceMeters = value;
        OnTotalDistanceChanged?.Invoke(TotalDistanceMeters);
    }

    void PublishStatus(string message)
    {
        OnStatusChanged?.Invoke(message);
    }

    static bool TryConsumeTap(out Vector2 screenPosition)
    {
        screenPosition = default;

        if (Touchscreen.current == null)
            return false;

        var touch = Touchscreen.current.primaryTouch;
        if (!touch.press.wasPressedThisFrame)
            return false;

        screenPosition = touch.position.ReadValue();
        var touchId = touch.touchId.ReadValue();

        if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject(touchId))
            return false;

        return true;
    }

    // ── Format helpers ────────────────────────────────────────────────────────

    public static string FormatMeters(float meters)
    {
        if (meters >= 1f)
            return $"{meters:F2} m";
        return $"{meters * 100f:F1} cm";
    }

    public static string FormatLive(float meters)
    {
        if (meters >= 1f)
            return $"D = {meters:F2} m";
        return $"D = {meters * 100f:F0} cm";
    }

    public static string FormatHeightLive(float meters)
    {
        if (meters >= 1f)
            return $"H = {meters:F2} m";
        return $"H = {meters * 100f:F0} cm";
    }
}
