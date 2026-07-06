using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

public class ARFurniturePlacer : MonoBehaviour
{
    private struct FloorPlacementHit
    {
        public Pose pose;
        public ARPlane plane;
    }

    [Header("AR")]
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private ARAnchorManager anchorManager;
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private Transform furnitureParent;
    [SerializeField] private Camera arCamera;

    [Header("Furniture")]
    [SerializeField] private GameObject furniturePrefab;

    [Header("Floor detection")]
    [SerializeField] private float minDepthBelowCamera = 0.75f;
    [SerializeField] private float minFloorArea = 0.25f;
    [SerializeField] private float autoPlaceDelay = 1f;

    [Header("Indicator")]
    [SerializeField] private bool hideIndicatorAfterPlace = true;

    [Header("Placement distance")]
    [Tooltip("Screen Y for auto-place ray (0=bottom, 1=top). 0.35 = lower third like a natural floor view.")]
    [SerializeField] private float placementScreenY = 0.35f;
    [Tooltip("Meters in front of camera when raycast misses (fallback).")]
    [SerializeField] private float placeDistanceInFront = 2.5f;
    [Tooltip("Auto-place never closer than this (meters).")]
    [SerializeField] private float minAutoPlaceDistance = 2f;

    [Header("Spawn animation")]
    [SerializeField] private bool animateSpawn = true;
    [SerializeField] private float spawnDuration = 0.35f;
    [Tooltip("Starting scale as a fraction of the prefab scale (0.05 = 5%).")]
    [SerializeField] private float spawnStartScaleFactor = 0.05f;

    [Header("Grounding")]
    [SerializeField] private bool addBlobShadow = true;
    [SerializeField] private GameObject blobShadowPrefab;
    [SerializeField] private float blobShadowScale = 0.55f;
    [Tooltip("Slight push into the floor plane so legs visually touch tiles.")]
    [SerializeField] private float floorContactInset = 0.02f;

    [Header("Anchor + drift correction")]
    [Tooltip("Keep re-snapping to the live floor height for this many seconds after placement.")]
    [SerializeField] private float continuousFloorSnapDuration = 8f;
    [Tooltip("Wait this long after placement before re-checking floor height (ARCore plane refinement).")]
    [SerializeField] private float postPlacementCorrectionDelay = 2.5f;
    [SerializeField] private float floorCorrectionThreshold = 0.01f;
    [SerializeField] private float floorCorrectionSmoothDuration = 0.25f;

    private GameObject activePrefab;
    private GameObject placedInstance;
    private ARPlane activePlacementPlane;
    private ARAnchor activeAnchor;
    private float floorSnapUntilTime;
    private float lastKnownFloorY;
    private readonly List<ARRaycastHit> hits = new();
    private bool autoPlaced;
    private float floorStableSince = -1f;
    private Coroutine spawnCoroutine;
    private Coroutine correctionCoroutine;

    void OnEnable()
    {
        EnhancedTouchSupport.Enable();
    }

    void Start()
    {
        if (arCamera == null)
        {
            arCamera = Camera.main;
        }

        if (anchorManager == null)
        {
            anchorManager = FindFirstObjectByType<ARAnchorManager>();
        }

        EnsureFurnitureParentInSessionSpace();

        if (furniturePrefab != null)
        {
            SetPrefab(furniturePrefab);
        }

        placementIndicator?.StopTracking();
    }

    void LateUpdate()
    {
        if (placedInstance == null || Time.time > floorSnapUntilTime)
        {
            return;
        }

        if (!TryGetFloorYAtFootprint(out var floorY))
        {
            if (activePlacementPlane != null)
            {
                floorY = activePlacementPlane.transform.position.y;
            }
            else
            {
                floorY = lastKnownFloorY;
            }
        }
        else
        {
            lastKnownFloorY = floorY;
        }

        var contactY = ARFurnitureGrounding.GetSupportContactY(placedInstance);
        if (float.IsPositiveInfinity(contactY))
        {
            return;
        }

        var targetRestingY = floorY - floorContactInset;
        if (Mathf.Abs(contactY - targetRestingY) > 0.002f)
        {
            ARFurnitureGrounding.AlignToFloor(placedInstance, floorY, floorContactInset);
        }
    }

    void EnsureFurnitureParentInSessionSpace()
    {
        if (furnitureParent == null || raycastManager == null)
        {
            return;
        }

        var sessionRoot = raycastManager.transform;
        if (furnitureParent.parent == sessionRoot)
        {
            return;
        }

        furnitureParent.SetParent(sessionRoot, true);
    }

    void UpdatePlacementIndicator(bool isTap, Vector2 screenPoint)
    {
        if (placementIndicator == null)
        {
            return;
        }

        if (!autoPlaced)
        {
            placementIndicator.StartTracking();
            return;
        }

        if (isTap)
        {
            placementIndicator.StartTracking(screenPoint);
            return;
        }

        if (hideIndicatorAfterPlace)
        {
            placementIndicator.StopTracking();
        }
    }

    void Update()
    {
        if (activePrefab == null || raycastManager == null || arCamera == null)
        {
            return;
        }

        var isTap = TryGetTapPosition(out var tapPoint);
        var screenPoint = isTap ? tapPoint : GetAutoPlaceScreenPoint();

        UpdatePlacementIndicator(isTap, screenPoint);

        if (!TryGetFloorHit(screenPoint, !isTap, out var hit))
        {
            floorStableSince = -1f;
            return;
        }

        if (!autoPlaced)
        {
            if (floorStableSince < 0f)
            {
                floorStableSince = Time.time;
            }

            if (Time.time - floorStableSince >= autoPlaceDelay)
            {
                PlaceFurniture(hit);
                autoPlaced = true;

                if (hideIndicatorAfterPlace)
                {
                    placementIndicator?.StopTracking();
                }
            }
        }
        else if (isTap)
        {
            PlaceFurniture(hit);

            if (hideIndicatorAfterPlace)
            {
                placementIndicator?.StopTracking();
            }
        }
    }

    /// <summary>
    /// Manual height tweak for glossy / low-texture floors where plane Y is unreliable.
    /// Positive values raise the furniture; negative values lower it.
    /// </summary>
    public void NudgeVertical(float deltaMeters)
    {
        if (placedInstance == null || Mathf.Approximately(deltaMeters, 0f))
        {
            return;
        }

        placedInstance.transform.position += Vector3.up * deltaMeters;
        RefreshBlobShadow();
    }

    Vector2 GetAutoPlaceScreenPoint()
    {
        return new Vector2(Screen.width * 0.5f, Screen.height * placementScreenY);
    }

    bool TryGetFloorHit(Vector2 screenPoint, bool enforceMinDistance, out FloorPlacementHit hit)
    {
        hit = default;

        if (TryGetFloorPoseFromRaycast(screenPoint, minDepthBelowCamera, minFloorArea, out hit.pose, out hit.plane))
        {
            if (enforceMinDistance)
            {
                hit.pose.position = EnforceMinDistance(hit.pose.position);
            }

            return true;
        }

        if (!TryGetAutoPlacePose(out hit.pose, out hit.plane))
        {
            return false;
        }

        if (enforceMinDistance)
        {
            hit.pose.position = EnforceMinDistance(hit.pose.position);
        }

        return true;
    }

    Vector3 EnforceMinDistance(Vector3 position)
    {
        var cameraPos = arCamera.transform.position;
        var offset = position - cameraPos;
        offset.y = 0f;

        if (offset.sqrMagnitude >= minAutoPlaceDistance * minAutoPlaceDistance)
        {
            return position;
        }

        var direction = offset.sqrMagnitude > 0.01f
            ? offset.normalized
            : GetFlatForward();

        var adjusted = cameraPos + direction * minAutoPlaceDistance;
        adjusted.y = position.y;
        return adjusted;
    }

    Vector3 GetFlatForward()
    {
        var forward = arCamera.transform.forward;
        forward.y = 0f;
        if (forward.sqrMagnitude < 0.001f)
        {
            forward = Vector3.forward;
        }

        return forward.normalized;
    }

    bool TryGetAutoPlacePose(out Pose pose, out ARPlane plane)
    {
        pose = default;
        plane = null;

        if (planeManager == null)
        {
            return false;
        }

        var cameraPos = arCamera.transform.position;
        var cameraY = cameraPos.y;
        ARPlane bestPlane = null;
        var bestDistanceSq = float.PositiveInfinity;

        foreach (var trackablePlane in planeManager.trackables)
        {
            if (trackablePlane.alignment != PlaneAlignment.HorizontalUp)
            {
                Debug.Log($"[ARFurniturePlacer] Auto-place rejected plane '{trackablePlane.trackableId}': not HorizontalUp (alignment={trackablePlane.alignment}).");
                continue;
            }

            if (trackablePlane.trackingState != TrackingState.Tracking)
            {
                Debug.Log($"[ARFurniturePlacer] Auto-place rejected plane '{trackablePlane.trackableId}': trackingState={trackablePlane.trackingState} (need Tracking).");
                continue;
            }

            var planeY = trackablePlane.transform.position.y;
            if (planeY > cameraY - minDepthBelowCamera)
            {
                Debug.Log($"[ARFurniturePlacer] Auto-place rejected plane '{trackablePlane.trackableId}': y={planeY:F3} above min depth (cameraY - minDepth = {cameraY - minDepthBelowCamera:F3}).");
                continue;
            }

            var area = trackablePlane.size.x * trackablePlane.size.y;
            if (area < minFloorArea)
            {
                Debug.Log($"[ARFurniturePlacer] Auto-place rejected plane '{trackablePlane.trackableId}': area={area:F3} < minFloorArea={minFloorArea:F3}.");
                continue;
            }

            var distanceSq = (trackablePlane.transform.position - cameraPos).sqrMagnitude;
            if (distanceSq < bestDistanceSq)
            {
                bestDistanceSq = distanceSq;
                bestPlane = trackablePlane;
            }
        }

        if (bestPlane == null)
        {
            return false;
        }

        var position = cameraPos + GetFlatForward() * placeDistanceInFront;
        position.y = bestPlane.transform.position.y;

        pose = new Pose(position, Quaternion.identity);
        plane = bestPlane;
        return true;
    }

    bool TryGetFloorPoseFromRaycast(Vector2 screenPoint, float minDepth, float minArea, out Pose pose, out ARPlane plane)
    {
        pose = default;
        plane = null;

        if (!raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
        {
            return false;
        }

        var cameraY = arCamera.transform.position.y;

        // hits are already sorted nearest-to-farthest by ARRaycastManager — take the first valid hit.
        foreach (var hit in hits)
        {
            if (hit.trackable is not ARPlane hitPlane)
            {
                Debug.Log("[ARFurniturePlacer] Rejected raycast hit: trackable is not an ARPlane.");
                continue;
            }

            if (hitPlane.alignment != PlaneAlignment.HorizontalUp)
            {
                Debug.Log($"[ARFurniturePlacer] Rejected raycast hit on '{hitPlane.trackableId}': not HorizontalUp (alignment={hitPlane.alignment}).");
                continue;
            }

            if (hitPlane.trackingState != TrackingState.Tracking)
            {
                Debug.Log($"[ARFurniturePlacer] Rejected raycast hit on '{hitPlane.trackableId}': trackingState={hitPlane.trackingState} (need Tracking).");
                continue;
            }

            if (Vector3.Dot(hit.pose.up, Vector3.up) < 0.85f)
            {
                Debug.Log($"[ARFurniturePlacer] Rejected raycast hit on '{hitPlane.trackableId}': up-dot={Vector3.Dot(hit.pose.up, Vector3.up):F3} < 0.85.");
                continue;
            }

            if (hit.pose.position.y > cameraY - minDepth)
            {
                Debug.Log($"[ARFurniturePlacer] Rejected raycast hit on '{hitPlane.trackableId}': y={hit.pose.position.y:F3} above min depth (cameraY - minDepth = {cameraY - minDepth:F3}).");
                continue;
            }

            var area = hitPlane.size.x * hitPlane.size.y;
            if (area < minArea)
            {
                Debug.Log($"[ARFurniturePlacer] Rejected raycast hit on '{hitPlane.trackableId}': area={area:F3} < minArea={minArea:F3}.");
                continue;
            }

            pose = hit.pose;
            plane = hitPlane;
            return true;
        }

        return false;
    }

    bool TryGetTapPosition(out Vector2 screenPoint)
    {
        screenPoint = default;

        if (Touch.activeTouches.Count > 0)
        {
            var touch = Touch.activeTouches[0];
            if (touch.phase == TouchPhase.Began)
            {
                screenPoint = touch.screenPosition;
                return true;
            }
        }

        if (Input.touchCount > 0 && Input.GetTouch(0).phase == UnityEngine.TouchPhase.Began)
        {
            screenPoint = Input.GetTouch(0).position;
            return true;
        }

#if UNITY_EDITOR
        if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
        {
            screenPoint = Mouse.current.position.ReadValue();
            return true;
        }
#endif

        return false;
    }

    public void SetPrefab(GameObject prefab)
    {
        if (prefab == null)
        {
            return;
        }

        activePrefab = prefab;
        autoPlaced = false;
        floorStableSince = -1f;
        ClearPlacedFurniture();
        placementIndicator?.StopTracking();
    }

    public void ClearPlacedFurniture()
    {
        StopSpawnAnimation();
        StopFloorCorrection();
        DestroyPlacementAnchor();
        activePlacementPlane = null;
        floorSnapUntilTime = 0f;
        ARFurnitureGrounding.ClearBlobShadows(furnitureParent);

        if (placedInstance != null)
        {
            Destroy(placedInstance);
            placedInstance = null;
        }
    }

    void StopSpawnAnimation()
    {
        if (spawnCoroutine != null)
        {
            StopCoroutine(spawnCoroutine);
            spawnCoroutine = null;
        }
    }

    void StopFloorCorrection()
    {
        if (correctionCoroutine != null)
        {
            StopCoroutine(correctionCoroutine);
            correctionCoroutine = null;
        }
    }

    void PlaceFurniture(FloorPlacementHit hit)
    {
        var prefab = activePrefab ?? furniturePrefab;
        if (prefab == null)
        {
            Debug.LogWarning("[ARFurniturePlacer] No furniture prefab assigned.");
            return;
        }

        var pose = hit.pose;
        var floorY = pose.position.y;
        lastKnownFloorY = floorY;
        activePlacementPlane = hit.plane;
        floorSnapUntilTime = Time.time + continuousFloorSnapDuration;

        StopSpawnAnimation();
        StopFloorCorrection();
        DestroyPlacementAnchor();
        ARFurnitureGrounding.ClearBlobShadows(furnitureParent);

        if (placedInstance != null)
        {
            Destroy(placedInstance);
        }

        var prefabEuler = prefab.transform.rotation.eulerAngles;
        var rotation = Quaternion.Euler(prefabEuler.x, arCamera.transform.eulerAngles.y, prefabEuler.z);
        var targetScale = prefab.transform.localScale;

        // 1) Spawn at the captured hit pose (initial plane estimate).
        placedInstance = Instantiate(prefab);
        placedInstance.transform.SetPositionAndRotation(pose.position, rotation);

        if (animateSpawn && spawnDuration > 0f)
        {
            placedInstance.transform.localScale = targetScale * spawnStartScaleFactor;
        }
        else
        {
            ApplyTargetScale(placedInstance, targetScale);
        }

        // 2) Snap mesh feet to the floor Y from this frame.
        ARFurnitureGrounding.AlignToFloor(placedInstance, floorY, floorContactInset);

        // 3) Parent to world root — NOT the AR anchor (anchor Y drift was lifting furniture).
        if (furnitureParent != null)
        {
            placedInstance.transform.SetParent(furnitureParent, true);
        }

        // Optional plane anchor for tracking only (furniture stays on FurnitureRoot).
        CreatePlacementAnchor(hit, new Pose(placedInstance.transform.position, Quaternion.identity));

        // 4) Blob shadow + spawn animation (unchanged behaviour).
        if (addBlobShadow && (!animateSpawn || spawnDuration <= 0f))
        {
            RefreshBlobShadow();
        }

        if (animateSpawn && spawnDuration > 0f)
        {
            spawnCoroutine = StartCoroutine(LerpObjectScale(
                targetScale * spawnStartScaleFactor,
                targetScale,
                spawnDuration,
                placedInstance,
                floorY));
        }
        else
        {
            ApplyTargetScale(placedInstance, targetScale);
        }

        // 5) After ARCore settles, re-raycast and correct if the plane Y drifted.
        correctionCoroutine = StartCoroutine(PostPlacementFloorCorrection(floorY));

        Debug.Log($"[ARFurniturePlacer] Placed '{prefab.name}' at distance={Vector3.Distance(arCamera.transform.position, placedInstance.transform.position):F2}m");
        UnityMessageBridge.SendToApp("furniturePlaced", placedInstance.name);
    }

    /// <summary>
    /// Creates a plane anchor for AR session tracking. Furniture is NOT parented here
    /// because anchor Y updates during plane refinement were causing visible floating.
    /// </summary>
    void CreatePlacementAnchor(FloorPlacementHit hit, Pose pose)
    {
        if (anchorManager == null || hit.plane == null)
        {
            return;
        }

        activeAnchor = anchorManager.AttachAnchor(hit.plane, pose);
    }

    void DestroyPlacementAnchor()
    {
        if (activeAnchor == null)
        {
            return;
        }

        Destroy(activeAnchor.gameObject);
        activeAnchor = null;
    }

    /// <summary>
    /// Waits for ARCore plane refinement, then re-checks floor height at the furniture footprint.
    /// </summary>
    IEnumerator PostPlacementFloorCorrection(float initialFloorY)
    {
        var checkpoints = new[] { 0.5f, postPlacementCorrectionDelay, postPlacementCorrectionDelay + 2f };
        var previousCheckpoint = 0f;

        foreach (var checkpoint in checkpoints)
        {
            yield return new WaitForSeconds(checkpoint - previousCheckpoint);
            previousCheckpoint = checkpoint;

            if (placedInstance == null)
            {
                correctionCoroutine = null;
                yield break;
            }

            if (!TryGetFloorYAtFootprint(out var correctedFloorY))
            {
                continue;
            }

            var currentRestingY = ARFurnitureGrounding.GetSupportContactY(placedInstance);
            if (float.IsPositiveInfinity(currentRestingY))
            {
                continue;
            }

            var currentFloorY = currentRestingY + floorContactInset;
            if (Mathf.Abs(correctedFloorY - currentFloorY) <= floorCorrectionThreshold)
            {
                continue;
            }

            yield return SmoothAlignToFloor(correctedFloorY, floorCorrectionSmoothDuration);
            lastKnownFloorY = correctedFloorY;
            RefreshBlobShadow();
            Debug.Log($"[ARFurniturePlacer] Floor correction {currentFloorY:F3} -> {correctedFloorY:F3}");
        }

        correctionCoroutine = null;
    }

    bool TryGetFloorYAtFootprint(out float floorY)
    {
        floorY = 0f;

        if (placedInstance == null || arCamera == null || raycastManager == null)
        {
            return false;
        }

        if (!ARFurnitureGrounding.TryGetFootprint(placedInstance, out var footprintCenter, out _, out _))
        {
            return false;
        }

        var bestY = float.PositiveInfinity;
        var found = false;

        // Sample a few points above the footprint to survive glossy / low-texture floors.
        var offsets = new[]
        {
            Vector3.zero,
            new Vector3(0.08f, 0f, 0f),
            new Vector3(-0.08f, 0f, 0f),
            new Vector3(0f, 0f, 0.08f),
            new Vector3(0f, 0f, -0.08f),
        };

        foreach (var offset in offsets)
        {
            var samplePoint = footprintCenter + offset + Vector3.up * 0.35f;
            var screenPoint = (Vector2)arCamera.WorldToScreenPoint(samplePoint);

            if (screenPoint.x < 0f || screenPoint.y < 0f
                || screenPoint.x > Screen.width || screenPoint.y > Screen.height)
            {
                continue;
            }

            if (!TryGetFloorPoseFromRaycast(screenPoint, minDepthBelowCamera, minFloorArea, out var pose, out _))
            {
                continue;
            }

            if (pose.position.y < bestY)
            {
                bestY = pose.position.y;
                found = true;
            }
        }

        if (!found)
        {
            return false;
        }

        floorY = bestY;
        return true;
    }

    /// <summary>
    /// Projects the furniture footprint center to the screen and raycasts against AR planes.
    /// </summary>
    bool TryRaycastFloorAtFootprint(out float floorY)
    {
        return TryGetFloorYAtFootprint(out floorY);
    }

    IEnumerator SmoothAlignToFloor(float targetFloorY, float duration)
    {
        if (placedInstance == null)
        {
            yield break;
        }

        var startPosition = placedInstance.transform.position;
        var startLowestY = ARFurnitureGrounding.GetSupportContactY(placedInstance);
        if (float.IsPositiveInfinity(startLowestY))
        {
            yield break;
        }

        var targetPosition = startPosition;
        targetPosition.y += (targetFloorY - floorContactInset) - startLowestY;

        var elapsed = 0f;
        while (elapsed < duration && placedInstance != null)
        {
            elapsed += Time.deltaTime;
            var t = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(elapsed / duration));
            placedInstance.transform.position = Vector3.Lerp(startPosition, targetPosition, t);
            yield return null;
        }

        if (placedInstance != null)
        {
            ARFurnitureGrounding.AlignToFloor(placedInstance, targetFloorY, floorContactInset);
        }
    }

    void RefreshBlobShadow()
    {
        if (!addBlobShadow || placedInstance == null)
        {
            return;
        }

        ARFurnitureGrounding.AttachBlobShadow(
            placedInstance,
            furnitureParent,
            blobShadowPrefab,
            blobShadowScale);
    }

    static void ApplyTargetScale(GameObject instance, Vector3 targetScale)
    {
        instance.transform.localScale = targetScale;
    }

    IEnumerator LerpObjectScale(Vector3 from, Vector3 to, float duration, GameObject lerpObject, float initialFloorY)
    {
        var elapsed = 0f;
        var rate = duration > 0f ? 1f / duration : 1f;

        while (elapsed < 1f && lerpObject != null)
        {
            elapsed += Time.deltaTime * rate;
            var t = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(elapsed));
            lerpObject.transform.localScale = Vector3.Lerp(from, to, t);

            var floorY = TryGetFloorYAtFootprint(out var y) ? y : initialFloorY;
            ARFurnitureGrounding.AlignToFloor(lerpObject, floorY, floorContactInset);
            yield return null;
        }

        if (lerpObject != null)
        {
            lerpObject.transform.localScale = to;
            var floorY = TryGetFloorYAtFootprint(out var y) ? y : initialFloorY;
            ARFurnitureGrounding.AlignToFloor(lerpObject, floorY, floorContactInset);
            RefreshBlobShadow();
        }

        spawnCoroutine = null;
    }
}
