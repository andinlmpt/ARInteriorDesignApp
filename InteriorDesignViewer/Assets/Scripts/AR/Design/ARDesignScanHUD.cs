using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Scan chrome for the room scan, ARPlan-inspired frosted cards:
///   • an instruction card (what to do now, one detail line) with a five-step bar
///     (Height · Walls · Doors · Furniture · Review) so the user always knows where they are;
///   • live coaching from tracking problems ("Move slowly", "Too dark");
///   • a tool rail (Rescan with a second-tap confirm, Auto on/off, Light, Help);
///   • a mini floor plan of what's been mapped (large, with wall lengths, on the review step);
///   • short notes with a buzz when something sets itself (floor, height, corner, door, sofa);
///   • a first-run "how it works" card, which Help reopens;
///   • the floor dots and aiming circle for the height step;
///   • Undo, which becomes Back on the doors/furniture/review steps and keeps what was found.
/// With the automatic scan (<see cref="ARAutoRoomScan"/>) it also shows the hold-still ring and an
/// arrow to a missing corner.
/// </summary>
[DefaultExecutionOrder(-90)]
public class ARDesignScanHUD : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARSceneBridge bridge;
    [SerializeField] private FurnitureCatalog catalog;
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private ARDesignCornerRoomBuilder cornerBuilder;
    [SerializeField] private ARDesignSpatialMappingController spatialMapping;
    [SerializeField] private bool spawnSampleOnConfirm = false;
    [SerializeField] private bool measurementOnlyMode = false;
    [SerializeField] private bool enableNativeHud = true;

    static readonly Color Ink = new(0.10f, 0.10f, 0.12f, 1f);
    static readonly Color InkMuted = new(0.35f, 0.36f, 0.40f, 1f);
    static readonly Color Frost = new(1f, 1f, 1f, 0.94f);
    static readonly Color FrostSoft = new(1f, 1f, 1f, 0.82f);
    static readonly Color AccentReady = new(0.18f, 0.55f, 0.42f, 1f);
    static readonly Color MeasurePurple = new(12f / 255f, 41f / 255f, 95f / 255f, 1f); // navy
    static readonly Color MeasurePurpleDisabled = new(0.55f, 0.56f, 0.58f, 0.85f);
    static readonly Color CoachBg = new(1f, 0.95f, 0.85f, 0.97f);
    static readonly Color CoachInk = new(0.47f, 0.26f, 0.03f, 1f);
    static readonly Color RescanArmed = new(0.86f, 0.24f, 0.22f, 1f);
    static readonly Color AutoOrange = new(1f, 0.55f, 0.15f, 1f);
    static readonly Color StepTodo = new(0.90f, 0.90f, 0.92f, 1f);
    static readonly Color ToastBg = new(0.11f, 0.11f, 0.13f, 0.92f);
    static readonly Color Scrim = new(0f, 0f, 0f, 0.62f);

    static readonly Color MapFoundWall = new(0.30f, 0.62f, 0.95f, 1f);
    static readonly Color MapFloor = new(0.12f, 0.12f, 0.14f, 0.07f);
    static readonly Color MapDoor = new(0.20f, 0.55f, 0.95f, 1f);
    static readonly Color MapWindow = new(0.95f, 0.72f, 0.12f, 1f);
    static readonly Color MapFurniture = new(0.55f, 0.35f, 0.20f, 0.55f);
    static readonly Color MapSuggestion = new(1f, 0.55f, 0.12f, 0.40f);
    static readonly Color MapUser = new(0.10f, 0.45f, 0.95f, 1f);

    const int RetryCornerCount = 4;
    const float RescanConfirmSeconds = 3f;
    const string IntroSeenKey = "arScanIntroSeen";
    const float ToastSeconds = 1.8f;
    /// <summary>A note stays at least this long before a different one takes its place.</summary>
    const float ToastMinSeconds = 0.9f;
    const int ToastQueueMax = 3;
    const float MapRefreshInterval = 0.12f;

    // Layout (canvas units; the canvas is 1080 wide on 16:9 phones and about 966 on 20:9 ones).
    const float CardLeft = 196f;   // clears the app's back button at the top left
    const float CardRight = 24f;
    const float CardTop = 66f;
    const float CardHeight = 156f;
    const float CoachGap = 12f;
    const float CoachHeight = 80f;
    const float RailTop = CardTop + CardHeight + CoachGap + CoachHeight + 18f;
    const float RailWidth = 164f;
    const float RailItemHeight = 64f;
    const float RailGap = 12f;
    const float DockBottom = 78f;
    const float DockWidth = 740f;
    const float DockFullHeight = 180f;
    const float DockCompactHeight = 104f;
    const float CircleButtonsTop = 238f;
    const float MapSmall = 250f;
    const float MapLargeMax = 760f;
    const float MapGap = 20f;

    static readonly string[] SpatialStepNames = { "Height", "Walls", "Doors", "Furniture", "Review" };
    static readonly string[] OutlineStepNames = { "Height", "Walls" };

    Canvas canvas;
    RectTransform canvasRect;
    Text topHintLabel;
    Text subtitleLabel;
    Image[] stepChips = System.Array.Empty<Image>();
    Text[] stepLabels = System.Array.Empty<Text>();
    Image[] stepChecks = System.Array.Empty<Image>();
    string[] stepNames = System.Array.Empty<string>();

    RectTransform bottomDock;
    RectTransform bottomShadow;
    float dockHeight = DockFullHeight;
    Button confirmButton;
    Button undoButton;
    Button auxTypeButton;
    Button auxSwingButton;
    Text auxTypeLabel;
    Text auxSwingLabel;
    Text confirmLabel;
    Text undoLabel;
    Image confirmImage;
    Image undoImage;

    Button startButton;
    Button finishButton;
    Button heightUndoButton;
    Text startLabel;
    Text finishLabel;
    Text heightUndoLabel;
    Image startImage;
    Image finishImage;
    Image heightUndoImage;

    RectTransform coachChip;
    Text coachTitle;
    Text coachDetail;

    readonly List<(RectTransform holder, Button button)> railItems = new();
    Button rescanButton;
    Image rescanImage;
    Text rescanLabel;
    float rescanArmedUntil = -1f;
    Button autoToggleButton;
    Image autoToggleImage;
    Text autoToggleLabel;
    UnityEngine.XR.ARFoundation.ARCameraManager cameraManager;
    Button lightButton;
    Image lightImage;
    Text lightLabel;
    float nextLightCheckAt;
    bool lightSupported;
    Button helpButton;

    Image dwellRing;
    RectTransform targetArrow;
    RectTransform aimMark;

    RectTransform mapPanel;
    ARScanMiniMap map;
    bool mapExpanded;
    bool mapUserToggled;
    bool mapFacing;
    bool mapSquared;
    float nextMapRefreshAt;
    readonly List<Vector2> mapScratch = new();

    struct PendingToast
    {
        public string key;
        public string text;
        public string pluralFormat;
        public int count;
    }

    RectTransform toastRect;
    CanvasGroup toastGroup;
    Text toastText;
    string toastKey;
    int toastCount;
    float toastShownAt;
    float toastUntil;
    readonly List<PendingToast> toastQueue = new();

    GameObject helpOverlay;
    Text helpButtonLabel;
    Text[] helpStepTitles = System.Array.Empty<Text>();
    Text[] helpStepBodies = System.Array.Empty<Text>();
    Image[] helpStepBadges = System.Array.Empty<Image>();
    bool introOffered;

    float nextLiveRefreshAt;
    ARScanGuidance guidance;
    ARAutoRoomScan autoScan;
    ARScanFloorGrid floorGrid;
    bool active;

    bool lastBaseSet;
    bool lastHeightLocked;
    bool lastLoopClosed;
    int lastCornerCount;
    int lastMapStep = -1;

    bool AutoEnabled => autoScan != null && autoScan.Enabled;

    /// <summary>Automatic scan is driving the floor, height or walls step right now.</summary>
    bool AutoOutlineStep => AutoEnabled && autoScan.IsActive;

    bool InSpatialStep =>
        spatialMapping != null && spatialMapping.CurrentPhase != ARDesignSpatialMappingController.Phase.Outline;

    bool HelpVisible => helpOverlay != null && helpOverlay.activeSelf;

    bool Scanning => scanController != null && IsScanning(scanController.Phase);

    bool ShouldShowNativeHud()
    {
        // Dedicated AR Measurement scene keeps Unity chrome even when embedded in RN.
        if (measurementOnlyMode) return true;
        return !ARDesignHostDetect.IsEmbeddedInReactNative();
    }

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (bridge == null) bridge = FindFirstObjectByType<ARSceneBridge>();
        if (catalog == null) catalog = FindFirstObjectByType<FurnitureCatalog>();
        if (placementIndicator == null) placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();
        if (cornerBuilder == null) cornerBuilder = FindFirstObjectByType<ARDesignCornerRoomBuilder>();
        if (spatialMapping == null) spatialMapping = FindFirstObjectByType<ARDesignSpatialMappingController>();
        if (measurementOnlyMode && spatialMapping == null && scanController != null)
            spatialMapping = EnsureSpatialMappingRuntime(scanController.gameObject);

        active = enableNativeHud && ShouldShowNativeHud();
        if (!active)
        {
            Debug.Log("[ARDesignScanHUD] Native HUD disabled (React Native host or flag off).");
            enabled = false;
            return;
        }

        if (measurementOnlyMode)
        {
            if (!ARDesignHostDetect.IsEmbeddedInReactNative())
                ARMainMenuBackButton.EnsureOn(gameObject);
            ARMeasurementRnBridge.EnsureOn(gameObject);
        }

        guidance = ARScanGuidance.EnsureOn(gameObject);
        floorGrid = ARScanFloorGrid.EnsureOn(gameObject);
        if (measurementOnlyMode)
        {
            autoScan = ARAutoRoomScan.EnsureOn(gameObject);
            ARPerfLog.EnsureOn(gameObject);
        }

        stepNames = spatialMapping != null ? SpatialStepNames : OutlineStepNames;

        try
        {
            BuildUi();
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[ARDesignScanHUD] Failed to build UI — continuing without HUD. {e}");
            active = false;
            enabled = false;
        }
    }

    void OnEnable()
    {
        if (!active || scanController == null) return;
        scanController.StatusChanged += OnStatus;
        scanController.PhaseChanged += OnPhase;
        if (cornerBuilder != null)
        {
            cornerBuilder.CornersChanged += OnCornersChanged;
            cornerBuilder.HeightPhaseChanged += OnCornersChanged;
        }

        if (spatialMapping != null)
        {
            spatialMapping.PhaseChanged += OnSpatialChanged;
            spatialMapping.DataChanged += OnSpatialChanged;
            spatialMapping.Noted += OnSpatialNote;
        }

        if (autoScan != null)
        {
            autoScan.Changed += OnCornersChanged;
            autoScan.Noted += OnAutoNote;
        }
    }

    void OnDisable()
    {
        if (active) TurnLightOff();
        if (floorGrid != null) floorGrid.Visible = false;
        if (scanController == null) return;
        scanController.StatusChanged -= OnStatus;
        scanController.PhaseChanged -= OnPhase;
        if (cornerBuilder != null)
        {
            cornerBuilder.CornersChanged -= OnCornersChanged;
            cornerBuilder.HeightPhaseChanged -= OnCornersChanged;
        }

        if (spatialMapping != null)
        {
            spatialMapping.PhaseChanged -= OnSpatialChanged;
            spatialMapping.DataChanged -= OnSpatialChanged;
            spatialMapping.Noted -= OnSpatialNote;
        }

        if (autoScan != null)
        {
            autoScan.Changed -= OnCornersChanged;
            autoScan.Noted -= OnAutoNote;
        }
    }

    void OnSpatialChanged() => RefreshCornerUi();

    void Start()
    {
        if (!active || scanController == null) return;
        SnapshotMilestones();
        OnStatus(scanController.GetScanStatus());
        ApplyReticle(scanController.Phase);
        RefreshCornerUi();
        if (Scanning) MaybeShowIntro();
    }

    void OnCornersChanged() => RefreshCornerUi();

    void Update()
    {
        if (!active || cornerBuilder == null) return;
        TrackMilestones();

        // Live height / width readouts (and the automatic scan's hold progress) change all the
        // time; about 12 refreshes a second reads the same and rebuilds the UI far less.
        if ((cornerBuilder.IsInHeightPhase || cornerBuilder.CornerCount > 0 || AutoOutlineStep)
            && Time.unscaledTime >= nextLiveRefreshAt)
        {
            nextLiveRefreshAt = Time.unscaledTime + 0.08f;
            RefreshCornerUi();
        }

        RefreshCoaching();
        RefreshRescanButton();
        RefreshAutoOverlay();
        RefreshAutoToggle();
        RefreshLightButton();
        RefreshHelpButton();
        LayoutRail();
        RefreshAimMark();
        RefreshFloorGrid();
        if (Time.unscaledTime >= nextMapRefreshAt)
        {
            nextMapRefreshAt = Time.unscaledTime + MapRefreshInterval;
            RefreshMap();
        }

        TickToast();
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(phase != RoomScanController.ScanPhase.Confirmed);
        if (!IsScanning(phase))
        {
            TurnLightOff();
            if (HelpVisible) HideHelp(markSeen: false);
        }

        if (guidance != null)
            guidance.enabled = IsScanning(phase);

        ApplyReticle(phase);
        RefreshCornerUi();
        if (phase == RoomScanController.ScanPhase.Scanning)
            MaybeShowIntro();
    }

    void ApplyReticle(RoomScanController.ScanPhase phase)
    {
        if (placementIndicator == null) return;

        if (phase != RoomScanController.ScanPhase.Scanning
            && phase != RoomScanController.ScanPhase.ReadyToConfirm)
        {
            placementIndicator.StopTracking(clearOverlay: true);
            return;
        }

        // Height base: show measurement icon. After Finish: hide reticle — width uses the line only.
        if (cornerBuilder != null)
        {
            if (cornerBuilder.IsInHeightPhase && !cornerBuilder.HasHeightBase)
            {
                cornerBuilder.RefreshHeightPlacementIndicator();
                return;
            }

            if (cornerBuilder.IsInHeightPhase)
                return; // base locked; leave overlay frozen until Finish

            if (measurementOnlyMode && cornerBuilder.IsHeightLocked
                && !(AutoEnabled && !cornerBuilder.IsLoopClosed))
            {
                placementIndicator.StopTracking(clearOverlay: true);
                return;
            }
        }

        placementIndicator.StartTracking();
    }

    void OnStatus(ScanStatusPayload status)
    {
        if (!active || status == null) return;
        RefreshCornerUi();
    }

    // ── Which step ────────────────────────────────────────────────────────────

    /// <summary>0 Height, 1 Walls, 2 Doors, 3 Furniture, 4 Review.</summary>
    int CurrentStepIndex()
    {
        if (InSpatialStep)
        {
            return spatialMapping.CurrentPhase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => 2,
                ARDesignSpatialMappingController.Phase.ExistingFurniture => 3,
                _ => 4,
            };
        }

        return cornerBuilder != null && cornerBuilder.IsInHeightPhase ? 0 : 1;
    }

    void RefreshStepBar()
    {
        var current = Mathf.Min(CurrentStepIndex(), stepChips.Length - 1);
        for (var i = 0; i < stepChips.Length; i++)
        {
            var done = i < current;
            var now = i == current;
            stepChips[i].color = done ? AccentReady : now ? Ink : StepTodo;
            stepLabels[i].color = done || now ? Color.white : InkMuted;
            stepLabels[i].fontStyle = now ? FontStyle.Bold : FontStyle.Normal;
            if (stepChecks[i].gameObject.activeSelf != done)
            {
                stepChecks[i].gameObject.SetActive(done);
                // Leave room for the tick on finished steps.
                stepLabels[i].rectTransform.offsetMin = new Vector2(done ? 26f : 6f, 0f);
            }
        }
    }

    // ── Floor, height and walls ───────────────────────────────────────────────

    void RefreshCornerUi()
    {
        if (InSpatialStep)
        {
            RefreshSpatialUi();
            RefreshStepBar();
            ApplyDockLayout();
            return;
        }

        var autoWalls = AutoEnabled && autoScan.CurrentStep == ARAutoRoomScan.Step.Walls;
        if (auxTypeButton != null)
        {
            // Automatic walls step: "Start over" drops every corner and looks at the walls again.
            auxTypeButton.gameObject.SetActive(autoWalls);
            if (autoWalls && auxTypeLabel != null)
                auxTypeLabel.text = "Start over";
        }
        if (auxSwingButton != null)
            auxSwingButton.gameObject.SetActive(false);

        var inHeightPhase = cornerBuilder != null && cornerBuilder.IsInHeightPhase;
        var count = cornerBuilder != null ? cornerBuilder.CornerCount : 0;
        var canConfirmHeight = cornerBuilder != null && cornerBuilder.CanConfirmHeight;
        var canCloseWidth = cornerBuilder != null && cornerBuilder.CanClose;
        var canConfirmWidth = cornerBuilder != null && cornerBuilder.CanConfirm;
        var outlineCrosses = cornerBuilder != null && cornerBuilder.IsOutlineSelfIntersecting;
        var canConfirm = inHeightPhase ? canConfirmHeight : (canConfirmWidth || canCloseWidth);

        if (cornerBuilder != null)
        {
            BuildOutlineTexts(out var title, out var subtitle);
            if (topHintLabel != null) topHintLabel.text = title;
            if (subtitleLabel != null) subtitleLabel.text = subtitle;
        }

        if (undoButton != null)
        {
            // Automatic walls step: Undo takes back a corner, or with none goes back to the height.
            var canUndo = inHeightPhase ? cornerBuilder.HasHeightBase : count > 0 || autoWalls;
            undoButton.interactable = canUndo;
            if (undoImage != null)
                undoImage.color = canUndo ? Frost : FrostSoft;
            if (undoLabel != null)
            {
                undoLabel.text = IsRetryMode() ? "Retry" : "Undo";
                undoLabel.color = canUndo ? Ink : InkMuted;
            }
        }

        var useStartFinish = measurementOnlyMode && inHeightPhase;

        if (bottomDock != null)
            bottomDock.gameObject.SetActive(!useStartFinish);
        if (bottomShadow != null)
            bottomShadow.gameObject.SetActive(!useStartFinish);

        if (startButton != null)
        {
            var showStart = useStartFinish && !cornerBuilder.HasHeightBase;
            startButton.gameObject.SetActive(showStart);
            if (showStart)
            {
                var canStart = cornerBuilder.CanStartHeight;
                startButton.interactable = canStart;
                if (startImage != null)
                    startImage.color = canStart ? MeasurePurple : MeasurePurpleDisabled;
                if (startLabel != null)
                    startLabel.color = canStart ? Color.white : new Color(1f, 1f, 1f, 0.55f);
            }
        }

        if (finishButton != null)
        {
            var showFinish = useStartFinish && cornerBuilder.HasHeightBase;
            finishButton.gameObject.SetActive(showFinish);
            if (showFinish)
            {
                finishButton.interactable = canConfirmHeight;
                if (finishImage != null)
                    finishImage.color = canConfirmHeight ? MeasurePurple : MeasurePurpleDisabled;
                if (finishLabel != null)
                    finishLabel.color = canConfirmHeight
                        ? Color.white
                        : new Color(1f, 1f, 1f, 0.55f);
            }
        }

        if (heightUndoButton != null)
            heightUndoButton.gameObject.SetActive(useStartFinish && cornerBuilder.HasHeightBase);

        if (confirmButton != null)
        {
            if (useStartFinish)
            {
                confirmButton.gameObject.SetActive(false);
            }
            else
            {
                confirmButton.gameObject.SetActive(true);
                confirmButton.interactable = canConfirm;
                if (confirmLabel != null)
                {
                    if (inHeightPhase)
                    {
                        confirmLabel.text = cornerBuilder.HasHeightBase ? "Finish" : "Set base";
                        confirmLabel.color = canConfirmHeight ? Color.white : InkMuted;
                    }
                    else
                    {
                        if (canConfirmWidth)
                            confirmLabel.text = measurementOnlyMode ? "Continue" : "Done";
                        else if (canCloseWidth)
                            confirmLabel.text = "Close room";
                        else if (outlineCrosses)
                            confirmLabel.text = "Walls cross";
                        else if (autoWalls)
                            confirmLabel.text = "Finding corners…";
                        else
                            confirmLabel.text = "Add corners";
                        // Waiting states stay readable: dark text on a light chip.
                        confirmLabel.color = canConfirm ? Color.white : InkMuted;
                    }
                }

                if (confirmImage != null)
                    confirmImage.color = canConfirm ? AccentReady : StepTodo;
            }
        }

        RefreshStepBar();
        ApplyDockLayout();
    }

    const string FindFloorHint = "Move the phone slowly until dots appear on the floor";

    int LiveHeightCm() => cornerBuilder != null && cornerBuilder.HasLiveHeightPreview
        ? Mathf.RoundToInt(cornerBuilder.LiveHeightMeters * 100f)
        : 0;

    /// <summary>Title (what to do now) and one detail line for the height and walls steps.</summary>
    void BuildOutlineTexts(out string title, out string subtitle)
    {
        if (TryBuildAutoText(out title, out subtitle)) return;

        var count = cornerBuilder.CornerCount;
        if (cornerBuilder.IsInHeightPhase)
        {
            // By hand, the floor point is also the first corner of the outline.
            if (!cornerBuilder.HasHeightBase)
            {
                title = "Point at a corner of the room, on the floor";
                var onFloor = placementIndicator != null && placementIndicator.IsLockedOnFloor;
                subtitle = !onFloor ? FindFloorHint
                    : measurementOnlyMode ? "Tap Start · this is your first corner"
                    : "Tap to set it · this is your first corner";
                return;
            }

            title = "Aim up that corner to the ceiling";
            var cm = LiveHeightCm();
            subtitle = cm >= 180 ? $"{cm} cm · tap Finish when the line reaches the ceiling"
                : cm > 0 ? $"{cm} cm · aim higher"
                : "Tilt the phone up slowly";
            return;
        }

        var spotted = spatialMapping != null ? spatialMapping.EarlySightingCount : 0;
        var spottedSuffix = spotted > 0 ? $" · {spotted} furniture spotted" : string.Empty;
        title = "Tap each corner of the room on the floor";
        if (cornerBuilder.IsOutlineSelfIntersecting)
        {
            title = "The walls cross";
            subtitle = "Tap Undo to move the last corner";
        }
        else if (cornerBuilder.CanConfirm)
        {
            subtitle = $"{count} walls · room closed";
        }
        else if (cornerBuilder.CanClose)
        {
            subtitle = $"{count} corners · tap Close room when every corner is marked{spottedSuffix}";
        }
        else if (count <= 1)
        {
            subtitle = measurementOnlyMode
                ? "Your floor point is corner 1 · tap the next corner"
                : "Aim at a floor corner and tap";
        }
        else if (cornerBuilder.HasLivePreview)
        {
            subtitle = $"{count} corners · {Mathf.RoundToInt(cornerBuilder.LivePreviewDistanceMeters * 100f)} cm to here{spottedSuffix}";
        }
        else
        {
            subtitle = $"{count} corners · keep going{spottedSuffix}";
        }
    }

    /// <summary>Title and detail for the floor, height and walls steps of the automatic scan.</summary>
    bool TryBuildAutoText(out string title, out string subtitle)
    {
        title = null;
        subtitle = null;
        if (!AutoEnabled || cornerBuilder == null) return false;

        var holding = autoScan.DwellProgress > 0f;
        switch (autoScan.CurrentStep)
        {
            case ARAutoRoomScan.Step.Floor:
            {
                title = "Point at the floor next to a wall";
                var onFloor = placementIndicator != null && placementIndicator.IsLockedOnFloor;
                subtitle = holding ? "Hold still…"
                    : onFloor ? "Hold still to set it · or tap Start"
                    : FindFloorHint;
                return true;
            }

            case ARAutoRoomScan.Step.Height:
            {
                title = "Aim the circle where the wall meets the ceiling";
                var cm = LiveHeightCm();
                if (holding)
                    subtitle = $"{cm} cm · hold still…";
                else if (cm >= 180)
                    subtitle = $"{cm} cm · hold still to set it, or tap Finish";
                else if (cm > 0)
                    subtitle = $"{cm} cm · aim higher";
                else
                    subtitle = "Tilt the phone up slowly";
                return true;
            }

            case ARAutoRoomScan.Step.Walls:
                if (cornerBuilder.IsOutlineSelfIntersecting)
                {
                    title = "The outline crosses itself";
                    subtitle = "Tap a wrong corner to remove it, or tap Undo";
                }
                else if (autoScan.OutlineLooksComplete)
                {
                    title = "All corners found";
                    subtitle = $"{autoScan.CornerCount} corners · check the outline, then tap Close room";
                }
                else
                {
                    title = "Walk slowly along the walls";
                    if (holding)
                        subtitle = "Hold still to place the corner…";
                    else if (autoScan.HasTarget)
                        subtitle = $"{autoScan.CornerCount} corners · aim at the orange marker and hold";
                    else if (autoScan.WallCount == 0)
                        subtitle = "Point the camera at a wall from about 2 m away";
                    else
                        subtitle = $"{autoScan.CornerCount} corners · keep going around the room";
                }
                return true;
        }

        return false;
    }

    // ── Doors, furniture and review ───────────────────────────────────────────

    void RefreshSpatialUi()
    {
        if (spatialMapping == null) return;

        if (bottomDock != null) bottomDock.gameObject.SetActive(true);
        if (bottomShadow != null) bottomShadow.gameObject.SetActive(true);
        if (startButton != null) startButton.gameObject.SetActive(false);
        if (finishButton != null) finishButton.gameObject.SetActive(false);
        if (heightUndoButton != null) heightUndoButton.gameObject.SetActive(false);

        var phase = spatialMapping.CurrentPhase;
        var kind = spatialMapping.OpeningIsDoor ? "door" : "window";
        if (topHintLabel != null)
        {
            topHintLabel.text = phase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => spatialMapping.DetectsOpenings
                    ? "Look at each door and window"
                    : "Mark each door and window",
                ARDesignSpatialMappingController.Phase.ExistingFurniture => "Look around at your furniture",
                _ => "Check your room",
            };
        }

        if (subtitleLabel != null)
        {
            subtitleLabel.text = phase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => spatialMapping.HasPendingOpeningEdge
                    ? $"Now tap the floor at the other edge of the {kind}"
                    : spatialMapping.DetectsOpenings
                        ? $"{spatialMapping.OpeningCount} found · tap a wrong one to remove it · missed one? tap both edges"
                        : $"{spatialMapping.OpeningCount} marked · tap the floor at both edges of a {kind}",
                ARDesignSpatialMappingController.Phase.ExistingFurniture =>
                    (spatialMapping.IsFurnitureScanning ? "Looking… · " : "") +
                    $"{spatialMapping.ObstacleCount} added · tap one to remove it · tap the floor to add a {spatialMapping.SelectedObstacleType}",
                _ => BuildReviewSummary(),
            };
        }

        if (auxTypeButton != null)
        {
            auxTypeButton.gameObject.SetActive(
                phase == ARDesignSpatialMappingController.Phase.Openings
                || phase == ARDesignSpatialMappingController.Phase.ExistingFurniture);
            if (auxTypeLabel != null)
            {
                auxTypeLabel.text = phase switch
                {
                    ARDesignSpatialMappingController.Phase.Openings => $"Marking: {Capitalize(kind)}",
                    ARDesignSpatialMappingController.Phase.ExistingFurniture =>
                        $"Add: {Capitalize(spatialMapping.SelectedObstacleType)}",
                    _ => "Type",
                };
            }
        }

        if (auxSwingButton != null)
        {
            var showSwing = phase == ARDesignSpatialMappingController.Phase.Openings
                            && spatialMapping.OpeningIsDoor;
            var showScan = phase == ARDesignSpatialMappingController.Phase.ExistingFurniture;
            auxSwingButton.gameObject.SetActive(showSwing || showScan);
            if (auxSwingLabel != null)
            {
                if (showScan)
                    auxSwingLabel.text = spatialMapping.IsFurnitureScanning ? "Looking…" : "Look again";
                else if (showSwing)
                    auxSwingLabel.text = $"Opens: {spatialMapping.OpeningSwing}";
            }
        }

        if (undoButton != null)
        {
            // Nothing to undo here: go back a step instead (doors → walls reopens the outline).
            var canUndo = spatialMapping.CanUndo();
            undoButton.interactable = true;
            if (undoImage != null) undoImage.color = Frost;
            undoLabel.text = canUndo ? "Undo" : "Back";
            undoLabel.color = Ink;
        }

        if (confirmButton != null)
        {
            confirmButton.gameObject.SetActive(true);
            confirmButton.interactable = phase != ARDesignSpatialMappingController.Phase.ExistingFurniture
                || !spatialMapping.IsFurnitureScanning;
            confirmLabel.text = phase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => "Next: Furniture",
                ARDesignSpatialMappingController.Phase.ExistingFurniture => "Next: Review",
                _ => "Scan complete",
            };
            confirmLabel.color = confirmButton.interactable ? Color.white : InkMuted;
            if (confirmImage != null)
                confirmImage.color = confirmButton.interactable ? AccentReady : StepTodo;
        }
    }

    /// <summary>"L 4.2m × W 3.1m × H 2.5m · 2 doors & windows · 3 furniture items" for the review step.</summary>
    string BuildReviewSummary()
    {
        var parts = new List<string>();
        if (cornerBuilder != null && cornerBuilder.CornerCount >= 3)
        {
            RoomMeasurementUtil.ComputePolygonExtents(cornerBuilder.Corners, out var width, out var depth);
            var size = RoomMeasurementUtil.FormatDimensionLabel(width, depth, cornerBuilder.WallHeight);
            if (!string.IsNullOrEmpty(size)) parts.Add(size);
        }

        var openings = spatialMapping.OpeningCount;
        var furniture = spatialMapping.ObstacleCount;
        parts.Add(openings == 1 ? "1 door or window" : $"{openings} doors & windows");
        parts.Add(furniture == 1 ? "1 furniture item" : $"{furniture} furniture items");
        return string.Join(" · ", parts);
    }

    static string Capitalize(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s.Substring(1);

    // ── Notes and milestones ──────────────────────────────────────────────────

    void SnapshotMilestones()
    {
        if (cornerBuilder == null) return;
        lastBaseSet = cornerBuilder.HasHeightBase;
        lastHeightLocked = cornerBuilder.IsHeightLocked;
        lastLoopClosed = cornerBuilder.IsLoopClosed;
        lastCornerCount = cornerBuilder.CornerCount;
    }

    /// <summary>Floor point, height and closed outline, whether set by hand or by the automatic scan.</summary>
    void TrackMilestones()
    {
        if (!Scanning)
        {
            SnapshotMilestones();
            return;
        }

        var baseSet = cornerBuilder.HasHeightBase;
        var locked = cornerBuilder.IsHeightLocked;
        var closed = cornerBuilder.IsLoopClosed;
        var corners = cornerBuilder.CornerCount;

        if (baseSet && !lastBaseSet && !locked)
            ShowToast("floor", "Floor point set", ARScanHaptics.Kind.Tick);
        if (locked && !lastHeightLocked)
            ShowToast("height", $"Height set · {Mathf.RoundToInt(cornerBuilder.WallHeight * 100f)} cm", ARScanHaptics.Kind.Success);
        if (closed && !lastLoopClosed)
            ShowToast("closed", $"Room outline done · {corners} walls", ARScanHaptics.Kind.Success);
        // Corners tapped by hand: a buzz is enough, the corner appears where the finger is.
        if (!AutoEnabled && locked && lastHeightLocked && !closed && corners > lastCornerCount)
            ARScanHaptics.Play(ARScanHaptics.Kind.Tick);

        lastBaseSet = baseSet;
        lastHeightLocked = locked;
        lastLoopClosed = closed;
        lastCornerCount = corners;
    }

    void OnAutoNote(ARAutoRoomScan.Note note)
    {
        switch (note)
        {
            case ARAutoRoomScan.Note.CornerFound:
                ShowToast("corner-found", $"Corner found · {autoScan.CornerCount} so far", ARScanHaptics.Kind.Tick);
                break;
            case ARAutoRoomScan.Note.CornerAdded:
                ShowToast("corner-added", "Corner added", ARScanHaptics.Kind.Tick);
                break;
            case ARAutoRoomScan.Note.CornerRemoved:
                ShowToast("corner-removed", "Corner removed", ARScanHaptics.Kind.Tick);
                break;
            case ARAutoRoomScan.Note.OutlineComplete:
                ShowToast("outline", "All corners found · tap Close room", ARScanHaptics.Kind.Success);
                break;
            case ARAutoRoomScan.Note.TapIgnored:
                ShowToast("tracking", "Hold on · finding your place again", ARScanHaptics.Kind.Warning);
                break;
        }
    }

    void OnSpatialNote(ARDesignSpatialMappingController.Note note, string type)
    {
        var name = Capitalize(type);
        switch (note)
        {
            case ARDesignSpatialMappingController.Note.OpeningFound:
                ShowToast("opening-found", $"{name} found", ARScanHaptics.Kind.Tick, "{0} doors & windows found");
                break;
            case ARDesignSpatialMappingController.Note.OpeningAdded:
                ShowToast("opening-added", $"{name} added", ARScanHaptics.Kind.Tick);
                break;
            case ARDesignSpatialMappingController.Note.OpeningRemoved:
                ShowToast("opening-removed", $"{name} removed", ARScanHaptics.Kind.Tick);
                break;
            case ARDesignSpatialMappingController.Note.FurnitureFound:
                ShowToast("furniture-found", $"{name} added", ARScanHaptics.Kind.Tick, "{0} furniture items added");
                break;
            case ARDesignSpatialMappingController.Note.FurnitureAdded:
                ShowToast("furniture-added", $"{name} added", ARScanHaptics.Kind.Tick);
                break;
            case ARDesignSpatialMappingController.Note.FurnitureRemoved:
                ShowToast("furniture-removed", $"{name} removed", ARScanHaptics.Kind.Tick);
                break;
        }
    }

    /// <summary>
    /// Short note above the controls. The same kind arriving while one shows is counted
    /// (<paramref name="pluralFormat"/>, e.g. "{0} doors & windows found") instead of stacking;
    /// a different one waits until the current one has been up for a moment.
    /// </summary>
    void ShowToast(string key, string text, ARScanHaptics.Kind? haptic = null, string pluralFormat = null)
    {
        if (haptic.HasValue) ARScanHaptics.Play(haptic.Value);
        if (toastRect == null) return;

        var now = Time.unscaledTime;
        var showing = toastRect.gameObject.activeSelf && now < toastUntil;
        if (showing && key == toastKey)
        {
            if (pluralFormat != null)
            {
                toastCount++;
                text = string.Format(pluralFormat, toastCount);
            }

            SetToastText(text);
            toastUntil = now + ToastSeconds;
            return;
        }

        if (showing && now - toastShownAt < ToastMinSeconds)
        {
            var index = toastQueue.FindIndex(t => t.key == key);
            var item = new PendingToast { key = key, text = text, pluralFormat = pluralFormat, count = 1 };
            if (index >= 0 && pluralFormat != null)
            {
                item.count = toastQueue[index].count + 1;
                item.text = string.Format(pluralFormat, item.count);
            }

            if (index >= 0) toastQueue[index] = item;
            else if (toastQueue.Count < ToastQueueMax) toastQueue.Add(item);
            else toastQueue[^1] = item;
            // Let the queue move: the current note goes once it has been read.
            toastUntil = Mathf.Min(toastUntil, toastShownAt + ToastMinSeconds);
            return;
        }

        StartToast(key, text, 1);
    }

    void StartToast(string key, string text, int count)
    {
        var now = Time.unscaledTime;
        toastKey = key;
        toastCount = count;
        toastShownAt = now;
        toastUntil = now + (toastQueue.Count > 0 ? ToastMinSeconds : ToastSeconds);
        SetToastText(text);
        toastGroup.alpha = 1f;
        toastRect.gameObject.SetActive(true);
    }

    void SetToastText(string text)
    {
        toastText.text = text;
        var maxWidth = canvasRect != null && canvasRect.rect.width > 0f ? canvasRect.rect.width - 64f : 900f;
        toastRect.sizeDelta = new Vector2(Mathf.Min(toastText.preferredWidth + 72f, maxWidth), 62f);
    }

    void ClearToasts()
    {
        toastQueue.Clear();
        toastUntil = 0f;
        if (toastRect != null) toastRect.gameObject.SetActive(false);
    }

    void TickToast()
    {
        if (toastRect == null || !toastRect.gameObject.activeSelf) return;
        if (HelpVisible)
        {
            ClearToasts();
            return;
        }

        var left = toastUntil - Time.unscaledTime;
        if (left <= 0f)
        {
            if (toastQueue.Count == 0)
            {
                toastRect.gameObject.SetActive(false);
                return;
            }

            var next = toastQueue[0];
            toastQueue.RemoveAt(0);
            StartToast(next.key, next.text, next.count);
            left = toastUntil - Time.unscaledTime;
        }

        toastGroup.alpha = Mathf.Clamp01(left / 0.25f);
        var mapShown = mapPanel != null && mapPanel.gameObject.activeSelf;
        var y = mapShown && mapExpanded ? mapPanel.anchoredPosition.y + mapPanel.sizeDelta.y + 50f
            : mapShown ? Mathf.Max(DockTop() + 60f, mapPanel.anchoredPosition.y + mapPanel.sizeDelta.y + 50f)
            : DockTop() + 60f;
        toastRect.anchoredPosition = new Vector2(0f, y);
    }

    // ── Help card ─────────────────────────────────────────────────────────────

    /// <summary>The first scan on a phone starts with the "how it works" card.</summary>
    void MaybeShowIntro()
    {
        if (introOffered || helpOverlay == null || cornerBuilder == null) return;
        if (PlayerPrefs.GetInt(IntroSeenKey, 0) == 1) return;
        if (!Scanning || !cornerBuilder.IsInHeightPhase || cornerBuilder.HasHeightBase) return;
        introOffered = true;
        ShowHelp(firstRun: true);
    }

    void ShowHelp(bool firstRun)
    {
        if (helpOverlay == null) return;
        FillHelpTexts();
        var current = firstRun ? 0 : CurrentStepIndex();
        for (var i = 0; i < helpStepBadges.Length; i++)
        {
            var now = i == current;
            helpStepBadges[i].color = now ? Ink : StepTodo;
            var number = helpStepBadges[i].GetComponentInChildren<Text>();
            if (number != null) number.color = now ? Color.white : Ink;
        }

        helpButtonLabel.text = firstRun ? "Start scanning" : "Back to the scan";
        helpOverlay.SetActive(true);
        autoScan?.SetHoldPaused(true);
    }

    void HideHelp(bool markSeen = true)
    {
        if (helpOverlay == null) return;
        helpOverlay.SetActive(false);
        autoScan?.SetHoldPaused(false);
        if (!markSeen) return;
        PlayerPrefs.SetInt(IntroSeenKey, 1);
        PlayerPrefs.Save();
    }

    void FillHelpTexts()
    {
        var auto = AutoEnabled;
        var detectsOpenings = spatialMapping != null && spatialMapping.DetectsOpenings;
        var titles = new[] { "Height", "Walls", "Doors & windows", "Furniture", "Review" };
        var bodies = new[]
        {
            auto
                ? "Point at the floor next to a wall and hold still. Then aim the circle where the wall meets the ceiling."
                : "Point at a floor corner of the room and tap Start. Aim up that corner to the ceiling and tap Finish.",
            auto
                ? "Walk slowly along the walls. Corners appear by themselves; tap the floor to add one, or a corner to remove it."
                : "Tap each floor corner of the room in turn, then tap Close room.",
            detectsOpenings
                ? "Look at each door and window so they're found. Tap a wrong one to remove it."
                : "Tap the floor at both edges of each door and window.",
            "Look around at your furniture so it's added. Tap one to remove it, or tap the floor to add one.",
            "Check the floor plan and sizes, then tap Scan complete.",
        };

        for (var i = 0; i < helpStepTitles.Length; i++)
        {
            helpStepTitles[i].text = titles[i];
            helpStepBodies[i].text = bodies[i];
        }
    }

    void OnHelpClicked()
    {
        if (HelpVisible) HideHelp();
        else ShowHelp(firstRun: false);
    }

    void RefreshHelpButton()
    {
        if (helpButton == null) return;
        var show = Scanning && !HelpVisible;
        if (helpButton.gameObject.activeSelf != show)
            helpButton.gameObject.SetActive(show);
    }

    // ── Height aim, floor dots, hold ring, corner arrow ──────────────────────

    /// <summary>A circle where the height is read from (no finger down), while measuring it.</summary>
    void RefreshAimMark()
    {
        if (aimMark == null) return;
        var show = Scanning && !HelpVisible && cornerBuilder.IsInHeightPhase && cornerBuilder.HasHeightBase;
        if (aimMark.gameObject.activeSelf != show)
            aimMark.gameObject.SetActive(show);
        if (!show) return;

        var viewport = cornerBuilder.HeightAimViewportPoint;
        aimMark.anchorMin = viewport;
        aimMark.anchorMax = viewport;
        aimMark.anchoredPosition = Vector2.zero;
    }

    /// <summary>Floor dots only while the floor point is still to be set.</summary>
    void RefreshFloorGrid()
    {
        if (floorGrid == null) return;
        floorGrid.Visible = Scanning && !HelpVisible && cornerBuilder.IsInHeightPhase && !cornerBuilder.HasHeightBase;
    }

    /// <summary>Hold-still ring around what is about to set itself, and an arrow to a missing corner off screen.</summary>
    void RefreshAutoOverlay()
    {
        if (dwellRing == null || targetArrow == null) return;

        var cam = Camera.main;
        var showRing = !HelpVisible && AutoOutlineStep && autoScan.HasDwellPoint && autoScan.DwellProgress > 0.02f && cam != null;
        if (showRing)
        {
            var screen = cam.WorldToScreenPoint(autoScan.DwellPoint);
            var local = Vector2.zero;
            showRing = screen.z > 0f && TryScreenToCanvas(screen, out local);
            if (showRing)
            {
                dwellRing.rectTransform.anchoredPosition = local;
                dwellRing.fillAmount = autoScan.DwellProgress;
            }
        }
        if (dwellRing.gameObject.activeSelf != showRing)
            dwellRing.gameObject.SetActive(showRing);

        var showArrow = false;
        if (!HelpVisible && AutoOutlineStep && autoScan.CurrentStep == ARAutoRoomScan.Step.Walls && autoScan.HasTarget && cam != null)
        {
            var screen = cam.WorldToScreenPoint(autoScan.TargetPoint);
            var center = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
            var dir = (Vector2)screen - center;
            if (screen.z < 0f) dir = -dir;
            var margin = Screen.width * 0.08f;
            var onScreen = screen.z > 0f
                           && screen.x > margin && screen.x < Screen.width - margin
                           && screen.y > margin && screen.y < Screen.height - margin;
            if (!onScreen && dir.sqrMagnitude > 1f)
            {
                // Pin to an inset rectangle around the screen centre, pointing at the corner.
                var half = new Vector2(Screen.width * 0.5f - margin * 1.6f, Screen.height * 0.5f - margin * 3f);
                var scale = Mathf.Min(half.x / Mathf.Max(Mathf.Abs(dir.x), 1e-3f), half.y / Mathf.Max(Mathf.Abs(dir.y), 1e-3f));
                var pinned = center + dir * scale;
                if (TryScreenToCanvas(pinned, out var local))
                {
                    showArrow = true;
                    targetArrow.anchoredPosition = local;
                    var angle = Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg;
                    // The arrow icon points left (180°).
                    targetArrow.localRotation = Quaternion.Euler(0f, 0f, angle - 180f);
                }
            }
        }
        if (targetArrow.gameObject.activeSelf != showArrow)
            targetArrow.gameObject.SetActive(showArrow);
    }

    bool TryScreenToCanvas(Vector2 screen, out Vector2 local)
    {
        local = default;
        if (canvasRect == null) return false;
        var uiCamera = canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay ? canvas.worldCamera : null;
        return RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, screen, uiCamera, out local);
    }

    // ── Mini floor plan ───────────────────────────────────────────────────────

    void RefreshMap()
    {
        if (mapPanel == null || map == null || cornerBuilder == null) return;

        var step = CurrentStepIndex();
        if (step == 0)
        {
            // New scan: the next walls step turns the map to face the user again.
            mapFacing = false;
            mapSquared = false;
        }

        // A size the user picked lasts for that step only.
        if (step != lastMapStep)
        {
            lastMapStep = step;
            mapUserToggled = false;
        }

        var show = Scanning && !HelpVisible && step >= 1;
        if (mapPanel.gameObject.activeSelf != show)
            mapPanel.gameObject.SetActive(show);
        if (!show) return;

        // Large on the review step unless the user shrank it; small elsewhere unless they enlarged it.
        if (!mapUserToggled) mapExpanded = step == 4;
        ApplyMapLayout();

        var cam = Camera.main;
        if (!mapFacing && cam != null)
        {
            map.Frame.FaceUp(XZ(cam.transform.forward));
            mapFacing = true;
        }

        var corners = cornerBuilder.Corners;
        var closed = cornerBuilder.IsLoopClosed && corners.Count >= 3;
        if (closed && !mapSquared)
        {
            map.Frame.SquareTo(LongestEdgeDirection(corners));
            mapSquared = true;
        }

        map.Begin();
        mapScratch.Clear();
        foreach (var c in corners) mapScratch.Add(XZ(c));

        if (closed)
        {
            map.AddPolygon(mapScratch, MapFloor);
        }
        else if (AutoEnabled && autoScan.CurrentStep == ARAutoRoomScan.Step.Walls)
        {
            // Walls the camera has found so far, under the outline they make.
            var walls = autoScan.Walls;
            for (var i = 0; i < walls.Count; i++)
            {
                if (autoScan.IsRoomWall(i))
                    map.AddLine(walls[i].End(0), walls[i].End(1), 7f, MapFoundWall);
            }
        }

        var edgeCount = closed ? mapScratch.Count : mapScratch.Count - 1;
        for (var i = 0; i < edgeCount; i++)
            map.AddLine(mapScratch[i], mapScratch[(i + 1) % mapScratch.Count], 4f, Ink);
        // An open outline of 3+ corners will close back to the first one.
        if (!closed && mapScratch.Count >= 3)
            map.AddLine(mapScratch[^1], mapScratch[0], 2f, new Color(Ink.r, Ink.g, Ink.b, 0.3f));

        if (closed && spatialMapping != null) AddSpatialToMap(corners);

        if (!closed)
        {
            foreach (var p in mapScratch)
            {
                map.AddDot(p, 7f, Ink);
                map.AddDot(p, 4.5f, Color.white);
            }

            if (AutoEnabled && autoScan.HasTarget)
            {
                var pulse = 9f + 2f * Mathf.Sin(Time.unscaledTime * 6f);
                map.AddDot(XZ(autoScan.TargetPoint), pulse, AutoOrange);
            }
            else if (!AutoEnabled && cornerBuilder.HasLivePreview && mapScratch.Count > 0)
            {
                map.AddLine(mapScratch[^1], XZ(cornerBuilder.AimPoint), 3f, AutoOrange, fit: false);
            }
        }

        if (mapExpanded && closed) AddWallLengths(corners);

        // Where the user is; on the review step it doesn't widen the map.
        if (cam != null)
            map.AddMarker(XZ(cam.transform.position), XZ(cam.transform.forward), MapUser, fit: step < 4);

        map.End(0.25f);
    }

    void AddSpatialToMap(IReadOnlyList<Vector3> corners)
    {
        var phase = spatialMapping.CurrentPhase;
        if (phase == ARDesignSpatialMappingController.Phase.ExistingFurniture)
        {
            foreach (var s in spatialMapping.PendingSuggestions)
                map.AddBox(new Vector2(s.center.x, s.center.z), new Vector2(s.size.x, s.size.z), s.yaw, MapSuggestion, fit: false);
        }

        foreach (var o in spatialMapping.Obstacles)
        {
            if (o?.center == null || o.size == null) continue;
            var center = new Vector2(o.center.x, o.center.z);
            map.AddBox(center, new Vector2(o.size.x, o.size.z), o.yaw, MapFurniture, fit: false);
            if (mapExpanded) map.AddLabel(center, Vector2.zero, Capitalize(o.type));
        }

        foreach (var opening in spatialMapping.Openings)
        {
            var i = opening.wallIndex;
            if (i < 0 || i >= corners.Count) continue;
            var a = XZ(corners[i]);
            var b = XZ(corners[(i + 1) % corners.Count]);
            var length = Vector2.Distance(a, b);
            if (length < 1e-3f) continue;
            var dir = (b - a) / length;
            var start = a + dir * Mathf.Clamp(opening.offsetAlongWall, 0f, length);
            var end = a + dir * Mathf.Clamp(opening.offsetAlongWall + opening.width, 0f, length);
            map.AddLine(start, end, 9f, opening.type == "door" ? MapDoor : MapWindow, fit: false);
        }
    }

    /// <summary>Length of each wall next to it, outside the room.</summary>
    void AddWallLengths(IReadOnlyList<Vector3> corners)
    {
        for (var i = 0; i < corners.Count; i++)
        {
            var a = corners[i];
            var b = corners[(i + 1) % corners.Count];
            var a2 = XZ(a);
            var b2 = XZ(b);
            var length = Vector2.Distance(a2, b2);
            if (length < 0.3f) continue;

            var mid = (a2 + b2) * 0.5f;
            var normal = new Vector2(-(b2 - a2).y, (b2 - a2).x) / length;
            var probe = mid + normal * 0.05f;
            if (RoomPolygonUtil.PointInsidePolygonXZ(new Vector3(probe.x, 0f, probe.y), corners))
                normal = -normal;
            // A label beside a wall needs about half its width more room than one above or below it.
            var dir = map.Frame.ProjectDirection(normal);
            var push = dir * 18f + new Vector2(dir.x * 38f, 0f);
            map.AddLabel(mid, push, $"{Mathf.RoundToInt(length * 100f)} cm");
        }
    }

    static Vector2 LongestEdgeDirection(IReadOnlyList<Vector3> corners)
    {
        var best = Vector2.right;
        var bestLength = 0f;
        for (var i = 0; i < corners.Count; i++)
        {
            var d = XZ(corners[(i + 1) % corners.Count]) - XZ(corners[i]);
            if (d.sqrMagnitude <= bestLength) continue;
            bestLength = d.sqrMagnitude;
            best = d;
        }

        return best;
    }

    void ApplyMapLayout()
    {
        var dockTop = DockTop();
        // The large map has wall lengths beside the walls: leave room for them inside the panel.
        map.padding = mapExpanded ? 84f : 22f;
        if (mapExpanded)
        {
            var width = canvasRect != null && canvasRect.rect.width > 0f ? canvasRect.rect.width : 1080f;
            var size = Mathf.Min(width - 48f, MapLargeMax);
            mapPanel.anchorMin = mapPanel.anchorMax = mapPanel.pivot = new Vector2(0.5f, 0f);
            mapPanel.sizeDelta = new Vector2(size, size);
            mapPanel.anchoredPosition = new Vector2(0f, dockTop + MapGap);
        }
        else
        {
            mapPanel.anchorMin = mapPanel.anchorMax = mapPanel.pivot = Vector2.zero;
            mapPanel.sizeDelta = new Vector2(MapSmall, MapSmall);
            mapPanel.anchoredPosition = new Vector2(24f, dockTop + MapGap);
        }
    }

    void OnMapClicked()
    {
        mapUserToggled = true;
        mapExpanded = !mapExpanded;
        nextMapRefreshAt = 0f;
    }

    static Vector2 XZ(Vector3 v) => new(v.x, v.z);

    // ── Dock and tool rail ────────────────────────────────────────────────────

    /// <summary>The dock is lower when there are no extra buttons above Undo and the main action.</summary>
    void ApplyDockLayout()
    {
        if (bottomDock == null) return;
        var auxShown = (auxTypeButton != null && auxTypeButton.gameObject.activeSelf)
                       || (auxSwingButton != null && auxSwingButton.gameObject.activeSelf);
        var height = auxShown ? DockFullHeight : DockCompactHeight;
        if (Mathf.Approximately(height, dockHeight)) return;
        dockHeight = height;
        bottomDock.sizeDelta = new Vector2(DockWidth, height);
        if (bottomShadow != null) bottomShadow.sizeDelta = new Vector2(DockWidth + 20f, height + 20f);
    }

    float DockTop()
    {
        if (bottomDock != null && bottomDock.gameObject.activeSelf) return DockBottom + dockHeight;
        var circles = (startButton != null && startButton.gameObject.activeSelf)
                      || (finishButton != null && finishButton.gameObject.activeSelf);
        return circles ? CircleButtonsTop : DockBottom;
    }

    /// <summary>Stacks the visible rail buttons from the top, with no gaps for hidden ones.</summary>
    void LayoutRail()
    {
        var y = -RailTop - RailItemHeight * 0.5f;
        foreach (var (holder, button) in railItems)
        {
            if (holder == null || button == null || !button.gameObject.activeSelf) continue;
            holder.anchoredPosition = new Vector2(-CardRight - RailWidth * 0.5f, y);
            y -= RailItemHeight + RailGap;
        }
    }

    /// <summary>
    /// The flash, switched on through ARCore so the AR camera keeps running (the phone's own
    /// flashlight takes the camera away). Shown while scanning, on phones that support it.
    /// </summary>
    void RefreshLightButton()
    {
        if (lightButton == null) return;
        if (cameraManager == null) cameraManager = FindFirstObjectByType<UnityEngine.XR.ARFoundation.ARCameraManager>();
        if (Time.unscaledTime >= nextLightCheckAt)
        {
            nextLightCheckAt = Time.unscaledTime + 0.5f;
            lightSupported = cameraManager != null && cameraManager.DoesCurrentCameraSupportTorch();
        }

        var show = lightSupported && Scanning;
        if (lightButton.gameObject.activeSelf != show)
            lightButton.gameObject.SetActive(show);
        if (!show) return;

        var on = cameraManager.currentCameraTorchMode == UnityEngine.XR.ARSubsystems.XRCameraTorchMode.On;
        lightLabel.text = on ? "Light: On" : "Light: Off";
        lightLabel.color = Ink;
        if (lightImage != null)
            lightImage.color = on ? new Color(1f, 0.86f, 0.35f, 0.97f) : Frost;
    }

    void OnLightClicked()
    {
        if (cameraManager == null) return;
        var on = cameraManager.currentCameraTorchMode == UnityEngine.XR.ARSubsystems.XRCameraTorchMode.On;
        cameraManager.requestedCameraTorchMode = on
            ? UnityEngine.XR.ARSubsystems.XRCameraTorchMode.Off
            : UnityEngine.XR.ARSubsystems.XRCameraTorchMode.On;
    }

    /// <summary>The light goes off with the scan screen (it isn't needed afterwards and drains the battery).</summary>
    void TurnLightOff()
    {
        if (cameraManager == null) cameraManager = FindFirstObjectByType<UnityEngine.XR.ARFoundation.ARCameraManager>();
        if (cameraManager != null
            && cameraManager.requestedCameraTorchMode == UnityEngine.XR.ARSubsystems.XRCameraTorchMode.On)
            cameraManager.requestedCameraTorchMode = UnityEngine.XR.ARSubsystems.XRCameraTorchMode.Off;
    }

    /// <summary>The Auto on/off switch shows while outlining (floor, height, walls).</summary>
    void RefreshAutoToggle()
    {
        if (autoToggleButton == null || autoScan == null) return;
        var outlining = Scanning && !InSpatialStep && cornerBuilder != null && !cornerBuilder.IsLoopClosed;
        if (autoToggleButton.gameObject.activeSelf != outlining)
            autoToggleButton.gameObject.SetActive(outlining);
        if (!outlining) return;

        autoToggleLabel.text = autoScan.Enabled ? "Auto: On" : "Auto: Off";
        autoToggleLabel.color = autoScan.Enabled ? Color.white : Ink;
        if (autoToggleImage != null)
            autoToggleImage.color = autoScan.Enabled ? AccentReady : Frost;
    }

    void OnAutoToggleClicked()
    {
        if (autoScan == null) return;
        autoScan.SetEnabled(!autoScan.Enabled);
        ShowToast("auto", autoScan.Enabled ? "Automatic scan on" : "Automatic scan off · tap the corners yourself");
        ApplyReticle(scanController != null ? scanController.Phase : RoomScanController.ScanPhase.Scanning);
        RefreshCornerUi();
    }

    static bool IsScanning(RoomScanController.ScanPhase phase) =>
        phase == RoomScanController.ScanPhase.Scanning || phase == RoomScanController.ScanPhase.ReadyToConfirm;

    /// <summary>
    /// Whether the current step needs the camera on the floor, and whether it is.
    /// Null when the step doesn't use the floor (aiming at the ceiling, closed outline, review).
    /// </summary>
    bool? FloorAimForCurrentStep()
    {
        if (scanController == null || cornerBuilder == null || !IsScanning(scanController.Phase)) return null;
        if (InSpatialStep) return null;

        var indicatorOnFloor = placementIndicator != null && placementIndicator.IsLockedOnFloor;
        if (cornerBuilder.IsInHeightPhase)
            return cornerBuilder.HasHeightBase ? null : indicatorOnFloor;
        if (cornerBuilder.IsLoopClosed) return null;
        // Automatic walls: the camera should be on the walls, not the floor.
        if (AutoEnabled) return null;
        return cornerBuilder.CornerCount > 0 ? cornerBuilder.IsAimOnFloor : indicatorOnFloor;
    }

    void RefreshCoaching()
    {
        if (coachChip == null || guidance == null) return;

        guidance.FloorAim = FloorAimForCurrentStep();
        var trackingIssue = guidance.isActiveAndEnabled && guidance.Current != ARScanGuidance.Issue.None;
        string helpTitle = null;
        string helpDetail = null;
        var autoHelp = !trackingIssue && TryGetAutoHelp(out helpTitle, out helpDetail);
        var show = !HelpVisible && (trackingIssue || autoHelp);
        if (coachChip.gameObject.activeSelf != show)
            coachChip.gameObject.SetActive(show);
        if (!show) return;

        coachTitle.text = trackingIssue ? guidance.Title : helpTitle;
        coachDetail.text = trackingIssue ? guidance.Detail : helpDetail;
    }

    /// <summary>When nothing is wrong with tracking, the automatic scan's own "stuck?" help.</summary>
    bool TryGetAutoHelp(out string title, out string detail)
    {
        title = null;
        detail = null;
        if (!AutoEnabled || cornerBuilder == null) return false;

        if (autoScan.NeedsHeightHelp)
        {
            var useCm = cornerBuilder.LiveHeightMeters >= 1.8f
                ? Mathf.RoundToInt(cornerBuilder.LiveHeightMeters * 100f)
                : Mathf.RoundToInt(cornerBuilder.WallHeight * 100f);
            title = "Ceiling hard to measure?";
            detail = $"Tap Finish to use {useCm} cm, or aim at the line where wall meets ceiling";
            return true;
        }

        if (autoScan.NeedsWallHelp)
        {
            title = "Wall not showing up?";
            detail = "Plain walls are hard to detect. Tap its corner on the floor instead";
            return true;
        }

        return false;
    }

    /// <summary>Rescan appears once there is something to lose, and asks for a second tap.</summary>
    void RefreshRescanButton()
    {
        if (rescanButton == null || cornerBuilder == null) return;

        var hasProgress = Scanning
                          && (cornerBuilder.HasHeightBase || cornerBuilder.CornerCount > 0 || InSpatialStep);
        if (rescanButton.gameObject.activeSelf != hasProgress)
            rescanButton.gameObject.SetActive(hasProgress);

        var armed = Time.unscaledTime <= rescanArmedUntil;
        rescanLabel.text = armed ? "Tap again" : "Rescan";
        rescanLabel.color = armed ? Color.white : Ink;
        if (rescanImage != null)
            rescanImage.color = armed ? RescanArmed : Frost;
    }

    void OnRescanClicked()
    {
        if (Time.unscaledTime > rescanArmedUntil)
        {
            rescanArmedUntil = Time.unscaledTime + RescanConfirmSeconds;
            RefreshRescanButton();
            ShowToast("rescan", "Tap Rescan again to start over", ARScanHaptics.Kind.Warning);
            return;
        }

        rescanArmedUntil = -1f;
        if (scanController == null) return;
        scanController.StartRoomScan();
        SnapshotMilestones();
        ClearToasts();
        ShowToast("rescan", "Starting over", ARScanHaptics.Kind.Warning);
        OnStatus(scanController.GetScanStatus());
        ApplyReticle(scanController.Phase);
        RefreshCornerUi();
        RefreshRescanButton();
    }

    // ── Buttons ───────────────────────────────────────────────────────────────

    /// <summary>Corners 1–3 → Undo (remove last). All 4 placed → Retry (start the outline over).</summary>
    bool IsRetryMode()
    {
        // The automatic outline isn't built in tap order, so Undo always takes back one corner.
        if (AutoEnabled) return false;
        return cornerBuilder != null
               && !cornerBuilder.IsInHeightPhase
               && !cornerBuilder.IsLoopClosed
               && !cornerBuilder.IsOutlineSelfIntersecting
               && cornerBuilder.CornerCount >= RetryCornerCount;
    }

    void OnUndoClicked()
    {
        if (InSpatialStep)
        {
            if (spatialMapping.CanUndo())
            {
                spatialMapping.UndoLast();
                RefreshCornerUi();
                return;
            }

            // Review → furniture → doors, keeping what was found.
            if (spatialMapping.TryStepBack())
            {
                RefreshCornerUi();
                return;
            }

            // Doors step with nothing to undo: reopen the outline (handled below).
        }

        if (cornerBuilder != null && cornerBuilder.IsInHeightPhase)
            cornerBuilder.UndoHeightBase();
        else if (cornerBuilder != null && cornerBuilder.IsLoopClosed)
        {
            cornerBuilder.ReopenLoop();
            spatialMapping?.ResetToOutline(keepSightings: true);
            ShowToast("reopen", "Back to the walls · fix a corner, then close the room again");
        }
        else if (AutoEnabled && cornerBuilder != null && cornerBuilder.IsHeightLocked)
        {
            // Newest corner first; with none left, back to measuring the height.
            if (!autoScan.Undo())
                cornerBuilder.RestartFromHeight();
        }
        else if (IsRetryMode())
            cornerBuilder.ResetCorners();
        else if (cornerBuilder != null && cornerBuilder.IsHeightLocked && cornerBuilder.CornerCount <= 1)
            cornerBuilder.RestartFromHeight();
        else
            cornerBuilder?.UndoLastCorner();
        RefreshCornerUi();
    }

    void OnAuxTypeClicked()
    {
        if (AutoEnabled && autoScan.CurrentStep == ARAutoRoomScan.Step.Walls)
        {
            autoScan.StartWallsOver();
            ShowToast("walls-over", "Corners cleared · looking at the walls again", ARScanHaptics.Kind.Tick);
            RefreshCornerUi();
            return;
        }

        if (spatialMapping == null) return;
        if (spatialMapping.CurrentPhase == ARDesignSpatialMappingController.Phase.Openings)
            spatialMapping.ToggleOpeningKind();
        else if (spatialMapping.CurrentPhase == ARDesignSpatialMappingController.Phase.ExistingFurniture)
            spatialMapping.CycleObstacleType();
        RefreshCornerUi();
    }

    void OnAuxSwingClicked()
    {
        if (spatialMapping == null)
            return;
        if (spatialMapping.CurrentPhase == ARDesignSpatialMappingController.Phase.ExistingFurniture)
            spatialMapping.RunFurnitureAutoScan();
        else if (spatialMapping.CurrentPhase == ARDesignSpatialMappingController.Phase.Openings
                 && spatialMapping.OpeningIsDoor)
            spatialMapping.CycleOpeningSwing();
        RefreshCornerUi();
    }

    void OnStartClicked()
    {
        if (cornerBuilder == null || !cornerBuilder.TryConfirmHeightBaseFromIndicator())
            return;

        RefreshCornerUi();
    }

    void OnFinishClicked()
    {
        if (cornerBuilder == null || !cornerBuilder.ConfirmHeight())
            return;

        if (scanController != null)
            OnStatus(scanController.GetScanStatus());
        RefreshCornerUi();
    }

    void OnConfirmClicked()
    {
        if (cornerBuilder != null && cornerBuilder.IsInHeightPhase)
        {
            if (measurementOnlyMode)
            {
                if (!cornerBuilder.HasHeightBase)
                    OnStartClicked();
                else
                    OnFinishClicked();
                return;
            }

            if (!cornerBuilder.ConfirmHeight())
                return;

            if (scanController != null)
                OnStatus(scanController.GetScanStatus());
            RefreshCornerUi();
            return;
        }

        if (cornerBuilder != null && cornerBuilder.CanClose)
        {
            cornerBuilder.CloseLoop();
            RefreshCornerUi();
            return;
        }

        if (InSpatialStep)
        {
            if (spatialMapping.TryPrimaryAction(out var confirmedRoom))
            {
                if (confirmedRoom)
                    FinalizeRoomScan();
                RefreshCornerUi();
            }

            return;
        }

        if (cornerBuilder != null && !cornerBuilder.CanConfirm)
            return;

        FinalizeRoomScan();
    }

    void FinalizeRoomScan()
    {
        if (bridge != null)
            bridge.ConfirmRoomScan();
        else if (scanController != null && !scanController.ConfirmRoomScan())
            return;

        if (scanController == null || !scanController.IsConfirmed)
            return;

        ARScanHaptics.Play(ARScanHaptics.Kind.Success);
        if (canvas != null)
            canvas.gameObject.SetActive(false);

        placementIndicator?.StopTracking(clearOverlay: true);

        if (!spawnSampleOnConfirm) return;

        var placement = FindFirstObjectByType<FurniturePlacementController>();
        placement?.SpawnFurniture(new SpawnFurnitureRequest
        {
            modelId = "sample-cube",
            catalogId = "sample-cube",
            width = 0.5f,
            height = 0.5f,
            depth = 0.5f,
        });
    }

    // ── Building the UI ───────────────────────────────────────────────────────

    void BuildUi()
    {
        var root = new GameObject("ARDesignScanHUD");
        root.transform.SetParent(transform, false);

        canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 1000;
        canvasRect = (RectTransform)root.transform;
        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.5f;
        root.AddComponent<GraphicRaycaster>();

        ARDesignUiUtil.EnsureEventSystem();

        // Drawn first so everything else sits on top: hold ring, corner arrow, height aim.
        if (autoScan != null)
            BuildAutoMarkers(root.transform);
        BuildAimMark(root.transform);

        BuildInstructionCard(root.transform);
        BuildCoachChip(root.transform);
        BuildRail(root.transform);
        BuildMap(root.transform);
        BuildDock(root.transform);
        BuildHeightButtons(root.transform);
        BuildToast(root.transform);
        BuildHelpCard(root.transform);
    }

    /// <summary>Stretches across the top between the app's back button and the right edge.</summary>
    static void PlaceTopBand(RectTransform rt, float top, float height)
    {
        rt.anchorMin = new Vector2(0f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.offsetMin = new Vector2(CardLeft, -top - height);
        rt.offsetMax = new Vector2(-CardRight, -top);
    }

    void BuildInstructionCard(Transform root)
    {
        var shadow = ARDesignUiUtil.CreateRoundedImage(root, new Color(0f, 0f, 0f, 0.18f), 40);
        shadow.raycastTarget = false;
        PlaceTopBand(shadow.rectTransform, CardTop + 6f, CardHeight);

        var card = ARDesignUiUtil.CreateRoundedImage(root, Frost, 36);
        var cardRt = card.rectTransform;
        PlaceTopBand(cardRt, CardTop, CardHeight);

        topHintLabel = ARDesignUiUtil.CreateText(cardRt, "Scan your room", 30, FontStyle.Bold, TextAnchor.MiddleCenter);
        topHintLabel.color = Ink;
        ShrinkToFit(topHintLabel, 20);
        Stretch(topHintLabel.rectTransform, new Vector2(0.04f, 0.62f), new Vector2(0.96f, 0.95f));

        subtitleLabel = ARDesignUiUtil.CreateText(cardRt, string.Empty, 21, FontStyle.Normal, TextAnchor.MiddleCenter);
        subtitleLabel.color = InkMuted;
        ShrinkToFit(subtitleLabel, 15);
        Stretch(subtitleLabel.rectTransform, new Vector2(0.05f, 0.36f), new Vector2(0.95f, 0.63f));

        // Step bar: one chip per step, filled in as the scan moves on.
        var count = stepNames.Length;
        stepChips = new Image[count];
        stepLabels = new Text[count];
        stepChecks = new Image[count];
        const float left = 0.03f;
        const float right = 0.97f;
        var slot = (right - left) / count;
        for (var i = 0; i < count; i++)
        {
            var chip = ARDesignUiUtil.CreateRoundedImage(cardRt, StepTodo, 24);
            chip.raycastTarget = false;
            var chipRt = chip.rectTransform;
            chipRt.anchorMin = new Vector2(left + slot * i, 0.08f);
            chipRt.anchorMax = new Vector2(left + slot * (i + 1), 0.30f);
            chipRt.offsetMin = new Vector2(3f, 0f);
            chipRt.offsetMax = new Vector2(-3f, 0f);
            stepChips[i] = chip;

            var check = ARDesignUiUtil.CreateImage(chipRt, Color.white);
            check.sprite = ARDesignUiUtil.CheckSprite();
            check.preserveAspect = true;
            check.raycastTarget = false;
            var checkRt = check.rectTransform;
            checkRt.anchorMin = new Vector2(0f, 0.5f);
            checkRt.anchorMax = new Vector2(0f, 0.5f);
            checkRt.pivot = new Vector2(0f, 0.5f);
            checkRt.anchoredPosition = new Vector2(8f, 0f);
            checkRt.sizeDelta = new Vector2(22f, 22f);
            check.gameObject.SetActive(false);
            stepChecks[i] = check;

            var label = ARDesignUiUtil.CreateText(chipRt, stepNames[i], 18, FontStyle.Normal, TextAnchor.MiddleCenter);
            label.color = InkMuted;
            label.raycastTarget = false;
            ShrinkToFit(label, 12);
            var labelRt = label.rectTransform;
            labelRt.anchorMin = Vector2.zero;
            labelRt.anchorMax = Vector2.one;
            labelRt.offsetMin = new Vector2(6f, 0f);
            labelRt.offsetMax = new Vector2(-6f, 0f);
            stepLabels[i] = label;
        }
    }

    void BuildCoachChip(Transform root)
    {
        // Coaching chip under the instruction card ("Move slowly", "Point at the floor", …).
        var chip = ARDesignUiUtil.CreateRoundedImage(root, CoachBg, 30);
        chip.raycastTarget = false;
        coachChip = chip.rectTransform;
        PlaceTopBand(coachChip, CardTop + CardHeight + CoachGap, CoachHeight);

        coachTitle = ARDesignUiUtil.CreateText(coachChip, string.Empty, 24, FontStyle.Bold, TextAnchor.MiddleCenter);
        coachTitle.color = CoachInk;
        coachTitle.raycastTarget = false;
        ShrinkToFit(coachTitle, 18);
        Stretch(coachTitle.rectTransform, new Vector2(0.05f, 0.48f), new Vector2(0.95f, 0.94f));

        coachDetail = ARDesignUiUtil.CreateText(coachChip, string.Empty, 18, FontStyle.Normal, TextAnchor.MiddleCenter);
        coachDetail.color = CoachInk;
        coachDetail.raycastTarget = false;
        ShrinkToFit(coachDetail, 13);
        Stretch(coachDetail.rectTransform, new Vector2(0.05f, 0.08f), new Vector2(0.95f, 0.50f));
        coachChip.gameObject.SetActive(false);
    }

    /// <summary>Rescan, Auto, Light and Help down the right edge, under the instruction card.</summary>
    void BuildRail(Transform root)
    {
        rescanButton = CreateRailButton(root, "Rescan", Frost, Ink, OnRescanClicked, out rescanImage, out rescanLabel);
        if (autoScan != null)
            autoToggleButton = CreateRailButton(root, "Auto: On", AccentReady, Color.white, OnAutoToggleClicked, out autoToggleImage, out autoToggleLabel);
        lightButton = CreateRailButton(root, "Light: Off", Frost, Ink, OnLightClicked, out lightImage, out lightLabel);
        helpButton = CreateRailButton(root, "Help", Frost, Ink, OnHelpClicked, out _, out _);
        LayoutRail();
    }

    Button CreateRailButton(
        Transform root,
        string label,
        Color bg,
        Color textColor,
        UnityEngine.Events.UnityAction onClick,
        out Image image,
        out Text text)
    {
        var holder = new GameObject(label + "Holder", typeof(RectTransform));
        holder.transform.SetParent(root, false);
        var rt = (RectTransform)holder.transform;
        rt.anchorMin = new Vector2(1f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(RailWidth, RailItemHeight);
        var button = CreatePillButton(holder.transform, label, Vector2.zero, Vector2.one, bg, textColor, onClick, out image, out text);
        text.fontSize = 22;
        button.gameObject.SetActive(false);
        railItems.Add((rt, button));
        return button;
    }

    void BuildAutoMarkers(Transform root)
    {
        dwellRing = ARDesignUiUtil.CreateImage(root, Color.white);
        dwellRing.sprite = ARDesignUiUtil.CircleRingSprite(128, 0.14f);
        dwellRing.type = Image.Type.Filled;
        dwellRing.fillMethod = Image.FillMethod.Radial360;
        dwellRing.fillOrigin = (int)Image.Origin360.Top;
        dwellRing.fillClockwise = true;
        dwellRing.fillAmount = 0f;
        dwellRing.raycastTarget = false;
        var ringRt = dwellRing.rectTransform;
        ringRt.anchorMin = new Vector2(0.5f, 0.5f);
        ringRt.anchorMax = new Vector2(0.5f, 0.5f);
        ringRt.pivot = new Vector2(0.5f, 0.5f);
        ringRt.sizeDelta = new Vector2(150f, 150f);
        dwellRing.gameObject.SetActive(false);

        var arrowChip = ARDesignUiUtil.CreateImage(root, AutoOrange);
        ARDesignUiUtil.ApplyCircle(arrowChip);
        arrowChip.raycastTarget = false;
        targetArrow = arrowChip.rectTransform;
        targetArrow.anchorMin = new Vector2(0.5f, 0.5f);
        targetArrow.anchorMax = new Vector2(0.5f, 0.5f);
        targetArrow.pivot = new Vector2(0.5f, 0.5f);
        targetArrow.sizeDelta = new Vector2(96f, 96f);
        var arrowIcon = ARDesignUiUtil.CreateImage(targetArrow, Color.white);
        arrowIcon.sprite = LoadArrowSprite();
        arrowIcon.preserveAspect = true;
        arrowIcon.raycastTarget = false;
        Stretch(arrowIcon.rectTransform, new Vector2(0.22f, 0.22f), new Vector2(0.78f, 0.78f));
        targetArrow.gameObject.SetActive(false);
    }

    /// <summary>Ring with a centre dot at the point the height is read from.</summary>
    void BuildAimMark(Transform root)
    {
        var ring = ARDesignUiUtil.CreateImage(root, new Color(1f, 1f, 1f, 0.95f));
        ring.sprite = ARDesignUiUtil.CircleRingSprite(128, 0.1f);
        ring.raycastTarget = false;
        aimMark = ring.rectTransform;
        aimMark.pivot = new Vector2(0.5f, 0.5f);
        aimMark.sizeDelta = new Vector2(76f, 76f);

        var dot = ARDesignUiUtil.CreateImage(aimMark, Color.white);
        ARDesignUiUtil.ApplyCircle(dot);
        dot.raycastTarget = false;
        var dotRt = dot.rectTransform;
        dotRt.anchorMin = dotRt.anchorMax = dotRt.pivot = new Vector2(0.5f, 0.5f);
        dotRt.sizeDelta = new Vector2(12f, 12f);
        aimMark.gameObject.SetActive(false);
    }

    void BuildMap(Transform root)
    {
        var panel = ARDesignUiUtil.CreateRoundedImage(root, Frost, 32);
        mapPanel = panel.rectTransform;
        var button = panel.gameObject.AddComponent<Button>();
        button.targetGraphic = panel;
        button.transition = Selectable.Transition.None;
        button.onClick.AddListener(OnMapClicked);

        var go = new GameObject("MiniMap", typeof(RectTransform));
        go.transform.SetParent(mapPanel, false);
        map = go.AddComponent<ARScanMiniMap>();
        map.raycastTarget = false;
        var rt = map.rectTransform;
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = new Vector2(8f, 8f);
        rt.offsetMax = new Vector2(-8f, -8f);
        mapPanel.gameObject.SetActive(false);
        ApplyMapLayout();
    }

    void BuildDock(Transform root)
    {
        // Bottom dock (hidden during the Start / Finish height step). It is anchored by its bottom
        // edge and only its height changes, so the buttons are placed from the bottom.
        var shadow = ARDesignUiUtil.CreateRoundedImage(root, new Color(0f, 0f, 0f, 0.18f), 40);
        shadow.raycastTarget = false;
        bottomShadow = shadow.rectTransform;
        bottomShadow.anchorMin = bottomShadow.anchorMax = new Vector2(0.5f, 0f);
        bottomShadow.pivot = new Vector2(0.5f, 0f);
        bottomShadow.anchoredPosition = new Vector2(0f, DockBottom - 16f);
        bottomShadow.sizeDelta = new Vector2(DockWidth + 20f, DockFullHeight + 20f);

        var dock = ARDesignUiUtil.CreateRoundedImage(root, Frost, 40);
        bottomDock = dock.rectTransform;
        bottomDock.anchorMin = bottomDock.anchorMax = new Vector2(0.5f, 0f);
        bottomDock.pivot = new Vector2(0.5f, 0f);
        bottomDock.anchoredPosition = new Vector2(0f, DockBottom);
        bottomDock.sizeDelta = new Vector2(DockWidth, DockFullHeight);
        dockHeight = DockFullHeight;
        // The measurement scan starts on the Start / Finish height step — keep the dock off until then.
        bottomShadow.gameObject.SetActive(false);
        bottomDock.gameObject.SetActive(false);

        auxTypeButton = CreatePillButton(bottomDock, "Door", Vector2.zero, Vector2.zero, FrostSoft, Ink, OnAuxTypeClicked, out _, out auxTypeLabel);
        PlaceInDock(auxTypeButton, 0.05f, 0.48f, 100f, 164f);
        auxTypeLabel.fontSize = 24;
        auxTypeButton.gameObject.SetActive(false);

        auxSwingButton = CreatePillButton(bottomDock, "Swing", Vector2.zero, Vector2.zero, FrostSoft, Ink, OnAuxSwingClicked, out _, out auxSwingLabel);
        PlaceInDock(auxSwingButton, 0.52f, 0.95f, 100f, 164f);
        auxSwingLabel.fontSize = 24;
        auxSwingButton.gameObject.SetActive(false);

        undoButton = CreatePillButton(bottomDock, "Undo", Vector2.zero, Vector2.zero, Frost, Ink, OnUndoClicked, out undoImage, out undoLabel);
        PlaceInDock(undoButton, 0.05f, 0.30f, 16f, 88f);

        confirmButton = CreatePillButton(bottomDock, "Add corners", Vector2.zero, Vector2.zero, StepTodo, InkMuted, OnConfirmClicked, out confirmImage, out confirmLabel);
        PlaceInDock(confirmButton, 0.32f, 0.95f, 16f, 88f);
    }

    static void PlaceInDock(Button button, float xMin, float xMax, float bottom, float top)
    {
        var rt = (RectTransform)button.transform;
        rt.anchorMin = new Vector2(xMin, 0f);
        rt.anchorMax = new Vector2(xMax, 0f);
        rt.offsetMin = new Vector2(0f, bottom);
        rt.offsetMax = new Vector2(0f, top);
    }

    void BuildHeightButtons(Transform root)
    {
        startButton = CreateCenterActionButton(
            root, "Start", new Vector2(0.5f, 0f), new Vector2(0f, 160f), 156f, MeasurePurple,
            OnStartClicked, out startImage, out startLabel);
        startButton.gameObject.SetActive(false);

        finishButton = CreateCenterActionButton(
            root, "Finish", new Vector2(0.5f, 0f), new Vector2(0f, 160f), 156f, MeasurePurple,
            OnFinishClicked, out finishImage, out finishLabel);
        finishButton.gameObject.SetActive(false);

        // Undo beside Finish, so a misplaced base point can be set again.
        heightUndoButton = CreateCenterActionButton(
            root, "Undo", new Vector2(0.5f, 0f), new Vector2(-220f, 160f), 112f, Frost,
            OnUndoClicked, out heightUndoImage, out heightUndoLabel);
        heightUndoLabel.color = Ink;
        heightUndoButton.gameObject.SetActive(false);
    }

    void BuildToast(Transform root)
    {
        var bg = ARDesignUiUtil.CreateRoundedImage(root, ToastBg, 30);
        bg.raycastTarget = false;
        toastRect = bg.rectTransform;
        toastRect.anchorMin = toastRect.anchorMax = new Vector2(0.5f, 0f);
        toastRect.pivot = new Vector2(0.5f, 0.5f);
        toastRect.sizeDelta = new Vector2(400f, 62f);
        toastGroup = bg.gameObject.AddComponent<CanvasGroup>();
        toastGroup.blocksRaycasts = false;
        toastGroup.interactable = false;

        toastText = ARDesignUiUtil.CreateText(toastRect, string.Empty, 24, FontStyle.Bold, TextAnchor.MiddleCenter);
        toastText.color = Color.white;
        toastText.raycastTarget = false;
        toastText.horizontalOverflow = HorizontalWrapMode.Overflow;
        Stretch(toastText.rectTransform, Vector2.zero, Vector2.one);
        toastRect.gameObject.SetActive(false);
    }

    /// <summary>"How it works": the five steps and a few tips, over a dark scrim that blocks the camera taps.</summary>
    void BuildHelpCard(Transform root)
    {
        var scrim = ARDesignUiUtil.CreateImage(root, Scrim);
        helpOverlay = scrim.gameObject;
        helpOverlay.name = "HelpOverlay";
        Stretch(scrim.rectTransform, Vector2.zero, Vector2.one);

        const float rowHeight = 132f;
        const float rowsTop = 196f;
        var stepCount = SpatialStepNames.Length;
        var visibleSteps = spatialMapping != null ? stepCount : OutlineStepNames.Length;
        var cardHeight = rowsTop + rowHeight * visibleSteps + 260f;

        var card = ARDesignUiUtil.CreateRoundedImage(scrim.rectTransform, Color.white, 40);
        var cardRt = card.rectTransform;
        cardRt.anchorMin = new Vector2(0f, 0.5f);
        cardRt.anchorMax = new Vector2(1f, 0.5f);
        cardRt.pivot = new Vector2(0.5f, 0.5f);
        cardRt.offsetMin = new Vector2(28f, -cardHeight * 0.5f);
        cardRt.offsetMax = new Vector2(-28f, cardHeight * 0.5f);

        var title = ARDesignUiUtil.CreateText(cardRt, $"Scan your room in {visibleSteps} steps", 38, FontStyle.Bold, TextAnchor.MiddleLeft);
        title.color = Ink;
        ShrinkToFit(title, 26);
        PlaceFromTop(title.rectTransform, 44f, 60f, 44f, 44f);

        var intro = ARDesignUiUtil.CreateText(cardRt, "Hold the phone upright and follow the card at the top of the screen.", 22, FontStyle.Normal, TextAnchor.MiddleLeft);
        intro.color = InkMuted;
        ShrinkToFit(intro, 16);
        PlaceFromTop(intro.rectTransform, 108f, 64f, 44f, 44f);

        helpStepTitles = new Text[visibleSteps];
        helpStepBodies = new Text[visibleSteps];
        helpStepBadges = new Image[visibleSteps];
        for (var i = 0; i < visibleSteps; i++)
        {
            var top = rowsTop + rowHeight * i;
            var badge = ARDesignUiUtil.CreateImage(cardRt, StepTodo);
            ARDesignUiUtil.ApplyCircle(badge);
            badge.raycastTarget = false;
            var badgeRt = badge.rectTransform;
            badgeRt.anchorMin = badgeRt.anchorMax = new Vector2(0f, 1f);
            badgeRt.pivot = new Vector2(0f, 1f);
            badgeRt.anchoredPosition = new Vector2(44f, -top - 4f);
            badgeRt.sizeDelta = new Vector2(56f, 56f);
            var number = ARDesignUiUtil.CreateText(badgeRt, (i + 1).ToString(), 26, FontStyle.Bold, TextAnchor.MiddleCenter);
            number.color = Ink;
            number.raycastTarget = false;
            Stretch(number.rectTransform, Vector2.zero, Vector2.one);
            helpStepBadges[i] = badge;

            var stepTitle = ARDesignUiUtil.CreateText(cardRt, string.Empty, 27, FontStyle.Bold, TextAnchor.UpperLeft);
            stepTitle.color = Ink;
            stepTitle.raycastTarget = false;
            PlaceFromTop(stepTitle.rectTransform, top, 38f, 124f, 44f);
            helpStepTitles[i] = stepTitle;

            var body = ARDesignUiUtil.CreateText(cardRt, string.Empty, 21, FontStyle.Normal, TextAnchor.UpperLeft);
            body.color = InkMuted;
            body.raycastTarget = false;
            ShrinkToFit(body, 15);
            PlaceFromTop(body.rectTransform, top + 38f, rowHeight - 46f, 124f, 44f);
            helpStepBodies[i] = body;
        }

        var tips = ARDesignUiUtil.CreateText(
            cardRt,
            "Tips: turn the lights on and move slowly. Undo and Back are always there, and Rescan starts over.",
            21, FontStyle.Italic, TextAnchor.MiddleLeft);
        tips.color = InkMuted;
        ShrinkToFit(tips, 15);
        PlaceFromTop(tips.rectTransform, rowsTop + rowHeight * visibleSteps + 4f, 76f, 44f, 44f);

        var start = CreatePillButton(cardRt, "Start scanning", Vector2.zero, Vector2.zero, AccentReady, Color.white, () => HideHelp(), out _, out helpButtonLabel);
        var startRt = (RectTransform)start.transform;
        startRt.anchorMin = new Vector2(0f, 0f);
        startRt.anchorMax = new Vector2(1f, 0f);
        startRt.offsetMin = new Vector2(44f, 40f);
        startRt.offsetMax = new Vector2(-44f, 136f);
        helpButtonLabel.fontSize = 30;

        helpOverlay.SetActive(false);
    }

    /// <summary>Top-anchored row inside a card: <paramref name="top"/> down from its top edge, inset left/right.</summary>
    static void PlaceFromTop(RectTransform rt, float top, float height, float left, float right)
    {
        rt.anchorMin = new Vector2(0f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.offsetMin = new Vector2(left, -top - height);
        rt.offsetMax = new Vector2(-right, -top);
    }

    static void Stretch(RectTransform rt, Vector2 min, Vector2 max)
    {
        rt.anchorMin = min;
        rt.anchorMax = max;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    static Sprite LoadArrowSprite()
    {
        const string path = "UIIcons/back-arrow";
        var sprite = Resources.Load<Sprite>(path);
        if (sprite != null) return sprite;
        var tex = Resources.Load<Texture2D>(path);
        return tex == null
            ? null
            : Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
    }

    static ARDesignSpatialMappingController EnsureSpatialMappingRuntime(GameObject host)
    {
        var spatial = host.GetComponent<ARDesignSpatialMappingController>();
        if (spatial == null)
            spatial = host.AddComponent<ARDesignSpatialMappingController>();
        if (host.GetComponent<ARDesignSpatialMappingVisualizer>() == null)
            host.AddComponent<ARDesignSpatialMappingVisualizer>();
        if (host.GetComponent<ARFurnitureAutoSuggestService>() == null)
            host.AddComponent<ARFurnitureAutoSuggestService>();
        return spatial;
    }

    /// <summary>Long text (room size summary, coaching detail) shrinks instead of being cut off.</summary>
    static void ShrinkToFit(Text text, int minSize)
    {
        text.resizeTextForBestFit = true;
        text.resizeTextMinSize = minSize;
        text.resizeTextMaxSize = text.fontSize;
    }

    static Button CreateCenterActionButton(
        Transform parent,
        string label,
        Vector2 anchor,
        Vector2 anchoredPos,
        float diameter,
        Color bg,
        UnityEngine.Events.UnityAction onClick,
        out Image image,
        out Text text)
    {
        var go = new GameObject(label + "ActionButton", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyCircle(image);
        image.color = bg;

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        button.onClick.AddListener(onClick);
        var colors = button.colors;
        colors.highlightedColor = new Color(0.18f, 0.32f, 0.55f, 1f);
        colors.pressedColor = new Color(0.08f, 0.18f, 0.38f, 1f);
        colors.disabledColor = MeasurePurpleDisabled;
        button.colors = colors;

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = anchor;
        rt.anchorMax = anchor;
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = anchoredPos;
        rt.sizeDelta = new Vector2(diameter, diameter);

        text = ARDesignUiUtil.CreateText(go.transform, label, 26, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = Color.white;
        text.horizontalOverflow = HorizontalWrapMode.Overflow;
        text.raycastTarget = false;
        var textRt = text.rectTransform;
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = new Vector2(8f, 8f);
        textRt.offsetMax = new Vector2(-8f, -8f);
        return button;
    }

    static Button CreatePillButton(
        Transform parent,
        string label,
        Vector2 anchorMin,
        Vector2 anchorMax,
        Color bg,
        Color textColor,
        UnityEngine.Events.UnityAction onClick,
        out Image image,
        out Text text)
    {
        var go = new GameObject(label + "Button", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(image, 32);
        image.color = bg;

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        button.onClick.AddListener(onClick);
        var colors = button.colors;
        colors.highlightedColor = Color.white;
        colors.pressedColor = new Color(0.92f, 0.92f, 0.94f, 1f);
        colors.disabledColor = new Color(1f, 1f, 1f, 0.55f);
        button.colors = colors;

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        text = ARDesignUiUtil.CreateText(go.transform, label, 28, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = textColor;
        var textRt = text.rectTransform;
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = new Vector2(8f, 4f);
        textRt.offsetMax = new Vector2(-8f, -4f);
        return button;
    }
}
