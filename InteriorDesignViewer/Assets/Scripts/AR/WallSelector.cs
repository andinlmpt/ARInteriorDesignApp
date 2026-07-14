using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

/// <summary>
/// Handles raycasting against vertical AR planes to select walls for painting.
/// NOTE: Do NOT add [RequireComponent(typeof(ARRaycastManager))] here.
/// WallSelector lives on the 'Managers' GameObject, but the real ARRaycastManager
/// lives on 'XR Origin'. Adding [RequireComponent] caused Unity to auto-attach a
/// SECOND, non-functional ARRaycastManager to Managers which never detects planes.
/// </summary>
public class WallSelector : MonoBehaviour
{
    [Header("Raycast Config")]
    [Tooltip("Drag the XR Origin's ARRaycastManager here. If left empty, it will be found automatically.")]
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private Camera arCamera;

    [Header("Events")]
    [Tooltip("Fires when a wall is tapped, passing the selected ARPlane.")]
    public UnityEngine.Events.UnityEvent<ARPlane> OnWallSelectedEvent;

    private ARPlane selectedWall;
    public ARPlane SelectedWall => selectedWall;

    private readonly List<ARRaycastHit> hits = new();

    void Awake()
    {
        // IMPORTANT: Use FindFirstObjectByType to find the REAL ARRaycastManager on XR Origin.
        // GetComponent<ARRaycastManager>() would get the wrong one if Unity auto-added one here.
        if (raycastManager == null)
        {
            raycastManager = FindFirstObjectByType<ARRaycastManager>();
            if (raycastManager == null)
                Debug.LogError("[WallSelector] CRITICAL: ARRaycastManager not found in scene! Drag it from XR Origin to the WallSelector Inspector slot.");
            else
                Debug.Log($"[WallSelector] Auto-found ARRaycastManager on: {raycastManager.gameObject.name}");
        }

        if (arCamera == null)
            arCamera = Camera.main;
    }

    void OnEnable()
    {
        EnhancedTouchSupport.Enable();
    }

    void Update()
    {
        // Detect taps/clicks and execute selector
        if (TryGetTapPosition(out var screenPoint))
        {
            SelectWallAtPoint(screenPoint);
        }
    }

    private void SelectWallAtPoint(Vector2 screenPoint)
    {
        if (raycastManager == null)
        {
            Debug.LogError("[WallSelector] raycastManager is NULL — wall tap cannot work. Check Inspector.");
            return;
        }

        Debug.Log($"[WallSelector] Raycasting at screen point {screenPoint}");

        // Raycast against flat plane polygons (avoid infinite plane projection)
        bool hit = raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon);
        Debug.Log($"[WallSelector] Raycast hit: {hit}, total hits: {hits.Count}");

        if (hit)
        {
            foreach (var h in hits)
            {
                if (h.trackable is ARPlane plane)
                {
                    Debug.Log($"[WallSelector] Hit plane alignment: {plane.alignment}, trackableId: {plane.trackableId}");
                    // Restrict interaction to vertical surfaces (walls)
                    if (plane.alignment == PlaneAlignment.Vertical)
                    {
                        selectedWall = plane;
                        Debug.Log($"[WallSelector] ✅ Wall selected! Firing OnWallSelectedEvent for {plane.trackableId}");
                        OnWallSelectedEvent?.Invoke(plane);
                        return;
                    }
                }
            }
            Debug.LogWarning("[WallSelector] Raycast hit planes but none were Vertical alignment.");
        }
        else
        {
            Debug.LogWarning("[WallSelector] Raycast hit nothing. Make sure vertical planes are being tracked.");
        }
    }

    /// <summary>
    /// Checks for a valid tap/click input point not overlapping UI elements.
    /// </summary>
    private bool TryGetTapPosition(out Vector2 screenPoint)
    {
        screenPoint = default;

        // 1. Enhanced Touch Input (mobile primary)
        if (Touch.activeTouches.Count > 0)
        {
            var t = Touch.activeTouches[0];
            if (t.phase == TouchPhase.Began)
            {
                if (IsPointerOverUI(t.touchId))
                {
                    Debug.Log("[WallSelector] Touch blocked by UI.");
                    return false;
                }

                screenPoint = t.screenPosition;
                Debug.Log($"[WallSelector] Enhanced touch at {screenPoint}");
                return true;
            }
        }

        // 2. Legacy Touch Input (mobile fallback)
        if (Input.touchCount > 0 && Input.GetTouch(0).phase == UnityEngine.TouchPhase.Began)
        {
            if (IsPointerOverUI(Input.GetTouch(0).fingerId))
            {
                Debug.Log("[WallSelector] Legacy touch blocked by UI.");
                return false;
            }

            screenPoint = Input.GetTouch(0).position;
            Debug.Log($"[WallSelector] Legacy touch at {screenPoint}");
            return true;
        }

        // 3. Mouse Click (Editor testing)
#if UNITY_EDITOR
        if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
        {
            if (IsPointerOverUI())
                return false;

            screenPoint = Mouse.current.position.ReadValue();
            return true;
        }
#endif
        return false;
    }

    private bool IsPointerOverUI(int pointerId = -1)
    {
        if (EventSystem.current == null) return false;
        
        if (pointerId >= 0)
            return EventSystem.current.IsPointerOverGameObject(pointerId);
            
        return EventSystem.current.IsPointerOverGameObject();
    }
}
