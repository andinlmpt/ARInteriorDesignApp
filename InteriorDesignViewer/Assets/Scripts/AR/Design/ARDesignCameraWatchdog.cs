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

    float nextCheck;
    float aliveSince;

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

    void OnApplicationPause(bool paused)
    {
        if (!paused)
        {
            aliveSince = Time.unscaledTime;
            nextCheck = Time.unscaledTime + checkInterval;
        }
    }
}
