using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Merges AR plane + object-detector detections into pending furniture suggestions, and keeps the
/// detector's door/window sightings. The detector also runs while the user is still outlining the
/// room ("early sightings") and while marking doors and windows, so later steps start with what
/// the camera has already seen.
/// </summary>
[DisallowMultipleComponent]
public class ARFurnitureAutoSuggestService : MonoBehaviour
{
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private ARDesignCornerRoomBuilder cornerBuilder;
    [SerializeField] private ARFurnitureCocoDetector cocoDetector;
    [SerializeField] private float autoScanIntervalSeconds = 2.0f;
    [Tooltip("How often the detector looks while the room is being outlined.")]
    [SerializeField] private float earlyScanIntervalSeconds = 2.5f;
    [Tooltip("How often the detector looks while doors and windows are being marked.")]
    [SerializeField] private float openingScanIntervalSeconds = 2.0f;
    [SerializeField] private int maxSuggestions = 12;
    [SerializeField] private int maxEarlySightings = 16;
    [SerializeField] private int maxOpeningSightings = 200;

    readonly List<FurnitureAutoSuggestion> earlySightings = new();
    readonly List<AutoOpeningResolver.Sighting> openingSightings = new();
    readonly List<AutoOpeningResolver.Sighting> newOpeningSightings = new();
    float nextAutoScan;
    float nextEarlyScan;
    float nextOpeningScan;
    public bool IsScanning => cocoDetector != null && cocoDetector.IsScanning;
    public int Revision { get; private set; }

    /// <summary>Furniture spotted so far while the room outline is still open.</summary>
    public int EarlySightingCount => earlySightings.Count;

    public void DiscardResults() => cocoDetector?.DiscardResults();

    public void ClearEarlySightings() => earlySightings.Clear();

    /// <summary>Every door/window sighting so far (oldest dropped past the cap).</summary>
    public IReadOnlyList<AutoOpeningResolver.Sighting> OpeningSightings => openingSightings;

    /// <summary>Door/window sightings since the last call.</summary>
    public List<AutoOpeningResolver.Sighting> TakeNewOpeningSightings()
    {
        var taken = new List<AutoOpeningResolver.Sighting>(newOpeningSightings);
        newOpeningSightings.Clear();
        return taken;
    }

    public void ClearOpeningSightings()
    {
        openingSightings.Clear();
        newOpeningSightings.Clear();
    }

    void CollectOpeningSightings()
    {
        if (cocoDetector == null) return;
        foreach (var sighting in cocoDetector.TakeOpeningSightings())
        {
            openingSightings.Add(sighting);
            newOpeningSightings.Add(sighting);
        }
        if (openingSightings.Count > maxOpeningSightings)
            openingSightings.RemoveRange(0, openingSightings.Count - maxOpeningSightings);
    }

    /// <summary>
    /// Runs the detector while the outline is still open. The room shape isn't known yet,
    /// so sightings are kept wherever they touch the floor and filtered when the room closes.
    /// </summary>
    public void TickEarlyScan(float floorY)
    {
        if (Time.unscaledTime < nextEarlyScan && (cocoDetector == null || !cocoDetector.HasResults))
            return;
        nextEarlyScan = Time.unscaledTime + earlyScanIntervalSeconds;

        cocoDetector = ARFurnitureCocoDetector.EnsureOn(gameObject);
        if (cocoDetector == null) return;

        var found = cocoDetector.TryDetect(null, floorY, raycastManager, null, requireInsideRoom: false);
        CollectOpeningSightings();
        foreach (var sighting in found)
        {
            if (AddOrRefine(earlySightings, sighting, maxEarlySightings))
                Revision++;
        }
    }

    /// <summary>
    /// While doors and windows are marked: keeps the detector looking (door/window sightings), and
    /// files the furniture it sees for the next step.
    /// </summary>
    public void TickOpeningScan(IReadOnlyList<RoomObstaclePayload> existing, List<FurnitureAutoSuggestion> pending)
    {
        if (cornerBuilder == null || cornerBuilder.CornerCount < 3) return;
        if (Time.unscaledTime < nextOpeningScan && (cocoDetector == null || !cocoDetector.HasResults))
            return;
        nextOpeningScan = Time.unscaledTime + openingScanIntervalSeconds;

        cocoDetector = ARFurnitureCocoDetector.EnsureOn(gameObject);
        if (cocoDetector == null) return;
        var corners = cornerBuilder.Corners;
        var found = cocoDetector.TryDetect(corners, EstimateFloorY(corners), raycastManager, existing);
        CollectOpeningSightings();
        MergeIntoPending(found, pending);
    }

    /// <summary>
    /// Adds a detected object, or refines the one already listed where it stands: another sighting
    /// of the same type counts it as seen again, and a more confident one also replaces its
    /// position and size (keeping its id, so the app sees the same object).
    /// Returns true when the list changed.
    /// </summary>
    static bool AddOrRefine(List<FurnitureAutoSuggestion> list, FurnitureAutoSuggestion sighting, int max)
    {
        for (var i = 0; i < list.Count; i++)
        {
            var known = list[i];
            if (!ARFurniturePlaneAutoScannerOverlapsHelper.FootprintsOverlap(
                    sighting.center, sighting.size, sighting.yaw, known.center, known.size, known.yaw))
                continue;
            if (known.source != sighting.source || known.type != sighting.type)
                return false;

            var seen = Mathf.Max(1, known.sightings) + 1;
            if (sighting.confidence > known.confidence)
            {
                sighting.id = known.id;
                known = sighting;
            }
            known.sightings = seen;
            list[i] = known;
            return true;
        }

        if (list.Count >= max) return false;
        sighting.sightings = Mathf.Max(1, sighting.sightings);
        list.Add(sighting);
        return true;
    }

    /// <summary>Moves early sightings that fall inside the closed room into the suggestions.</summary>
    public void AdoptEarlySightings(IReadOnlyList<Vector3> corners, List<FurnitureAutoSuggestion> pending)
    {
        if (corners == null || corners.Count < 3 || earlySightings.Count == 0)
        {
            earlySightings.Clear();
            return;
        }

        var inside = earlySightings.FindAll(s => RoomPolygonUtil.PointInsidePolygonXZ(s.center, corners));
        earlySightings.Clear();
        MergeIntoPending(inside, pending);
    }

    void Awake()
    {
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();
        if (raycastManager == null) raycastManager = FindFirstObjectByType<ARRaycastManager>();
        if (cornerBuilder == null) cornerBuilder = FindFirstObjectByType<ARDesignCornerRoomBuilder>();
        cocoDetector = ARFurnitureCocoDetector.EnsureOn(gameObject);
    }

    public void TickAutoScan(
        ARDesignSpatialMappingController.Phase phase,
        IReadOnlyList<RoomObstaclePayload> obstacles,
        List<FurnitureAutoSuggestion> pending)
    {
        if (phase != ARDesignSpatialMappingController.Phase.ExistingFurniture)
            return;
        if (Time.unscaledTime < nextAutoScan && (cocoDetector == null || !cocoDetector.HasResults))
            return;
        nextAutoScan = Time.unscaledTime + autoScanIntervalSeconds;
        RunScan(obstacles, pending);
    }

    public void RunScan(IReadOnlyList<RoomObstaclePayload> obstacles, List<FurnitureAutoSuggestion> pending)
    {
        if (cornerBuilder == null || cornerBuilder.CornerCount < 3)
            return;

        var corners = cornerBuilder.Corners;
        var floorY = EstimateFloorY(corners);

        var found = new List<FurnitureAutoSuggestion>();
        cocoDetector = ARFurnitureCocoDetector.EnsureOn(gameObject);
        if (cocoDetector != null)
        {
            found.AddRange(cocoDetector.TryDetect(corners, floorY, raycastManager, obstacles));
            CollectOpeningSightings();
        }

        found.AddRange(ARFurniturePlaneAutoScanner.Scan(planeManager, corners, floorY, obstacles, pending));

        MergeIntoPending(found, pending);
    }

    void MergeIntoPending(List<FurnitureAutoSuggestion> found, List<FurnitureAutoSuggestion> pending)
    {
        foreach (var suggestion in found)
        {
            // Replace a heuristic surface with its recognized furniture label.
            if (suggestion.source == "coco")
                pending.RemoveAll(s => s.source == "plane" && ARFurniturePlaneAutoScannerOverlapsHelper.FootprintsOverlap(
                    suggestion.center, suggestion.size, suggestion.yaw, s.center, s.size, s.yaw));
            if (AddOrRefine(pending, suggestion, maxSuggestions))
                Revision++;
        }
    }

    static float EstimateFloorY(IReadOnlyList<Vector3> corners)
    {
        var y = corners[0].y;
        for (var i = 1; i < corners.Count; i++)
            y = Mathf.Min(y, corners[i].y);
        return y;
    }
}
