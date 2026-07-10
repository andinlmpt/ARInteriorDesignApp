using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Events;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

/// <summary>
/// Manages AR furniture placement.
///
/// FLOW:
///   1. SCANNING  — reticle is active. ARPlaneManager detects and grows a floor
///                  plane. No furniture exists. OnScanProgress fires each frame.
///   2. READY     — scanning criteria met. Reticle is locked on the floor
///                  (IsLockedOnFloor == true). OnSurfaceReady fires once.
///                  User TAPS to confirm placement.
///   3. PLACED    — furniture instantiated at the tapped position via
///                  Gabmeister-style elastic spawn animation. OnFurniturePlaced
///                  fires. User can tap again to reposition.
///
/// KEY DESIGN DECISIONS:
///   • No auto-place timer — furniture appears ONLY on an explicit tap when the
///     reticle is locked on a valid floor plane.
///   • Reticle visible throughout scanning AND ready-to-place phases.
///   • Lowest-Y plane selection (not nearest) prevents desk/table mis-detection.
///   • Pivot pinned to floorY at spawn, scale grows from zero (Gabmeister).
///   • AlignToFloor deferred one frame so renderer.bounds are initialised first.
/// </summary>
public class ARFurniturePlacer : MonoBehaviour
{
    /// <summary>Set by ARFurnitureGestureController while drag/pinch/rotate is active.</summary>
    public static bool SuppressPlacementInput { get; set; }

    // ── State machine ─────────────────────────────────────────────────────────
    public enum ScanState { Scanning, ReadyToPlace, Placed }

    private struct FloorPlacementHit
    {
        public Pose    pose;
        public ARPlane plane;
    }

    // ── Inspector: AR references ──────────────────────────────────────────────
    [Header("AR")]
    [SerializeField] private ARRaycastManager    raycastManager;
    [SerializeField] private ARPlaneManager      planeManager;
    [SerializeField] private ARAnchorManager     anchorManager;
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private Transform           furnitureParent;
    [SerializeField] private Camera              arCamera;

    // ── Inspector: Furniture ──────────────────────────────────────────────────
    [Header("Furniture")]
    [SerializeField] private GameObject furniturePrefab;

    // ── Inspector: Floor detection ────────────────────────────────────────────
    [Header("Floor detection")]
    [Tooltip("Plane must be at least this many metres below the camera to count as floor (rejects desks).")]
    [SerializeField] private float minDepthBelowCamera = 0.9f;
    [Tooltip("Minimum plane area (m²) for placement raycasts.")]
    [SerializeField] private float minFloorArea = 0.25f;

    // ── Inspector: Scanning phase ─────────────────────────────────────────────
    [Header("Scanning phase")]
    [Tooltip("Minimum plane area (m²) before scanning completes.")]
    [SerializeField] private float scanMinArea = 0.25f;
    [Tooltip("Seconds the same plane must be continuously tracked.")]
    [SerializeField] private float scanRequiredDuration = 1.5f;
    [Tooltip("Minimum area growth (m²) — forces the user to pan the camera rather than freeze on one patch.")]
    [SerializeField] private float scanMinAreaGrowth = 0.15f;

    // ── Inspector: Scanning events ────────────────────────────────────────────
    [Header("Scanning events")]
    public UnityEvent        OnScanStarted;
    /// <summary>Progress 0‥1 — fired every frame while scanning.</summary>
    public UnityEvent<float> OnScanProgress;
    /// <summary>Fired once when scanning criteria are met and the reticle becomes active.</summary>
    public UnityEvent        OnSurfaceReady;
    /// <summary>Fired once when furniture is first placed.</summary>
    public UnityEvent        OnFurniturePlacedEvent;

    // ── Inspector: Indicator ──────────────────────────────────────────────────
    [Header("Indicator")]
    [Tooltip("Hide the reticle once furniture has been placed and the user stops tapping.")]
    [SerializeField] private bool hideIndicatorAfterPlace = true;

    // ── Inspector: Placement distance ─────────────────────────────────────────
    [Header("Placement distance")]
    [Tooltip("Meters in front of camera used for the auto-place fallback pose.")]
    [SerializeField] private float placeDistanceInFront = 2.5f;
    [Tooltip("Furniture will not be placed closer than this to the camera (metres, horizontal).")]
    [SerializeField] private float minAutoPlaceDistance  = 0.5f;

    // ── Inspector: Spawn animation ────────────────────────────────────────────
    [Header("Spawn animation")]
    [SerializeField] private bool  animateSpawn  = true;
    [SerializeField] private float spawnDuration = 0.45f;

    // ── Inspector: Grounding ──────────────────────────────────────────────────
    [Header("Grounding")]
    [SerializeField] private bool       addBlobShadow    = false;
    [SerializeField] private GameObject blobShadowPrefab;
    [SerializeField] private float      blobShadowScale  = 0.55f;
    [Tooltip("Slight push into the floor so legs visually touch tiles.")]
    [SerializeField] private float floorContactInset = 0.02f;

    // ── Inspector: Drift correction ───────────────────────────────────────────
    [Header("Drift correction")]
    [Tooltip("Keep re-snapping to live floor height for this many seconds after placement.")]
    [SerializeField] private float continuousFloorSnapDuration   = 8f;
    [Tooltip("Wait this long after placement before re-raycasting floor height.")]
    [SerializeField] private float postPlacementCorrectionDelay  = 2.5f;
    [SerializeField] private float floorCorrectionThreshold      = 0.01f;
    [SerializeField] private float floorCorrectionSmoothDuration = 0.25f;

    // ── Private: state machine ────────────────────────────────────────────────
    private ScanState currentScanState = ScanState.Scanning;

    // Scanning bookkeeping
    private ARPlane scanTrackedPlane;
    private float   scanTrackedSince     = -1f;
    private float   scanTrackedStartArea =  0f;

    // Placement
    private GameObject activePrefab;
    private GameObject placedInstance;
    private ARPlane    activePlacementPlane;
    private ARAnchor   activeAnchor;
    private float      floorSnapUntilTime;
    private float      lastKnownFloorY;
    private bool       hasPlacedOnce = false;
    private readonly List<ARRaycastHit> hits = new();
    private Coroutine spawnCoroutine;
    private Coroutine correctionCoroutine;

    // ── Unity messages ────────────────────────────────────────────────────────
    void OnEnable()  => EnhancedTouchSupport.Enable();

    void Start()
    {
        if (arCamera == null)
            arCamera = Camera.main;

        if (anchorManager == null)
            anchorManager = FindFirstObjectByType<ARAnchorManager>();

        EnsureFurnitureParentInSessionSpace();

        if (furniturePrefab != null)
            SetPrefab(furniturePrefab);
        else
            EnterScanningState();
    }

    void Update()
    {
        if (activePrefab == null || arCamera == null)
            return;

        switch (currentScanState)
        {
            case ScanState.Scanning:
                UpdateScanning();
                // ALSO handle taps during scanning — if the indicator is already
                // locked on a valid floor, let the user place immediately rather
                // than waiting for the full scan timer to expire.
                if (placementIndicator != null && placementIndicator.IsLockedOnFloor)
                    UpdateReadyOrPlaced();
                break;

            case ScanState.ReadyToPlace:
            case ScanState.Placed:
                UpdateReadyOrPlaced();
                break;
        }
    }

    // ── SCANNING state ────────────────────────────────────────────────────────

    /// <summary>
    /// Tracks the best (lowest-Y) valid horizontal floor plane each frame.
    /// Fires OnScanProgress and transitions to ReadyToPlace when all criteria met.
    /// The reticle stays active throughout so the user sees plane feedback.
    /// </summary>
    void UpdateScanning()
    {
        if (planeManager == null)
        {
            Debug.LogWarning("[ARFurniturePlacer] ARPlaneManager not assigned — cannot scan.");
            return;
        }

        // ── Keep the reticle tracking during scanning so the user sees where
        //    planes are being detected (even though taps do nothing yet).
        placementIndicator?.StartTracking();

        // ── Find the best (lowest Y) qualifying floor candidate.
        var cameraY       = arCamera.transform.position.y;
        ARPlane best      = null;
        var     bestY     = float.PositiveInfinity;

        foreach (var plane in planeManager.trackables)
        {
            if (plane.alignment    != PlaneAlignment.HorizontalUp) continue;
            if (plane.trackingState != TrackingState.Tracking)     continue;

            var planeY = plane.transform.position.y;
            if (planeY > cameraY - minDepthBelowCamera)            continue;
            if (planeY < bestY) { bestY = planeY; best = plane; }
        }

        if (best == null)
        {
            if (scanTrackedPlane != null)
            {
                Debug.Log("[ARFurniturePlacer] Scan: lost tracked plane — resetting timer.");
                ResetScanTracking();
            }
            OnScanProgress?.Invoke(0f);
            return;
        }

        if (best != scanTrackedPlane)
        {
            Debug.Log($"[ARFurniturePlacer] Scan: new candidate plane '{best.trackableId}' Y={bestY:F3}.");
            scanTrackedPlane     = best;
            scanTrackedSince     = Time.time;
            scanTrackedStartArea = best.size.x * best.size.y;
        }

        var elapsed     = Time.time - scanTrackedSince;
        var currentArea = best.size.x * best.size.y;
        var areaGrowth  = currentArea - scanTrackedStartArea;

        // Progress reported as min(time, growth). Guard against zero scanMinAreaGrowth.
        var timeProgress   = Mathf.Clamp01(elapsed / scanRequiredDuration);
        var growthProgress = scanMinAreaGrowth > 0f
            ? Mathf.Clamp01(areaGrowth / scanMinAreaGrowth)
            : 1f;
        OnScanProgress?.Invoke(Mathf.Min(timeProgress, growthProgress));

        // Scan completes once the plane is big enough and has been tracked long
        // enough. Area growth is optional — not all environments allow panning.
        var areaOk = currentArea >= scanMinArea;
        var timeOk = elapsed    >= scanRequiredDuration;

        if (areaOk && timeOk)
        {
            Debug.Log($"[ARFurniturePlacer] Scan complete — plane '{best.trackableId}' " +
                      $"area={currentArea:F3} elapsed={elapsed:F2}s.");
            currentScanState = ScanState.ReadyToPlace;
            OnSurfaceReady?.Invoke();
        }
    }

    // ── READY / PLACED state ──────────────────────────────────────────────────

    /// <summary>
    /// Keeps the reticle tracking from screen center.
    /// Furniture is ONLY placed when the user taps AND the reticle is locked on
    /// a valid floor plane. No auto-place timer.
    /// After initial placement, a tap repositions the furniture.
    /// </summary>
    void UpdateReadyOrPlaced()
    {
        var isTap = TryGetTapPosition(out var tapPoint);

        // ── Indicator tracking ────────────────────────────────────────────────
        if (currentScanState == ScanState.ReadyToPlace || !hasPlacedOnce)
        {
            // Always track from screen center while waiting for the first placement.
            placementIndicator?.StartTracking();
        }
        else if (isTap)
        {
            // After first placement, show the reticle at the tap point briefly.
            placementIndicator?.StartTracking(tapPoint);
        }
        else if (hideIndicatorAfterPlace)
        {
            placementIndicator?.StopTracking();
        }

        // ── Gate placement on tap ───────────────────────────────────────────
        if (!isTap) return;
        if (SuppressPlacementInput) return;

        FloorPlacementHit hit;
        var               gotHit = TryGetPlacementHit(tapPoint, out hit);
        if (!gotHit) return;

        hit.pose.position = EnforceMinDistance(hit.pose.position);
        DoPlaceFurniture(hit);
    }

    /// <summary>
    /// First placement uses the locked indicator position.
    /// Reposition uses tap raycast (indicator may not update same frame).
    /// </summary>
    bool TryGetPlacementHit(Vector2 tapPoint, out FloorPlacementHit hit)
    {
        hit = default;

        if (!hasPlacedOnce)
        {
            if (placementIndicator == null || !placementIndicator.IsLockedOnFloor)
            {
                Debug.Log("[ARFurniturePlacer] Tap ignored: point at the floor until the indicator locks.");
                return false;
            }

            hit = new FloorPlacementHit
            {
                pose  = placementIndicator.CurrentPose,
                plane = placementIndicator.CurrentPlane,
            };
            hit.pose.position = placementIndicator.CurrentPose.position;
            return true;
        }

        if (TryGetFloorPoseFromRaycast(tapPoint, minDepthBelowCamera, minFloorArea,
                out var tapPose, out var tapPlane))
        {
            hit = new FloorPlacementHit { pose = tapPose, plane = tapPlane };
            return true;
        }

        if (placementIndicator != null && placementIndicator.IsLockedOnFloor)
        {
            hit = new FloorPlacementHit
            {
                pose  = placementIndicator.CurrentPose,
                plane = placementIndicator.CurrentPlane,
            };
            hit.pose.position = placementIndicator.CurrentPose.position;
            return true;
        }

        Debug.Log("[ARFurniturePlacer] Tap ignored: no valid floor under tap.");
        return false;
    }

    // ── State transitions ─────────────────────────────────────────────────────

    void EnterScanningState()
    {
        currentScanState = ScanState.Scanning;
        ResetScanTracking();
        hasPlacedOnce    = false;

        // Show the reticle immediately so the user gets plane-detection feedback
        // even during scanning.
        placementIndicator?.StartTracking();

        Debug.Log("[ARFurniturePlacer] → SCANNING state.");
        OnScanStarted?.Invoke();
    }

    void ResetScanTracking()
    {
        scanTrackedPlane     = null;
        scanTrackedSince     = -1f;
        scanTrackedStartArea =  0f;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>Assign a new prefab. Clears any placed furniture and restarts scanning.</summary>
    public void SetPrefab(GameObject prefab)
    {
        if (prefab == null) return;
        activePrefab = prefab;
        ClearPlacedFurniture();
        EnterScanningState();
    }

    /// <summary>Destroy the currently placed furniture and return to scanning.</summary>
    public void ClearPlacedFurniture()
    {
        StopSpawnAnimation();
        StopFloorCorrection();
        DestroyPlacementAnchor();
        activePlacementPlane = null;
        floorSnapUntilTime   = 0f;
        ARFurnitureGrounding.ClearBlobShadows(furnitureParent);

        if (placedInstance != null)
        {
            Destroy(placedInstance);
            placedInstance = null;
        }
    }

    /// <summary>Manual fine-tuning: move the placed furniture up or down.</summary>
    public void NudgeVertical(float deltaMeters)
    {
        if (placedInstance == null || Mathf.Approximately(deltaMeters, 0f)) return;
        placedInstance.transform.position += Vector3.up * deltaMeters;
        RefreshBlobShadow();
    }

    /// <summary>
    /// Projects <paramref name="worldPoint"/> to screen space and raycasts against
    /// AR planes to find the floor height at that world location.
    /// Used by ARFurnitureGestureController to re-ground furniture during drag.
    /// </summary>
    public bool TryGetFloorHeightAtWorldPoint(Vector3 worldPoint, out float floorY)
    {
        floorY = 0f;
        if (arCamera == null || raycastManager == null) return false;

        var bestY = float.PositiveInfinity;
        var found = false;

        // Sample the given point and a small cross-pattern around it.
        var offsets = new[]
        {
            Vector3.zero,
            new Vector3( 0.08f, 0f,  0f),
            new Vector3(-0.08f, 0f,  0f),
            new Vector3( 0f,    0f,  0.08f),
            new Vector3( 0f,    0f, -0.08f),
        };

        foreach (var off in offsets)
        {
            var sampleWorld  = worldPoint + off + Vector3.up * 0.35f;
            var screenPoint  = (Vector2)arCamera.WorldToScreenPoint(sampleWorld);
            if (screenPoint.x < 0f || screenPoint.y < 0f ||
                screenPoint.x > Screen.width || screenPoint.y > Screen.height)
                continue;

            if (!TryGetFloorPoseFromRaycast(screenPoint, minDepthBelowCamera, minFloorArea,
                    out var p, out _))
                continue;

            if (p.position.y < bestY) { bestY = p.position.y; found = true; }
        }

        if (!found) return false;
        floorY = bestY;
        return true;
    }

    /// <summary>Public wrapper so external scripts can refresh the blob shadow.</summary>
    public void RefreshBlobShadowExternal() => RefreshBlobShadow();

    /// <summary>
    /// Exposes the floor-contact inset so the gesture controller can pass the
    /// same value to ARFurnitureGrounding.AlignToFloor.
    /// </summary>
    public float FloorContactInset => floorContactInset;

    /// <summary>The currently placed furniture instance (null if none).</summary>
    public GameObject PlacedInstance => placedInstance;

    /// <summary>Current state (Scanning / ReadyToPlace / Placed).</summary>
    public ScanState CurrentScanState => currentScanState;

    // ── Placement ─────────────────────────────────────────────────────────────

    void DoPlaceFurniture(FloorPlacementHit hit)
    {
        var prefab = activePrefab ?? furniturePrefab;
        if (prefab == null)
        {
            Debug.LogWarning("[ARFurniturePlacer] No furniture prefab assigned.");
            return;
        }

        Vector3 indicatorPos;
        Pose    placePose;

        if (!hasPlacedOnce)
        {
            if (placementIndicator == null || !placementIndicator.IsLockedOnFloor)
            {
                Debug.Log("[ARFurniturePlacer] Placement blocked: indicator not locked on floor.");
                return;
            }

            placePose    = placementIndicator.CurrentPose;
            indicatorPos = placePose.position;
        }
        else
        {
            placePose    = hit.pose;
            indicatorPos = hit.pose.position;
        }

        lastKnownFloorY      = indicatorPos.y;
        activePlacementPlane = hit.plane ?? placementIndicator.CurrentPlane;
        floorSnapUntilTime   = Time.time + continuousFloorSnapDuration;

        StopSpawnAnimation();
        StopFloorCorrection();
        DestroyPlacementAnchor();
        ARFurnitureGrounding.ClearBlobShadows(furnitureParent);

        if (placedInstance != null)
            Destroy(placedInstance);

        var yaw         = arCamera.transform.eulerAngles.y;
        var rotation    = Quaternion.Euler(0f, yaw, 0f);
        var targetScale = prefab.transform.localScale;

        placedInstance = Instantiate(prefab);
        ARFurniturePrefabCleanup.HideEmbeddedBaseMeshes(placedInstance);
        placedInstance.transform.SetPositionAndRotation(indicatorPos, rotation);
        placedInstance.transform.localScale = targetScale;

        if (furnitureParent != null)
            placedInstance.transform.SetParent(furnitureParent, true);

        CreatePlacementAnchor(hit, new Pose(indicatorPos, rotation));
        if (activeAnchor != null)
            placedInstance.transform.SetParent(activeAnchor.transform, true);

        spawnCoroutine = StartCoroutine(
            FinalizePlacedFurniture(placedInstance, indicatorPos, targetScale, animateSpawn));

        hasPlacedOnce = true;
        if (currentScanState != ScanState.Placed)
        {
            currentScanState = ScanState.Placed;
            OnFurniturePlacedEvent?.Invoke();
        }

        if (hideIndicatorAfterPlace)
            placementIndicator?.StopTracking();

        Debug.Log($"[ARFurniturePlacer] Placed '{prefab.name}' at indicator Y={indicatorPos.y:F3}");
        UnityMessageBridge.SendToApp("furniturePlaced", placedInstance.name);
    }

    // ── Raycast / plane helpers ───────────────────────────────────────────────

    /// <summary>
    /// Raycasts and returns the hit with the LOWEST Y that passes all floor checks.
    /// Shared logic between indicator, placement, and footprint raycasts.
    /// </summary>
    bool TryGetFloorPoseFromRaycast(Vector2 screenPoint, float minDepth, float minArea,
                                     out Pose pose, out ARPlane plane)
    {
        pose  = default;
        plane = null;

        if (raycastManager == null || !raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
            return false;

        var cameraY      = arCamera.transform.position.y;
        var bestY        = float.PositiveInfinity;
        var bestPose     = default(Pose);
        ARPlane bestPlane = null;

        foreach (var hit in hits)
        {
            if (hit.trackable is not ARPlane hp)                                 continue;
            if (hp.alignment    != PlaneAlignment.HorizontalUp)                  continue;
            if (hp.trackingState != TrackingState.Tracking)                      continue;
            if (Vector3.Dot(hit.pose.up, Vector3.up) < 0.85f)                   continue;
            if (hit.pose.position.y > cameraY - minDepth)                        continue;
            if (hp.size.x * hp.size.y < minArea)                                 continue;

            if (hit.pose.position.y < bestY)
            {
                bestY     = hit.pose.position.y;
                bestPose  = hit.pose;
                bestPlane = hp;
            }
        }

        if (bestPlane == null) return false;

        Debug.Log($"[ARFurniturePlacer] Raycast → plane '{bestPlane.trackableId}' Y={bestY:F3} " +
                  $"(lowest of {hits.Count} hits).");
        pose  = bestPose;
        plane = bestPlane;
        return true;
    }

    /// <summary>
    /// Scans all tracked planes and returns the lowest-Y one passing all filters.
    /// Used as a fallback when the screen-center raycast misses.
    /// </summary>
    bool TryGetAutoPlacePose(out Pose pose, out ARPlane plane)
    {
        pose  = default;
        plane = null;
        if (planeManager == null) return false;

        var cameraPos  = arCamera.transform.position;
        var bestY      = float.PositiveInfinity;
        ARPlane best   = null;

        foreach (var tp in planeManager.trackables)
        {
            if (tp.alignment    != PlaneAlignment.HorizontalUp) continue;
            if (tp.trackingState != TrackingState.Tracking)     continue;
            var py = tp.transform.position.y;
            if (py > cameraPos.y - minDepthBelowCamera)         continue;
            if (tp.size.x * tp.size.y < minFloorArea)           continue;
            if (py < bestY) { bestY = py; best = tp; }
        }

        if (best == null) return false;

        Debug.Log($"[ARFurniturePlacer] Auto-place → plane '{best.trackableId}' Y={bestY:F3}.");
        var pos  = cameraPos + GetFlatForward() * placeDistanceInFront;
        pos.y    = best.transform.position.y;
        pose     = new Pose(pos, Quaternion.identity);
        plane    = best;
        return true;
    }

    Vector3 EnforceMinDistance(Vector3 position)
    {
        var cam    = arCamera.transform.position;
        var offset = position - cam;
        offset.y   = 0f;
        if (offset.sqrMagnitude >= minAutoPlaceDistance * minAutoPlaceDistance)
            return position;
        var dir    = offset.sqrMagnitude > 0.01f ? offset.normalized : GetFlatForward();
        var adj    = cam + dir * minAutoPlaceDistance;
        adj.y      = position.y;
        return adj;
    }

    Vector3 GetFlatForward()
    {
        var f = arCamera.transform.forward;
        f.y   = 0f;
        return f.sqrMagnitude < 0.001f ? Vector3.forward : f.normalized;
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    bool TryGetTapPosition(out Vector2 screenPoint)
    {
        screenPoint = default;

        if (Touch.activeTouches.Count > 0)
        {
            var t = Touch.activeTouches[0];
            if (t.phase == TouchPhase.Began)
            {
                if (IsPointerOverUI(t.touchId))
                    return false;

                screenPoint = t.screenPosition;
                return true;
            }
        }

        if (Input.touchCount > 0 && Input.GetTouch(0).phase == UnityEngine.TouchPhase.Began)
        {
            if (IsPointerOverUI(Input.GetTouch(0).fingerId))
                return false;

            screenPoint = Input.GetTouch(0).position;
            return true;
        }

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

    static bool IsPointerOverUI(int pointerId = -1)
    {
        if (EventSystem.current == null)
            return false;

        return pointerId >= 0
            ? EventSystem.current.IsPointerOverGameObject(pointerId)
            : EventSystem.current.IsPointerOverGameObject();
    }

    // ── Anchors ───────────────────────────────────────────────────────────────

    void CreatePlacementAnchor(FloorPlacementHit hit, Pose pose)
    {
        if (anchorManager == null || hit.plane == null) return;
        activeAnchor = anchorManager.AttachAnchor(hit.plane, pose);
    }

    IEnumerator FinalizePlacedFurniture(GameObject obj, Vector3 indicatorPos, Vector3 targetScale, bool useSpawnAnimation)
    {
        yield return null;
        yield return new WaitForEndOfFrame();
        if (obj == null) { spawnCoroutine = null; yield break; }

        var floorPoint = new Vector3(indicatorPos.x, indicatorPos.y, indicatorPos.z);
        yield return SnapFeetToFloorWhenReady(obj, floorPoint);

        if (useSpawnAnimation)
        {
            obj.transform.localScale = Vector3.zero;
            yield return SpawnScaleAnimation(targetScale, spawnDuration, obj, floorPoint.y);
        }

        yield return SnapFeetToFloorWhenReady(obj, floorPoint);

        if (addBlobShadow)
            RefreshBlobShadow();

        correctionCoroutine = StartCoroutine(PostPlacementFloorCorrection(floorPoint.y));
        spawnCoroutine = null;
    }

    IEnumerator SnapFeetToFloorWhenReady(GameObject obj, Vector3 floorPoint)
    {
        for (var i = 0; i < 10 && obj != null; i++)
        {
            if (ARFurnitureGrounding.SnapPivotToFloorPoint(obj, floorPoint, floorContactInset))
            {
                var footY = ARFurnitureGrounding.GetSupportContactY(obj);
                Debug.Log($"[ARFurniturePlacer] Snapped feet to floor footY={footY:F3} pivotY={obj.transform.position.y:F3}");
                yield break;
            }

            ARFurnitureGrounding.PlaceFeetOnFloor(obj, floorPoint, floorContactInset, 12);
            var contactY = ARFurnitureGrounding.GetSupportContactY(obj);
            if (!float.IsPositiveInfinity(contactY) &&
                Mathf.Abs(contactY - (floorPoint.y - floorContactInset)) < 0.05f)
            {
                Debug.Log($"[ARFurniturePlacer] Feet grounded via iterative snap contactY={contactY:F3}");
                yield break;
            }

            yield return null;
        }

        if (obj != null)
            Debug.LogWarning("[ARFurniturePlacer] Could not fully ground furniture; kept best-effort position.");
    }

    void DestroyPlacementAnchor()
    {
        if (activeAnchor == null) return;
        Destroy(activeAnchor.gameObject);
        activeAnchor = null;
    }

    // ── Coroutines ────────────────────────────────────────────────────────────

    void StopSpawnAnimation()
    {
        if (spawnCoroutine    != null) { StopCoroutine(spawnCoroutine);    spawnCoroutine    = null; }
    }

    void StopFloorCorrection()
    {
        if (correctionCoroutine != null) { StopCoroutine(correctionCoroutine); correctionCoroutine = null; }
    }

    /// <summary>
    /// Gabmeister-style spawn animation:
    ///   Frame 0:    yield — Unity initialises renderer.bounds.
    ///   Phase 1 (80% duration): 0% → 110% scale. Pivot stays at floorY — the
    ///               object "grows from the floor" naturally. NO AlignToFloor
    ///               during this phase because bounds are unreliable at small scale.
    ///   Phase 2 (20% duration): 110% → 100% elastic settle.
    ///   Final:      Set exact target scale, then ONE authoritative AlignToFloor
    ///               when renderer.bounds are fully valid.
    /// </summary>
    IEnumerator SpawnScaleAnimation(Vector3 targetScale, float duration, GameObject obj, float initFloorY)
    {
        if (obj == null) { yield break; }

        var floorPoint = new Vector3(obj.transform.position.x, initFloorY, obj.transform.position.z);
        var spawnPos   = obj.transform.position;

        var overshoot    = targetScale * 1.1f;
        var growDuration = duration * 0.8f;
        var elapsed      = 0f;
        var rate         = growDuration > 0f ? 1f / growDuration : 1f;

        while (elapsed < 1f && obj != null)
        {
            elapsed += Time.deltaTime * rate;
            obj.transform.localScale = Vector3.Lerp(Vector3.zero, overshoot,
                                                    Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(elapsed)));
            obj.transform.position = spawnPos;
            yield return null;
        }

        var settleDuration = duration * 0.2f;
        elapsed = 0f;
        rate    = settleDuration > 0f ? 1f / settleDuration : 1f;

        while (elapsed < 1f && obj != null)
        {
            elapsed += Time.deltaTime * rate;
            obj.transform.localScale = Vector3.Lerp(overshoot, targetScale,
                                                    Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(elapsed)));
            yield return null;
        }

        if (obj != null)
        {
            obj.transform.localScale = targetScale;
            ARFurnitureGrounding.PlaceFeetOnFloor(obj, floorPoint, floorContactInset);

            var contactY = ARFurnitureGrounding.GetSupportContactY(obj);
            Debug.Log($"[ARFurniturePlacer] Spawn done '{obj.name}' " +
                      $"floorY={initFloorY:F3} contactY={contactY:F3} " +
                      $"pivotY={obj.transform.position.y:F3}");
        }
    }

    /// <summary>Re-checks floor height at furniture footprint after ARCore settles.</summary>
    IEnumerator PostPlacementFloorCorrection(float initialFloorY)
    {
        var checkpoints = new[] { 0.5f, postPlacementCorrectionDelay, postPlacementCorrectionDelay + 2f };
        var prev        = 0f;

        foreach (var cp in checkpoints)
        {
            yield return new WaitForSeconds(cp - prev);
            prev = cp;

            if (placedInstance == null) { correctionCoroutine = null; yield break; }
            if (!TryGetFloorYAtFootprint(out var corrY))                              continue;

            var restY = ARFurnitureGrounding.GetSupportContactY(placedInstance);
            if (float.IsPositiveInfinity(restY))                                      continue;
            if (Mathf.Abs(corrY - (restY + floorContactInset)) <= floorCorrectionThreshold) continue;

            yield return SmoothAlignToFloor(corrY, floorCorrectionSmoothDuration);
            lastKnownFloorY = corrY;
            RefreshBlobShadow();
            Debug.Log($"[ARFurniturePlacer] Floor correction → {corrY:F3}");
        }

        correctionCoroutine = null;
    }

    // ── Floor Y helpers ───────────────────────────────────────────────────────

    bool TryGetFloorYAtFootprint(out float floorY)
    {
        floorY = 0f;
        if (placedInstance == null || arCamera == null || raycastManager == null) return false;
        if (!ARFurnitureGrounding.TryGetFootprint(placedInstance, out var center, out _, out _)) return false;

        var bestY = float.PositiveInfinity;
        var found = false;

        var offsets = new[]
        {
            Vector3.zero,
            new Vector3( 0.08f, 0f, 0f),
            new Vector3(-0.08f, 0f, 0f),
            new Vector3(0f, 0f,  0.08f),
            new Vector3(0f, 0f, -0.08f),
        };

        foreach (var off in offsets)
        {
            var sp = (Vector2)arCamera.WorldToScreenPoint(center + off + Vector3.up * 0.35f);
            if (sp.x < 0f || sp.y < 0f || sp.x > Screen.width || sp.y > Screen.height) continue;
            if (!TryGetFloorPoseFromRaycast(sp, minDepthBelowCamera, minFloorArea, out var p, out _)) continue;
            if (p.position.y < bestY) { bestY = p.position.y; found = true; }
        }

        if (!found) return false;
        floorY = bestY;
        return true;
    }

    IEnumerator SmoothAlignToFloor(float targetY, float duration)
    {
        if (placedInstance == null) yield break;
        var startPos = placedInstance.transform.position;
        var startLow = ARFurnitureGrounding.GetSupportContactY(placedInstance);
        if (float.IsPositiveInfinity(startLow)) yield break;

        var targetPos  = startPos;
        targetPos.y   += (targetY - floorContactInset) - startLow;
        var elapsed    = 0f;

        while (elapsed < duration && placedInstance != null)
        {
            elapsed += Time.deltaTime;
            var t    = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(elapsed / duration));
            placedInstance.transform.position = Vector3.Lerp(startPos, targetPos, t);
            yield return null;
        }

        if (placedInstance != null)
        {
            var pt = new Vector3(placedInstance.transform.position.x, targetY, placedInstance.transform.position.z);
            ARFurnitureGrounding.PlaceFeetOnFloor(placedInstance, pt, floorContactInset, 8);
        }
    }

    // ── Misc ──────────────────────────────────────────────────────────────────

    void RefreshBlobShadow()
    {
        if (!addBlobShadow || placedInstance == null) return;
        ARFurnitureGrounding.AttachBlobShadow(placedInstance, furnitureParent, blobShadowPrefab, blobShadowScale);
    }

    void EnsureFurnitureParentInSessionSpace()
    {
        if (furnitureParent == null || raycastManager == null) return;
        var root = raycastManager.transform;
        if (furnitureParent.parent != root)
            furnitureParent.SetParent(root, true);
    }

    static void ApplyTargetScale(GameObject go, Vector3 s) => go.transform.localScale = s;
}
