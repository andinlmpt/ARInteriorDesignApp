using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Watches for a black / non-tracking AR camera after launch or resume and asks
/// <see cref="ARBootstrap"/> to recover. Also exposes a "Retry camera" action
/// for the scan HUD.
/// </summary>
[DefaultExecutionOrder(-950)]
public class ARDesignCameraWatchdog : MonoBehaviour
{
    [SerializeField] private ARBootstrap bootstrap;
    [SerializeField] private ARSession arSession;
    [SerializeField] private ARCameraBackground cameraBackground;
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARDesignLayoutModeController layoutMode;
    [SerializeField] private float checkInterval = 1.25f;
    [SerializeField] private float gracePeriod = 3f;
    [Tooltip("Seconds the camera may be unavailable (taken by the phone's flashlight, another app) before the session is restarted.")]
    [SerializeField] private float cameraUnavailableRecoverAfter = 2f;
    [SerializeField] private float cameraRetryInterval = 3f;

    float nextCheck;
    float aliveSince;
    float cameraUnavailableSince = -1f;
    float nextCameraRetry;

    void Awake()
    {
        if (bootstrap == null) bootstrap = FindFirstObjectByType<ARBootstrap>();
        if (arSession == null) arSession = FindFirstObjectByType<ARSession>();
        if (cameraBackground == null) cameraBackground = FindFirstObjectByType<ARCameraBackground>();
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (layoutMode == null) layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();
        aliveSince = Time.unscaledTime;
    }

    void Update()
    {
        // Orbit planner owns the camera — never force AR resume there.
        // Real-room mode keeps the live feed and still needs recovery.
        if (layoutMode != null && layoutMode.IsPlannerOrbitActive) return;

        if (Time.unscaledTime < aliveSince + gracePeriod) return;
        if (TickCameraUnavailable()) return;
        if (Time.unscaledTime < nextCheck) return;
        nextCheck = Time.unscaledTime + checkInterval;

        if (ARSession.state == ARSessionState.SessionInitializing) return;

        // Tracking with a disabled background still looks like a black screen.
        if (ARSession.state == ARSessionState.SessionTracking)
        {
            if (cameraBackground == null || cameraBackground.enabled) return;
            Debug.LogWarning("[ARDesignCameraWatchdog] Camera is tracking but background is off — recovering.");
            bootstrap?.ResumeCamera();
            return;
        }

        // Stuck without frames — nudge the session.
        if (ARSession.state == ARSessionState.None ||
            ARSession.state == ARSessionState.Ready ||
            ARSession.state == ARSessionState.CheckingAvailability)
        {
            Debug.LogWarning($"[ARDesignCameraWatchdog] Recovering from state={ARSession.state}");
            bootstrap?.ResumeCamera();
        }
    }

    /// <summary>
    /// While ARCore reports the camera as unavailable (the phone's flashlight or another app holds
    /// it), keep trying to get it back every few seconds instead of leaving the view frozen.
    /// </summary>
    bool TickCameraUnavailable()
    {
        if (ARSession.notTrackingReason != UnityEngine.XR.ARSubsystems.NotTrackingReason.CameraUnavailable)
        {
            cameraUnavailableSince = -1f;
            return false;
        }

        var now = Time.unscaledTime;
        if (cameraUnavailableSince < 0f) cameraUnavailableSince = now;
        if (now - cameraUnavailableSince >= cameraUnavailableRecoverAfter && now >= nextCameraRetry)
        {
            nextCameraRetry = now + cameraRetryInterval;
            bootstrap?.ReacquireCamera();
        }

        return true;
    }

    void OnApplicationPause(bool paused)
    {
        if (!paused)
        {
            aliveSince = Time.unscaledTime;
            nextCheck = Time.unscaledTime + checkInterval;
        }
    }
}
