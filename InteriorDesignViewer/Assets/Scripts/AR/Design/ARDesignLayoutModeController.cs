using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.InputSystem.XR;
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
    [SerializeField] private float orbitSensitivity = 0.18f;
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

    bool orbiting;
    Vector2 lastOrbitPos;
    float lastPinchDistance;

    /// <summary>True while the room is confirmed and placement UI is active.</summary>
    public bool IsLayoutActive => sessionActive;

    /// <summary>True when orbit planner (not live AR) owns the camera.</summary>
    public bool IsPlannerOrbitActive => sessionActive && viewMode == ViewMode.Planner;

    public ViewMode CurrentViewMode => viewMode;
    public Vector3 FocusPoint => focus;

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
            EnterLayoutMode();
        else if (sessionActive)
            ExitLayoutMode();
    }

    void LateUpdate()
    {
        if (!sessionActive || arCamera == null) return;

        if (viewMode == ViewMode.Planner)
        {
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

    void HandleOrbitInput()
    {
        if (placementController != null && placementController.SuppressTapInput)
        {
            orbiting = false;
            lastPinchDistance = 0f;
            return;
        }

        if (placementController != null && placementController.HasPendingPlacement)
        {
            orbiting = false;
            lastPinchDistance = 0f;
            return;
        }

        var touchCount = Touch.activeTouches.Count;
        if (touchCount >= 1 && IsPointerOverUI(Touch.activeTouches[0].touchId))
        {
            orbiting = false;
            return;
        }

        if (touchCount >= 2)
        {
            orbiting = false;
            var d = Vector2.Distance(Touch.activeTouches[0].screenPosition, Touch.activeTouches[1].screenPosition);
            if (lastPinchDistance > 1f)
            {
                var delta = d - lastPinchDistance;
                distance = Mathf.Clamp(distance - delta * pinchZoomSensitivity, minDistance, maxDistance);
            }

            lastPinchDistance = d;
            return;
        }

        lastPinchDistance = 0f;

        if (touchCount == 1)
        {
            var touch = Touch.activeTouches[0];
            if (touch.phase == TouchPhase.Began)
            {
                orbiting = true;
                lastOrbitPos = touch.screenPosition;
            }
            else if (orbiting && (touch.phase == TouchPhase.Moved || touch.phase == TouchPhase.Stationary))
            {
                var delta = touch.screenPosition - lastOrbitPos;
                yaw += delta.x * orbitSensitivity;
                pitch = Mathf.Clamp(pitch - delta.y * orbitSensitivity, pitchMin, pitchMax);
                lastOrbitPos = touch.screenPosition;
            }
            else if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
            {
                orbiting = false;
            }

            return;
        }

        orbiting = false;

#if UNITY_EDITOR
        if (Mouse.current != null && Mouse.current.leftButton.isPressed
            && !(EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()))
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

    void ApplyCameraPose()
    {
        var rotation = Quaternion.Euler(pitch, yaw, 0f);
        var position = focus + rotation * (Vector3.back * distance);
        arCamera.transform.SetPositionAndRotation(position, rotation);
    }

    static bool IsPointerOverUI(int touchId)
    {
        if (EventSystem.current == null) return false;
        return EventSystem.current.IsPointerOverGameObject(touchId);
    }
}
