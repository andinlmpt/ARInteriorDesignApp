using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;

/// <summary>
/// Steps C–E of spatial mapping after the floor outline is closed:
/// mark doors/windows on walls, existing furniture on the floor, then confirm.
/// The object detector already runs while the outline is being drawn, so these steps start with
/// what the camera saw during the scan. Doors and windows it sees (Open Images model) are put on
/// the walls by themselves (<see cref="AutoOpeningResolver"/>), and furniture seen consistently
/// is added by itself. Tapping an opening or a piece of furniture removes it (and it stays away);
/// tapping the floor at both edges still marks a door/window by hand.
/// </summary>
[DefaultExecutionOrder(-95)]
public class ARDesignSpatialMappingController : MonoBehaviour
{
    public enum Phase
    {
        Outline,
        Openings,
        ExistingFurniture,
        ConfirmReview,
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

    static readonly string[] ObstacleTypes = { "sofa", "bed", "desk", "table", "chair", "wardrobe", "other" };

    readonly List<RoomOpeningPayload> openings = new();
    readonly List<RoomObstaclePayload> obstacles = new();
    readonly List<FurnitureAutoSuggestion> pendingSuggestions = new();
    readonly List<ARRaycastHit> hits = new();

    const float MinOpeningWidth = 0.3f;
    const float DefaultDoorHeight = 2.1f;
    const float DefaultWindowHeight = 1.2f;
    const float DefaultWindowSill = 0.9f;
    const string AutoPrefix = "auto-";
    /// <summary>A detected piece of furniture is added by itself once seen this often, or this confidently.</summary>
    const int AutoAcceptSightings = 2;
    const float AutoAcceptConfidence = 0.55f;

    readonly AutoOpeningResolver.Tracker openingTracker = new();
    /// <summary>Furniture the user removed: detections there are ignored.</summary>
    readonly List<RoomObstaclePayload> removedObstacles = new();

    int openingCounter;
    int obstacleCounter;
    int pendingEdgeWall = -1;
    float pendingEdgeOffset;
    Vector3 pendingEdgePoint;
    bool openingIsDoor = true;
    string openingSwing = "left";
    int obstacleTypeIndex;
    bool lastFurnitureScanning;
    int lastSuggestionRevision;

    public Phase CurrentPhase { get; private set; } = Phase.Outline;
    public bool CanConfirmRoom => CurrentPhase == Phase.ConfirmReview;
    public int OpeningCount => openings.Count;
    /// <summary>True after the first edge of a door/window is tapped, until the second edge.</summary>
    public bool HasPendingOpeningEdge { get; private set; }
    public int ObstacleCount => obstacles.Count;
    /// <summary>Doors/windows the detector placed (still on the walls).</summary>
    public int AutoOpeningCount => openings.FindAll(o => IsAuto(o.id)).Count;
    /// <summary>Furniture the detector added by itself (still there).</summary>
    public int AutoObstacleCount => obstacles.FindAll(o => IsAuto(o.id)).Count;
    /// <summary>The build has the model that sees doors and windows.</summary>
    public bool DetectsOpenings => ARFurnitureCocoDetector.HasRoomModel;
    public int PendingSuggestionCount => pendingSuggestions.Count;
    /// <summary>Furniture spotted while the outline is still open (shown as a count while scanning).</summary>
    public int EarlySightingCount => autoSuggest != null ? autoSuggest.EarlySightingCount : 0;
    public bool IsFurnitureScanning => autoSuggest != null && autoSuggest.IsScanning;
    public IReadOnlyList<FurnitureAutoSuggestion> PendingSuggestions => pendingSuggestions;
    public bool OpeningIsDoor => openingIsDoor;
    public string OpeningSwing => openingSwing;
    public string SelectedObstacleType => ObstacleTypes[Mathf.Clamp(obstacleTypeIndex, 0, ObstacleTypes.Length - 1)];
    public IReadOnlyList<RoomOpeningPayload> Openings => openings;
    public IReadOnlyList<RoomObstaclePayload> Obstacles => obstacles;
    /// <summary>Review and furniture can go back one step and keep everything found.</summary>
    public bool CanStepBack => CurrentPhase == Phase.ConfirmReview || CurrentPhase == Phase.ExistingFurniture;

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
            SetPhase(Phase.Openings);
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
        TickEarlyFurnitureScan();

        if (CurrentPhase == Phase.Openings && autoSuggest != null)
        {
            autoSuggest.TickOpeningScan(ObstaclesAndRemoved(), pendingSuggestions);
            ResolveOpeningSightings(autoSuggest.TakeNewOpeningSightings());
        }

        if (CurrentPhase == Phase.ExistingFurniture && autoSuggest != null)
        {
            var previousCount = pendingSuggestions.Count;
            autoSuggest.TickAutoScan(CurrentPhase, ObstaclesAndRemoved(), pendingSuggestions);
            // A door seen only now still goes on its wall.
            ResolveOpeningSightings(autoSuggest.TakeNewOpeningSightings());
            var accepted = AcceptConfidentSuggestions();
            if (accepted || pendingSuggestions.Count != previousCount || lastFurnitureScanning != IsFurnitureScanning
                || lastSuggestionRevision != autoSuggest.Revision)
            {
                RebuildVisuals();
                DataChanged?.Invoke();
            }
            lastFurnitureScanning = IsFurnitureScanning;
            lastSuggestionRevision = autoSuggest.Revision;
        }

        if (CurrentPhase != Phase.Openings && CurrentPhase != Phase.ExistingFurniture) return;
        if (Touch.activeTouches.Count != 1) return;
        var touch = Touch.activeTouches[0];
        if (touch.phase != UnityEngine.InputSystem.TouchPhase.Began) return;
        if (IsPointerOverUI(touch.touchId)) return;

        if (CurrentPhase == Phase.Openings)
        {
            // Tapping a door or window removes it; otherwise the tap marks an edge by hand.
            if (!HasPendingOpeningEdge && TryRemoveOpeningAtScreen(touch.screenPosition)) return;
            TryAddOpeningAtScreen(touch.screenPosition);
        }
        else
        {
            if (TryRemoveObstacleAtScreen(touch.screenPosition)) return;
            TryAddObstacleAtScreen(touch.screenPosition);
        }
    }

    static bool IsAuto(string id) => id != null && id.StartsWith(AutoPrefix);

    List<RoomObstaclePayload> ObstaclesAndRemoved()
    {
        var list = new List<RoomObstaclePayload>(obstacles);
        list.AddRange(removedObstacles);
        return list;
    }

    float FloorY => cornerBuilder != null && cornerBuilder.CornerCount > 0
        ? RoomPolygonUtil.ComputeFloorY(cornerBuilder.Corners)
        : 0f;

    /// <summary>Every sighting so far, against the just-closed outline (walls may have changed).</summary>
    void ResolveAllOpeningSightings()
    {
        openingTracker.Clear();
        openings.RemoveAll(o => IsAuto(o.id));
        autoSuggest?.TakeNewOpeningSightings();
        if (autoSuggest != null)
            ResolveOpeningSightings(autoSuggest.OpeningSightings);
    }

    void ResolveOpeningSightings(IReadOnlyList<AutoOpeningResolver.Sighting> sightings)
    {
        if (sightings == null || sightings.Count == 0 || cornerBuilder == null || cornerBuilder.CornerCount < 3) return;

        var corners = cornerBuilder.Corners;
        var floorY = FloorY;
        var changed = false;
        foreach (var sighting in sightings)
        {
            if (!AutoOpeningResolver.TryPlace(sighting, corners, floorY, cornerBuilder.WallHeight, out var placement))
                continue;
            var candidate = openingTracker.Add(placement);
            if (candidate == null) continue;
            changed |= UpsertAutoOpening(candidate);
        }

        if (!changed) return;
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    /// <summary>Adds or updates the opening for a confirmed detection, unless one marked by hand is there.</summary>
    bool UpsertAutoOpening(AutoOpeningResolver.Tracker.Candidate c)
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
            Noted?.Invoke(Note.OpeningFound, c.kind);
        }

        existing.wallIndex = c.wall;
        existing.offsetAlongWall = c.start;
        existing.width = c.end - c.start;
        existing.sillHeight = c.sill;
        existing.height = Mathf.Max(0.3f, c.top - c.sill);
        return true;
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
        RemoveOpening(hit);
        return true;
    }

    void RemoveOpening(RoomOpeningPayload opening)
    {
        openings.Remove(opening);
        if (IsAuto(opening.id))
            openingTracker.Suppress(opening.wallIndex, opening.offsetAlongWall + opening.width * 0.5f, opening.type);
        RebuildVisuals();
        DataChanged?.Invoke();
        Noted?.Invoke(Note.OpeningRemoved, opening.type);
    }

    /// <summary>Furniture the detector has seen twice (or once, confidently) is added without a tap.</summary>
    bool AcceptConfidentSuggestions()
    {
        var accepted = false;
        for (var i = pendingSuggestions.Count - 1; i >= 0; i--)
        {
            var s = pendingSuggestions[i];
            if (s.source != "coco") continue;
            if (s.sightings < AutoAcceptSightings && s.confidence < AutoAcceptConfidence) continue;
            AcceptSuggestionAtIndex(i, AutoPrefix);
            Noted?.Invoke(Note.FurnitureFound, s.type);
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
            obstacles.RemoveAt(i);
            removedObstacles.Add(o);
            RebuildVisuals();
            DataChanged?.Invoke();
            Noted?.Invoke(Note.FurnitureRemoved, o.type);
            return true;
        }

        return false;
    }

    /// <summary>Where the tap's ray meets the floor height (when no AR plane is under the finger).</summary>
    bool TryGetFloorFromRay(Vector2 screen, out Vector3 world)
    {
        world = default;
        if (arCamera == null) arCamera = Camera.main;
        if (arCamera == null || cornerBuilder == null || cornerBuilder.CornerCount < 3) return false;
        return ARFurnitureCocoDetector.TryProjectToFloor(arCamera.ScreenPointToRay(screen), FloorY, out world);
    }

    /// <summary>Steps 1 and 2 together: look for furniture while the user walks the corners.</summary>
    void TickEarlyFurnitureScan()
    {
        if (CurrentPhase != Phase.Outline || autoSuggest == null || cornerBuilder == null) return;
        // The floor height is known once the wall height is set. The automatic scan may have no
        // corner yet while the user walks the walls, and doors seen then still count.
        if (!cornerBuilder.IsHeightLocked) return;

        var floorY = cornerBuilder.CornerCount > 0
            ? RoomPolygonUtil.ComputeFloorY(cornerBuilder.Corners)
            : cornerBuilder.FloorY;
        var before = autoSuggest.EarlySightingCount;
        autoSuggest.TickEarlyScan(floorY);
        if (autoSuggest.EarlySightingCount != before)
            DataChanged?.Invoke();
    }

    void OnCornersChanged()
    {
        if (cornerBuilder == null) return;
        if (!cornerBuilder.IsLoopClosed)
        {
            // Reopened to fix the outline: door/window sightings stay valid (they're rays, not walls).
            if (CurrentPhase != Phase.Outline)
                ResetToOutline(keepSightings: true);
            return;
        }

        if (CurrentPhase == Phase.Outline)
        {
            autoSuggest?.AdoptEarlySightings(cornerBuilder.Corners, pendingSuggestions);
            SetPhase(Phase.Openings);
            // Doors and windows seen while walking the walls go up as soon as the walls exist.
            ResolveAllOpeningSightings();
        }
    }

    public void RunFurnitureAutoScan()
    {
        if (CurrentPhase != Phase.ExistingFurniture) return;
        autoSuggest?.RunScan(obstacles, pendingSuggestions);
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    /// <summary>
    /// Back to outlining: drops openings and furniture. A new scan also forgets what the detector saw;
    /// reopening the outline to fix it keeps the door/window sightings.
    /// </summary>
    public void ResetToOutline(bool keepSightings = false)
    {
        autoSuggest?.DiscardResults();
        autoSuggest?.ClearEarlySightings();
        if (!keepSightings)
            autoSuggest?.ClearOpeningSightings();
        openingTracker.Clear();
        removedObstacles.Clear();
        openings.Clear();
        obstacles.Clear();
        pendingSuggestions.Clear();
        ClearPendingEdge();
        openingCounter = 0;
        obstacleCounter = 0;
        SetPhase(Phase.Outline);
        RebuildVisuals();
    }

    public void ToggleOpeningKind()
    {
        openingIsDoor = !openingIsDoor;
        DataChanged?.Invoke();
    }

    public void CycleOpeningSwing()
    {
        openingSwing = openingSwing switch
        {
            "left" => "right",
            "right" => "none",
            _ => "left",
        };
        DataChanged?.Invoke();
    }

    public void CycleObstacleType()
    {
        obstacleTypeIndex = (obstacleTypeIndex + 1) % ObstacleTypes.Length;
        DataChanged?.Invoke();
    }

    /// <summary>Review → furniture → doors and windows, keeping everything found. False at the doors step.</summary>
    public bool TryStepBack()
    {
        switch (CurrentPhase)
        {
            case Phase.ConfirmReview:
                SetPhase(Phase.ExistingFurniture);
                return true;
            case Phase.ExistingFurniture:
                SetPhase(Phase.Openings);
                return true;
            default:
                return false;
        }
    }

    /// <summary>Primary action button on the scan HUD (advance or confirm map).</summary>
    public bool TryPrimaryAction(out bool confirmedRoom)
    {
        confirmedRoom = false;
        switch (CurrentPhase)
        {
            case Phase.Openings:
                SetPhase(Phase.ExistingFurniture);
                RunFurnitureAutoScan();
                return true;
            case Phase.ExistingFurniture:
                if (IsFurnitureScanning) return false;
                AcceptAllSuggestions(minConfidence: 0.6f);
                SetPhase(Phase.ConfirmReview);
                return true;
            case Phase.ConfirmReview:
                confirmedRoom = true;
                return true;
            default:
                return false;
        }
    }

    public void UndoLast()
    {
        if (CurrentPhase == Phase.Openings && HasPendingOpeningEdge)
        {
            ClearPendingEdge();
            RebuildVisuals();
            DataChanged?.Invoke();
            return;
        }

        if (CurrentPhase == Phase.Openings && openings.Count > 0)
        {
            RemoveOpening(openings[^1]);
            return;
        }

        if (CurrentPhase == Phase.ExistingFurniture && obstacles.Count > 0)
        {
            var last = obstacles[^1];
            obstacles.RemoveAt(obstacles.Count - 1);
            // An automatic one would just be detected again.
            if (IsAuto(last.id)) removedObstacles.Add(last);
            RebuildVisuals();
            DataChanged?.Invoke();
            Noted?.Invoke(Note.FurnitureRemoved, last.type);
        }
    }

    public bool CanUndo()
    {
        return CurrentPhase == Phase.Openings && (HasPendingOpeningEdge || openings.Count > 0)
               || CurrentPhase == Phase.ExistingFurniture && obstacles.Count > 0;
    }

    public RoomOpeningPayload[] ToOpeningPayloads() => openings.ToArray();
    public RoomObstaclePayload[] ToObstaclePayloads() => obstacles.ToArray();

    void SetPhase(Phase phase)
    {
        if (CurrentPhase == phase) return;
        CurrentPhase = phase;
        if (phase != Phase.ExistingFurniture) autoSuggest?.DiscardResults();
        if (phase != Phase.Openings) ClearPendingEdge();
        RebuildVisuals();
        PhaseChanged?.Invoke();
        DataChanged?.Invoke();
    }

    /// <summary>
    /// First tap marks one edge of the door/window on a wall, the second tap the other edge
    /// on the same wall; the opening spans the measured distance between them.
    /// </summary>
    void TryAddOpeningAtScreen(Vector2 screen)
    {
        if (cornerBuilder == null || cornerBuilder.CornerCount < 3) return;
        if (!TryGetFloorPoint(screen, out var world)) return;
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

        var wallHeight = cornerBuilder.WallHeight;
        var sill = openingIsDoor ? 0f : Mathf.Min(DefaultWindowSill, wallHeight * 0.5f);
        var height = openingIsDoor
            ? Mathf.Min(DefaultDoorHeight, wallHeight - 0.05f)
            : Mathf.Min(DefaultWindowHeight, wallHeight - sill - 0.1f);

        openingCounter += 1;
        openings.Add(new RoomOpeningPayload
        {
            id = $"opening-{openingCounter}",
            type = openingIsDoor ? "door" : "window",
            wallIndex = wallIndex,
            offsetAlongWall = start,
            width = width,
            height = Mathf.Max(0.3f, height),
            sillHeight = sill,
            swing = openingIsDoor ? openingSwing : "none",
        });

        ClearPendingEdge();
        RebuildVisuals();
        DataChanged?.Invoke();
        Noted?.Invoke(Note.OpeningAdded, openingIsDoor ? "door" : "window");
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
        if (!TryGetFloorPoint(screen, out var world)) return;
        if (TryAcceptSuggestionNear(world))
            return;
        if (cornerBuilder != null && cornerBuilder.CornerCount >= 3
            && !RoomPolygonUtil.PointInsidePolygonXZ(world, cornerBuilder.Corners))
            return;

        obstacleCounter += 1;
        var type = SelectedObstacleType;
        var footprint = DefaultObstacleSize(type);
        obstacles.Add(new RoomObstaclePayload
        {
            id = $"obstacle-{obstacleCounter}",
            type = type,
            center = new ARDesignVec3(world),
            size = new ARDesignVec3(footprint),
            yaw = 0f,
        });

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
        AcceptSuggestionAtIndex(best);
        Noted?.Invoke(Note.FurnitureAdded, type);
        return true;
    }

    void AcceptSuggestionAtIndex(int index, string idPrefix = "")
    {
        if (index < 0 || index >= pendingSuggestions.Count) return;
        var s = pendingSuggestions[index];
        pendingSuggestions.RemoveAt(index);

        obstacleCounter += 1;
        obstacles.Add(new RoomObstaclePayload
        {
            id = $"{idPrefix}obstacle-{obstacleCounter}",
            type = s.type,
            center = new ARDesignVec3(s.center),
            size = new ARDesignVec3(s.size),
            yaw = s.yaw,
        });

        RebuildVisuals();
        DataChanged?.Invoke();
    }

    void AcceptAllSuggestions(float minConfidence)
    {
        for (var i = pendingSuggestions.Count - 1; i >= 0; i--)
        {
            if (pendingSuggestions[i].confidence < minConfidence)
                continue;
            var type = pendingSuggestions[i].type;
            AcceptSuggestionAtIndex(i);
            Noted?.Invoke(Note.FurnitureFound, type);
        }
    }

    void RebuildVisuals()
    {
        if (visualizer == null) return;
        var wallHeight = cornerBuilder != null ? cornerBuilder.WallHeight : 2.5f;
        visualizer.Rebuild(
            cornerBuilder?.Corners,
            wallHeight,
            openings,
            obstacles,
            pendingSuggestions,
            HasPendingOpeningEdge ? pendingEdgePoint : (Vector3?)null,
            CurrentPhase);
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
