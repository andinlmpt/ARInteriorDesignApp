using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

/// <summary>
/// Touch manipulation for the currently selected piece of furniture.
///
///   1 finger drag   Moves the piece across the floor under the finger.
///   2 finger twist  Yaw only. Scale is never changed.
/// </summary>
[DefaultExecutionOrder(-100)]
public class FurnitureManipulator : MonoBehaviour
{
    [SerializeField] private FurniturePlacementController placementController;
    [SerializeField] private Camera arCamera;

    [Header("Drag")]
    [Tooltip("Screen pixels of movement before a touch becomes a drag rather than a tap.")]
    [SerializeField] private float dragStartThreshold = 8f;
    [Tooltip("If true, drag only starts when the finger goes down on the selected piece. If false, any drag moves the selection (easier in planner view).")]
    [SerializeField] private bool requireTouchOnSelection = true;
    [Tooltip("Extra screen-pixel radius around the furniture for starting a drag.")]
    [SerializeField] private float selectionPickRadiusPx = 96f;
    [Tooltip("Fallback translation speed used when the floor raycast misses mid-drag.")]
    [SerializeField] private float fallbackMoveSpeed = 0.012f;

    [Header("Twist")]
    [SerializeField] private float rotationSensitivity = 1f;
    [SerializeField] private float twistDeadZone = 0.05f;

    public event Action<PlacedFurniture> GestureBegan;
    public event Action<PlacedFurniture> GestureEnded;

    /// <summary>Fired once per gesture when the user tries to drag or twist a locked piece.</summary>
    public event Action<PlacedFurniture> LockedGestureBlocked;

    /// <summary>True while a drag or twist owns the touches.</summary>
    public bool IsGestureActive => gestureActive;

    PlacedFurniture tracked;

    bool dragEligible;
    bool isDragging;
    bool gestureActive;
    Vector2 dragStartScreen;
    Vector3 dragGrabOffset;

    bool isTwoFinger;
    float twistStartAngle;
    Vector3 lastSafePosition;
    float lastSafeYaw;

    /// <summary>RN planner sends gestures via bridge; EnhancedTouch stays empty under UaaL.</summary>
    bool rnGestureStream;

    /// <summary>The current touch started on a locked piece (drags only raise a notice).</summary>
    bool lockedTouch;
    bool lockedNoticeSent;

    /// <summary>A drag counts as held back when overlap resolution moved it more than 1 cm.</summary>
    const float BlockedSlopSqr = 0.01f * 0.01f;

    void Awake()
    {
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (arCamera == null) arCamera = Camera.main;
    }

    void OnEnable() => EnhancedTouchSupport.Enable();

    void Update()
    {
        if (placementController == null) return;

        // RN owns the touch stream while plannerPointer / furnitureGesture is active.
        if (rnGestureStream)
            return;

        var selected = placementController.Selected;
        if (selected == null)
        {
            EndGesture();
            return;
        }

        if (selected != tracked)
        {
            EndGesture();
            tracked = selected;
        }

        var touchCount = Touch.activeTouches.Count;

        if (touchCount >= 1 && IsPointerOverUI(Touch.activeTouches[0].touchId))
        {
            if (!isDragging && !isTwoFinger)
            {
                EndGesture();
                return;
            }
        }

        if (touchCount >= 2)
        {
            HandleTwoFinger(selected);
            return;
        }

        if (touchCount == 1)
        {
            HandleSingleFinger(selected);
            return;
        }

        lockedTouch = false;
        lockedNoticeSent = false;
        EndGesture();
    }

    void HandleSingleFinger(PlacedFurniture furniture)
    {
        if (isTwoFinger)
        {
            isTwoFinger = false;
            dragEligible = false;
            placementController.SuppressTapInput = false;
            return;
        }

        var touch = Touch.activeTouches[0];

        switch (touch.phase)
        {
            case TouchPhase.Began:
                var onPiece = !requireTouchOnSelection
                              || IsTouchOnFurniture(touch.screenPosition, furniture)
                              || IsTouchNearFurniture(touch.screenPosition, furniture);
                lockedTouch = onPiece && furniture.IsLocked;
                dragEligible = onPiece && !furniture.IsLocked;
                dragStartScreen = touch.screenPosition;
                isDragging = false;

                dragGrabOffset = Vector3.zero;
                if (dragEligible &&
                    placementController.TryGetDragFloorPositionFor(furniture, touch.screenPosition, out var grabPoint))
                {
                    dragGrabOffset = furniture.transform.position - grabPoint;
                    dragGrabOffset.y = 0f;
                }
                break;

            case TouchPhase.Moved:
            case TouchPhase.Stationary:
                if (!dragEligible)
                {
                    if (lockedTouch
                        && Vector2.Distance(touch.screenPosition, dragStartScreen) >= dragStartThreshold)
                        NotifyLocked(furniture);
                    break;
                }

                if (!isDragging)
                {
                    if (Vector2.Distance(touch.screenPosition, dragStartScreen) < dragStartThreshold)
                        break;

                    isDragging = true;
                    placementController.SuppressTapInput = true;
                    BeginGesture(furniture);
                }

                var blockedAt = DragTo(furniture, touch.screenPosition, touch.delta);
                RememberSafePose(furniture);
                placementController.RefreshPlacementSafety(furniture, blockedAt);
                break;

            case TouchPhase.Ended:
            case TouchPhase.Canceled:
                EndGesture();
                break;
        }
    }

    /// <returns>
    /// The pivot the finger asked for when another piece held the drag back; otherwise null.
    /// </returns>
    Vector3? DragTo(PlacedFurniture furniture, Vector2 screenPosition, Vector2 screenDelta)
    {
        if (placementController.TryGetDragFloorPositionFor(furniture, screenPosition, out var floorPoint))
        {
            var target = floorPoint + dragGrabOffset;
            var resolved = placementController.ResolveCollisionFreePivot(furniture, target, lastSafePosition);
            furniture.transform.position = new Vector3(resolved.x, furniture.transform.position.y, resolved.z);
            placementController.GroundInstance(furniture);
            return HeldBack(target, resolved);
        }

        if (arCamera != null)
        {
            var forward = arCamera.transform.forward;
            forward.y = 0f;
            if (forward.sqrMagnitude > 0.001f) forward.Normalize();

            var right = arCamera.transform.right;
            right.y = 0f;
            if (right.sqrMagnitude > 0.001f) right.Normalize();

            furniture.transform.Translate(
                forward * (screenDelta.y * fallbackMoveSpeed) + right * (screenDelta.x * fallbackMoveSpeed),
                Space.World);

            var desired = furniture.transform.position;
            var resolved = placementController.ResolveCollisionFreePivot(furniture, desired, lastSafePosition);
            furniture.transform.position = new Vector3(resolved.x, furniture.transform.position.y, resolved.z);
            placementController.GroundInstance(furniture);
            return HeldBack(desired, resolved);
        }

        return null;
    }

    static Vector3? HeldBack(Vector3 desired, Vector3 resolved)
    {
        var dx = desired.x - resolved.x;
        var dz = desired.z - resolved.z;
        return dx * dx + dz * dz > BlockedSlopSqr ? desired : (Vector3?)null;
    }

    void NotifyLocked(PlacedFurniture furniture)
    {
        if (lockedNoticeSent) return;
        lockedNoticeSent = true;
        LockedGestureBlocked?.Invoke(furniture);
    }

    void HandleTwoFinger(PlacedFurniture furniture)
    {
        if (furniture.IsLocked)
        {
            NotifyLocked(furniture);
            return;
        }

        var p0 = Touch.activeTouches[0].screenPosition;
        var p1 = Touch.activeTouches[1].screenPosition;
        var angle = Mathf.Atan2(p1.y - p0.y, p1.x - p0.x) * Mathf.Rad2Deg;

        if (!isTwoFinger)
        {
            isTwoFinger = true;
            isDragging = false;
            dragEligible = false;
            twistStartAngle = angle;
            placementController.SuppressTapInput = true;
            BeginGesture(furniture);
        }

        ApplyTwist(furniture, angle);
        placementController.GroundInstance(furniture);

        var resolved = placementController.ResolveCollisionFreePivot(
            furniture, furniture.transform.position, lastSafePosition);
        furniture.transform.position = new Vector3(
            resolved.x, furniture.transform.position.y, resolved.z);
        placementController.GroundInstance(furniture);

        if (!placementController.IsPlacementClear(furniture))
        {
            // Rotation swung into a wall or another piece with nowhere to slide — undo yaw.
            furniture.transform.rotation = Quaternion.Euler(0f, lastSafeYaw, 0f);
            furniture.transform.position = new Vector3(
                lastSafePosition.x, furniture.transform.position.y, lastSafePosition.z);
            placementController.GroundInstance(furniture);
        }
        else
        {
            RememberSafePose(furniture);
        }

        placementController.RefreshPlacementSafety(furniture);
    }

    void ApplyTwist(PlacedFurniture furniture, float currentAngle)
    {
        var delta = Mathf.DeltaAngle(twistStartAngle, currentAngle);
        if (Mathf.Abs(delta) < twistDeadZone) return;

        furniture.transform.Rotate(0f, delta * rotationSensitivity, 0f, Space.World);
        // Keep pitch/roll locked so pieces never tip when viewed from the side.
        var euler = furniture.transform.eulerAngles;
        furniture.transform.rotation = Quaternion.Euler(0f, euler.y, 0f);
        twistStartAngle = currentAngle;
    }

    void BeginGesture(PlacedFurniture furniture)
    {
        if (gestureActive) return;
        gestureActive = true;
        if (furniture != null)
        {
            // Seed fallback even if currently overlapping so resolve never snaps to world origin.
            lastSafePosition = furniture.transform.position;
            lastSafeYaw = furniture.transform.eulerAngles.y;
            RememberSafePose(furniture);
        }
        placementController?.BeginFurnitureManipulation(furniture);
        GestureBegan?.Invoke(furniture);
    }

    void RememberSafePose(PlacedFurniture furniture)
    {
        if (furniture == null || placementController == null) return;
        if (!placementController.IsPlacementClear(furniture)) return;

        lastSafePosition = furniture.transform.position;
        lastSafeYaw = furniture.transform.eulerAngles.y;
    }

    void EndGesture()
    {
        if (!gestureActive && !isDragging && !isTwoFinger && !dragEligible)
            return;

        var furniture = tracked;
        var wasActive = gestureActive;

        isDragging = false;
        isTwoFinger = false;
        dragEligible = false;
        gestureActive = false;
        rnGestureStream = false;

        if (placementController != null)
            placementController.SuppressTapInput = false;

        if (wasActive && furniture != null)
        {
            placementController.EndFurnitureManipulation(furniture);
            GestureEnded?.Invoke(furniture);
        }
    }

    /// <summary>
    /// RN-driven drag/twist for planner mode (UaaL does not deliver EnhancedTouch under RN overlays).
    /// Payload: {"phase":"begin|move|end","x":px,"y":px,"dx":px,"dy":px,"twistDelta":deg}
    /// Screen coords are top-left origin (React Native); converted to Unity bottom-left.
    /// </summary>
    public void ApplyGestureFromRn(string json)
    {
        if (placementController == null) return;

        var furniture = placementController.Selected;
        if (furniture == null)
        {
            EndGesture();
            return;
        }

        if (furniture != tracked)
        {
            EndGesture();
            tracked = furniture;
        }

        if (arCamera == null) arCamera = Camera.main;

        FurnitureGestureRnPayload payload = null;
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                payload = JsonUtility.FromJson<FurnitureGestureRnPayload>(json);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[FurnitureManipulator] Bad furnitureGesture payload: {e.Message}");
                return;
            }
        }

        if (payload == null) return;

        var phase = (payload.phase ?? string.Empty).Trim().ToLowerInvariant();
        var screen = RnToUnityScreen(payload.x, payload.y);
        var delta = new Vector2(payload.dx, -payload.dy); // flip Y for Unity screen space

        switch (phase)
        {
            case "begin":
                rnGestureStream = true;
                lockedTouch = furniture.IsLocked;
                lockedNoticeSent = false;
                dragEligible = !furniture.IsLocked;
                isDragging = false;
                isTwoFinger = false;
                dragStartScreen = screen;
                dragGrabOffset = Vector3.zero;
                if (placementController.TryGetDragFloorPositionFor(furniture, screen, out var grabPoint))
                {
                    dragGrabOffset = furniture.transform.position - grabPoint;
                    dragGrabOffset.y = 0f;
                }
                RememberSafePose(furniture);
                break;

            case "move":
                if (!dragEligible)
                {
                    if (lockedTouch
                        && (Mathf.Abs(payload.twistDelta) > 0.01f
                            || Vector2.Distance(screen, dragStartScreen) >= dragStartThreshold))
                        NotifyLocked(furniture);
                    break;
                }

                if (Mathf.Abs(payload.twistDelta) > 0.01f)
                {
                    if (!isTwoFinger)
                    {
                        isTwoFinger = true;
                        isDragging = false;
                        placementController.SuppressTapInput = true;
                        BeginGesture(furniture);
                    }

                    furniture.transform.Rotate(0f, payload.twistDelta * rotationSensitivity, 0f, Space.World);
                    var euler = furniture.transform.eulerAngles;
                    furniture.transform.rotation = Quaternion.Euler(0f, euler.y, 0f);
                    placementController.GroundInstance(furniture);
                    RememberSafePose(furniture);
                    placementController.RefreshPlacementSafety(furniture);
                    break;
                }

                if (!isDragging)
                {
                    if (Vector2.Distance(screen, dragStartScreen) < 1.5f)
                        break;

                    isDragging = true;
                    placementController.SuppressTapInput = true;
                    BeginGesture(furniture);
                }

                var blockedAt = DragTo(furniture, screen, delta);
                RememberSafePose(furniture);
                placementController.RefreshPlacementSafety(furniture, blockedAt);
                break;

            case "end":
            case "cancel":
                rnGestureStream = false;
                EndGesture();
                break;
        }
    }

    static Vector2 RnToUnityScreen(float pageX, float pageY)
    {
        // RN: origin top-left, Y down. Unity ScreenPointToRay: origin bottom-left, Y up.
        return new Vector2(pageX, Screen.height - pageY);
    }

    [Serializable]
    class FurnitureGestureRnPayload
    {
        public string phase;
        public float x;
        public float y;
        public float dx;
        public float dy;
        public float twistDelta;
    }

    bool IsTouchOnFurniture(Vector2 screenPosition, PlacedFurniture furniture)
    {
        if (arCamera == null) return false;

        var ray = arCamera.ScreenPointToRay(screenPosition);
        if (!Physics.Raycast(ray, out var hit, 80f)) return false;

        return hit.transform.GetComponentInParent<PlacedFurniture>() == furniture;
    }

    bool IsTouchNearFurniture(Vector2 screenPosition, PlacedFurniture furniture)
    {
        if (arCamera == null || furniture == null) return false;

        var screen = arCamera.WorldToScreenPoint(furniture.transform.position);
        if (screen.z < 0.1f) return false;

        return Vector2.Distance(screenPosition, new Vector2(screen.x, screen.y)) <= selectionPickRadiusPx;
    }

    static bool IsPointerOverUI(int pointerId)
    {
        return EventSystem.current != null && EventSystem.current.IsPointerOverGameObject(pointerId);
    }
}
