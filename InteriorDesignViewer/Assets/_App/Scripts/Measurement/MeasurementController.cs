using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;

/// <summary>
/// Tap-to-place room measurement on AR floor planes with live preview line.
/// </summary>
[DefaultExecutionOrder(100)]
public class MeasurementController : MonoBehaviour
{
    public enum MeasurementMode
    {
        Single,
        Chained,
    }

    struct MeasurementSegment
    {
        public GameObject lineObject;
        public GameObject labelObject;
        public float distanceMeters;
    }

    [Header("AR")]
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private MeasurementScanController scanController;

    [Header("Prefabs")]
    [SerializeField] private GameObject pointMarkerPrefab;
    [SerializeField] private GameObject linePrefab;
    [SerializeField] private GameObject labelPrefab;

    [Header("Hierarchy")]
    [SerializeField] private Transform measurementRoot;

    [Header("Line appearance")]
    [SerializeField] private Color lineColor = new(0.12f, 0.75f, 1f, 1f);
    [SerializeField] private Color previewLineColor = new(1f, 1f, 1f, 0.95f);
    [SerializeField] private Color pointColor = new(1f, 0.85f, 0.15f, 1f);
    [SerializeField] private float lineWidth = 0.02f;
    [SerializeField] private float previewLineWidth = 0.015f;
    [SerializeField] private float pointScale = 0.06f;
    [Tooltip("Lifts lines and markers slightly above the floor to avoid z-fighting.")]
    [SerializeField] private float floorVisualInset = 0.015f;
    [SerializeField] private Material lineMaterialOverride;
    [SerializeField] private Material pointMaterialOverride;

    readonly List<Vector3> placedPoints = new();
    readonly List<GameObject> pointMarkers = new();
    readonly List<MeasurementSegment> segments = new();

    GameObject previewLineObject;
    GameObject previewLabelObject;
    MeasurementLabel previewLabel;

    MeasurementMode mode = MeasurementMode.Single;
    bool awaitingNewPair;
    float lastPreviewStatusDistance = -1f;

    public MeasurementMode Mode => mode;
    public float TotalDistanceMeters { get; private set; }
    public float LivePreviewDistanceMeters { get; private set; }
    public int PointCount => placedPoints.Count;
    public bool IsLivePreviewActive { get; private set; }

    public event Action<float> OnTotalDistanceChanged;
    public event Action<float> OnLiveDistanceChanged;
    public event Action<int> OnPointCountChanged;
    public event Action<string> OnStatusChanged;

    Transform Root => measurementRoot != null ? measurementRoot : transform;

    void Awake()
    {
        if (scanController == null)
            scanController = FindFirstObjectByType<MeasurementScanController>();

        if (placementIndicator == null)
            placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();
    }

    void OnEnable()
    {
        if (scanController != null)
            scanController.OnPhaseChanged += HandleScanPhaseChanged;

        TryStartIndicatorTracking();
        PublishStatus(scanController != null && !scanController.IsScanComplete
            ? "Move phone to start scanning the floor."
            : "Point at the floor, then tap to place the first point.");
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.OnPhaseChanged -= HandleScanPhaseChanged;

        HideLivePreview();
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
        foreach (var marker in pointMarkers)
        {
            if (marker != null)
                Destroy(marker);
        }

        foreach (var segment in segments)
        {
            if (segment.lineObject != null)
                Destroy(segment.lineObject);
            if (segment.labelObject != null)
                Destroy(segment.labelObject);
        }

        placedPoints.Clear();
        pointMarkers.Clear();
        segments.Clear();
        awaitingNewPair = false;
        HideLivePreview();
        SetTotalDistance(0f);
        PublishStatus("Cleared. Tap to place a new point.");
    }

    public void UndoLastPoint()
    {
        if (placedPoints.Count == 0)
            return;

        var lastMarker = pointMarkers[pointMarkers.Count - 1];
        if (lastMarker != null)
            Destroy(lastMarker);

        placedPoints.RemoveAt(placedPoints.Count - 1);
        pointMarkers.RemoveAt(pointMarkers.Count - 1);

        if (segments.Count > 0)
        {
            var lastSegment = segments[segments.Count - 1];
            if (lastSegment.lineObject != null)
                Destroy(lastSegment.lineObject);
            if (lastSegment.labelObject != null)
                Destroy(lastSegment.labelObject);

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
        CreateSegment(start, end, distance, finalized: true);
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

        EnsurePreviewObjects();
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
        if (scanController != null && !scanController.IsScanComplete)
            return false;

        if (placementIndicator == null || !placementIndicator.IsLockedOnFloor)
            return false;

        if (placedPoints.Count == 0)
            return false;

        if (mode == MeasurementMode.Single && awaitingNewPair)
            return false;

        return true;
    }

    void EnsurePreviewObjects()
    {
        if (previewLineObject != null)
            return;

        if (linePrefab != null)
            previewLineObject = Instantiate(linePrefab, Root);
        else
        {
            previewLineObject = new GameObject("MeasurementPreviewLine");
            previewLineObject.transform.SetParent(Root, false);
            previewLineObject.AddComponent<LineRenderer>();
        }

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

        if (previewLineObject != null)
        {
            Destroy(previewLineObject);
            previewLineObject = null;
        }

        if (previewLabelObject != null)
        {
            Destroy(previewLabelObject);
            previewLabelObject = null;
            previewLabel = null;
        }
    }

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
            if (collider != null)
                Destroy(collider);
        }

        MeasurementVisualUtility.ConfigurePoint(
            marker.GetComponentInChildren<Renderer>(),
            pointColor,
            pointMaterialOverride);

        pointMarkers.Add(marker);
    }

    void CreateSegment(Vector3 start, Vector3 end, float distanceMeters, bool finalized)
    {
        GameObject lineObject;
        if (linePrefab != null)
            lineObject = Instantiate(linePrefab, Root);
        else
        {
            lineObject = new GameObject("MeasurementLine");
            lineObject.transform.SetParent(Root, false);
            lineObject.AddComponent<LineRenderer>();
        }

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
            if (label != null)
                label.SetText(FormatLive(distanceMeters));
        }

        segments.Add(new MeasurementSegment
        {
            lineObject = lineObject,
            labelObject = labelObject,
            distanceMeters = distanceMeters,
        });
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
}
