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

    int openingCounter;
    int obstacleCounter;
    int pendingEdgeWall = -1;
    float pendingEdgeOffset;
    Vector3 pendingEdgePoint;
    bool openingIsDoor = true;
    string openingSwing = "left";
    int obstacleTypeIndex;

    public Phase CurrentPhase { get; private set; } = Phase.Outline;
    public bool CanConfirmRoom => CurrentPhase == Phase.ConfirmReview;
    public int OpeningCount => openings.Count;
    /// <summary>True after the first edge of a door/window is tapped, until the second edge.</summary>
    public bool HasPendingOpeningEdge { get; private set; }
    public int ObstacleCount => obstacles.Count;
    public int PendingSuggestionCount => pendingSuggestions.Count;
    public IReadOnlyList<FurnitureAutoSuggestion> PendingSuggestions => pendingSuggestions;
    public bool OpeningIsDoor => openingIsDoor;
    public string OpeningSwing => openingSwing;
    public string SelectedObstacleType => ObstacleTypes[Mathf.Clamp(obstacleTypeIndex, 0, ObstacleTypes.Length - 1)];

    public event Action PhaseChanged;
    public event Action DataChanged;

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
        if (CurrentPhase == Phase.ExistingFurniture && autoSuggest != null)
            autoSuggest.TickAutoScan(CurrentPhase, obstacles, pendingSuggestions);

        if (CurrentPhase != Phase.Openings && CurrentPhase != Phase.ExistingFurniture) return;
        if (Touch.activeTouches.Count != 1) return;
        var touch = Touch.activeTouches[0];
        if (touch.phase != UnityEngine.InputSystem.TouchPhase.Began) return;
        if (IsPointerOverUI(touch.touchId)) return;

        if (CurrentPhase == Phase.Openings)
            TryAddOpeningAtScreen(touch.screenPosition);
        else
            TryAddObstacleAtScreen(touch.screenPosition);
    }

    void OnCornersChanged()
    {
        if (cornerBuilder == null) return;
        if (!cornerBuilder.IsLoopClosed)
        {
            if (CurrentPhase != Phase.Outline)
                ResetToOutline();
            return;
        }

        if (CurrentPhase == Phase.Outline)
            SetPhase(Phase.Openings);
    }

    public void RunFurnitureAutoScan()
    {
        if (CurrentPhase != Phase.ExistingFurniture) return;
        autoSuggest?.RunScan(obstacles, pendingSuggestions);
        RebuildVisuals();
        DataChanged?.Invoke();
    }

    public void ResetToOutline()
    {
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
            openings.RemoveAt(openings.Count - 1);
            RebuildVisuals();
            DataChanged?.Invoke();
            return;
        }

        if (CurrentPhase == Phase.ExistingFurniture && obstacles.Count > 0)
        {
            obstacles.RemoveAt(obstacles.Count - 1);
            RebuildVisuals();
            DataChanged?.Invoke();
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
        AcceptSuggestionAtIndex(best);
        return true;
    }

    void AcceptSuggestionAtIndex(int index)
    {
        if (index < 0 || index >= pendingSuggestions.Count) return;
        var s = pendingSuggestions[index];
        pendingSuggestions.RemoveAt(index);

        obstacleCounter += 1;
        obstacles.Add(new RoomObstaclePayload
        {
            id = $"obstacle-{obstacleCounter}",
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
            AcceptSuggestionAtIndex(i);
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
