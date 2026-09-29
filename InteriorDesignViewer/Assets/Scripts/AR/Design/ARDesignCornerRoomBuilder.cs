using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.Rendering;
using UnityEngine.UI;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

/// <summary>
/// ARPlan-style room scan: measure wall height first (tap floor, aim up),
/// then corner-to-corner floor outline with live width readout, then confirm.
/// </summary>
[DefaultExecutionOrder(-125)]
public class ARDesignCornerRoomBuilder : MonoBehaviour
{
    public enum RoomOutlinePhase
    {
        Height,
        Width,
    }
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private Camera arCamera;
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private ARAnchorManager anchorManager;
    [Tooltip("Pin the base point and each corner to an AR anchor so they stay where tapped when tracking corrects itself.")]
    [SerializeField] private bool anchorCorners = true;

    [Header("Look")]
    [SerializeField] private Color edgeColor = new(1f, 1f, 1f, 0.98f);
    [SerializeField] private float floorLineWidth = 0.028f;
    [SerializeField] private float wallLineWidth = 0.022f;
    [SerializeField] private float wallHeight = 2.5f;
    [SerializeField] private bool requireHeightBeforeCorners = true;
    [Tooltip("When true, the floor base is set only via Start (not screen tap). Used in AR Measurement scene.")]
    [SerializeField] private bool requireStartButtonForHeightBase = false;
    [SerializeField] private float minWallHeight = 0.5f;
    [SerializeField] private float defaultWallHeight = 2.5f;
    [SerializeField] private float maxWallHeight = 5.0f;
    [SerializeField] private float ceilingSnapTolerance = 0.25f;
    [Tooltip("Plane hits below this are treated as furniture / mid-wall noise, not ceiling.")]
    [SerializeField] private float minCeilingHeightAboveBase = 1.8f;
    [Tooltip("If Finish is pressed with a peak below this, fall back to defaultWallHeight.")]
    [SerializeField] private float minReliableLockHeight = 1.8f;
    [SerializeField] private float heightAimScreenY = 0.62f;
    [SerializeField] private float heightPlacementIconSize = 0.32f;
    [SerializeField] private string measurementIconResourcePath = "MeasurementIcons/measurement-icon";
    [SerializeField] private float cornerMarkerSize = 0.06f;
    [SerializeField] private float closeSnapDistance = 0.35f;
    [SerializeField] private int maxCorners = 24;
    [SerializeField] private bool showEdgeMeasurements = true;
    [SerializeField] private bool showLivePreviewMeasurement = true;
    [SerializeField] private bool keepMeasurementsAfterConfirm = false;

    /// <summary>
    /// Anchor for one tapped point. Anchors are created asynchronously, so the slot can be
    /// released (undo / retry) before its anchor arrives.
    /// </summary>
    sealed class AnchorSlot
    {
        public ARAnchor anchor;
        public bool released;
    }

    /// <summary>Ignore anchor jitter below this (5 mm) so labels are not rebuilt every frame.</summary>
    const float AnchorMoveEpsilonSq = 0.005f * 0.005f;

    readonly List<Vector3> corners = new();
    /// <summary>Parallel to <see cref="corners"/>. Index 0 shares <see cref="heightBaseAnchor"/> once seeded.</summary>
    readonly List<AnchorSlot> cornerAnchors = new();
    AnchorSlot heightBaseAnchor;
    readonly List<ARRaycastHit> hits = new();
    readonly List<GameObject> markers = new();
    readonly List<GameObject> measurementLabels = new();

    LineRenderer floorLoop;
    LineRenderer previewSegment;
    LineRenderer heightLine;
    LineRenderer[] wallGuides = Array.Empty<LineRenderer>();
    LineRenderer ceilingLoop;
    Material lineMaterial;
    Transform root;
    bool active;
    bool roomLocked;
    bool heightBaseSet;
    bool heightLocked;
    RoomOutlinePhase outlinePhase = RoomOutlinePhase.Height;
    Vector3 heightFloorBase;
    Texture2D cachedMeasurementIcon;
    GameObject previewMeasureLabel;
    GameObject heightMeasureLabel;
    Text previewMeasureText;
    Text heightMeasureText;
    int lastPreviewCm = int.MinValue;
    int lastHeightPreviewCm = int.MinValue;
    float peakLiveHeight;

    public IReadOnlyList<Vector3> Corners => corners;
    public int CornerCount => corners.Count;
    public bool CanConfirm => corners.Count >= 3;
    public float WallHeight => wallHeight;
    public RoomOutlinePhase OutlinePhase => outlinePhase;
    public bool RequireHeightBeforeCorners => requireHeightBeforeCorners;
    public bool IsInHeightPhase => active && requireHeightBeforeCorners && !heightLocked;
    public bool IsHeightLocked => heightLocked;
    public bool HasHeightBase => heightBaseSet;

    /// <summary>Live distance from last corner to current aim point (metres). 0 when hidden.</summary>
    public float LivePreviewDistanceMeters { get; private set; }

    /// <summary>True while the rubber-band preview (and live cm readout) is visible.</summary>
    public bool HasLivePreview { get; private set; }

    /// <summary>Live wall height while extruding upward (metres). 0 when hidden.</summary>
    public float LiveHeightMeters { get; private set; }

    /// <summary>True while the vertical height preview line is visible.</summary>
    public bool HasLiveHeightPreview { get; private set; }

    /// <summary>True once the floor base is placed — Finish does not wait for a 1 m live reading.</summary>
    public bool CanConfirmHeight => IsInHeightPhase && heightBaseSet;

    /// <summary>Start is available while aiming the reticle at the floor base point.</summary>
    public bool CanStartHeight =>
        IsInHeightPhase && !heightBaseSet
        && placementIndicator != null && placementIndicator.IsLockedOnFloor;

    public event Action CornersChanged;
    public event Action HeightPhaseChanged;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (raycastManager == null) raycastManager = FindFirstObjectByType<ARRaycastManager>();
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();
        if (arCamera == null) arCamera = Camera.main;
        if (placementIndicator == null) placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();
        if (anchorManager == null) anchorManager = FindFirstObjectByType<ARAnchorManager>();

        root = new GameObject("CornerRoomOutline").transform;
        root.SetParent(transform, false);

        lineMaterial = CreateLineMaterial(edgeColor);
        floorLoop = CreateLine("FloorLoop", floorLineWidth, true);
        previewSegment = CreateLine("PreviewSegment", floorLineWidth, false);
        heightLine = CreateLine("HeightLine", wallLineWidth, false);
        ceilingLoop = CreateLine("CeilingLoop", wallLineWidth, true);
        previewSegment.enabled = false;
        heightLine.enabled = false;
        ceilingLoop.enabled = false;
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
    }

    void OnDestroy()
    {
        Clear();
        ReleaseHeightBaseAnchor();
        ClearHeightMeasureLabel();
        EndHeightPlacementTracking();
        if (lineMaterial != null) Destroy(lineMaterial);
        if (root != null) Destroy(root.gameObject);
    }

    void Start()
    {
        if (scanController != null)
            OnPhase(scanController.Phase);
    }

    void Update()
    {
        if (!active) return;

        SyncAnchoredPoints();

        if (IsInHeightPhase)
        {
            UpdateHeightPreview();

            if (Touch.activeTouches.Count != 1) return;
            var touch = Touch.activeTouches[0];
            if (touch.phase != TouchPhase.Began) return;
            if (IsPointerOverUI(touch.touchId)) return;
            if (heightBaseSet) return;
            if (requireStartButtonForHeightBase) return;

            TrySetHeightBaseFromTap(touch.screenPosition);
            return;
        }

        if (heightLocked && heightBaseSet && corners.Count == 0)
            UpdateHeightPreview(forceLocked: true);

        UpdatePreview();

        if (Touch.activeTouches.Count != 1) return;
        var widthTouch = Touch.activeTouches[0];
        if (widthTouch.phase != TouchPhase.Began) return;
        if (IsPointerOverUI(widthTouch.touchId)) return;

        if (TryGetFloorHit(widthTouch.screenPosition, out var widthHit))
            TryAddCorner(widthHit);
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        active = phase == RoomScanController.ScanPhase.Scanning
                 || phase == RoomScanController.ScanPhase.ReadyToConfirm;
        roomLocked = phase == RoomScanController.ScanPhase.Confirmed;

        if (phase == RoomScanController.ScanPhase.Confirmed)
        {
            previewSegment.enabled = false;
            HideHeightPreview();
            EndHeightPlacementTracking();
            if (keepMeasurementsAfterConfirm && corners.Count >= 2)
            {
                if (root != null) root.gameObject.SetActive(true);
                RebuildVisuals(closed: true);
                // Soften guide lines in planner — keep measurement chips.
                if (floorLoop != null) floorLoop.enabled = false;
                if (ceilingLoop != null) ceilingLoop.enabled = false;
                ClearWallGuides();
                for (var i = 0; i < markers.Count; i++)
                {
                    if (markers[i] != null) markers[i].SetActive(false);
                }
            }
            else
            {
                HidePreviewOnly();
            }

            return;
        }

        if (root != null)
            root.gameObject.SetActive(active);

        if (!active)
        {
            Clear();
            return;
        }

        if (floorLoop != null) floorLoop.enabled = true;
        for (var i = 0; i < markers.Count; i++)
        {
            if (markers[i] != null) markers[i].SetActive(true);
        }

        if (phase == RoomScanController.ScanPhase.Scanning && corners.Count == 0)
            Clear();

        if (IsInHeightPhase && !heightBaseSet)
            BeginHeightPlacementTracking();
        else if (heightLocked)
            placementIndicator?.StopTracking(clearOverlay: true);
        else if (!IsInHeightPhase)
            placementIndicator?.StartTracking();
    }

    /// <summary>Places the height base at the current floor reticle (Start button).</summary>
    public bool TryConfirmHeightBaseFromIndicator()
    {
        if (!IsInHeightPhase || heightBaseSet) return false;
        if (placementIndicator == null || !placementIndicator.IsLockedOnFloor) return false;

        TrySetHeightBase(placementIndicator.CurrentPose.position);
        return heightBaseSet;
    }

    /// <summary>
    /// Locks wall height and seeds the width outline: the Finish base point becomes
    /// corner 0 so live width measurement starts from that same floor point.
    /// </summary>
    public bool ConfirmHeight()
    {
        if (!CanConfirmHeight) return false;

        // Prefer peak while aiming — avoids locking a short mid-wall / furniture hit.
        var candidate = Mathf.Max(peakLiveHeight, LiveHeightMeters);
        float measured;
        if (candidate >= minReliableLockHeight)
            measured = candidate;
        else
        {
            // Too short to be a real ceiling — use default rather than ~70 cm furniture height.
            Debug.LogWarning(
                $"[ARDesignCornerRoomBuilder] Height peak {candidate:F2}m below reliable " +
                $"{minReliableLockHeight:F2}m — using default {defaultWallHeight:F2}m.");
            measured = defaultWallHeight;
        }

        wallHeight = Mathf.Clamp(measured, minWallHeight, maxWallHeight);
        heightLocked = true;
        outlinePhase = RoomOutlinePhase.Width;

        SeedWidthStartFromHeightBase();

        if (heightLine != null) heightLine.enabled = false;
        SetHeightMeasureVisible(false);
        EndHeightPlacementTracking();
        RebuildVisuals();

        // Width phase: no floor reticle — only the preview measurement line.
        placementIndicator?.StopTracking(clearOverlay: true);

        HeightPhaseChanged?.Invoke();
        CornersChanged?.Invoke();
        return true;
    }

    /// <summary>Finish base → first width node. Later taps add corners 1, 2, …</summary>
    void SeedWidthStartFromHeightBase()
    {
        if (!heightBaseSet) return;

        if (corners.Count == 0)
        {
            corners.Add(heightFloorBase);
            cornerAnchors.Add(heightBaseAnchor);
            return;
        }

        // Replace any accidental first corner so width always starts at the Finish point.
        corners[0] = heightFloorBase;
        if (cornerAnchors.Count > 0)
        {
            ReleaseCornerSlot(cornerAnchors[0]);
            cornerAnchors[0] = heightBaseAnchor;
        }
    }

    public void UndoHeightBase()
    {
        if (!IsInHeightPhase) return;

        heightBaseSet = false;
        heightFloorBase = default;
        ReleaseHeightBaseAnchor();
        LiveHeightMeters = 0f;
        HasLiveHeightPreview = false;
        peakLiveHeight = 0f;
        lastHeightPreviewCm = int.MinValue;

        if (heightLine != null) heightLine.enabled = false;
        SetHeightMeasureVisible(false);
        BeginHeightPlacementTracking();

        HeightPhaseChanged?.Invoke();
        CornersChanged?.Invoke();
    }

    public void UndoLastCorner()
    {
        if (corners.Count == 0) return;
        // Keep the seeded height-base corner while width outline is active.
        if (heightLocked && corners.Count <= 1) return;

        corners.RemoveAt(corners.Count - 1);
        if (cornerAnchors.Count > corners.Count)
        {
            ReleaseCornerSlot(cornerAnchors[^1]);
            cornerAnchors.RemoveAt(cornerAnchors.Count - 1);
        }
        RebuildVisuals();
        CornersChanged?.Invoke();
    }

    /// <summary>
    /// Start the floor outline over. Keeps the measured height and its seeded base corner.
    /// </summary>
    public void ResetCorners()
    {
        if (corners.Count == 0) return;
        var keep = heightLocked ? 1 : 0;
        if (corners.Count <= keep) return;

        corners.RemoveRange(keep, corners.Count - keep);
        for (var i = keep; i < cornerAnchors.Count; i++)
            ReleaseCornerSlot(cornerAnchors[i]);
        if (cornerAnchors.Count > keep)
            cornerAnchors.RemoveRange(keep, cornerAnchors.Count - keep);
        RebuildVisuals();
        CornersChanged?.Invoke();
    }

    public void PrepareForRescan()
    {
        roomLocked = false;
        ResetHeightPhase();
        Clear();
        active = true;
        if (root != null) root.gameObject.SetActive(true);
        if (floorLoop != null) floorLoop.enabled = true;
        if (IsInHeightPhase && !heightBaseSet)
            BeginHeightPlacementTracking();
    }

    void ResetHeightPhase()
    {
        heightBaseSet = false;
        heightLocked = false;
        outlinePhase = requireHeightBeforeCorners ? RoomOutlinePhase.Height : RoomOutlinePhase.Width;
        heightFloorBase = default;
        ReleaseHeightBaseAnchor();
        LiveHeightMeters = 0f;
        HasLiveHeightPreview = false;
        peakLiveHeight = 0f;
        lastHeightPreviewCm = int.MinValue;

        if (heightLine != null) heightLine.enabled = false;
        SetHeightMeasureVisible(false);
    }

    void TrySetHeightBaseFromTap(Vector2 screenPoint)
    {
        if (placementIndicator != null && placementIndicator.IsLockedOnFloor)
        {
            TrySetHeightBase(placementIndicator.CurrentPose.position);
            return;
        }

        if (TryGetFloorHit(screenPoint, out var hit))
            TrySetHeightBase(hit);
    }

    void TrySetHeightBase(Vector3 worldPoint)
    {
        worldPoint.y = FindFloorY(worldPoint);
        heightFloorBase = worldPoint;
        heightBaseSet = true;
        ReleaseHeightBaseAnchor();
        heightBaseAnchor = PinWorldPoint(worldPoint);
        peakLiveHeight = 0f;
        LiveHeightMeters = 0f;
        HasLiveHeightPreview = false;
        lastHeightPreviewCm = int.MinValue;

        if (placementIndicator != null && placementIndicator.IsLockedOnFloor)
            placementIndicator.LockOverlayAt(placementIndicator.CurrentPose);
        else
            placementIndicator?.LockOverlayAt(worldPoint + Vector3.up * 0.01f, Quaternion.identity);

        HeightPhaseChanged?.Invoke();
        CornersChanged?.Invoke();
    }

    Texture2D GetMeasurementIconTexture()
    {
        if (cachedMeasurementIcon != null)
            return cachedMeasurementIcon;

        cachedMeasurementIcon = Resources.Load<Texture2D>(measurementIconResourcePath);
        if (cachedMeasurementIcon == null)
        {
            var sprite = Resources.Load<Sprite>(measurementIconResourcePath);
            if (sprite != null)
                cachedMeasurementIcon = sprite.texture;
        }

        if (cachedMeasurementIcon == null)
        {
            Debug.LogWarning(
                $"[ARDesignCornerRoomBuilder] Missing measurement icon at Resources/{measurementIconResourcePath}.png");
        }

        return cachedMeasurementIcon;
    }

    /// <summary>Re-applies the measurement icon and floor tracking (safe to call from HUD).</summary>
    public void RefreshHeightPlacementIndicator()
    {
        if (!IsInHeightPhase || heightBaseSet)
            return;

        BeginHeightPlacementTracking();
    }

    void BeginHeightPlacementTracking()
    {
        if (placementIndicator == null || !IsInHeightPhase) return;

        var icon = GetMeasurementIconTexture();
        if (icon != null)
            placementIndicator.SetOverlayIcon(icon, heightPlacementIconSize);

        placementIndicator.StartTracking();
    }

    void EndHeightPlacementTracking()
    {
        placementIndicator?.ClearOverlayIcon();
    }

    // ── World anchors ─────────────────────────────────────────────────────────

    AnchorSlot PinWorldPoint(Vector3 worldPoint)
    {
        if (!anchorCorners || anchorManager == null || !anchorManager.isActiveAndEnabled)
            return null;

        var slot = new AnchorSlot();
        CreateAnchorAsync(slot, worldPoint);
        return slot;
    }

    async void CreateAnchorAsync(AnchorSlot slot, Vector3 worldPoint)
    {
        try
        {
            var result = await anchorManager.TryAddAnchorAsync(new Pose(worldPoint, Quaternion.identity));
            if (!result.status.IsSuccess() || result.value == null)
                return;

            if (slot.released || this == null)
            {
                Destroy(result.value.gameObject);
                return;
            }

            slot.anchor = result.value;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARDesignCornerRoomBuilder] Corner anchor failed: {e.Message}");
        }
    }

    static void ReleaseSlot(AnchorSlot slot)
    {
        if (slot == null || slot.released) return;
        slot.released = true;
        if (slot.anchor != null) Destroy(slot.anchor.gameObject);
        slot.anchor = null;
    }

    /// <summary>Release a corner's anchor unless it is the shared height-base anchor.</summary>
    void ReleaseCornerSlot(AnchorSlot slot)
    {
        if (slot != null && slot != heightBaseAnchor)
            ReleaseSlot(slot);
    }

    void ReleaseHeightBaseAnchor()
    {
        ReleaseSlot(heightBaseAnchor);
        heightBaseAnchor = null;
    }

    static bool TryGetTrackedPosition(AnchorSlot slot, out Vector3 position)
    {
        position = default;
        if (slot?.anchor == null || slot.anchor.trackingState != TrackingState.Tracking)
            return false;
        position = slot.anchor.transform.position;
        return true;
    }

    /// <summary>
    /// Follow ARCore's corrections so tapped points stay on the real-world spot instead of
    /// sliding when tracking re-localises (e.g. after turning away and back).
    /// </summary>
    void SyncAnchoredPoints()
    {
        if (roomLocked) return;

        var moved = false;
        if (heightBaseSet && TryGetTrackedPosition(heightBaseAnchor, out var basePos)
            && (basePos - heightFloorBase).sqrMagnitude > AnchorMoveEpsilonSq)
        {
            heightFloorBase = basePos;
            moved = true;
        }

        for (var i = 0; i < corners.Count && i < cornerAnchors.Count; i++)
        {
            if (!TryGetTrackedPosition(cornerAnchors[i], out var p)) continue;
            if ((p - corners[i]).sqrMagnitude <= AnchorMoveEpsilonSq) continue;
            corners[i] = p;
            moved = true;
        }

        if (!moved) return;

        if (placementIndicator != null && heightBaseSet && IsInHeightPhase)
            placementIndicator.LockOverlayAt(heightFloorBase + Vector3.up * 0.01f, Quaternion.identity);
        RebuildVisuals();
    }

    void TryAddCorner(Vector3 worldPoint)
    {
        worldPoint.y = FindFloorY(worldPoint);

        // Snap near the height base so the outline stays anchored to it.
        if (heightLocked && heightBaseSet
            && Vector3.Distance(Flat(worldPoint), Flat(heightFloorBase)) <= closeSnapDistance)
        {
            worldPoint = heightFloorBase;
        }

        // Close the loop by tapping near the first corner.
        if (corners.Count >= 3 && Vector3.Distance(Flat(worldPoint), Flat(corners[0])) <= closeSnapDistance)
        {
            RebuildVisuals(closed: true);
            CornersChanged?.Invoke();
            return;
        }

        if (corners.Count >= maxCorners) return;

        // Ignore accidental double-taps on the same spot.
        if (corners.Count > 0 && Vector3.Distance(Flat(worldPoint), Flat(corners[^1])) < 0.12f)
            return;

        corners.Add(worldPoint);
        cornerAnchors.Add(PinWorldPoint(worldPoint));
        RebuildVisuals();
        CornersChanged?.Invoke();
    }

    void UpdateHeightPreview(bool forceLocked = false)
    {
        if (!heightBaseSet || heightLine == null)
        {
            HideHeightPreview();
            return;
        }

        var locked = forceLocked || heightLocked;
        float heightMeters;
        if (locked)
        {
            heightMeters = wallHeight;
        }
        else if (TryEstimateLiveHeight(out var topPoint))
        {
            heightMeters = topPoint.y - heightFloorBase.y;
            // Keep the highest good reading so furniture / mid-wall dips don't erase ceiling.
            if (heightMeters >= minWallHeight)
                peakLiveHeight = Mathf.Max(peakLiveHeight, heightMeters);
            heightMeters = Mathf.Max(heightMeters, peakLiveHeight);
        }
        else if (peakLiveHeight >= minWallHeight)
        {
            heightMeters = peakLiveHeight;
        }
        else
        {
            heightMeters = 0.15f;
        }

        heightMeters = Mathf.Clamp(heightMeters, 0f, maxWallHeight);
        if (!locked && heightMeters < 0.15f)
            heightMeters = 0.15f;

        var top = heightFloorBase + Vector3.up * heightMeters;
        heightLine.enabled = true;
        heightLine.positionCount = 2;
        heightLine.SetPosition(0, heightFloorBase + Vector3.up * 0.012f);
        heightLine.SetPosition(1, top + Vector3.up * 0.012f);

        LiveHeightMeters = heightMeters;
        HasLiveHeightPreview = true;

        if (!showLivePreviewMeasurement)
        {
            SetHeightMeasureVisible(false);
            return;
        }

        var cm = Mathf.RoundToInt(heightMeters * 100f);
        var labelPos = Vector3.Lerp(heightFloorBase, top, 0.55f) + Vector3.up * 0.04f;
        EnsureHeightMeasureLabel();
        heightMeasureLabel.transform.position = labelPos;
        SetHeightMeasureVisible(true);

        if (heightMeasureText != null && cm != lastHeightPreviewCm)
        {
            lastHeightPreviewCm = cm;
            heightMeasureText.text = $"H = {cm} cm";
        }
    }

    bool TryEstimateLiveHeight(out Vector3 topPoint)
    {
        topPoint = heightFloorBase + Vector3.up * wallHeight;
        if (arCamera == null) return false;

        var screen = GetHeightAimScreenPoint();
        var ray = arCamera.ScreenPointToRay(screen);
        var camPos = arCamera.transform.position;

        var pitchHeight = EstimateHeightFromCameraPitch(ray, heightFloorBase, camPos);
        var columnHeight = EstimateHeightAtVerticalColumn(ray, heightFloorBase);
        var ceilingHeight = TryGetDetectedCeilingHeight(screen);
        var cameraClearance = camPos.y - heightFloorBase.y;

        // Strong upward look: trust pitch (ceiling aim). Column alone often stops mid-wall.
        var lookingUp = ray.direction.y > 0.2f;
        float bestHeight;
        if (lookingUp)
        {
            bestHeight = Mathf.Max(pitchHeight, columnHeight);
            // Ceiling / high plane snap only when it is actually high enough.
            if (ceilingHeight >= minCeilingHeightAboveBase)
                bestHeight = Mathf.Max(bestHeight, ceilingHeight);
            // Looking well above eye level → at least camera height + a bit.
            if (ray.direction.y > 0.45f)
                bestHeight = Mathf.Max(bestHeight, cameraClearance + 0.35f);
        }
        else
        {
            bestHeight = Mathf.Max(pitchHeight, columnHeight);
            if (ceilingHeight >= minCeilingHeightAboveBase)
                bestHeight = Mathf.Max(bestHeight, ceilingHeight);
        }

        if (bestHeight <= 0.05f) return false;

        bestHeight = Mathf.Clamp(bestHeight, 0.08f, maxWallHeight);
        topPoint = heightFloorBase + Vector3.up * bestHeight;
        return true;
    }

    float TryGetDetectedCeilingHeight(Vector2 screenPoint)
    {
        if (raycastManager == null) return 0f;

        hits.Clear();
        if (!raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
            return 0f;

        var best = 0f;
        for (var i = 0; i < hits.Count; i++)
        {
            var pos = hits[i].pose.position;
            var h = pos.y - heightFloorBase.y;
            // Ignore furniture tops and mid-wall hits — those caused the ~70–90 cm lock.
            if (h < minCeilingHeightAboveBase) continue;

            ARPlane plane = null;
            if (planeManager != null)
                plane = planeManager.GetPlane(hits[i].trackableId);

            if (plane != null)
            {
                // Ceiling underside or high floor-like plane.
                if (plane.alignment == PlaneAlignment.HorizontalDown
                    || plane.alignment == PlaneAlignment.HorizontalUp)
                {
                    if (h > best) best = h;
                    continue;
                }

                // Vertical wall: only near the height base column, and only high hits.
                if (plane.alignment == PlaneAlignment.Vertical)
                {
                    var horiz = Vector3.Distance(Flat(pos), Flat(heightFloorBase));
                    if (horiz > 1.2f) continue;
                    if (h > best) best = h;
                }

                continue;
            }

            if (h > best) best = h;
        }

        return best;
    }

    static float EstimateHeightAtVerticalColumn(Ray ray, Vector3 basePoint)
    {
        var o = ray.origin;
        var d = ray.direction;

        // Intersect look ray with the vertical line through the floor base (XZ).
        var flatDir = new Vector2(d.x, d.z);
        var flatLen = flatDir.magnitude;
        if (flatLen < 1e-4f)
        {
            // Ray nearly vertical — height grows with distance along ray.
            if (d.y <= 0.02f) return 0f;
            var t = (basePoint.y + 2.4f - o.y) / d.y;
            if (t <= 0.05f) return 0f;
            return Mathf.Max(0f, ray.GetPoint(Mathf.Min(t, 30f)).y - basePoint.y);
        }

        var toBase = new Vector2(basePoint.x - o.x, basePoint.z - o.z);
        var tHoriz = Vector2.Dot(toBase, flatDir) / (flatLen * flatLen);
        if (tHoriz <= 0.08f) return 0f;
        tHoriz = Mathf.Min(tHoriz, 30f);

        return Mathf.Max(0f, ray.GetPoint(tHoriz).y - basePoint.y);
    }

    static float EstimateHeightFromCameraPitch(Ray ray, Vector3 basePoint, Vector3 camPos)
    {
        if (ray.direction.y <= 0.02f) return 0f;

        var dx = basePoint.x - camPos.x;
        var dz = basePoint.z - camPos.z;
        var horiz = Mathf.Sqrt(dx * dx + dz * dz);
        var dy = ray.direction.y;
        var flat = Mathf.Sqrt(ray.direction.x * ray.direction.x + ray.direction.z * ray.direction.z);
        if (flat < 1e-4f)
            return Mathf.Max(0f, (camPos.y - basePoint.y) + 1.2f);

        var pitch = Mathf.Atan2(dy, flat);

        if (horiz < 0.08f)
            return Mathf.Max(0f, (camPos.y - basePoint.y) + Mathf.Tan(pitch) * 1.5f);

        // Height of the look ray above the floor at the base's horizontal distance.
        return horiz * Mathf.Tan(pitch) + (camPos.y - basePoint.y);
    }

    Vector2 GetHeightAimScreenPoint()
    {
        // Height follows where the user looks (center / upper screen), not the floor reticle.
        if (Touch.activeTouches.Count == 1)
        {
            var touch = Touch.activeTouches[0];
            if (touch.phase != TouchPhase.Ended && touch.phase != TouchPhase.Canceled)
                return touch.screenPosition;
        }

        return new Vector2(Screen.width * 0.5f, Screen.height * heightAimScreenY);
    }

    Vector2 GetAimScreenPoint()
    {
        if (Touch.activeTouches.Count == 1)
        {
            var touch = Touch.activeTouches[0];
            if (touch.phase != TouchPhase.Ended && touch.phase != TouchPhase.Canceled)
                return touch.screenPosition;
        }

        if (placementIndicator != null && placementIndicator.isActiveAndEnabled)
        {
            var indicatorScreen = arCamera.WorldToScreenPoint(placementIndicator.WorldPosition);
            if (indicatorScreen.z > 0f)
                return new Vector2(indicatorScreen.x, indicatorScreen.y);
        }

        return new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
    }

    void EnsureHeightMeasureLabel()
    {
        if (heightMeasureLabel != null) return;
        heightMeasureLabel = CreateMeasurementLabel(Vector3.zero, "H = 0 cm");
        heightMeasureLabel.name = "LiveHeightMeasure";
        heightMeasureText = heightMeasureLabel.GetComponentInChildren<Text>(true);
    }

    void SetHeightMeasureVisible(bool visible)
    {
        if (heightMeasureLabel != null)
            heightMeasureLabel.SetActive(visible);
    }

    void HideHeightPreview()
    {
        if (heightLine != null)
            heightLine.enabled = false;
        SetHeightMeasureVisible(false);
        LiveHeightMeters = 0f;
        HasLiveHeightPreview = false;
        lastHeightPreviewCm = int.MinValue;
    }

    void UpdatePreview()
    {
        if (corners.Count == 0 || arCamera == null || raycastManager == null)
        {
            HideLivePreview();
            return;
        }

        if (!TryGetPreviewAimHit(out var hit))
        {
            HideLivePreview();
            return;
        }

        hit.y = FindFloorY(hit);
        var from = corners[^1];
        var lengthMeters = Vector3.Distance(Flat(from), Flat(hit));

        previewSegment.enabled = true;
        previewSegment.positionCount = 2;
        previewSegment.SetPosition(0, from + Vector3.up * 0.01f);
        previewSegment.SetPosition(1, hit + Vector3.up * 0.01f);

        LivePreviewDistanceMeters = lengthMeters;
        HasLivePreview = lengthMeters >= 0.02f;

        if (!showLivePreviewMeasurement || !HasLivePreview)
        {
            SetPreviewMeasureVisible(false);
            return;
        }

        var cm = Mathf.RoundToInt(lengthMeters * 100f);
        var mid = (from + hit) * 0.5f + Vector3.up * 0.10f;
        EnsurePreviewMeasureLabel();
        previewMeasureLabel.transform.position = mid;
        SetPreviewMeasureVisible(true);

        if (previewMeasureText != null && cm != lastPreviewCm)
        {
            lastPreviewCm = cm;
            previewMeasureText.text = $"{cm} cm";
        }
    }

    bool TryGetPreviewAimHit(out Vector3 hit)
    {
        hit = default;

        // Prefer active finger so the tape updates while dragging between taps.
        if (Touch.activeTouches.Count == 1)
        {
            var touch = Touch.activeTouches[0];
            if (touch.phase != TouchPhase.Ended
                && touch.phase != TouchPhase.Canceled
                && !IsPointerOverUI(touch.touchId)
                && TryGetFloorHit(touch.screenPosition, out hit))
            {
                return true;
            }
        }

        // Fall back to placement reticle, then screen center.
        if (placementIndicator != null && placementIndicator.isActiveAndEnabled)
        {
            var indicatorScreen = arCamera.WorldToScreenPoint(placementIndicator.WorldPosition);
            if (indicatorScreen.z > 0f
                && TryGetFloorHit(new Vector2(indicatorScreen.x, indicatorScreen.y), out hit))
            {
                return true;
            }
        }

        var center = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
        return TryGetFloorHit(center, out hit);
    }

    void EnsurePreviewMeasureLabel()
    {
        if (previewMeasureLabel != null) return;
        previewMeasureLabel = CreateMeasurementLabel(Vector3.zero, "0 cm");
        previewMeasureLabel.name = "LivePreviewMeasure";
        previewMeasureText = previewMeasureLabel.GetComponentInChildren<Text>(true);
        // Slightly stronger chip so the live tape reads clearly while aiming.
        var bg = previewMeasureLabel.GetComponentInChildren<Image>(true);
        if (bg != null)
            bg.color = new Color(0.98f, 0.86f, 0.55f, 0.96f);
    }

    void SetPreviewMeasureVisible(bool visible)
    {
        if (previewMeasureLabel != null)
            previewMeasureLabel.SetActive(visible);
    }

    void HideLivePreview()
    {
        if (previewSegment != null)
            previewSegment.enabled = false;
        SetPreviewMeasureVisible(false);
        LivePreviewDistanceMeters = 0f;
        HasLivePreview = false;
        lastPreviewCm = int.MinValue;
    }

    void RebuildVisuals(bool closed = false)
    {
        // Markers
        while (markers.Count > corners.Count)
        {
            var last = markers[^1];
            markers.RemoveAt(markers.Count - 1);
            if (last != null) Destroy(last);
        }

        while (markers.Count < corners.Count)
        {
            var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = $"Corner_{markers.Count}";
            marker.transform.SetParent(root, false);
            marker.transform.localScale = Vector3.one * cornerMarkerSize;
            Destroy(marker.GetComponent<Collider>());
            var renderer = marker.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = lineMaterial;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            markers.Add(marker);
        }

        for (var i = 0; i < corners.Count; i++)
        {
            markers[i].SetActive(!roomLocked);
            markers[i].transform.position = corners[i] + Vector3.up * 0.02f;
            // Emphasize the Finish / width-start corner.
            var scale = (i == 0 && heightLocked) ? cornerMarkerSize * 1.45f : cornerMarkerSize;
            markers[i].transform.localScale = Vector3.one * scale;
        }

        // Floor loop
        if (corners.Count == 0)
        {
            floorLoop.positionCount = 0;
            ceilingLoop.enabled = false;
            ClearWallGuides();
            ClearMeasurementLabels();
            return;
        }

        var loopClosed = closed || corners.Count >= 3;
        floorLoop.loop = loopClosed;
        floorLoop.positionCount = corners.Count;
        floorLoop.enabled = !roomLocked;
        for (var i = 0; i < corners.Count; i++)
            floorLoop.SetPosition(i, corners[i] + Vector3.up * 0.012f);

        // Vertical wall guides + ceiling ring
        EnsureWallGuides(corners.Count);
        for (var i = 0; i < corners.Count; i++)
        {
            var a = corners[i] + Vector3.up * 0.012f;
            var b = a + Vector3.up * wallHeight;
            wallGuides[i].enabled = !roomLocked;
            wallGuides[i].positionCount = 2;
            wallGuides[i].SetPosition(0, a);
            wallGuides[i].SetPosition(1, b);
        }

        for (var i = corners.Count; i < wallGuides.Length; i++)
            wallGuides[i].enabled = false;

        if (corners.Count >= 2 && !roomLocked)
        {
            ceilingLoop.enabled = true;
            ceilingLoop.loop = loopClosed;
            ceilingLoop.positionCount = corners.Count;
            for (var i = 0; i < corners.Count; i++)
                ceilingLoop.SetPosition(i, corners[i] + Vector3.up * wallHeight);
        }
        else
        {
            ceilingLoop.enabled = false;
        }

        RebuildMeasurementLabels(loopClosed);
    }

    void RebuildMeasurementLabels(bool loopClosed)
    {
        ClearMeasurementLabels();
        if (!showEdgeMeasurements || corners.Count < 2) return;

        var edgeCount = loopClosed ? corners.Count : corners.Count - 1;
        for (var i = 0; i < edgeCount; i++)
        {
            var a = corners[i];
            var b = corners[(i + 1) % corners.Count];
            var lengthMeters = Vector3.Distance(Flat(a), Flat(b));
            if (lengthMeters < 0.05f) continue;

            var mid = (a + b) * 0.5f + Vector3.up * 0.08f;
            var cm = Mathf.RoundToInt(lengthMeters * 100f);
            var label = CreateMeasurementLabel(mid, $"{cm} cm");
            measurementLabels.Add(label);
        }

        // Wall height chip near first corner once the outline can form a room.
        if (loopClosed && corners.Count >= 3)
        {
            var heightPos = corners[0] + Vector3.up * (wallHeight * 0.5f);
            var heightCm = Mathf.RoundToInt(wallHeight * 100f);
            var heightLabel = CreateMeasurementLabel(heightPos, $"H {heightCm} cm");
            measurementLabels.Add(heightLabel);
        }
    }

    GameObject CreateMeasurementLabel(Vector3 worldPos, string text)
    {
        var go = new GameObject("MeasureLabel");
        go.transform.SetParent(root, false);
        go.transform.position = worldPos;

        var canvas = go.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        canvas.sortingOrder = 40;

        var rt = canvas.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(180f, 48f);
        go.transform.localScale = Vector3.one * 0.004f;

        var bg = ARDesignUiUtil.CreateRoundedImage(go.transform, new Color(1f, 1f, 1f, 0.94f), 24);
        bg.raycastTarget = false;
        var bgRt = bg.rectTransform;
        bgRt.anchorMin = Vector2.zero;
        bgRt.anchorMax = Vector2.one;
        bgRt.offsetMin = Vector2.zero;
        bgRt.offsetMax = Vector2.zero;

        var label = ARDesignUiUtil.CreateText(bg.transform, text, 30, FontStyle.Bold, TextAnchor.MiddleCenter);
        label.color = new Color(0.12f, 0.12f, 0.14f, 1f);
        label.raycastTarget = false;
        var labelRt = label.rectTransform;
        labelRt.anchorMin = Vector2.zero;
        labelRt.anchorMax = Vector2.one;
        labelRt.offsetMin = new Vector2(8f, 4f);
        labelRt.offsetMax = new Vector2(-8f, -4f);

        go.AddComponent<ARDesignBillboard>();
        return go;
    }

    void ClearMeasurementLabels()
    {
        for (var i = 0; i < measurementLabels.Count; i++)
        {
            if (measurementLabels[i] != null)
                Destroy(measurementLabels[i]);
        }

        measurementLabels.Clear();
    }

    void HidePreviewOnly()
    {
        HideLivePreview();
        HideHeightPreview();
        EndHeightPlacementTracking();
        if (root != null) root.gameObject.SetActive(false);
    }

    void ClearPreviewMeasureLabel()
    {
        if (previewMeasureLabel != null)
        {
            Destroy(previewMeasureLabel);
            previewMeasureLabel = null;
            previewMeasureText = null;
        }

        lastPreviewCm = int.MinValue;
        LivePreviewDistanceMeters = 0f;
        HasLivePreview = false;
    }

    public void Clear()
    {
        corners.Clear();
        foreach (var slot in cornerAnchors)
            ReleaseCornerSlot(slot);
        cornerAnchors.Clear();
        ClearMeasurementLabels();
        ClearPreviewMeasureLabel();
        if (previewSegment != null) previewSegment.enabled = false;
        if (!heightLocked)
            ResetHeightPhase();
        else if (heightLine != null)
            heightLine.enabled = false;
        RebuildVisuals();
        CornersChanged?.Invoke();
    }

    void ClearHeightMeasureLabel()
    {
        if (heightMeasureLabel != null)
        {
            Destroy(heightMeasureLabel);
            heightMeasureLabel = null;
            heightMeasureText = null;
        }

        lastHeightPreviewCm = int.MinValue;
        LiveHeightMeters = 0f;
        HasLiveHeightPreview = false;
    }

    void EnsureWallGuides(int count)
    {
        if (wallGuides.Length >= count) return;
        var next = new LineRenderer[count];
        for (var i = 0; i < wallGuides.Length; i++)
            next[i] = wallGuides[i];
        for (var i = wallGuides.Length; i < count; i++)
            next[i] = CreateLine($"WallGuide_{i}", wallLineWidth, false);
        wallGuides = next;
    }

    void ClearWallGuides()
    {
        for (var i = 0; i < wallGuides.Length; i++)
        {
            if (wallGuides[i] != null)
                wallGuides[i].enabled = false;
        }
    }

    bool TryGetFloorHit(Vector2 screenPoint, out Vector3 world)
    {
        world = default;
        if (raycastManager == null) return false;

        hits.Clear();
        if (raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
        {
            for (var i = 0; i < hits.Count; i++)
            {
                var plane = planeManager != null ? planeManager.GetPlane(hits[i].trackableId) : null;
                if (plane != null && plane.alignment != PlaneAlignment.HorizontalUp)
                    continue;
                world = hits[i].pose.position;
                return true;
            }

            world = hits[0].pose.position;
            return true;
        }

        // Fallback: estimated floor plane under the camera.
        if (arCamera == null) return false;
        var ray = arCamera.ScreenPointToRay(screenPoint);
        var floorY = EstimateFloorY();
        if (Mathf.Abs(ray.direction.y) < 1e-4f) return false;
        var t = (floorY - ray.origin.y) / ray.direction.y;
        if (t < 0.2f || t > 12f) return false;
        world = ray.GetPoint(t);
        return true;
    }

    float EstimateFloorY()
    {
        if (heightBaseSet) return heightFloorBase.y;
        if (corners.Count > 0) return corners[0].y;
        if (planeManager != null)
        {
            var best = float.PositiveInfinity;
            foreach (var plane in planeManager.trackables)
            {
                if (plane == null || plane.alignment != PlaneAlignment.HorizontalUp) continue;
                best = Mathf.Min(best, plane.transform.position.y);
            }

            if (!float.IsPositiveInfinity(best)) return best;
        }

        return arCamera != null ? arCamera.transform.position.y - 1.4f : 0f;
    }

    float FindFloorY(Vector3 point)
    {
        if (heightBaseSet) return heightFloorBase.y;
        if (corners.Count > 0) return corners[0].y;
        return EstimateFloorY();
    }

    static Vector3 Flat(Vector3 v) => new(v.x, 0f, v.z);

    LineRenderer CreateLine(string name, float width, bool loop)
    {
        var go = new GameObject(name);
        go.transform.SetParent(root, false);
        var line = go.AddComponent<LineRenderer>();
        line.sharedMaterial = lineMaterial;
        line.useWorldSpace = true;
        line.loop = loop;
        line.widthMultiplier = 1f;
        line.startWidth = width;
        line.endWidth = width;
        line.numCapVertices = 4;
        line.numCornerVertices = 4;
        line.alignment = LineAlignment.View;
        line.shadowCastingMode = ShadowCastingMode.Off;
        line.receiveShadows = false;
        line.startColor = edgeColor;
        line.endColor = edgeColor;
        line.positionCount = 0;
        return line;
    }

    static Material CreateLineMaterial(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Unlit")
                     ?? Shader.Find("Unlit/Color")
                     ?? Shader.Find("Sprites/Default");
        var material = new Material(shader);
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        material.color = color;
        return material;
    }

    static bool IsPointerOverUI(int touchId)
    {
        if (EventSystem.current == null) return false;
        return EventSystem.current.IsPointerOverGameObject(touchId);
    }
}
