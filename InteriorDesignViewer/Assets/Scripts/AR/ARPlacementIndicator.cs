using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// AR reticle that raycasts from screen center against AR planes and validates
/// the hit against the same floor-quality rules used by ARFurniturePlacer.
///
/// STATES:
///   Searching  — no valid floor plane under the reticle (hidden or dim)
///   Locked     — a valid floor plane is detected (fully visible, ready for tap)
///
/// PUBLIC API (called by ARFurniturePlacer):
///   StartTracking()   — enable reticle tracking
///   StopTracking()    — hide reticle and disable tracking
///   IsLockedOnFloor   — true only when the current hit passes ALL floor checks
///   CurrentPose       — world-space pose of the last valid floor hit
///   CurrentPlane      — the ARPlane that was hit (null when not locked)
///
/// VISUAL FEEDBACK:
///   Assign lockedMaterial / searchingMaterial in the Inspector to show
///   different colours for "floor found" vs "searching" states.
///   If only one material is assigned the renderer is shown/hidden instead.
/// </summary>
[DefaultExecutionOrder(-200)]
public class ARPlacementIndicator : MonoBehaviour
{
    // ── Inspector ─────────────────────────────────────────────────────────────
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private Renderer         indicatorRenderer;

    [Tooltip("0 = bottom, 0.5 = center, 1 = top. 0.35 = slightly below center, good for floor detection.")]
    [SerializeField] private float screenY = 0.35f;

    [Tooltip("Rotate the reticle to match the plane surface normal.")]
    [SerializeField] private bool alignToPlaneRotation = true;

    [Header("Visual states")]
    [Tooltip("Material shown when a valid floor plane is locked. Optional — falls back to show/hide.")]
    [SerializeField] private Material lockedMaterial;
    [Tooltip("Material shown while searching for a valid floor plane. Optional.")]
    [SerializeField] private Material searchingMaterial;
    [Tooltip("Scale multiplier applied when locked on a valid floor (makes the reticle pulse larger).")]
    [SerializeField] private float lockedScale   = 1.0f;
    [Tooltip("Scale multiplier applied while searching.")]
    [SerializeField] private float searchingScale = 0.7f;
    [Tooltip("Speed at which the reticle scale lerps between locked/searching sizes.")]
    [SerializeField] private float scaleSmoothing = 8f;

    [Header("Floor validation (match ARFurniturePlacer)")]
    [Tooltip("Plane must be at least this many metres below the camera to count as floor.")]
    [SerializeField] private float minDepthBelowCamera = 0.9f;
    [Tooltip("Minimum plane area (m²) to count as a valid floor.")]
    [SerializeField] private float minFloorArea = 0.25f;
    [Tooltip("Tiny lift above the plane surface to avoid z-fighting with the floor mesh.")]
    [SerializeField] private float floorSurfaceInset = 0.002f;
    [SerializeField] private Camera arCamera;

    // ── Public state ──────────────────────────────────────────────────────────
    /// <summary>True when the reticle is hitting a plane that passes ALL floor checks.</summary>
    public bool     IsLockedOnFloor { get; private set; }
    /// <summary>World-space pose of the last valid floor hit (updated every frame while tracking).</summary>
    public Pose     CurrentPose     { get; private set; }
    /// <summary>The ARPlane that was hit. Null when IsLockedOnFloor is false.</summary>
    public ARPlane  CurrentPlane    { get; private set; }
    /// <summary>World position of the reticle (where the user sees the indicator).</summary>
    public Vector3 WorldPosition => transform.position;

    /// <summary>True when the reticle is visible (tracking and at least partially hitting a surface).</summary>
    public bool     IsVisible       { get; private set; }

    // ── Private ───────────────────────────────────────────────────────────────
    private readonly List<ARRaycastHit> hits     = new();
    private bool                        isTracking;
    private Vector2                     screenPointOverride = Vector2.negativeInfinity;
    private Vector3                     baseScale;          // prefab scale at Awake
    private float                       currentScaleMultiplier = 1f;

    // ── Unity messages ────────────────────────────────────────────────────────
    void Awake()
    {
        if (raycastManager == null)
            raycastManager = FindFirstObjectByType<ARRaycastManager>();

        if (arCamera == null)
            arCamera = Camera.main;

        if (indicatorRenderer == null)
            indicatorRenderer = GetComponentInChildren<Renderer>();

        baseScale = transform.localScale;
        SetVisible(false, false);
    }

    void Update()
    {
        if (!isTracking || raycastManager == null)
        {
            SetVisible(false, false);
            return;
        }

        var screenPoint = screenPointOverride.x >= 0f
            ? screenPointOverride
            : new Vector2(Screen.width * 0.5f, Screen.height * screenY);

        if (!raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
        {
            IsLockedOnFloor = false;
            CurrentPlane    = null;
            SetVisible(false, false);
            return;
        }

        var bestHitY           = float.PositiveInfinity;
        var bestHitPose        = default(Pose);
        ARPlane bestPlane      = null;

        var nearFloorY         = float.PositiveInfinity;
        var nearFloorPose      = default(Pose);
        var nearFloorFound     = false;

        var cameraY            = arCamera != null ? arCamera.transform.position.y : float.PositiveInfinity;

        foreach (var hit in hits)
        {
            if (hit.trackable is not ARPlane hitPlane)
                continue;

            if (hitPlane.alignment != PlaneAlignment.HorizontalUp)
                continue;

            if (hitPlane.trackingState != TrackingState.Tracking)
                continue;

            if (Vector3.Dot(hit.pose.up, Vector3.up) < 0.85f)
                continue;

            // Prefer the lowest horizontal hit that is below the camera (real floor, not walls).
            if (arCamera == null || hit.pose.position.y <= cameraY - minDepthBelowCamera)
            {
                if (hit.pose.position.y < nearFloorY)
                {
                    nearFloorY     = hit.pose.position.y;
                    nearFloorPose  = hit.pose;
                    nearFloorFound = true;
                }
            }

            if (arCamera != null && hit.pose.position.y > cameraY - minDepthBelowCamera)
                continue;

            if (hitPlane.size.x * hitPlane.size.y < minFloorArea)
                continue;

            if (hit.pose.position.y < bestHitY)
            {
                bestHitY    = hit.pose.position.y;
                bestHitPose = hit.pose;
                bestPlane   = hitPlane;
            }
        }

        if (bestPlane != null)
        {
            IsLockedOnFloor = true;
            CurrentPlane    = bestPlane;
            CurrentPose     = bestHitPose;
            ApplyIndicatorPose(bestHitPose, true);
        }
        else if (nearFloorFound)
        {
            IsLockedOnFloor = false;
            CurrentPlane    = null;
            ApplyIndicatorPose(nearFloorPose, false);
        }
        else
        {
            IsLockedOnFloor = false;
            CurrentPlane    = null;
            SetVisible(false, false);
        }

        var targetMultiplier   = IsLockedOnFloor ? lockedScale : searchingScale;
        currentScaleMultiplier = Mathf.Lerp(currentScaleMultiplier, targetMultiplier, Time.deltaTime * scaleSmoothing);
        transform.localScale   = baseScale * currentScaleMultiplier;
    }

    void ApplyIndicatorPose(Pose floorPose, bool locked)
    {
        var targetRotation = alignToPlaneRotation ? floorPose.rotation : Quaternion.identity;
        var surfacePos     = floorPose.position + floorPose.up * floorSurfaceInset;
        transform.SetPositionAndRotation(surfacePos, targetRotation);
        SetVisible(true, locked);
    }

    public void StartTracking()
    {
        isTracking          = true;
        screenPointOverride = Vector2.negativeInfinity;
    }

    public void StartTracking(Vector2 screenPoint)
    {
        isTracking          = true;
        screenPointOverride = screenPoint;
    }

    /// <summary>Match furniture placement's floor-depth rule so the reticle and the sofa share a plane.</summary>
    public void SetMinDepthBelowCamera(float metres)
    {
        minDepthBelowCamera = Mathf.Max(0.05f, metres);
    }

    public void StopTracking()
    {
        isTracking          = false;
        screenPointOverride = Vector2.negativeInfinity;
        IsLockedOnFloor     = false;
        CurrentPlane        = null;
        SetVisible(false, false);
    }

    void SetVisible(bool visible, bool locked)
    {
        IsVisible = visible;

        if (indicatorRenderer == null) return;

        indicatorRenderer.enabled = visible;

        if (!visible) return;

        if (lockedMaterial != null && searchingMaterial != null)
            indicatorRenderer.material = locked ? lockedMaterial : searchingMaterial;
    }
}
