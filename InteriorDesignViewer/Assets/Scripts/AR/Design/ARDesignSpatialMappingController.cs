using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;

/// <summary>
/// One walk around the room finds everything. While the walls are outlined (by
/// <see cref="ARAutoRoomScan"/> or corners tapped by hand), the object detector also looks for
/// doors, windows and furniture, and shows each one as soon as it has been seen twice (or once,
/// confidently). Finish closes the outline and opens Review: doors and windows are placed exactly
/// on the final walls, furniture inside the room is kept, and the user removes anything wrong
/// (tap it) or adds anything missed (+ Add: both edges of a door/window, or where a piece of
/// furniture stands). Back returns to the walk and keeps everything. Removed things stay away,
/// and the user's own changes in Review can be undone.
/// </summary>
[DefaultExecutionOrder(-95)]
public class ARDesignSpatialMappingController : MonoBehaviour
{
    public enum Phase
    {
        /// <summary>Walking the room: walls, doors, windows and furniture are found together.</summary>
        Outline,
        /// <summary>Checking and fixing what was found before the room is saved.</summary>
        ConfirmReview,
    }

    /// <summary>What a floor tap adds in Review (None: taps remove things, or add a "maybe").</summary>
    public enum AddMode
    {
        None,
        Door,
        Window,
        Furniture,
    }

    /// <summary>A door, window or piece of furniture appeared or went (the HUD shows a short note).</summary>
    public enum Note
    {
        OpeningFound,
        OpeningAdded,
        OpeningRemoved,
        FurnitureFound,
        FurnitureAdded,
        FurnitureRemoved,
    }

    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARDesignCornerRoomBuilder cornerBuilder;
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private Camera arCamera;
    [SerializeField] private ARDesignSpatialMappingVisualizer visualizer;
    [SerializeField] private ARFurnitureAutoSuggestService autoSuggest;

    /// <summary>Furniture that can be added by hand, in the order the HUD offers them.</summary>
    public static readonly string[] FurnitureTypes = { "sofa", "bed", "table", "chair", "desk", "wardrobe", "other" };

    const float MinOpeningWidth = 0.3f;
    const float DefaultDoorHeight = 2.1f;
    const float DefaultWindowHeight = 1.2f;
    const float DefaultWindowSill = 0.9f;
    const string AutoPrefix = "auto-";
    /// <summary>A detected piece of furniture is added by itself once seen this often, or this confidently.</summary>
    const int AutoAcceptSightings = 2;
    const float AutoAcceptConfidence = 0.55f;
    /// <summary>A door/window the user removed stays away within this distance of where it was (m).</summary>
    const float RemovedOpeningRadius = 0.45f;
    /// <summary>Walls found by the automatic scan are only the part seen; doors near their ends still count.</summary>
    const float LiveWallExtension = 0.6f;
    const float LiveRefreshSeconds = 1f;

    /// <summary>A door or window added by hand, kept by position so it survives going back to the walk.</summary>
    sealed class ManualOpening
    {
        public string id;
        public string type;
        public Vector3 a;
        public Vector3 b;
        public float sill;
        public float height;
        public string swing;
    }

    enum ActionKind
    {
        AddedOpening,
        RemovedOpening,
        AddedObstacle,
        RemovedObstacle,
    }

    /// <summary>Something the user did in Review, so Undo can take it back.</summary>
    struct ReviewAction
    {
        public ActionKind kind;
        public RoomOpeningPayload opening;
        public ManualOpening manual;
        public RoomObstaclePayload obstacle;
        public (string kind, Vector3 center) removedSpot;
        public bool hadRemovedSpot;
    }

    readonly List<RoomOpeningPayload> openings = new();
    readonly List<RoomObstaclePayload> obstacles = new();
    readonly List<FurnitureAutoSuggestion> pendingSuggestions = new();
    readonly List<ARRaycastHit> hits = new();
    readonly AutoOpeningResolver.Tracker openingTracker = new();
    /// <summary>Furniture the user removed: detections there are ignored.</summary>
    readonly List<RoomObstaclePayload> removedObstacles = new();
    /// <summary>Doors/windows the user removed, by kind and floor position: they stay away whatever the walls.</summary>
    readonly List<(string kind, Vector3 center)> removedOpenings = new();
    readonly List<ManualOpening> manualOpenings = new();
    readonly List<ReviewAction> history = new();
    readonly HashSet<string> announcedFurniture = new();
    readonly Dictionary<string, int> announcedOpenings = new();
    List<AutoOpeningResolver.LiveOpening> liveOpenings = new();
    readonly List<FurnitureAutoSuggestion> liveFurniture = new();
    /// <summary>Furniture seen once during the walk: drawn faint until it's seen again.</summary>
    readonly List<FurnitureAutoSuggestion> liveMaybeFurniture = new();

    readonly List<RoomObstaclePayload> knownFurniture = new();
    int knownFurnitureCount = -1;
    int knownRemovedCount = -1;
    ARAutoRoomScan autoScan;
    int openingCounter;
    int obstacleCounter;
    int pendingEdgeWall = -1;
    float pendingEdgeOffset;
    Vector3 pendingEdgePoint;
    string addFurnitureType = "sofa";
    float nextLiveRefreshAt;
    int lastSightingCount = -1;
    int lastSuggestRevision = -1;
    int lastCornerCount = -1;
    int lastWallCount = -1;
    string liveSignature = string.Empty;
    bool lastFurnitureScanning;

    public Phase CurrentPhase { get; private set; } = Phase.Outline;
    public bool IsReviewing => CurrentPhase == Phase.ConfirmReview;
    public bool CanConfirmRoom => CurrentPhase == Phase.ConfirmReview && CurrentAddMode == AddMode.None;
    public AddMode CurrentAddMode { get; private set; } = AddMode.None;
    /// <summary>The furniture type being added (when <see cref="CurrentAddMode"/> is Furniture).</summary>
    public string AddingFurnitureType => addFurnitureType;
    /// <summary>True after the first edge of a door/window is tapped, until the second edge.</summary>
    public bool HasPendingOpeningEdge { get; private set; }
    /// <summary>The build has the model that sees doors and windows.</summary>
    public bool DetectsOpenings => ARFurnitureCocoDetector.HasRoomModel;
    public bool IsFurnitureScanning => autoSuggest != null && autoSuggest.IsScanning;

    /// <summary>The object detector is loaded and has run once (or there is none to wait for).</summary>
    public bool IsDetectorWarm => autoSuggest == null || autoSuggest.IsDetectorWarm;

    /// <summary>Loads and runs the object detector once, so its first detection doesn't freeze the walk.</summary>
    public void WarmUpDetector()
    {
        ResolveReferences();
        autoSuggest?.WarmUpDetector();
    }

    public IReadOnlyList<RoomOpeningPayload> Openings => openings;
    public IReadOnlyList<RoomObstaclePayload> Obstacles => obstacles;
    public IReadOnlyList<FurnitureAutoSuggestion> PendingSuggestions => pendingSuggestions;
    /// <summary>Doors and windows found so far during the walk (placed in the room).</summary>
    public IReadOnlyList<AutoOpeningResolver.LiveOpening> LiveOpenings => liveOpenings;
    /// <summary>Furniture found so far during the walk (not counting furniture kept from an earlier walk).</summary>
    public IReadOnlyList<FurnitureAutoSuggestion> LiveFurniture => liveFurniture;

    public int OpeningCount => IsReviewing ? openings.Count : liveOpenings.Count + manualOpenings.Count;
    public int ObstacleCount => obstacles.Count + (IsReviewing ? 0 : liveFurniture.Count);
    public int DoorCount => CountOpenings("door");
    public int WindowCount => CountOpenings("window");

    public event Action PhaseChanged;
    public event Action DataChanged;
    /// <summary>What changed and its type ("door", "window", "sofa", …).</summary>
    public event Action<Note, string> Noted;

    void Awake() => ResolveReferences();

    void ResolveReferences()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (cornerBuilder == null) cornerBuilder = FindFirstObjectByType<ARDesignCornerRoomBuilder>();
        if (raycastManager == null) raycastManager = FindFirstObjectByType<ARRaycastManager>();
        if (arCamera == null) arCamera = Camera.main;
        if (visualizer == null)
            visualizer = GetComponent<ARDesignSpatialMappingVisualizer>();
        if (autoSuggest == null)
            autoSuggest = GetComponent<ARFurnitureAutoSuggestService>();
        // Older measurement scenes already contain this controller, so the HUD's
        // runtime setup does not run. Ensure those scenes start the detector too.
        if (autoSuggest == null)
            autoSuggest = gameObject.AddComponent<ARFurnitureAutoSuggestService>();
    }

    void Start()
    {
        ResolveReferences();
        if (cornerBuilder != null && cornerBuilder.IsLoopClosed && CurrentPhase == Phase.Outline)
            EnterReview(announce: false);
    }

    void OnEnable()
    {
        EnhancedTouchSupport.Enable();
        if (cornerBuilder != null)
            cornerBuilder.CornersChanged += OnCornersChanged;
    }

    void OnDisable()
    {
        if (cornerBuilder != null)
            cornerBuilder.CornersChanged -= OnCornersChanged;
    }

    void Update()
    {
        if (CurrentPhase == Phase.Outline)
            TickWalk();
        else
            TickReview();

        if (CurrentPhase != Phase.ConfirmReview) return;
        if (Touch.activeTouches.Count != 1) return;
        var touch = Touch.activeTouches[0];
        if (touch.phase != UnityEngine.InputSystem.TouchPhase.Began) return;
        if (IsPointerOverUI(touch.touchId)) return;
        HandleReviewTap(touch.screenPosition);
    }

    static bool IsAuto(string id) => id != null && id.StartsWith(AutoPrefix);

    int CountOpenings(string kind)
    {
        var count = 0;
        if (IsReviewing)
        {
            foreach (var o in openings)
                if (o.type == kind) count++;
            return count;
        }

        foreach (var o in liveOpenings)
            if (o.kind == kind) count++;
        foreach (var m in manualOpenings)
            if (m.type == kind) count++;
        return count;
    }

    /// <summary>Furniture in the room plus furniture the user removed: the detector skips both.</summary>
    List<RoomObstaclePayload> ObstaclesAndRemoved()
    {
        // Every change moves items in or out of these lists, so the counts tell when to rebuild.
        if (knownFurnitureCount != obstacles.Count || knownRemovedCount != removedObstacles.Count)
        {
            knownFurniture.Clear();
            knownFurniture.AddRange(obstacles);
            knownFurniture.AddRange(removedObstacles);
            knownFurnitureCount = obstacles.Count;
            knownRemovedCount = removedObstacles.Count;
        }

        return knownFurniture;
    }

    float FloorY => cornerBuilder == null ? 0f
        : cornerBuilder.CornerCount > 0 ? RoomPolygonUtil.ComputeFloorY(cornerBuilder.Corners)
        : cornerBuilder.FloorY;

    bool IsRemovedOpening(string kind, Vector3 center)
    {
        foreach (var r in removedOpenings)
        {
            if (r.kind == kind && FlatDistance(r.center, center) <= RemovedOpeningRadius) return true;
        }

        return false;
    }

    static float FlatDistance(Vector3 a, Vector3 b) => new Vector2(a.x - b.x, a.z - b.z).magnitude;

    // ── The walk ──────────────────────────────────────────────────────────────

    /// <summary>The detector looks while the user walks; what it finds is shown at once.</summary>
    void TickWalk()
    {
        if (autoSuggest == null || cornerBuilder == null || !cornerBuilder.IsHeightLocked) return;

        autoSuggest.TickEarlyScan(FloorY, ObstaclesAndRemoved());

        if (autoScan == null) autoScan = FindFirstObjectByType<ARAutoRoomScan>();
        var sightings = autoSuggest.OpeningSightings.Count;
        var walls = autoScan != null ? autoScan.WallCount : 0;
        var changed = sightings != lastSightingCount || autoSuggest.Revision != lastSuggestRevision
                      || cornerBuilder.CornerCount != lastCornerCount || walls != lastWallCount;
        if (!changed && Time.unscaledTime < nextLiveRefreshAt) return;

        lastSightingCount = sightings;
        lastSuggestRevision = autoSuggest.Revision;
        lastCornerCount = cornerBuilder.CornerCount;
        lastWallCount = walls;
        nextLiveRefreshAt = Time.unscaledTime + LiveRefreshSeconds;
        RefreshLive(announce: true);
    }

    /// <summary>Walls known so far: the outline's edges, and the walls the automatic scan has found.</summary>
    List<AutoOpeningResolver.WallSegment> WalkWalls()
    {
        var walls = new List<AutoOpeningResolver.WallSegment>();
        var corners = cornerBuilder.Corners;
        for (var i = 0; i + 1 < corners.Count; i++)
            walls.Add(new AutoOpeningResolver.WallSegment(corners[i], corners[i + 1]));
        if (corners.Count >= 3)
            walls.Add(new AutoOpeningResolver.WallSegment(corners[^1], corners[0]));

        if (autoScan != null && autoScan.Enabled)
        {
            var floorY = FloorY;
            var found = autoScan.Walls;
            for (var i = 0; i < found.Count; i++)
            {
                if (!autoScan.IsRoomWall(i)) continue;
                var a = found[i].End(0) - found[i].dir * LiveWallExtension;
                var b = found[i].End(1) + found[i].dir * LiveWallExtension;
                walls.Add(new AutoOpeningResolver.WallSegment(new Vector3(a.x, floorY, a.y), new Vector3(b.x, floorY, b.y)));
            }
        }

        return walls;
    }

    void RefreshLive(bool announce)
    {
        liveOpenings = AutoOpeningResolver.PlaceLive(
            autoSuggest.OpeningSightings, WalkWalls(), FloorY, cornerBuilder.WallHeight, IsRemovedOpening);

        liveFurniture.Clear();
        liveMaybeFurniture.Clear();
        foreach (var s in autoSuggest.EarlySightings)
        {
            if (s.source != "coco") continue;
            if (OverlapsAny(s, obstacles) || OverlapsAny(s, removedObstacles)) continue;
            // Square to the walls walked so far (kept inside them once the room is closed).
            var fitted = ARFurnitureAutoSuggestService.FitToRoom(s, cornerBuilder.Corners, cornerBuilder.IsLoopClosed);
            // Seen once, it shows faint straight away: waiting for a second detection took 8–13 s.
            if (s.sightings < AutoAcceptSightings && s.confidence < AutoAcceptConfidence)
                liveMaybeFurniture.Add(fitted);
            else
                liveFurniture.Add(fitted);
        }

        if (announce) AnnounceLive();

        var signature = LiveSignature();
        if (signature == liveSignature) return;
        liveSignature = signature;
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    /// <summary>One note per newly found door/window (by kind count) and per new piece of furniture.</summary>
    void AnnounceLive()
    {
        foreach (var kind in new[] { "door", "window" })
        {
            var now = 0;
            foreach (var o in liveOpenings)
                if (o.kind == kind) now++;
            announcedOpenings.TryGetValue(kind, out var before);
            for (var i = before; i < now; i++) Noted?.Invoke(Note.OpeningFound, kind);
            announcedOpenings[kind] = Mathf.Max(before, now);
        }

        foreach (var s in liveFurniture)
        {
            if (announcedFurniture.Add(s.id)) Noted?.Invoke(Note.FurnitureFound, s.type);
        }
    }

    string LiveSignature()
    {
        var sb = new System.Text.StringBuilder();
        foreach (var o in liveOpenings)
            sb.Append(o.kind).Append(Mathf.RoundToInt(o.Center.x * 10f)).Append(',').Append(Mathf.RoundToInt(o.Center.z * 10f)).Append(';');
        foreach (var s in liveFurniture)
            sb.Append(s.id).Append(Mathf.RoundToInt(s.center.x * 10f)).Append(',').Append(Mathf.RoundToInt(s.center.z * 10f)).Append(';');
        foreach (var s in liveMaybeFurniture)
            sb.Append('?').Append(s.id).Append(Mathf.RoundToInt(s.center.x * 10f)).Append(',').Append(Mathf.RoundToInt(s.center.z * 10f)).Append(';');
        sb.Append(obstacles.Count);
        return sb.ToString();
    }

    static bool OverlapsAny(FurnitureAutoSuggestion s, List<RoomObstaclePayload> list)
    {
        foreach (var o in list)
        {
            if (o?.center == null || o.size == null) continue;
            if (ARFurniturePlaneAutoScannerOverlapsHelper.FootprintsOverlap(
                    s.center, s.size, s.yaw,
                    new Vector3(o.center.x, o.center.y, o.center.z), new Vector3(o.size.x, o.size.y, o.size.z), o.yaw))
                return true;
        }

        return false;
    }

    void OnCornersChanged()
    {
        if (cornerBuilder == null) return;
        if (cornerBuilder.IsLoopClosed)
        {
            if (CurrentPhase == Phase.Outline) EnterReview(announce: false);
            return;
        }

        // Reopened to keep walking: keep everything found so far.
        if (CurrentPhase != Phase.Outline) ReturnToWalk();
    }

    /// <summary>
    /// The outline is closed: furniture seen during the walk that stands inside the room is kept,
    /// and doors/windows (found or added by hand) are placed exactly on the final walls.
    /// </summary>
    void EnterReview(bool announce)
    {
        var corners = cornerBuilder.Corners;
        if (autoSuggest != null)
        {
            autoSuggest.AdoptEarlySightings(corners, pendingSuggestions);
            pendingSuggestions.RemoveAll(s => OverlapsAny(s, obstacles) || OverlapsAny(s, removedObstacles));
        }

        AcceptConfidentSuggestions(announce);
        ResolveAllOpeningSightings(announce);
        RestoreManualOpenings();
        liveOpenings.Clear();
        liveFurniture.Clear();
        liveMaybeFurniture.Clear();
        liveSignature = string.Empty;
        history.Clear();
        CurrentAddMode = AddMode.None;
        SetPhase(Phase.ConfirmReview);
    }

    void ReturnToWalk()
    {
        // Wall-based openings are rebuilt from the sightings (and manual ones from their
        // positions) when the room is closed again; furniture and removals stay as they are.
        openings.Clear();
        openingTracker.Clear();
        pendingSuggestions.Clear();
        history.Clear();
        ClearPendingEdge();
        CurrentAddMode = AddMode.None;
        lastSightingCount = -1;
        SetPhase(Phase.Outline);
    }

    /// <summary>Back from Review to the walk (the outline reopens; everything found is kept).</summary>
    public void BackToWalk()
    {
        if (CurrentPhase != Phase.ConfirmReview || cornerBuilder == null) return;
        cornerBuilder.ReopenLoop();
    }

    // ── Review ────────────────────────────────────────────────────────────────

    /// <summary>The detector keeps looking in Review, so pointing at something missed adds it.</summary>
    void TickReview()
    {
        if (autoSuggest == null) return;
        var previousCount = pendingSuggestions.Count;
        var previousRevision = autoSuggest.Revision;
        autoSuggest.TickAutoScan(ObstaclesAndRemoved(), pendingSuggestions);
        ResolveOpeningSightings(autoSuggest.TakeNewOpeningSightings(), announce: true);
        var accepted = AcceptConfidentSuggestions(announce: true);
        if (accepted || pendingSuggestions.Count != previousCount || previousRevision != autoSuggest.Revision
            || lastFurnitureScanning != IsFurnitureScanning)
        {
            RebuildVisuals();
            DataChanged?.Invoke();
        }

        lastFurnitureScanning = IsFurnitureScanning;
    }

    void HandleReviewTap(Vector2 screen)
    {
        switch (CurrentAddMode)
        {
            case AddMode.Door:
            case AddMode.Window:
                TryAddOpeningAtScreen(screen);
                return;
            case AddMode.Furniture:
                TryAddObstacleAtScreen(screen);
                return;
        }

        // Tapping a door/window or a piece of furniture removes it; tapping a faint "maybe" adds it.
        if (TryRemoveOpeningAtScreen(screen)) return;
        if (TryRemoveObstacleAtScreen(screen)) return;
        if ((TryGetFloorPoint(screen, out var world) || TryGetFloorFromRay(screen, out world)) && TryAcceptSuggestionNear(world))
            return;
    }

    /// <summary>
    /// Starts adding something by hand: a door or window (tap the floor at both edges) or a
    /// piece of furniture of <paramref name="furnitureType"/> (tap where it stands).
    /// </summary>
    public void StartAdding(AddMode mode, string furnitureType = null)
    {
        if (CurrentPhase != Phase.ConfirmReview) return;
        CurrentAddMode = mode;
        if (mode == AddMode.Furniture && !string.IsNullOrEmpty(furnitureType))
            addFurnitureType = furnitureType;
        ClearPendingEdge();
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    public void CancelAdding()
    {
        if (CurrentAddMode == AddMode.None && !HasPendingOpeningEdge) return;
        CurrentAddMode = AddMode.None;
        ClearPendingEdge();
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    /// <summary>Every sighting so far, against the just-closed outline (walls may have changed).</summary>
    void ResolveAllOpeningSightings(bool announce)
    {
        openingTracker.Clear();
        openings.RemoveAll(o => IsAuto(o.id));
        autoSuggest?.TakeNewOpeningSightings();
        if (autoSuggest != null)
            ResolveOpeningSightings(autoSuggest.OpeningSightings, announce);
    }

    void ResolveOpeningSightings(IReadOnlyList<AutoOpeningResolver.Sighting> sightings, bool announce)
    {
        if (sightings == null || sightings.Count == 0 || cornerBuilder == null || cornerBuilder.CornerCount < 3) return;

        var corners = cornerBuilder.Corners;
        var walls = AutoOpeningResolver.OutlineWalls(corners);
        var floorY = FloorY;
        var changed = false;
        foreach (var sighting in sightings)
        {
            if (!AutoOpeningResolver.TryPlace(sighting, walls, floorY, cornerBuilder.WallHeight, out var placement))
                continue;
            var center = walls[placement.wall].PointAt(placement.Center);
            if (IsRemovedOpening(placement.kind, center)) continue;
            var candidate = openingTracker.Add(placement);
            if (candidate == null) continue;
            changed |= UpsertAutoOpening(candidate, announce);
        }

        if (!changed) return;
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    /// <summary>Adds or updates the opening for a confirmed detection, unless one marked by hand is there.</summary>
    bool UpsertAutoOpening(AutoOpeningResolver.Tracker.Candidate c, bool announce)
    {
        var existing = openings.Find(o => o.id == c.id);
        if (existing == null)
        {
            foreach (var o in openings)
            {
                if (o.wallIndex != c.wall || IsAuto(o.id)) continue;
                var overlap = Mathf.Min(o.offsetAlongWall + o.width, c.end) - Mathf.Max(o.offsetAlongWall, c.start);
                if (overlap > 0.3f * Mathf.Min(o.width, c.end - c.start)) return false;
            }

            existing = new RoomOpeningPayload { id = c.id, type = c.kind, swing = c.kind == "door" ? "left" : "none" };
            openings.Add(existing);
            Debug.Log($"[ARDesignSpatialMapping] Auto {c.kind} on wall {c.wall}: " +
                      $"{c.start:F2}–{c.end:F2} m, sill {c.sill:F2} m, top {c.top:F2} m ({c.sightings} sightings).");
            if (announce) Noted?.Invoke(Note.OpeningFound, c.kind);
        }

        existing.wallIndex = c.wall;
        existing.offsetAlongWall = c.start;
        existing.width = c.end - c.start;
        existing.sillHeight = c.sill;
        existing.height = Mathf.Max(0.3f, c.top - c.sill);
        return true;
    }

    /// <summary>Puts doors/windows added by hand back on the nearest wall of the (new) outline.</summary>
    void RestoreManualOpenings()
    {
        foreach (var m in manualOpenings)
        {
            if (openings.Exists(o => o.id == m.id)) continue;
            if (!TryProjectOnWall((m.a + m.b) * 0.5f, out var wallIndex, out var centerOffset, out _)) continue;
            var length = GetWallLength(wallIndex);
            var width = Mathf.Min(FlatDistance(m.a, m.b), length);
            var start = Mathf.Clamp(centerOffset - width * 0.5f, 0f, length - width);
            openings.Add(new RoomOpeningPayload
            {
                id = m.id,
                type = m.type,
                wallIndex = wallIndex,
                offsetAlongWall = start,
                width = width,
                height = m.height,
                sillHeight = m.sill,
                swing = m.swing,
            });
        }
    }

    /// <summary>Tapping on a door or window (on the wall itself) removes it.</summary>
    bool TryRemoveOpeningAtScreen(Vector2 screen)
    {
        if (openings.Count == 0 || cornerBuilder == null || cornerBuilder.CornerCount < 3) return false;
        if (arCamera == null) arCamera = Camera.main;
        if (arCamera == null) return false;

        var ray = arCamera.ScreenPointToRay(screen);
        var corners = cornerBuilder.Corners;
        var floorY = FloorY;
        RoomOpeningPayload hit = null;
        var nearest = float.MaxValue;
        foreach (var o in openings)
        {
            if (o.wallIndex < 0 || o.wallIndex >= corners.Count) continue;
            if (!AutoOpeningResolver.TryHitWallPlane(ray.origin, ray.direction, corners, o.wallIndex, out var along, out var y, out var t))
                continue;
            var up = y - floorY;
            if (along < o.offsetAlongWall - 0.1f || along > o.offsetAlongWall + o.width + 0.1f) continue;
            if (up < o.sillHeight - 0.15f || up > o.sillHeight + o.height + 0.15f) continue;
            if (t < nearest)
            {
                nearest = t;
                hit = o;
            }
        }

        if (hit == null) return false;
        RemoveOpening(hit, record: true);
        return true;
    }

    /// <summary>Removes a door or window by id (e.g. from the HUD's list).</summary>
    public bool RemoveOpening(string id)
    {
        var opening = openings.Find(o => o.id == id);
        if (opening == null) return false;
        RemoveOpening(opening, record: true);
        return true;
    }

    void RemoveOpening(RoomOpeningPayload opening, bool record)
    {
        openings.Remove(opening);
        var action = new ReviewAction { kind = ActionKind.RemovedOpening, opening = opening };
        if (IsAuto(opening.id))
        {
            var spot = (opening.type, OpeningCenter(opening));
            removedOpenings.Add(spot);
            action.removedSpot = spot;
            action.hadRemovedSpot = true;
        }
        else
        {
            action.manual = manualOpenings.Find(m => m.id == opening.id);
            manualOpenings.RemoveAll(m => m.id == opening.id);
        }

        if (record) history.Add(action);
        RebuildVisuals();
        DataChanged?.Invoke();
        Noted?.Invoke(Note.OpeningRemoved, opening.type);
    }

    Vector3 OpeningCenter(RoomOpeningPayload o)
    {
        var corners = cornerBuilder.Corners;
        if (o.wallIndex < 0 || o.wallIndex >= corners.Count) return Vector3.zero;
        var wall = new AutoOpeningResolver.WallSegment(corners[o.wallIndex], corners[(o.wallIndex + 1) % corners.Count]);
        return wall.PointAt(o.offsetAlongWall + o.width * 0.5f);
    }

    /// <summary>Furniture the detector has seen twice (or once, confidently) is added without a tap.</summary>
    bool AcceptConfidentSuggestions(bool announce)
    {
        var accepted = false;
        for (var i = pendingSuggestions.Count - 1; i >= 0; i--)
        {
            var s = pendingSuggestions[i];
            if (s.source != "coco") continue;
            if (s.sightings < AutoAcceptSightings && s.confidence < AutoAcceptConfidence) continue;
            AcceptSuggestionAtIndex(i, AutoPrefix, record: false);
            if (announce) Noted?.Invoke(Note.FurnitureFound, s.type);
            accepted = true;
        }

        return accepted;
    }

    /// <summary>Tapping a piece of furniture already in the room removes it (and it isn't detected again).</summary>
    bool TryRemoveObstacleAtScreen(Vector2 screen)
    {
        if (obstacles.Count == 0) return false;
        if (!TryGetFloorPoint(screen, out var world) && !TryGetFloorFromRay(screen, out world)) return false;

        for (var i = obstacles.Count - 1; i >= 0; i--)
        {
            var o = obstacles[i];
            var center = new Vector3(o.center.x, o.center.y, o.center.z);
            var size = new Vector3(o.size.x + 0.2f, o.size.y, o.size.z + 0.2f);
            if (!ARFurniturePlaneAutoScannerOverlapsHelper.FootprintsOverlap(center, size, o.yaw, world, new Vector3(0.01f, 0.01f, 0.01f), 0f))
                continue;
            RemoveObstacle(o);
            return true;
        }

        return false;
    }

    /// <summary>Removes a piece of furniture by id (e.g. from the HUD's list).</summary>
    public bool RemoveObstacle(string id)
    {
        var obstacle = obstacles.Find(o => o.id == id);
        if (obstacle == null) return false;
        RemoveObstacle(obstacle);
        return true;
    }

    void RemoveObstacle(RoomObstaclePayload obstacle)
    {
        obstacles.Remove(obstacle);
        removedObstacles.Add(obstacle);
        history.Add(new ReviewAction { kind = ActionKind.RemovedObstacle, obstacle = obstacle });
        RebuildVisuals();
        DataChanged?.Invoke();
        Noted?.Invoke(Note.FurnitureRemoved, obstacle.type);
    }

    /// <summary>Adds a "maybe" (a detection not sure enough to add by itself) by id.</summary>
    public bool AcceptSuggestion(string id)
    {
        var index = pendingSuggestions.FindIndex(s => s.id == id);
        if (index < 0) return false;
        var type = pendingSuggestions[index].type;
        AcceptSuggestionAtIndex(index, string.Empty, record: true);
        Noted?.Invoke(Note.FurnitureAdded, type);
        return true;
    }

    /// <summary>Where the tap's ray meets the floor height (when no AR plane is under the finger).</summary>
    bool TryGetFloorFromRay(Vector2 screen, out Vector3 world)
    {
        world = default;
        if (arCamera == null) arCamera = Camera.main;
        if (arCamera == null || cornerBuilder == null || cornerBuilder.CornerCount < 3) return false;
        return ARFurnitureCocoDetector.TryProjectToFloor(arCamera.ScreenPointToRay(screen), FloorY, out world);
    }

    /// <summary>
    /// Back to the start of a new scan: drops openings, furniture and removals. A new scan also
    /// forgets what the detector saw.
    /// </summary>
    public void ResetToOutline(bool keepSightings = false)
    {
        autoSuggest?.DiscardResults();
        autoSuggest?.ClearEarlySightings();
        if (!keepSightings)
            autoSuggest?.ClearOpeningSightings();
        openingTracker.Clear();
        removedObstacles.Clear();
        removedOpenings.Clear();
        manualOpenings.Clear();
        openings.Clear();
        obstacles.Clear();
        pendingSuggestions.Clear();
        liveOpenings.Clear();
        liveFurniture.Clear();
        liveMaybeFurniture.Clear();
        history.Clear();
        announcedFurniture.Clear();
        announcedOpenings.Clear();
        liveSignature = string.Empty;
        lastSightingCount = -1;
        ClearPendingEdge();
        CurrentAddMode = AddMode.None;
        openingCounter = 0;
        obstacleCounter = 0;
        SetPhase(Phase.Outline);
        RebuildVisuals();
    }

    /// <summary>Primary action in Review: confirm the room.</summary>
    public bool TryPrimaryAction(out bool confirmedRoom)
    {
        confirmedRoom = CanConfirmRoom;
        return confirmedRoom;
    }

    /// <summary>Takes back the user's last change in Review (or the first edge of a door/window being added).</summary>
    public void UndoLast()
    {
        if (HasPendingOpeningEdge)
        {
            ClearPendingEdge();
            RebuildVisuals();
            DataChanged?.Invoke();
            return;
        }

        if (history.Count == 0) return;
        var action = history[^1];
        history.RemoveAt(history.Count - 1);
        switch (action.kind)
        {
            case ActionKind.AddedOpening:
                openings.Remove(action.opening);
                manualOpenings.RemoveAll(m => m.id == action.opening.id);
                Noted?.Invoke(Note.OpeningRemoved, action.opening.type);
                break;
            case ActionKind.RemovedOpening:
                openings.Add(action.opening);
                if (action.hadRemovedSpot) removedOpenings.Remove(action.removedSpot);
                if (action.manual != null) manualOpenings.Add(action.manual);
                Noted?.Invoke(Note.OpeningAdded, action.opening.type);
                break;
            case ActionKind.AddedObstacle:
                obstacles.Remove(action.obstacle);
                Noted?.Invoke(Note.FurnitureRemoved, action.obstacle.type);
                break;
            case ActionKind.RemovedObstacle:
                removedObstacles.Remove(action.obstacle);
                obstacles.Add(action.obstacle);
                Noted?.Invoke(Note.FurnitureAdded, action.obstacle.type);
                break;
        }

        RebuildVisuals();
        DataChanged?.Invoke();
    }

    public bool CanUndo() => CurrentPhase == Phase.ConfirmReview && (HasPendingOpeningEdge || history.Count > 0);

    public RoomOpeningPayload[] ToOpeningPayloads() => openings.ToArray();
    public RoomObstaclePayload[] ToObstaclePayloads() => obstacles.ToArray();

    void SetPhase(Phase phase)
    {
        if (CurrentPhase == phase) return;
        CurrentPhase = phase;
        if (phase != Phase.ConfirmReview)
        {
            autoSuggest?.DiscardResults();
            ClearPendingEdge();
        }

        RebuildVisuals();
        PhaseChanged?.Invoke();
        DataChanged?.Invoke();
    }

    /// <summary>
    /// Adding a door/window by hand: the first tap marks one edge on a wall, the second the other
    /// edge on the same wall; the opening spans the distance between them.
    /// </summary>
    void TryAddOpeningAtScreen(Vector2 screen)
    {
        if (cornerBuilder == null || cornerBuilder.CornerCount < 3) return;
        if (!TryGetFloorPoint(screen, out var world) && !TryGetFloorFromRay(screen, out world)) return;
        if (!TryProjectOnWall(world, out var wallIndex, out var offset, out var wallPoint)) return;

        if (!HasPendingOpeningEdge || wallIndex != pendingEdgeWall)
        {
            SetPendingEdge(wallIndex, offset, wallPoint);
            return;
        }

        var start = Mathf.Min(pendingEdgeOffset, offset);
        var width = Mathf.Abs(offset - pendingEdgeOffset);
        if (width < MinOpeningWidth) return;
        width = Mathf.Min(width, GetWallLength(wallIndex) - start);

        var isDoor = CurrentAddMode == AddMode.Door;
        var wallHeight = cornerBuilder.WallHeight;
        var sill = isDoor ? 0f : Mathf.Min(DefaultWindowSill, wallHeight * 0.5f);
        var height = isDoor
            ? Mathf.Min(DefaultDoorHeight, wallHeight - 0.05f)
            : Mathf.Min(DefaultWindowHeight, wallHeight - sill - 0.1f);

        openingCounter += 1;
        var opening = new RoomOpeningPayload
        {
            id = $"opening-{openingCounter}",
            type = isDoor ? "door" : "window",
            wallIndex = wallIndex,
            offsetAlongWall = start,
            width = width,
            height = Mathf.Max(0.3f, height),
            sillHeight = sill,
            swing = isDoor ? "left" : "none",
        };
        openings.Add(opening);

        var corners = cornerBuilder.Corners;
        var wall = new AutoOpeningResolver.WallSegment(corners[wallIndex], corners[(wallIndex + 1) % corners.Count]);
        var manual = new ManualOpening
        {
            id = opening.id,
            type = opening.type,
            a = wall.PointAt(start),
            b = wall.PointAt(start + width),
            sill = opening.sillHeight,
            height = opening.height,
            swing = opening.swing,
        };
        manualOpenings.Add(manual);
        history.Add(new ReviewAction { kind = ActionKind.AddedOpening, opening = opening, manual = manual });

        ClearPendingEdge();
        CurrentAddMode = AddMode.None;
        RebuildVisuals();
        DataChanged?.Invoke();
        Noted?.Invoke(Note.OpeningAdded, opening.type);
    }

    void SetPendingEdge(int wallIndex, float offset, Vector3 point)
    {
        HasPendingOpeningEdge = true;
        pendingEdgeWall = wallIndex;
        pendingEdgeOffset = offset;
        pendingEdgePoint = point;
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    void ClearPendingEdge()
    {
        HasPendingOpeningEdge = false;
        pendingEdgeWall = -1;
    }

    void TryAddObstacleAtScreen(Vector2 screen)
    {
        if (!TryGetFloorPoint(screen, out var world) && !TryGetFloorFromRay(screen, out world)) return;
        if (cornerBuilder != null && cornerBuilder.CornerCount >= 3
            && !RoomPolygonUtil.PointInsidePolygonXZ(world, cornerBuilder.Corners))
            return;

        obstacleCounter += 1;
        var type = addFurnitureType;
        // Square to the nearest wall and inside the room, like the furniture the scan finds.
        var box = ARFurnitureAutoSuggestService.FitToRoom(
            new FurnitureAutoSuggestion { center = world, size = DefaultObstacleSize(type) },
            cornerBuilder != null ? cornerBuilder.Corners : null,
            cornerBuilder != null && cornerBuilder.IsLoopClosed);
        var obstacle = new RoomObstaclePayload
        {
            id = $"obstacle-{obstacleCounter}",
            type = type,
            center = new ARDesignVec3(box.center),
            size = new ARDesignVec3(box.size),
            yaw = box.yaw,
        };
        obstacles.Add(obstacle);
        history.Add(new ReviewAction { kind = ActionKind.AddedObstacle, obstacle = obstacle });

        CurrentAddMode = AddMode.None;
        RebuildVisuals();
        DataChanged?.Invoke();
        Noted?.Invoke(Note.FurnitureAdded, type);
    }

    static Vector3 DefaultObstacleSize(string type) => type switch
    {
        "bed" => new Vector3(1.6f, 0.5f, 2.1f),
        "desk" => new Vector3(1.2f, 0.75f, 0.6f),
        "table" => new Vector3(1.0f, 0.75f, 1.0f),
        "chair" => new Vector3(0.5f, 0.9f, 0.5f),
        "wardrobe" => new Vector3(1.8f, 2.0f, 0.6f),
        _ => new Vector3(2.0f, 0.85f, 0.9f),
    };

    bool TryGetFloorPoint(Vector2 screen, out Vector3 world)
    {
        world = default;
        if (raycastManager == null) return false;
        hits.Clear();
        if (!raycastManager.Raycast(screen, hits, TrackableType.PlaneWithinPolygon)) return false;
        foreach (var hit in hits)
        {
            var plane = hit.trackable as ARPlane;
            if (plane != null && plane.alignment == PlaneAlignment.HorizontalUp)
            {
                world = hit.pose.position;
                return true;
            }
        }

        return false;
    }

    bool TryProjectOnWall(Vector3 world, out int wallIndex, out float offset, out Vector3 onWall)
    {
        wallIndex = -1;
        offset = 0f;
        onWall = world;
        var corners = cornerBuilder.Corners;
        if (corners == null || corners.Count < 3) return false;

        var bestDist = float.MaxValue;
        var flat = new Vector3(world.x, 0f, world.z);
        for (var i = 0; i < corners.Count; i++)
        {
            var a = corners[i];
            var b = corners[(i + 1) % corners.Count];
            var aFlat = new Vector3(a.x, 0f, a.z);
            var bFlat = new Vector3(b.x, 0f, b.z);
            var ab = bFlat - aFlat;
            var len = ab.magnitude;
            if (len < 1e-3f) continue;
            var t = Mathf.Clamp01(Vector3.Dot(flat - aFlat, ab) / (len * len));
            var proj = aFlat + ab * t;
            var dist = Vector3.Distance(flat, proj);
            if (dist < bestDist && dist <= 0.45f)
            {
                bestDist = dist;
                wallIndex = i;
                offset = t * len;
                onWall = new Vector3(proj.x, world.y, proj.z);
            }
        }

        return wallIndex >= 0;
    }

    float GetWallLength(int wallIndex)
    {
        var corners = cornerBuilder.Corners;
        var a = corners[wallIndex];
        var b = corners[(wallIndex + 1) % corners.Count];
        return Vector3.Distance(new Vector3(a.x, 0f, a.z), new Vector3(b.x, 0f, b.z));
    }

    public bool TryAcceptSuggestionNear(Vector3 world, float radius = 0.6f)
    {
        var best = -1;
        var bestDist = radius;
        for (var i = 0; i < pendingSuggestions.Count; i++)
        {
            var s = pendingSuggestions[i];
            var d = Vector3.Distance(
                new Vector3(world.x, 0f, world.z),
                new Vector3(s.center.x, 0f, s.center.z));
            if (d < bestDist)
            {
                bestDist = d;
                best = i;
            }
        }

        if (best < 0) return false;
        var type = pendingSuggestions[best].type;
        AcceptSuggestionAtIndex(best, string.Empty, record: true);
        Noted?.Invoke(Note.FurnitureAdded, type);
        return true;
    }

    void AcceptSuggestionAtIndex(int index, string idPrefix, bool record)
    {
        if (index < 0 || index >= pendingSuggestions.Count) return;
        var s = pendingSuggestions[index];
        pendingSuggestions.RemoveAt(index);

        obstacleCounter += 1;
        var obstacle = new RoomObstaclePayload
        {
            id = $"{idPrefix}obstacle-{obstacleCounter}",
            type = s.type,
            label = s.label ?? string.Empty,
            center = new ARDesignVec3(s.center),
            size = new ARDesignVec3(s.size),
            yaw = s.yaw,
        };
        obstacles.Add(obstacle);
        if (record) history.Add(new ReviewAction { kind = ActionKind.AddedObstacle, obstacle = obstacle });

        RebuildVisuals();
        DataChanged?.Invoke();
    }

    void RebuildVisuals()
    {
        if (visualizer == null) return;
        var reviewing = CurrentPhase == Phase.ConfirmReview;
        visualizer.Rebuild(new ARDesignSpatialMappingVisualizer.Contents
        {
            corners = cornerBuilder != null ? cornerBuilder.Corners : null,
            wallHeight = cornerBuilder != null ? cornerBuilder.WallHeight : 2.5f,
            openings = reviewing ? openings : null,
            liveOpenings = reviewing ? null : liveOpenings,
            obstacles = obstacles,
            furniture = reviewing ? null : liveFurniture,
            maybe = reviewing ? pendingSuggestions : liveMaybeFurniture,
            pendingEdge = HasPendingOpeningEdge ? pendingEdgePoint : null,
        });
    }

    static bool IsPointerOverUI(int touchId)
    {
#if UNITY_ANDROID || UNITY_IOS
        return UnityEngine.EventSystems.EventSystem.current != null
               && UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject(touchId);
#else
        return UnityEngine.EventSystems.EventSystem.current != null
               && UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject();
#endif
    }
}
