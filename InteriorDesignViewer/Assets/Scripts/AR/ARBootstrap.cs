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
    public bool IsStarting => starting;
    public bool CameraPermissionDenied { get; private set; }
    public bool CameraUnsupported { get; private set; }

    void ReportCameraStatus(string state, string message) =>
        GetComponent<ARDesignCameraWatchdog>()?.ReportStatus(state, message);

    /// <summary>
    /// Goes up every time AR tracking is reset (the world frame starts over). Positions saved in
    /// an earlier epoch no longer match the real room.
    /// </summary>
    public static int TrackingEpoch { get; private set; }
    RoomScanController scanController;
    ARDesignLayoutModeController layoutMode;

    /// <summary>
    /// Plain logs go out without a stack trace: on Android each one carried three lines of trace,
    /// which cost the phone a little and filled its log buffer in seconds. Warnings and errors keep theirs.
    /// </summary>
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void TrimLogStackTraces() => Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);

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

    Coroutine scanResetRoutine;

    /// <summary>
    /// A new room scan: forget the planes ARCore has mapped so far. Unity stays loaded between
    /// scans, so without this every earlier scan's floor and wall planes stay tracked, the count
    /// keeps growing and each reopened scan gets slower. The camera feed is kicked the same way as
    /// on resume, so the reset doesn't leave it black.
    /// </summary>
    public IEnumerator PrepareTrackingForNewScan()
    {
        // No layout checks here: a new scan replaces any layout shown before it (planner or real
        // room), so there are no placed pieces to keep. Skipping the reset after a layout view left
        // the old map in place, often skewed by pauses, and the next scan measured a 3.1 m ceiling.
        if (!isActiveAndEnabled || arSession == null) yield break;

        // The first scan after the app starts has no earlier map to clear: resetting there only
        // restarted the camera that had just opened (a cold start reset it twice and it came up
        // "stuck in Ready", 2026-11-11/12).
        if (!anyScanStarted)
        {
            anyScanStarted = true;
            Debug.Log("[ARBootstrap] First scan since the app started — the AR map is new, no reset.");
            while (starting) yield return null;
            yield break;
        }

        if (scanResetRoutine == null)
            scanResetRoutine = StartCoroutine(ResetWhenIdle());
        while (scanResetRoutine != null) yield return null;
    }

    public IEnumerator WaitForTrackingPreparation()
    {
        while (scanResetRoutine != null || starting) yield return null;
    }

    /// <summary>A scan has started since the app launched (static: Unity scenes reload, the AR map doesn't).</summary>
    static bool anyScanStarted;

    IEnumerator ResetWhenIdle()
    {
        // Always defer so the caller can store the coroutine before it finishes.
        yield return null;
        try
        {
            // A resume/focus restart may be running; wait before clearing the map.
            while (starting) yield return null;
            if (Time.unscaledTime - lastResetAt < ResetCooldownSeconds)
            {
                Debug.Log("[ARBootstrap] New scan — tracking was just reset, earlier planes are already gone.");
                yield break;
            }

            Debug.Log("[ARBootstrap] New scan — resetting AR tracking (clears earlier planes).");
            yield return EnsureSessionRunning(resetTracking: true);
            // Let the plane manager consume removals before accepting room points.
            yield return null;
            yield return null;
        }
        finally
        {
            scanResetRoutine = null;
        }
    }

    /// <summary>Resets within this long of each other count as one (each restarts ARCore's camera).</summary>
    const float ResetCooldownSeconds = 3f;
    float lastResetAt = float.NegativeInfinity;

    /// <param name="force">A session still stuck after the wait needs its reset even inside the cooldown.</param>
    void ResetSession(string reason, bool force = false)
    {
        if (!force && Time.unscaledTime - lastResetAt < ResetCooldownSeconds)
        {
            Debug.Log($"[ARBootstrap] Skipped a second reset ({reason}) — one just happened.");
            return;
        }

        lastResetAt = Time.unscaledTime;
        arSession.Reset();
        TrackingEpoch++;
    }

    /// <summary>Public entry so ARDesignScene can force a camera recovery.</summary>
    public void ResumeCamera()
    {
        if (!isActiveAndEnabled) return;
        CameraPermissionDenied = false;
        GetComponent<ARDesignCameraWatchdog>()?.ResetRecovery();
        StartCoroutine(EnsureSessionRunning(resetTracking: false));
    }

    /// <summary>
    /// The camera was taken away (e.g. the phone's own flashlight was switched on): pause and
    /// resume the AR session so ARCore opens the camera again, the same as leaving and
    /// returning to the app. Tracking is not reset.
    /// </summary>
    public void ReacquireCamera()
    {
        if (!isActiveAndEnabled || arSession == null || starting) return;
        StartCoroutine(ReacquireCameraRoutine());
    }

    IEnumerator ReacquireCameraRoutine()
    {
        Debug.LogWarning("[ARBootstrap] Camera unavailable — pausing and resuming the AR session to get it back.");
        arSession.enabled = false;
        yield return null;
        yield return null;
        arSession.enabled = true;
        yield return EnsureSessionRunning(resetTracking: false);
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
                if (CameraPermissionDenied)
                {
                    ReportCameraStatus("permissionDenied", "Allow camera access in Settings to scan rooms or view furniture in AR.");
                    yield break;
                }
                ReportCameraStatus("requestingPermission", "Allow camera access to continue.");
                var denied = false;
                var callbacks = new PermissionCallbacks();
                callbacks.PermissionDenied += _ => denied = true;
                callbacks.PermissionDeniedAndDontAskAgain += _ => denied = true;
                Permission.RequestUserPermission(Permission.Camera, callbacks);

                var elapsed = 0f;
                while (!denied && !Permission.HasUserAuthorizedPermission(Permission.Camera) &&
                       elapsed < permissionTimeoutSeconds)
                {
                    elapsed += Time.unscaledDeltaTime;
                    yield return null;
                }
            }

            if (!Permission.HasUserAuthorizedPermission(Permission.Camera))
            {
                Debug.LogError("[ARBootstrap] Camera permission not granted — camera will stay black.");
                CameraPermissionDenied = true;
                ReportCameraStatus("permissionDenied", "Allow camera access in Settings to scan rooms or view furniture in AR.");
                yield break;
            }
#elif UNITY_IOS && !UNITY_EDITOR
            if (!Application.HasUserAuthorization(UserAuthorization.WebCam))
                yield return Application.RequestUserAuthorization(UserAuthorization.WebCam);
            if (!Application.HasUserAuthorization(UserAuthorization.WebCam))
            {
                CameraPermissionDenied = true;
                ReportCameraStatus("permissionDenied", "Allow camera access in Settings to scan rooms or view furniture in AR.");
                yield break;
            }
#endif
            CameraPermissionDenied = false;

            if (arSession == null)
            {
                Debug.LogError("[ARBootstrap] No ARSession in the scene.");
                ReportCameraStatus("unavailable", "The AR camera could not start. Go back and try again.");
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
                CameraUnsupported = true;
                ReportCameraStatus("unsupported", "This device does not support room scanning or AR furniture.");
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

            CameraUnsupported = false;
            // A new scan replaces the previous layout even if its camera mode is still active.
            if (resetTracking)
                ResetSession("new scan");

            // Orbit planner owns the camera — never re-enable passthrough or reset
            // tracking (that would yank the locked orbit view).
            if (IsPlannerOrbitActive())
            {
                layoutMode?.ReapplyPlannerCamera();
                ReportCameraStatus("inactive", string.Empty);
                Debug.Log("[ARBootstrap] Planner orbit active — skipped AR camera resume.");
                yield break;
            }

            ReportCameraStatus("starting", "Opening the camera…");
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
                ResetSession("stuck", force: true);
            }

            Debug.Log($"[ARBootstrap] AR session state={ARSession.state}");
        }
        finally
        {
            starting = false;
        }
    }
}
