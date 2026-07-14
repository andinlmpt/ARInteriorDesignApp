using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

/// <summary>
/// Post-placement touch gestures: move (1-finger drag along camera axes),
/// rotate (2-finger twist), and scale (2-finger pinch).
/// Move uses screen delta → world translation via flat camera forward/right
/// so movement stays smooth even when the furniture pivot is not under the finger.
/// </summary>
[DefaultExecutionOrder(-100)]
public class ARFurnitureGestureController : MonoBehaviour
{
    // ── Inspector ─────────────────────────────────────────────────────────────
    [SerializeField] private ARFurniturePlacer placer;
    [SerializeField] private bool                requireTouchOnFurniture = false;
    [SerializeField] private LayerMask           furnitureLayerMask      = ~0;
    [Tooltip("Scales screen-pixel drag into world-space metres per frame.")]
    [SerializeField] private float               moveSpeedModifier       = 0.0005f;
    [SerializeField] private float               rotationSensitivity     = 0.5f;
    [SerializeField] private float               scaleSensitivity        = 1f;
    [SerializeField] private float               minScaleMultiplier      = 0.3f;
    [SerializeField] private float               maxScaleMultiplier      = 3f;
    [SerializeField] private bool                verboseLogging          = false;

    [Tooltip("Screen pixels of movement before a touch is treated as a drag.")]
    [SerializeField] private float dragStartThreshold = 12f;

    // ── Private ───────────────────────────────────────────────────────────────
    private Camera   arCamera;
    private GameObject trackedFurniture;
    private Vector3  referenceScale;

    private bool     isDragging;
    private bool     dragEligible;
    private Vector2  dragStartScreen;

    private bool     isTwoFinger;
    private float    pinchStartDistance;
    private float    twistStartAngle;
    private Vector3  scaleAtPinchStart;

    // ── Unity messages ────────────────────────────────────────────────────────
    void OnEnable() => EnhancedTouchSupport.Enable();

    void Awake()
    {
        if (placer == null)
            placer = FindFirstObjectByType<ARFurniturePlacer>();
    }

    void Start()
    {
        arCamera = Camera.main;
    }

    void Update()
    {
        var furniture = placer != null ? placer.PlacedInstance : null;
        if (furniture == null)
        {
            ClearGestureState();
            ARFurniturePlacer.SuppressPlacementInput = false;
            return;
        }

        if (furniture != trackedFurniture)
        {
            trackedFurniture = furniture;
            referenceScale   = furniture.transform.localScale;
        }

        var touchCount = Touch.activeTouches.Count;

        if (touchCount >= 1 && IsPointerOverUI(Touch.activeTouches[0].touchId))
        {
            ClearGestureState();
            ARFurniturePlacer.SuppressPlacementInput = true;
            return;
        }

        if (touchCount >= 2)
        {
            ARFurniturePlacer.SuppressPlacementInput = true;
            HandleTwoFingerGesture(furniture);
            return;
        }

        if (touchCount == 1)
        {
            HandleSingleFingerGesture(furniture);
            return;
        }

        if (isDragging || isTwoFinger)
            FinishGesture(furniture);

        ARFurniturePlacer.SuppressPlacementInput = isDragging;
    }

    // ── Single finger (move) ──────────────────────────────────────────────────

    void HandleSingleFingerGesture(GameObject furniture)
    {
        var touch = Touch.activeTouches[0];

        switch (touch.phase)
        {
            case TouchPhase.Began:
                dragEligible     = !requireTouchOnFurniture || IsTouchOnFurniture(touch.screenPosition, furniture);
                dragStartScreen  = touch.screenPosition;
                isDragging       = false;
                break;

            case TouchPhase.Moved:
                if (!dragEligible) break;

                if (!isDragging)
                {
                    if (Vector2.Distance(touch.screenPosition, dragStartScreen) < dragStartThreshold)
                        break;

                    isDragging = true;
                    ARFurniturePlacer.SuppressPlacementInput = true;
                    if (verboseLogging)
                        Debug.Log("[ARFurnitureGestureController] Drag started.");
                    SetOutlineVisible(furniture, true);
                }

                MoveFurniture(furniture, touch.delta);
                break;

            case TouchPhase.Ended:
            case TouchPhase.Canceled:
                if (isDragging)
                    FinishGesture(furniture);
                dragEligible = false;
                ARFurniturePlacer.SuppressPlacementInput = false;
                break;
        }
    }

    // ── Two finger (pinch + twist) ────────────────────────────────────────────

    void HandleTwoFingerGesture(GameObject furniture)
    {
        var t0 = Touch.activeTouches[0];
        var t1 = Touch.activeTouches[1];
        var p0 = t0.screenPosition;
        var p1 = t1.screenPosition;

        var distance = Vector2.Distance(p0, p1);
        var angle    = Mathf.Atan2(p1.y - p0.y, p1.x - p0.x) * Mathf.Rad2Deg;

        if (!isTwoFinger)
        {
            isTwoFinger          = true;
            pinchStartDistance   = Mathf.Max(distance, 1f);
            twistStartAngle      = angle;
            scaleAtPinchStart    = furniture.transform.localScale;
            isDragging           = false;
            dragEligible         = false;

            if (verboseLogging)
                Debug.Log("[ARFurnitureGestureController] Two-finger gesture started.");

            SetOutlineVisible(furniture, true);
        }

        ApplyPinchScale(furniture, distance);
        ApplyTwistRotation(furniture, angle);
        GroundFurniture(furniture);
    }

    void ApplyPinchScale(GameObject furniture, float currentDistance)
    {
        var factor  = Mathf.Pow(currentDistance / pinchStartDistance, scaleSensitivity);
        var target  = scaleAtPinchStart * factor;
        var minScale = referenceScale * minScaleMultiplier;
        var maxScale = referenceScale * maxScaleMultiplier;

        furniture.transform.localScale = new Vector3(
            Mathf.Clamp(target.x, minScale.x, maxScale.x),
            Mathf.Clamp(target.y, minScale.y, maxScale.y),
            Mathf.Clamp(target.z, minScale.z, maxScale.z));
    }

    void ApplyTwistRotation(GameObject furniture, float currentAngle)
    {
        var delta = Mathf.DeltaAngle(twistStartAngle, currentAngle);
        if (Mathf.Abs(delta) < 0.05f) return;

        furniture.transform.Rotate(0f, delta * rotationSensitivity, 0f, Space.World);
        twistStartAngle = currentAngle;
    }

    // ── Move / ground ─────────────────────────────────────────────────────────

    /// <summary>
    /// Converts finger delta on screen into world-space movement using the AR camera
    /// forward/right axes (flattened to the floor plane).
    /// </summary>
    void MoveFurniture(GameObject furniture, Vector2 touchDelta)
    {
        if (arCamera == null || touchDelta.sqrMagnitude < 0.01f) return;

        var forward = arCamera.transform.forward;
        forward.y   = 0f;
        if (forward.sqrMagnitude > 0.001f) forward.Normalize();

        var right = arCamera.transform.right;
        right.y   = 0f;
        if (right.sqrMagnitude > 0.001f) right.Normalize();

        var move = forward * (touchDelta.y * moveSpeedModifier)
                 + right   * (touchDelta.x * moveSpeedModifier);

        furniture.transform.Translate(move, Space.World);
        GroundFurniture(furniture);
    }

    void GroundFurniture(GameObject furniture)
    {
        if (placer.TryGetFloorHeightAtWorldPoint(furniture.transform.position, out var floorY))
        {
            var floorPoint = new Vector3(furniture.transform.position.x, floorY, furniture.transform.position.z);
            if (!ARFurnitureGrounding.SnapPivotToFloorPoint(furniture, floorPoint, placer.FloorContactInset))
                ARFurnitureGrounding.PlaceFeetOnFloor(furniture, floorPoint, placer.FloorContactInset, 4);
        }
    }

    bool IsTouchOnFurniture(Vector2 screenPosition, GameObject furniture)
    {
        if (arCamera == null) return false;

        var ray = arCamera.ScreenPointToRay(screenPosition);
        if (!Physics.Raycast(ray, out var hit, 50f, furnitureLayerMask))
            return false;

        return hit.transform == furniture.transform || hit.transform.IsChildOf(furniture.transform);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    void FinishGesture(GameObject furniture)
    {
        GroundFurniture(furniture);
        placer.RefreshBlobShadowExternal();
        referenceScale = furniture.transform.localScale;

        if (verboseLogging)
            Debug.Log("[ARFurnitureGestureController] Gesture finished.");

        ClearGestureState();
        ARFurniturePlacer.SuppressPlacementInput = false;
    }

    void ClearGestureState()
    {
        if (trackedFurniture != null)
        {
            SetOutlineVisible(trackedFurniture, false);
        }
        isDragging       = false;
        isTwoFinger      = false;
        dragEligible     = false;
        trackedFurniture = null;
    }

    void SetOutlineVisible(GameObject furniture, bool visible)
    {
        if (furniture == null) return;
        var outline = furniture.GetComponent<ARDragOutline>();
        if (outline == null && visible)
        {
            outline = furniture.AddComponent<ARDragOutline>();
            if (ARFurnitureGrounding.TryGetLocalFurnitureBounds(furniture, out var localBounds))
            {
                outline.SetupOutline(localBounds);
            }
        }
        if (outline != null)
        {
            outline.SetVisible(visible);
        }
    }

    static bool IsPointerOverUI(int pointerId)
    {
        return EventSystem.current != null &&
               EventSystem.current.IsPointerOverGameObject(pointerId);
    }
}
