using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.InputSystem.XR;
using UnityEngine.UI;
using UnityEngine.XR.ARFoundation;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

/// <summary>
/// After room confirm: furniture placement unlocks. Default view is
/// <see cref="ViewMode.RealRoom"/> (live AR camera of the user's space).
/// Optional <see cref="ViewMode.Planner"/> switches to orbit cutaway with a
/// stylized room shell for top-down arranging.
/// </summary>
[DefaultExecutionOrder(50)]
public class ARDesignLayoutModeController : MonoBehaviour
{
    public enum ViewMode
    {
        /// <summary>Live AR passthrough — furniture sits in the real room.</summary>
        RealRoom,
        /// <summary>Orbit planner with stylized room mesh.</summary>
        Planner,
    }

    [SerializeField] private RoomScanController scanController;
    [SerializeField] private FurniturePlacementController placementController;
    [SerializeField] private Camera arCamera;
    [SerializeField] private ARCameraBackground cameraBackground;
    [SerializeField] private TrackedPoseDriver trackedPoseDriver;
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private RoomMeshVisualizer roomMeshVisualizer;

    [Header("Defaults")]
    [Tooltip("Shown right after Confirm. RealRoom keeps the live camera.")]
    [SerializeField] private ViewMode defaultViewMode = ViewMode.RealRoom;

    [Header("Orbit (planner only)")]
    [SerializeField] private float orbitSensitivity = 0.22f;
    [Tooltip("Degrees per RN / pixel unit for plannerOrbit bridge messages.")]
    [SerializeField] private float rnOrbitSensitivity = 0.12f;
    [SerializeField] private float rnOrbitPixelScale = 0.065f;
    [SerializeField] private float rnOrbitSmoothing = 14f;
    [SerializeField] private float pinchZoomSensitivity = 0.01f;
    [SerializeField] private float minDistance = 1.2f;
    [SerializeField] private float maxDistance = 12f;
    [SerializeField] private float pitchMin = 15f;
    [SerializeField] private float pitchMax = 80f;
    [SerializeField] private Color plannerClearColor = new(0.93f, 0.92f, 0.90f, 1f);

    bool sessionActive;
    ViewMode viewMode = ViewMode.RealRoom;
    bool wasCameraBackgroundEnabled = true;
    bool wasTrackedPoseEnabled = true;
    CameraClearFlags previousClearFlags;
    Color previousBackgroundColor;
    bool capturedCameraDefaults;

    Vector3 focus;
    float distance = 4.5f;
    float yaw;
    float pitch = 35f;
    float targetYaw;
    float targetPitch = 35f;

    bool orbiting;
    Vector2 lastOrbitPos;
    float lastPinchDistance;

    /// <summary>True while the room is confirmed and placement UI is active.</summary>
    public bool IsLayoutActive => sessionActive;

    /// <summary>True when orbit planner (not live AR) owns the camera.</summary>
    public bool IsPlannerOrbitActive => sessionActive && viewMode == ViewMode.Planner;

    public ViewMode CurrentViewMode => viewMode;
    public Vector3 FocusPoint => focus;

    /// <summary>
    /// While true, RN planner gestures do not auto-switch a live AR session into the planner;
    /// only an explicit <see cref="SetViewMode(ViewMode)"/> changes the view.
    /// </summary>
    public bool HoldRealRoom { get; set; }

    public event Action<ViewMode> ViewModeChanged;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (arCamera == null) arCamera = Camera.main;
        if (cameraBackground == null && arCamera != null)
            cameraBackground = arCamera.GetComponent<ARCameraBackground>();
        if (trackedPoseDriver == null && arCamera != null)
            trackedPoseDriver = arCamera.GetComponent<TrackedPoseDriver>();
        if (placementIndicator == null)
            placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();
        if (roomMeshVisualizer == null)
            roomMeshVisualizer = FindFirstObjectByType<RoomMeshVisualizer>();
    }

    void Update()
    {
        if (!sessionActive || viewMode != ViewMode.Planner || arCamera == null)
            return;

        // Smooth RN orbit steps (ApplyOrbitFromRn sets targets; we ease the camera here).
        if (Mathf.Abs(Mathf.DeltaAngle(yaw, targetYaw)) > 0.01f
            || Mathf.Abs(pitch - targetPitch) > 0.01f)
        {
            var t = 1f - Mathf.Exp(-rnOrbitSmoothing * Time.unscaledDeltaTime);
            yaw = Mathf.LerpAngle(yaw, targetYaw, t);
            pitch = Mathf.Lerp(pitch, targetPitch, t);
            ApplyCameraPose();
            EnforcePlannerCamera();
        }
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

        if (sessionActive)
            ExitLayoutMode();
    }

    void OnApplicationPause(bool paused)
    {
        if (!paused && sessionActive)
            ApplyCurrentView();
    }

    void OnApplicationFocus(bool hasFocus)
    {
        if (hasFocus && sessionActive)
            ApplyCurrentView();
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        if (phase == RoomScanController.ScanPhase.Confirmed)
        {
            // AR Furniture unlocks via a synthetic confirm — stay on live AR camera.
            if (scanController != null && scanController.IsFurniturePlacementOnly)
            {
                sessionActive = true;
                viewMode = ViewMode.RealRoom;
                CaptureCameraDefaults();
                orbiting = false;
                ApplyCurrentView();
                roomMeshVisualizer?.Clear();
                Debug.Log("[ARDesignLayoutMode] Furniture-only confirm — live AR, no planner shell.");
                return;
            }

            EnterLayoutMode();
        }
        else if (sessionActive)
        {
            ExitLayoutMode();
        }
    }

    void LateUpdate()
    {
        if (!sessionActive || arCamera == null) return;

        if (viewMode == ViewMode.Planner)
        {
            // RN sends plannerPointer — ignore EnhancedTouch / InputSystem orbit (ghost touches on UaaL).
            if (!ARDesignHostDetect.IsEmbeddedInReactNative())
                HandleOrbitInput();
            ApplyCameraPose();
            EnforcePlannerCamera();
        }
        else
        {
            EnforceRealRoomCamera();
        }
    }

    public void EnterLayoutMode()
    {
        if (sessionActive)
        {
            ApplyCurrentView();
            return;
        }

        sessionActive = true;
        CaptureCameraDefaults();
        CaptureOrbitFromRoom();
        SetViewMode(defaultViewMode, force: true);
        placementIndicator?.StopTracking();
        Debug.Log($"[ARDesignLayoutMode] Post-confirm view: {viewMode}");
    }

    /// <summary>Switch between live AR room and stylized planner.</summary>
    public void SetViewMode(ViewMode mode) => SetViewMode(mode, force: false);

    public void ToggleViewMode()
    {
        SetViewMode(viewMode == ViewMode.RealRoom ? ViewMode.Planner : ViewMode.RealRoom);
    }

    /// <summary>Standalone measurement scene: top-down 2D plan vs isometric 3D shell.</summary>
    public void ApplyMeasurementViewPreset(bool topDown)
    {
        if (!sessionActive)
        {
            if (scanController == null || !scanController.IsConfirmed)
                return;
            EnterLayoutMode();
        }

        viewMode = ViewMode.Planner;
        CaptureOrbitFromRoom();
        pitch = topDown ? 89f : 35f;
        yaw = topDown ? 0f : yaw;
        targetPitch = pitch;
        targetYaw = yaw;

        if (topDown && scanController?.ConfirmedRoom != null && scanController.ConfirmedRoom.hasBounds)
        {
            var size = scanController.ConfirmedRoom.bounds.size;
            distance = Mathf.Clamp(Mathf.Max(size.x, size.z) * 1.2f, minDistance, maxDistance);
        }

        ApplyCurrentView();
        ViewModeChanged?.Invoke(viewMode);
    }

    void SetViewMode(ViewMode mode, bool force)
    {
        if (!sessionActive && (scanController == null || !scanController.IsConfirmed))
            return;

        sessionActive = true;
        if (!force && viewMode == mode)
        {
            ApplyCurrentView();
            return;
        }

        viewMode = mode;
        orbiting = false;
        lastPinchDistance = 0f;

        if (viewMode == ViewMode.Planner)
            CaptureOrbitFromRoom();

        ApplyCurrentView();
        ViewModeChanged?.Invoke(viewMode);
        Debug.Log($"[ARDesignLayoutMode] View mode → {viewMode}");
    }

    /// <summary>Re-apply planner camera after resume (legacy callers).</summary>
    public void ReapplyPlannerCamera()
    {
        if (!sessionActive && (scanController == null || !scanController.IsConfirmed))
            return;

        sessionActive = true;
        if (viewMode != ViewMode.Planner)
            viewMode = ViewMode.Planner;
        ApplyCurrentView();
    }

    void ApplyCurrentView()
    {
        if (viewMode == ViewMode.Planner)
        {
            EnforcePlannerCamera();
            ApplyCameraPose();
            roomMeshVisualizer?.SetShellVisible(true);
            scanController?.SetLiveFloorTracking(false);
        }
        else
        {
            EnforceRealRoomCamera();
            roomMeshVisualizer?.SetShellVisible(false);
            scanController?.SetLiveFloorTracking(true);
        }
    }

    void CaptureCameraDefaults()
    {
        if (capturedCameraDefaults || arCamera == null) return;
        previousClearFlags = arCamera.clearFlags;
        previousBackgroundColor = arCamera.backgroundColor;
        wasCameraBackgroundEnabled = cameraBackground == null || cameraBackground.enabled;
        wasTrackedPoseEnabled = trackedPoseDriver == null || trackedPoseDriver.enabled;
        capturedCameraDefaults = true;
    }

    void EnforceRealRoomCamera()
    {
        if (arCamera != null)
        {
            // ARFoundation usually drives Skybox/Solid via ARCameraBackground.
            if (capturedCameraDefaults)
            {
                arCamera.clearFlags = previousClearFlags;
                arCamera.backgroundColor = previousBackgroundColor;
            }
        }

        if (cameraBackground != null && !cameraBackground.enabled)
            cameraBackground.enabled = true;

        if (trackedPoseDriver != null && !trackedPoseDriver.enabled)
            trackedPoseDriver.enabled = true;
    }

    void EnforcePlannerCamera()
    {
        if (arCamera != null)
        {
            arCamera.clearFlags = CameraClearFlags.SolidColor;
            arCamera.backgroundColor = plannerClearColor;
        }

        if (cameraBackground != null && cameraBackground.enabled)
            cameraBackground.enabled = false;

        if (trackedPoseDriver != null && trackedPoseDriver.enabled)
            trackedPoseDriver.enabled = false;

        placementIndicator?.StopTracking();
    }

    void CaptureOrbitFromRoom()
    {
        var room = scanController != null ? scanController.ConfirmedRoom : null;
        if (room != null && room.hasBounds)
        {
            focus = room.bounds.center;
            var size = room.bounds.size;
            distance = Mathf.Clamp(Mathf.Max(size.x, size.z) * 1.35f + size.y * 0.5f, minDistance, maxDistance);
        }
        else if (arCamera != null)
        {
            focus = arCamera.transform.position + arCamera.transform.forward * 2f;
            focus.y = scanController != null ? scanController.ConfirmedRoom?.floorY ?? focus.y : focus.y;
        }

        if (arCamera != null)
        {
            var euler = arCamera.transform.eulerAngles;
            yaw = euler.y;
            pitch = Mathf.Clamp(euler.x > 180f ? euler.x - 360f : euler.x, pitchMin, pitchMax);
            if (pitch < pitchMin) pitch = 35f;
            targetYaw = yaw;
            targetPitch = pitch;
        }
    }

    public void ExitLayoutMode()
    {
        if (!sessionActive) return;
        sessionActive = false;
        orbiting = false;
        viewMode = defaultViewMode;

        if (cameraBackground != null)
            cameraBackground.enabled = wasCameraBackgroundEnabled;

        if (trackedPoseDriver != null)
            trackedPoseDriver.enabled = wasTrackedPoseEnabled;

        if (arCamera != null && capturedCameraDefaults)
        {
            arCamera.clearFlags = previousClearFlags;
            arCamera.backgroundColor = previousBackgroundColor;
        }

        roomMeshVisualizer?.SetShellVisible(true);
        ViewModeChanged?.Invoke(viewMode);
        Debug.Log("[ARDesignLayoutMode] Returned to live AR scan mode.");
    }

    /// <summary>
    /// Always restore the live AR camera feed (used when RN switches back to furniture
    /// after a measurement / planner session).
    /// </summary>
    public void ForceLiveArCamera()
    {
        sessionActive = false;
        orbiting = false;
        lastPinchDistance = 0f;
        viewMode = ViewMode.RealRoom;
        EnforceRealRoomCamera();
        roomMeshVisualizer?.SetShellVisible(false);
        scanController?.SetLiveFloorTracking(true);
        ViewModeChanged?.Invoke(viewMode);
        Debug.Log("[ARDesignLayoutMode] Forced live AR camera.");
    }

    /// <summary>
    /// Apply drag / pinch from React Native (UaaL often does not deliver EnhancedTouch).
    /// Payload: {"dx":float,"dy":float,"pinch":float} — pinch is distance ratio (1 = unchanged).
    /// </summary>
    public void ApplyOrbitFromRn(string json)
    {
        EnsurePlannerSession();
        if (!sessionActive || viewMode != ViewMode.Planner || arCamera == null)
            return;

        float dx = 0f;
        float dy = 0f;
        float pinch = 1f;
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                var payload = JsonUtility.FromJson<PlannerOrbitPayload>(json);
                if (payload != null)
                {
                    dx = payload.dx;
                    dy = payload.dy;
                    pinch = payload.pinch > 0.01f ? payload.pinch : 1f;
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[ARDesignLayoutMode] Bad plannerOrbit payload: {e.Message}");
            }
        }

        if (Mathf.Abs(dx) > 0.0001f || Mathf.Abs(dy) > 0.0001f)
        {
            const float deadzonePx = 2f;
            if (Mathf.Abs(dx) < deadzonePx) dx = 0f;
            if (Mathf.Abs(dy) < deadzonePx) dy = 0f;

            if (Mathf.Abs(dx) > 0.0001f || Mathf.Abs(dy) > 0.0001f)
            {
                // Same gain as native one-finger planner orbit (ApplyOneFingerOrbit).
                yaw += dx * orbitSensitivity;
                pitch = Mathf.Clamp(pitch - dy * orbitSensitivity, pitchMin, pitchMax);
                targetYaw = yaw;
                targetPitch = pitch;
                ApplyCameraPose();
                EnforcePlannerCamera();
            }
        }

        if (Mathf.Abs(pinch - 1f) > 0.001f)
        {
            distance = Mathf.Clamp(distance / pinch, minDistance, maxDistance);
            ApplyCameraPose();
            EnforcePlannerCamera();
        }
    }

    void EnsurePlannerSession()
    {
        if (scanController == null || !scanController.IsConfirmed)
            return;

        // Never enter planner shell for furniture-only synthetic rooms.
        if (scanController.IsFurniturePlacementOnly)
            return;

        if (HoldRealRoom && sessionActive && viewMode == ViewMode.RealRoom)
            return;

        var switched = !sessionActive || viewMode != ViewMode.Planner;
        sessionActive = true;
        viewMode = ViewMode.Planner;

        if (switched)
        {
            CaptureOrbitFromRoom();
            // Prefer an isometric angle so drag orbit is obvious after measurement.
            if (pitch < 20f || pitch > 85f)
                pitch = 35f;
            ApplyCurrentView();
            ViewModeChanged?.Invoke(viewMode);
        }
        else
        {
            EnforcePlannerCamera();
        }
    }

    void HandleOrbitInput()
    {
        if (placementController != null &&
            (placementController.SuppressTapInput || placementController.HasPendingPlacement))
        {
            orbiting = false;
            lastPinchDistance = 0f;
            return;
        }

        // ── Two-finger pinch (Enhanced Touch) ────────────────────────────────
        if (Touch.activeTouches.Count >= 2)
        {
            orbiting = false;
            var d = Vector2.Distance(
                Touch.activeTouches[0].screenPosition,
                Touch.activeTouches[1].screenPosition);
            if (lastPinchDistance > 1f)
            {
                var delta = d - lastPinchDistance;
                distance = Mathf.Clamp(distance - delta * pinchZoomSensitivity, minDistance, maxDistance);
            }

            lastPinchDistance = d;
            return;
        }

        lastPinchDistance = 0f;

        // ── One-finger orbit — Enhanced Touch ────────────────────────────────
        if (Touch.activeTouches.Count == 1)
        {
            ApplyOneFingerOrbit(Touch.activeTouches[0].screenPosition, Touch.activeTouches[0].phase);
            return;
        }

        // ── Fallback: Input System Touchscreen (common on UaaL Android) ──────
        var ts = Touchscreen.current;
        if (ts != null && ts.primaryTouch.press.isPressed)
        {
            var pos = ts.primaryTouch.position.ReadValue();
            var phase = TouchPhase.Moved;
            if (ts.primaryTouch.press.wasPressedThisFrame)
                phase = TouchPhase.Began;
            else if (ts.primaryTouch.press.wasReleasedThisFrame)
                phase = TouchPhase.Ended;
            ApplyOneFingerOrbit(pos, phase);
            return;
        }

#if ENABLE_LEGACY_INPUT_MANAGER
        if (Input.touchCount == 1)
        {
            var t = Input.GetTouch(0);
            var phase = t.phase switch
            {
                UnityEngine.TouchPhase.Began => TouchPhase.Began,
                UnityEngine.TouchPhase.Ended => TouchPhase.Ended,
                UnityEngine.TouchPhase.Canceled => TouchPhase.Canceled,
                UnityEngine.TouchPhase.Stationary => TouchPhase.Stationary,
                _ => TouchPhase.Moved,
            };
            ApplyOneFingerOrbit(t.position, phase);
            return;
        }
#endif

        orbiting = false;

#if UNITY_EDITOR
        if (Mouse.current != null && Mouse.current.leftButton.isPressed
            && !IsScreenPosOverUI(Mouse.current.position.ReadValue()))
        {
            var delta = Mouse.current.delta.ReadValue();
            yaw += delta.x * orbitSensitivity * 0.15f;
            pitch = Mathf.Clamp(pitch - delta.y * orbitSensitivity * 0.15f, pitchMin, pitchMax);
        }

        if (Mouse.current != null)
        {
            var scroll = Mouse.current.scroll.ReadValue().y;
            if (Mathf.Abs(scroll) > 0.01f)
                distance = Mathf.Clamp(distance - scroll * 0.002f, minDistance, maxDistance);
        }
#endif
    }

    /// <summary>
    /// UaaL often skips TouchPhase.Began — treat the first Moved as a new orbit start.
    /// </summary>
    void ApplyOneFingerOrbit(Vector2 screenPos, TouchPhase phase)
    {
        if (phase == TouchPhase.Ended || phase == TouchPhase.Canceled)
        {
            orbiting = false;
            return;
        }

        if (phase == TouchPhase.Began || !orbiting)
        {
            if (IsScreenPosOverUI(screenPos))
            {
                orbiting = false;
                return;
            }

            orbiting = true;
            lastOrbitPos = screenPos;
            // Baseline only on the first sample so we don't jump on Began→Moved.
            if (phase == TouchPhase.Began)
                return;
        }

        if (!orbiting)
            return;

        var delta = screenPos - lastOrbitPos;
        if (delta.sqrMagnitude < 0.25f)
            return;

        yaw += delta.x * orbitSensitivity;
        pitch = Mathf.Clamp(pitch - delta.y * orbitSensitivity, pitchMin, pitchMax);
        lastOrbitPos = screenPos;
    }

    void ApplyCameraPose()
    {
        if (arCamera == null) return;
        var rotation = Quaternion.Euler(pitch, yaw, 0f);
        var position = focus + rotation * (Vector3.back * distance);
        arCamera.transform.SetPositionAndRotation(position, rotation);
    }

    static readonly List<RaycastResult> UiRaycastHits = new();

    static bool IsScreenPosOverUI(Vector2 screenPos)
    {
        if (EventSystem.current == null) return false;

        var eventData = new PointerEventData(EventSystem.current) { position = screenPos };
        UiRaycastHits.Clear();
        EventSystem.current.RaycastAll(eventData, UiRaycastHits);
        // Only block orbit when the finger is on a real control (button), not frost chips.
        for (var i = 0; i < UiRaycastHits.Count; i++)
        {
            var go = UiRaycastHits[i].gameObject;
            if (go != null && go.GetComponentInParent<Button>() != null)
                return true;
        }

        return false;
    }

    [Serializable]
    class PlannerOrbitPayload
    {
        public float dx;
        public float dy;
        public float pinch = 1f;
    }
}
