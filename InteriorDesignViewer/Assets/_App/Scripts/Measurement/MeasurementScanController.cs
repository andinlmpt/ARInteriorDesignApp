using System;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Floor scanning phase before the placement indicator is shown.
/// Mirrors ARFurniturePlacer scan criteria without modifying shared AR scripts.
/// </summary>
[DefaultExecutionOrder(50)]
public class MeasurementScanController : MonoBehaviour
{
    public enum ScanPhase { Scanning, Ready }

    [Header("AR")]
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private Camera arCamera;
    [SerializeField] private ARPlacementIndicator placementIndicator;

    [Header("Scan criteria")]
    [SerializeField] private float minDepthBelowCamera = 0.35f;
    [SerializeField] private float scanMinArea = 0.15f;
    [SerializeField] private float scanRequiredDuration = 1f;
    [SerializeField] private float scanMinAreaGrowth = 0.15f;

    ARPlane scanTrackedPlane;
    float scanTrackedSince;
    float scanTrackedStartArea;

    public ScanPhase Phase { get; private set; } = ScanPhase.Scanning;
    public float ScanProgress { get; private set; }
    public bool IsScanComplete => Phase == ScanPhase.Ready;

    public event Action<ScanPhase> OnPhaseChanged;
    public event Action<float> OnProgressChanged;
    public event Action<string> OnHintChanged;

    void Awake()
    {
        if (planeManager == null)
            planeManager = FindFirstObjectByType<ARPlaneManager>();

        if (arCamera == null)
            arCamera = Camera.main;

        if (placementIndicator == null)
            placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();
    }

    void OnEnable()
    {
        Phase = ScanPhase.Scanning;
        ScanProgress = 0f;
        ResetScanTracking();
        placementIndicator?.StopTracking();
        PublishHint(GetScanHint(0f));
        OnPhaseChanged?.Invoke(Phase);
        OnProgressChanged?.Invoke(ScanProgress);
    }

    void Update()
    {
        if (Phase == ScanPhase.Ready)
            return;

        UpdateScanning();
    }

    void UpdateScanning()
    {
        if (planeManager == null)
            return;

        placementIndicator?.StopTracking();

        var cameraY = arCamera != null ? arCamera.transform.position.y : float.PositiveInfinity;
        ARPlane best = null;
        var bestY = float.PositiveInfinity;

        foreach (var plane in planeManager.trackables)
        {
            if (plane.alignment != PlaneAlignment.HorizontalUp)
                continue;
            if (plane.trackingState != TrackingState.Tracking)
                continue;

            var planeY = plane.transform.position.y;
            if (planeY > cameraY - minDepthBelowCamera)
                continue;

            if (planeY < bestY)
            {
                bestY = planeY;
                best = plane;
            }
        }

        if (best == null)
        {
            if (scanTrackedPlane != null)
                ResetScanTracking();

            SetProgress(0f);
            PublishHint(GetScanHint(0f));
            return;
        }

        if (best != scanTrackedPlane)
        {
            scanTrackedPlane = best;
            scanTrackedSince = Time.time;
            scanTrackedStartArea = best.size.x * best.size.y;
        }

        var elapsed = Time.time - scanTrackedSince;
        var currentArea = best.size.x * best.size.y;
        var areaGrowth = currentArea - scanTrackedStartArea;

        var timeProgress = Mathf.Clamp01(elapsed / scanRequiredDuration);
        var growthProgress = scanMinAreaGrowth > 0f
            ? Mathf.Clamp01(areaGrowth / scanMinAreaGrowth)
            : 1f;

        SetProgress(Mathf.Min(timeProgress, growthProgress));
        PublishHint(GetScanHint(ScanProgress));

        if (currentArea >= scanMinArea && elapsed >= scanRequiredDuration)
            CompleteScan();
    }

    void CompleteScan()
    {
        Phase = ScanPhase.Ready;
        placementIndicator?.StartTracking();
        PublishHint("Floor ready — tap to place the first point.");
        OnPhaseChanged?.Invoke(Phase);
    }

    void ResetScanTracking()
    {
        scanTrackedPlane = null;
        scanTrackedSince = 0f;
        scanTrackedStartArea = 0f;
    }

    void SetProgress(float value)
    {
        if (Mathf.Approximately(ScanProgress, value))
            return;

        ScanProgress = value;
        OnProgressChanged?.Invoke(ScanProgress);
    }

    void PublishHint(string hint)
    {
        OnHintChanged?.Invoke(hint);
    }

    static string GetScanHint(float progress)
    {
        if (progress <= 0.01f)
            return "Move phone to start";

        if (progress < 1f)
            return "Continue to move the camera to include larger area to the recognized plane";

        return "Floor ready — tap to place the first point.";
    }
}
