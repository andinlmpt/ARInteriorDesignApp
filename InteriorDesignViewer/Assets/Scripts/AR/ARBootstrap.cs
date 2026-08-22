using System.Collections;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
#if UNITY_ANDROID
using UnityEngine.Android;
#endif

/// <summary>
/// Requests camera permission, starts the AR session, and recovers the camera
/// feed when the app is backgrounded / reopened (common Xiaomi / Android issue
/// where ARCore stays alive but the camera texture stays black).
/// </summary>
[DefaultExecutionOrder(-1000)]
public class ARBootstrap : MonoBehaviour
{
    [SerializeField] private ARSession arSession;
    [SerializeField] private ARCameraManager cameraManager;
    [SerializeField] private ARCameraBackground cameraBackground;

    [Tooltip("Seconds to wait for camera permission before giving up.")]
    [SerializeField] private float permissionTimeoutSeconds = 60f;

    bool starting;
    bool sessionReady;
    RoomScanController scanController;
    ARDesignLayoutModeController layoutMode;

    void Awake()
    {
        if (arSession == null)
            arSession = GetComponent<ARSession>() ?? FindFirstObjectByType<ARSession>();

        if (cameraManager == null)
            cameraManager = FindFirstObjectByType<ARCameraManager>();

        if (cameraBackground == null && cameraManager != null)
            cameraBackground = cameraManager.GetComponent<ARCameraBackground>();

        if (GetComponent<ARDesignCameraWatchdog>() == null)
            gameObject.AddComponent<ARDesignCameraWatchdog>();

        scanController = FindFirstObjectByType<RoomScanController>();
        layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();

#if UNITY_ANDROID && !UNITY_EDITOR
        // Only park the session when we still need to ask for the camera.
        // Disabling it on every cold start — then failing to re-enable — leaves
        // the AR camera at its solid-black clear color after the Unity splash.
        if (arSession != null && !Permission.HasUserAuthorizedPermission(Permission.Camera))
            arSession.enabled = false;
#endif
    }

    /// <summary>
    /// Only the orbit planner owns the camera. Real-room mode must keep the
    /// live AR feed and must NOT call <see cref="ARDesignLayoutModeController.ReapplyPlannerCamera"/>.
    /// </summary>
    bool IsPlannerOrbitActive()
    {
        return layoutMode != null && layoutMode.IsPlannerOrbitActive;
    }

    bool IsRealRoomLayoutActive()
    {
        return layoutMode != null
               && layoutMode.IsLayoutActive
               && !layoutMode.IsPlannerOrbitActive;
    }

    IEnumerator Start()
    {
        yield return EnsureSessionRunning(resetTracking: false);
    }

    void OnApplicationPause(bool paused)
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        if (!paused)
            StartCoroutine(EnsureSessionRunning(resetTracking: false));
#endif
    }

    void OnApplicationFocus(bool hasFocus)
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        if (hasFocus)
            StartCoroutine(EnsureSessionRunning(resetTracking: false));
#endif
    }

    /// <summary>Public entry so ARDesignScene can force a camera recovery.</summary>
    public void ResumeCamera()
    {
        if (!isActiveAndEnabled) return;
        StartCoroutine(EnsureSessionRunning(resetTracking: false));
    }

    IEnumerator EnsureSessionRunning(bool resetTracking)
    {
        if (starting) yield break;
        starting = true;

        try
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            if (!Permission.HasUserAuthorizedPermission(Permission.Camera))
            {
                Permission.RequestUserPermission(Permission.Camera);

                var elapsed = 0f;
                while (!Permission.HasUserAuthorizedPermission(Permission.Camera) &&
                       elapsed < permissionTimeoutSeconds)
                {
                    elapsed += Time.unscaledDeltaTime;
                    yield return null;
                }
            }

            if (!Permission.HasUserAuthorizedPermission(Permission.Camera))
            {
                Debug.LogError("[ARBootstrap] Camera permission not granted — camera will stay black.");
                yield break;
            }
#endif

            if (arSession == null)
            {
                Debug.LogError("[ARBootstrap] No ARSession in the scene.");
                yield break;
            }

            if (cameraManager == null)
                cameraManager = FindFirstObjectByType<ARCameraManager>();
            if (cameraBackground == null && cameraManager != null)
                cameraBackground = cameraManager.GetComponent<ARCameraBackground>();

            // Re-enable after pause / first launch.
            if (!arSession.enabled)
                arSession.enabled = true;

            yield return ARSession.CheckAvailability();

            if (ARSession.state == ARSessionState.NeedsInstall)
                yield return ARSession.Install();

            if (ARSession.state == ARSessionState.Unsupported)
            {
#if UNITY_EDITOR
                Debug.LogWarning(
                    "[ARBootstrap] AR is unsupported in the Editor on this machine. " +
                    "Use File → Build And Run on an ARCore device to test scanning. " +
                    "(Optional: enable XR Simulation for in-Editor AR.)");
#else
                Debug.LogError("[ARBootstrap] AR is unsupported on this device.");
#endif
                yield break;
            }

            // Orbit planner owns the camera — never re-enable passthrough or reset
            // tracking (that would yank the locked orbit view).
            if (IsPlannerOrbitActive())
            {
                layoutMode?.ReapplyPlannerCamera();
                Debug.Log("[ARBootstrap] Planner orbit active — skipped AR camera resume.");
                yield break;
            }

            // Kick the camera pipeline — after resume ARCameraBackground often
            // stops blitting even though the session reports Tracking.
            if (cameraManager != null)
            {
                cameraManager.enabled = false;
                yield return null;
                cameraManager.enabled = true;
            }

            if (cameraBackground != null)
            {
                cameraBackground.enabled = false;
                yield return null;
                cameraBackground.enabled = true;
            }

            // Real-room post-confirm: restore live feed without resetting tracking
            // (a reset would drift already-placed furniture off the real floor).
            if (IsRealRoomLayoutActive())
            {
                layoutMode?.SetViewMode(ARDesignLayoutModeController.ViewMode.RealRoom);
                sessionReady = true;
                Debug.Log("[ARBootstrap] Real-room layout — restored AR camera, skipped session reset.");
                yield break;
            }

            // Cold start: enabling the session is enough. ARSession.Reset() on
            // Xiaomi / ARCore often leaves the camera texture black after splash.
            sessionReady = true;
            if (resetTracking)
                arSession.Reset();

            var wait = 0f;
            while (wait < 2.5f &&
                   ARSession.state != ARSessionState.SessionTracking &&
                   ARSession.state != ARSessionState.SessionInitializing)
            {
                wait += Time.unscaledDeltaTime;
                yield return null;
            }

            if (ARSession.state == ARSessionState.None ||
                ARSession.state == ARSessionState.Ready)
            {
                Debug.LogWarning($"[ARBootstrap] Session stuck in {ARSession.state} — resetting.");
                arSession.Reset();
            }

            Debug.Log($"[ARBootstrap] AR session state={ARSession.state}");
        }
        finally
        {
            starting = false;
        }
    }
}
