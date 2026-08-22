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
    [SerializeField] private float fallbackMoveSpeed = 0.004f;

    [Header("Twist")]
    [SerializeField] private float rotationSensitivity = 1f;
    [SerializeField] private float twistDeadZone = 0.05f;

    public event Action<PlacedFurniture> GestureBegan;
    public event Action<PlacedFurniture> GestureEnded;

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

    void Awake()
    {
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (arCamera == null) arCamera = Camera.main;
    }

    void OnEnable() => EnhancedTouchSupport.Enable();

    void Update()
    {
        if (placementController == null) return;

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
                dragEligible = !requireTouchOnSelection
                               || IsTouchOnFurniture(touch.screenPosition, furniture)
                               || IsTouchNearFurniture(touch.screenPosition, furniture);
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
                if (!dragEligible) break;

                if (!isDragging)
                {
                    if (Vector2.Distance(touch.screenPosition, dragStartScreen) < dragStartThreshold)
                        break;

                    isDragging = true;
                    placementController.SuppressTapInput = true;
                    BeginGesture(furniture);
                }

                DragTo(furniture, touch.screenPosition, touch.delta);
                break;

            case TouchPhase.Ended:
            case TouchPhase.Canceled:
                EndGesture();
                break;
        }
    }

    void DragTo(PlacedFurniture furniture, Vector2 screenPosition, Vector2 screenDelta)
    {
        if (placementController.TryGetDragFloorPositionFor(furniture, screenPosition, out var floorPoint))
        {
            var target = floorPoint + dragGrabOffset;
            furniture.transform.position = new Vector3(target.x, furniture.transform.position.y, target.z);
            placementController.GroundInstance(furniture);
            return;
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
            placementController.GroundInstance(furniture);
        }
    }

    void HandleTwoFinger(PlacedFurniture furniture)
    {
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
        placementController?.BeginFurnitureManipulation(furniture);
        GestureBegan?.Invoke(furniture);
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

        if (placementController != null)
            placementController.SuppressTapInput = false;

        if (wasActive && furniture != null)
        {
            placementController.EndFurnitureManipulation(furniture);
            GestureEnded?.Invoke(furniture);
        }
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
