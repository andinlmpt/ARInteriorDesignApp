using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Owns the room-scan phase of ARDesignScene.
///
/// PHASES
///   Idle            AR session is up but the user has not started a scan.
///   Scanning        Accumulating planes / mesh chunks. Progress ticks upward.
///   ReadyToConfirm  Coverage thresholds met. RN can offer "Done scanning".
///   Confirmed       Geometry snapshotted and frozen. Placement is unlocked.
///
/// COVERAGE MODEL
/// ARCore gives us planes and feature points, not a watertight room mesh, so
/// "coverage" is a heuristic blend of three independent signals:
///   • floor area found        — can we actually stand furniture somewhere?
///   • look-around coverage    — has the user swept the phone across the room?
///   • wall area found         — do we have vertical context for the export?
/// Walls are weighted but not gating: plenty of real rooms surface a usable
/// floor long before ARCore commits to a vertical plane.
///
/// Detection keeps running after confirmation (tracking quality degrades if you
/// disable it), but the snapshot taken at confirm time is what gets exported.
/// </summary>
[DefaultExecutionOrder(-150)]
public class RoomScanController : MonoBehaviour
{
    public enum ScanPhase
    {
        Idle,
        Scanning,
        ReadyToConfirm,
        Confirmed,
    }

    [Header("AR")]
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private ARPointCloudManager pointCloudManager;
    [Tooltip("Optional. AR Foundation has no meshing provider for ARCore, so this stays empty on Android.")]
    [SerializeField] private ARMeshManager meshManager;
    [SerializeField] private Camera arCamera;

    [Header("Coverage targets")]
    [Tooltip("Horizontal plane area (m²) that counts as a fully scanned floor.")]
    [SerializeField] private float targetFloorArea = 2.5f;
    [Tooltip("Vertical plane area (m²) that counts as fully scanned walls.")]
    [SerializeField] private float targetWallArea = 2f;
    [Tooltip("Fraction of the yaw circle the user must sweep before the scan is considered complete.")]
    [Range(0.1f, 1f)]
    [SerializeField] private float targetLookAroundCoverage = 0.25f;
    [Tooltip("Minimum seconds of scanning before ReadyToConfirm, so progress never snaps to 100% instantly.")]
    [SerializeField] private float minScanDuration = 2f;
    [Tooltip("Allow ReadyToConfirm once this fraction of the floor target is met (does not require 100%).")]
    [Range(0.2f, 1f)]
    [SerializeField] private float readyFloorScore = 0.45f;
    [Tooltip("Allow ReadyToConfirm once this fraction of look-around coverage is met.")]
    [Range(0.1f, 1f)]
    [SerializeField] private float readyLookScore = 0.35f;

    [Header("Memory budget")]
    [Tooltip("Hard cap on captured environment mesh chunks.")]
    [SerializeField] private int maxMeshChunks = 96;
    [Tooltip("Planes below this area (m²) are treated as noise.")]
    [SerializeField] private float minPlaneArea = 0.08f;

    [Header("Reporting")]
    [Tooltip("Seconds between scanProgress pushes to RN. Progress also fires immediately on phase change.")]
    [SerializeField] private float statusPushInterval = 0.4f;

    [Header("Corner outline")]
    [SerializeField] private ARDesignCornerRoomBuilder cornerBuilder;

    /// <summary>Fired on every phase transition.</summary>
    public event Action<ScanPhase> PhaseChanged;

    /// <summary>Fired on the throttled status cadence and on every phase change.</summary>
    public event Action<ScanStatusPayload> StatusChanged;

    public ScanPhase Phase { get; private set; } = ScanPhase.Idle;
    public bool IsConfirmed => Phase == ScanPhase.Confirmed;
    public RoomGeometrySnapshot ConfirmedRoom { get; private set; }
    public ARDesignCornerRoomBuilder CornerBuilder => cornerBuilder;

    /// <summary>Floor outline polygon in world XZ (copied at confirm). Used to keep furniture inside the room.</summary>
    public IReadOnlyList<Vector3> FloorPolygon => floorPolygon;

    readonly List<Vector3> floorPolygon = new();

    // Yaw sweep tracking: 24 buckets of 15° each.
    const int YawBucketCount = 24;
    readonly bool[] yawBuckets = new bool[YawBucketCount];

    float scanStartTime;
    float lastStatusPush;
    float cachedProgress;
    ScanStatusPayload cachedStatus = new();

    void Awake()
    {
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();
        if (pointCloudManager == null) pointCloudManager = FindFirstObjectByType<ARPointCloudManager>();
        if (meshManager == null) meshManager = FindFirstObjectByType<ARMeshManager>();
        if (arCamera == null) arCamera = Camera.main;
        if (cornerBuilder == null) cornerBuilder = FindFirstObjectByType<ARDesignCornerRoomBuilder>();
    }

    void OnEnable()
    {
        if (cornerBuilder != null)
            cornerBuilder.CornersChanged += OnCornersChanged;
    }

    void OnDisable()
    {
        if (cornerBuilder != null)
            cornerBuilder.CornersChanged -= OnCornersChanged;
    }

    void OnCornersChanged()
    {
        RecomputeStatus();
        PushStatus();

        if (Phase == ScanPhase.Scanning && cachedStatus.readyToConfirm)
            SetPhase(ScanPhase.ReadyToConfirm);
        else if (Phase == ScanPhase.ReadyToConfirm && !cachedStatus.readyToConfirm)
            SetPhase(ScanPhase.Scanning);
    }

    void Update()
    {
        if (Phase != ScanPhase.Scanning && Phase != ScanPhase.ReadyToConfirm)
            return;

        SampleYawBucket();
        RecomputeStatus();

        if (Phase == ScanPhase.Scanning && cachedStatus.readyToConfirm)
            SetPhase(ScanPhase.ReadyToConfirm);
        else if (Phase == ScanPhase.ReadyToConfirm && !cachedStatus.readyToConfirm)
            SetPhase(ScanPhase.Scanning);

        if (Time.unscaledTime - lastStatusPush >= statusPushInterval)
            PushStatus();
    }

    void OnDestroy()
    {
        ConfirmedRoom?.Dispose();
        ConfirmedRoom = null;
    }

    // ── Public API (driven by ARSceneBridge) ──────────────────────────────────

    /// <summary>Begins or restarts the scan phase, discarding any previously confirmed room.</summary>
    public void StartRoomScan()
    {
        ConfirmedRoom?.Dispose();
        ConfirmedRoom = null;
        floorPolygon.Clear();

        Array.Clear(yawBuckets, 0, yawBuckets.Length);
        scanStartTime = Time.unscaledTime;
        cachedProgress = 0f;

        SetPlaneDetectionEnabled(true);
        if (pointCloudManager != null)
            pointCloudManager.enabled = true;
        if (meshManager != null)
            meshManager.enabled = true;

        cornerBuilder?.PrepareForRescan();

        SetPhase(ScanPhase.Scanning);
    }

    /// <summary>
    /// Freezes the current geometry as the room layout and unlocks placement.
    /// Prefers a clean corner-to-corner outline when the user has tapped enough corners.
    /// </summary>
    public bool ConfirmRoomScan()
    {
        if (Phase == ScanPhase.Idle)
        {
            Debug.LogWarning("[RoomScanController] ConfirmRoomScan called before StartRoomScan.");
            return false;
        }

        RoomGeometrySnapshot snapshot = null;

        if (cornerBuilder != null && cornerBuilder.CanConfirm)
        {
            snapshot = RoomGeometryBuilder.CaptureFromFloorCorners(
                cornerBuilder.Corners, cornerBuilder.WallHeight);
            CaptureFloorPolygon(cornerBuilder.Corners);
        }

        if (snapshot == null || snapshot.IsEmpty)
            snapshot = RoomGeometryBuilder.Capture(planeManager, meshManager, maxMeshChunks, minPlaneArea);

        if (snapshot.IsEmpty)
        {
            snapshot.Dispose();
            Debug.LogWarning("[RoomScanController] Nothing to confirm — tap at least 3 floor corners first.");
            return false;
        }

        if (floorPolygon.Count < 3 && snapshot.hasBounds)
            CaptureFloorPolygonFromBounds(snapshot.bounds);

        ConfirmedRoom?.Dispose();
        ConfirmedRoom = snapshot;

        Debug.Log($"[RoomScanController] Room confirmed — {snapshot.planeCount} planes, " +
                  $"{snapshot.meshChunkCount} mesh chunks, {snapshot.triangleCount} triangles, " +
                  $"polygon={floorPolygon.Count}.");

        // Keep horizontal floor tracking so live-AR tap-to-place hits the real
        // floor. Visualizers stay hidden via ScanVisualizationController.
        // Vertical / point-cloud / mesh growth stop so the outline stays frozen.
        if (planeManager != null)
        {
            planeManager.requestedDetectionMode = PlaneDetectionMode.Horizontal;
            planeManager.enabled = true;
        }

        if (pointCloudManager != null)
            pointCloudManager.enabled = false;
        if (meshManager != null)
            meshManager.enabled = false;

        SetPhase(ScanPhase.Confirmed);
        return true;
    }

    /// <summary>
    /// Toggle live horizontal floor planes after confirm (RealRoom on / Planner off).
    /// </summary>
    public void SetLiveFloorTracking(bool enabled)
    {
        if (planeManager == null) return;
        if (!IsConfirmed && enabled) return;

        if (enabled)
        {
            planeManager.requestedDetectionMode = PlaneDetectionMode.Horizontal;
            planeManager.enabled = true;
        }
        else
        {
            planeManager.enabled = false;
        }
    }

    void CaptureFloorPolygon(IReadOnlyList<Vector3> corners)
    {
        floorPolygon.Clear();
        if (corners == null) return;
        for (var i = 0; i < corners.Count; i++)
            floorPolygon.Add(corners[i]);
    }

    void CaptureFloorPolygonFromBounds(Bounds bounds)
    {
        floorPolygon.Clear();
        var y = bounds.min.y;
        floorPolygon.Add(new Vector3(bounds.min.x, y, bounds.min.z));
        floorPolygon.Add(new Vector3(bounds.max.x, y, bounds.min.z));
        floorPolygon.Add(new Vector3(bounds.max.x, y, bounds.max.z));
        floorPolygon.Add(new Vector3(bounds.min.x, y, bounds.max.z));
    }

    /// <summary>
    /// Clamps a world point onto the confirmed floor polygon, inset from walls.
    /// Preserves the incoming Y so live-AR floor hits are not yanked to the
    /// (often slightly wrong) scan floor height.
    /// </summary>
    public Vector3 ClampToFloorPolygon(Vector3 worldPoint, float wallInset = 0.2f)
    {
        var keepY = worldPoint.y;

        if (floorPolygon.Count < 3)
        {
            if (ConfirmedRoom != null && ConfirmedRoom.hasBounds)
            {
                var b = ConfirmedRoom.bounds;
                var pad = Mathf.Max(0.05f, wallInset);
                worldPoint.x = Mathf.Clamp(worldPoint.x, b.min.x + pad, b.max.x - pad);
                worldPoint.z = Mathf.Clamp(worldPoint.z, b.min.z + pad, b.max.z - pad);
            }

            worldPoint.y = keepY;
            return worldPoint;
        }

        var point = new Vector3(worldPoint.x, 0f, worldPoint.z);

        if (!IsInsidePolygonXZ(point, floorPolygon))
        {
            point = ClosestPointOnPolygonXZ(point, floorPolygon);
            if (wallInset > 0.001f)
                point = InsetTowardCentroid(point, floorPolygon, wallInset);
        }
        else if (wallInset > 0.001f)
        {
            point = PushInsideFromEdges(point, floorPolygon, wallInset);
        }

        point.y = keepY;
        return point;
    }

    public bool IsInsideRoom(Vector3 worldPoint)
    {
        if (floorPolygon.Count < 3)
        {
            if (ConfirmedRoom == null || !ConfirmedRoom.hasBounds) return true;
            var b = ConfirmedRoom.bounds;
            return worldPoint.x >= b.min.x && worldPoint.x <= b.max.x
                   && worldPoint.z >= b.min.z && worldPoint.z <= b.max.z;
        }

        return IsInsidePolygonXZ(new Vector3(worldPoint.x, 0f, worldPoint.z), floorPolygon);
    }

    /// <summary>XZ centroid of the confirmed floor polygon (or room bounds center).</summary>
    public Vector3 FloorPolygonCentroid
    {
        get
        {
            if (floorPolygon.Count >= 3)
                return PolygonCentroidXZ(floorPolygon);

            if (ConfirmedRoom != null && ConfirmedRoom.hasBounds)
            {
                var c = ConfirmedRoom.bounds.center;
                c.y = 0f;
                return c;
            }

            return Vector3.zero;
        }
    }

    static bool IsInsidePolygonXZ(Vector3 point, IReadOnlyList<Vector3> polygon)
    {
        var inside = false;
        for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++)
        {
            var pi = polygon[i];
            var pj = polygon[j];
            var intersect = ((pi.z > point.z) != (pj.z > point.z))
                            && (point.x < (pj.x - pi.x) * (point.z - pi.z) / ((pj.z - pi.z) + 1e-8f) + pi.x);
            if (intersect) inside = !inside;
        }

        return inside;
    }

    static Vector3 ClosestPointOnPolygonXZ(Vector3 point, IReadOnlyList<Vector3> polygon)
    {
        var best = polygon[0];
        best.y = 0f;
        var bestDist = float.PositiveInfinity;

        for (var i = 0; i < polygon.Count; i++)
        {
            var a = polygon[i];
            var b = polygon[(i + 1) % polygon.Count];
            a.y = 0f;
            b.y = 0f;
            var closest = ClosestPointOnSegmentXZ(point, a, b);
            var d = (closest - point).sqrMagnitude;
            if (d < bestDist)
            {
                bestDist = d;
                best = closest;
            }
        }

        return best;
    }

    static Vector3 ClosestPointOnSegmentXZ(Vector3 p, Vector3 a, Vector3 b)
    {
        var ab = b - a;
        ab.y = 0f;
        var lenSq = ab.sqrMagnitude;
        if (lenSq < 1e-8f) return a;
        var t = Mathf.Clamp01(Vector3.Dot(p - a, ab) / lenSq);
        return a + ab * t;
    }

    static Vector3 InsetTowardCentroid(Vector3 point, IReadOnlyList<Vector3> polygon, float inset)
    {
        var centroid = PolygonCentroidXZ(polygon);
        var toCenter = centroid - point;
        toCenter.y = 0f;
        if (toCenter.sqrMagnitude < 1e-6f) return point;

        var candidate = point + toCenter.normalized * inset;
        return IsInsidePolygonXZ(candidate, polygon) ? candidate : point;
    }

    /// <summary>If closer than inset to any edge, push inward to maintain clearance.</summary>
    static Vector3 PushInsideFromEdges(Vector3 point, IReadOnlyList<Vector3> polygon, float inset)
    {
        var insetSq = inset * inset;
        var closest = ClosestPointOnPolygonXZ(point, polygon);
        var offset = point - closest;
        offset.y = 0f;
        if (offset.sqrMagnitude >= insetSq)
            return point;

        var centroid = PolygonCentroidXZ(polygon);
        var inward = centroid - closest;
        inward.y = 0f;
        if (inward.sqrMagnitude < 1e-6f) return point;

        var candidate = closest + inward.normalized * inset;
        return IsInsidePolygonXZ(candidate, polygon) ? candidate : point;
    }

    static Vector3 PolygonCentroidXZ(IReadOnlyList<Vector3> polygon)
    {
        var centroid = Vector3.zero;
        for (var i = 0; i < polygon.Count; i++)
        {
            centroid.x += polygon[i].x;
            centroid.z += polygon[i].z;
        }

        centroid /= polygon.Count;
        centroid.y = 0f;
        return centroid;
    }

    /// <summary>Latest coverage snapshot. Recomputed on demand so RN always gets fresh numbers.</summary>
    public ScanStatusPayload GetScanStatus()
    {
        RecomputeStatus();
        return cachedStatus;
    }

    // ── Coverage heuristics ───────────────────────────────────────────────────

    void SampleYawBucket()
    {
        if (arCamera == null) return;

        var forward = arCamera.transform.forward;
        forward.y = 0f;
        if (forward.sqrMagnitude < 1e-4f) return;

        var yaw = Mathf.Atan2(forward.x, forward.z) * Mathf.Rad2Deg;
        if (yaw < 0f) yaw += 360f;

        var bucket = Mathf.Clamp(Mathf.FloorToInt(yaw / (360f / YawBucketCount)), 0, YawBucketCount - 1);
        yawBuckets[bucket] = true;
    }

    void RecomputeStatus()
    {
        var horizontalArea = 0f;
        var verticalArea = 0f;
        var horizontalCount = 0;
        var verticalCount = 0;
        var planeCount = 0;

        if (planeManager != null)
        {
            foreach (var plane in planeManager.trackables)
            {
                if (plane == null) continue;
                if (plane.trackingState != TrackingState.Tracking) continue;
                if (plane.subsumedBy != null) continue;

                var area = plane.size.x * plane.size.y;
                if (area < minPlaneArea) continue;

                planeCount++;

                switch (plane.alignment)
                {
                    case PlaneAlignment.HorizontalUp:
                        horizontalArea += area;
                        horizontalCount++;
                        break;
                    case PlaneAlignment.Vertical:
                        verticalArea += area;
                        verticalCount++;
                        break;
                }
            }
        }

        var pointCount = 0;
        if (pointCloudManager != null)
        {
            foreach (var cloud in pointCloudManager.trackables)
            {
                if (cloud == null || !cloud.positions.HasValue) continue;
                pointCount += cloud.positions.Value.Length;
            }
        }

        var meshChunkCount = 0;
        if (meshManager != null)
        {
            foreach (var filter in meshManager.GetComponentsInChildren<MeshFilter>())
            {
                if (filter != null && filter.sharedMesh != null)
                    meshChunkCount++;
            }
        }

        var seenBuckets = 0;
        foreach (var seen in yawBuckets)
        {
            if (seen) seenBuckets++;
        }

        var lookAround = seenBuckets / (float)YawBucketCount;

        var floorScore = Mathf.Clamp01(horizontalArea / Mathf.Max(0.01f, targetFloorArea));
        var wallScore = Mathf.Clamp01(verticalArea / Mathf.Max(0.01f, targetWallArea));
        var lookScore = Mathf.Clamp01(lookAround / Mathf.Max(0.01f, targetLookAroundCoverage));

        var cornerCount = cornerBuilder != null ? cornerBuilder.CornerCount : 0;
        var cornerProgress = Mathf.Clamp01(cornerCount / 4f);
        var progress = cornerCount > 0
            ? Mathf.Max(0.15f, cornerProgress)
            : 0.45f * floorScore + 0.30f * lookScore + 0.25f * wallScore;

        // Progress only ever climbs — planes get merged and re-fitted constantly,
        // and a bar that jumps backwards reads as a bug to the user.
        cachedProgress = Mathf.Max(cachedProgress, progress);

        // Corner-to-corner is ready with 3+ taps. Plane heuristics remain a fallback.
        var ready = Phase != ScanPhase.Idle && (
            (cornerBuilder != null && cornerBuilder.CanConfirm) ||
            (Time.unscaledTime - scanStartTime >= minScanDuration
             && horizontalCount > 0
             && floorScore >= readyFloorScore
             && lookScore >= readyLookScore));

        cachedStatus.phase = PhaseToString(Phase);
        cachedStatus.progress = Phase == ScanPhase.Confirmed ? 1f : cachedProgress;
        cachedStatus.readyToConfirm = ready || Phase == ScanPhase.Confirmed;
        cachedStatus.confirmed = Phase == ScanPhase.Confirmed;
        cachedStatus.planeCount = Mathf.Max(planeCount, cornerCount);
        cachedStatus.horizontalPlaneCount = horizontalCount;
        cachedStatus.verticalPlaneCount = verticalCount;
        cachedStatus.meshChunkCount = meshChunkCount;
        cachedStatus.pointCount = pointCount;
        cachedStatus.horizontalAreaSqm = horizontalArea;
        cachedStatus.verticalAreaSqm = verticalArea;
        cachedStatus.lookAroundCoverage = lookAround;
        cachedStatus.hint = BuildHint(floorScore, lookScore, wallScore, cornerCount);
    }

    string BuildHint(float floorScore, float lookScore, float wallScore, int cornerCount)
    {
        if (Phase == ScanPhase.Confirmed) return "confirmed";
        if (Phase == ScanPhase.Idle) return "idle";
        if (cornerBuilder != null)
        {
            if (cornerBuilder.CanConfirm) return "readyToConfirm";
            if (cornerCount == 0) return "tapFirstCorner";
            if (cornerCount == 1) return "tapNextCorner";
            if (cornerCount == 2) return "tapThirdCorner";
            return "tapMoreCorners";
        }

        if (cachedStatus.readyToConfirm) return "readyToConfirm";
        if (floorScore < 0.35f) return "findFloor";
        if (lookScore < 1f) return "moveAround";
        if (wallScore < 0.5f) return "scanWalls";
        return "keepScanning";
    }

    // ── Plumbing ──────────────────────────────────────────────────────────────

    void SetPhase(ScanPhase phase)
    {
        if (Phase == phase) return;

        Phase = phase;
        RecomputeStatus();
        PhaseChanged?.Invoke(phase);
        PushStatus();
    }

    void PushStatus()
    {
        lastStatusPush = Time.unscaledTime;
        StatusChanged?.Invoke(cachedStatus);
    }

    void SetPlaneDetectionEnabled(bool enabled)
    {
        if (planeManager != null)
            planeManager.enabled = enabled;
    }

    public static string PhaseToString(ScanPhase phase) => phase switch
    {
        ScanPhase.Scanning => "scanning",
        ScanPhase.ReadyToConfirm => "readyToConfirm",
        ScanPhase.Confirmed => "confirmed",
        _ => "idle",
    };
}
