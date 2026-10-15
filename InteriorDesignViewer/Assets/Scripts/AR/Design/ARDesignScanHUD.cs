using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Corner-to-corner scan chrome — ARPlan-inspired frosted pills, step dots, rounded controls,
/// live coaching ("Move slowly", "Point at the floor"), Rescan, and a final "Scan complete".
/// Titles say which of the five steps the user is on. With the automatic scan
/// (<see cref="ARAutoRoomScan"/>) it also shows the hold-still ring, an arrow to a missing
/// corner, the Auto on/off switch and "Start over" for the corners.
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
    static readonly Color Accent = new(0.12f, 0.12f, 0.14f, 1f);
    static readonly Color AccentReady = new(0.18f, 0.55f, 0.42f, 1f);
    static readonly Color MeasurePurple = new(12f / 255f, 41f / 255f, 95f / 255f, 1f); // navy
    static readonly Color MeasurePurpleDisabled = new(0.55f, 0.56f, 0.58f, 0.85f);
    static readonly Color DotIdle = new(0.78f, 0.79f, 0.82f, 1f);
    static readonly Color DotActive = new(0.12f, 0.12f, 0.14f, 1f);
    static readonly Color CoachBg = new(1f, 0.95f, 0.85f, 0.97f);
    static readonly Color CoachInk = new(0.47f, 0.26f, 0.03f, 1f);
    static readonly Color RescanArmed = new(0.86f, 0.24f, 0.22f, 1f);
    const int RetryCornerCount = 4;
    const float RescanConfirmSeconds = 3f;
    const int StepCount = 5;
    static readonly Color AutoOrange = new(1f, 0.55f, 0.15f, 1f);

    Canvas canvas;
    Text topHintLabel;
    Text subtitleLabel;
    RectTransform bottomDock;
    RectTransform bottomShadow;
    Button confirmButton;
    Button undoButton;
    Button auxTypeButton;
    Button auxSwingButton;
    Text auxTypeLabel;
    Text auxSwingLabel;
    Image auxTypeImage;
    Image auxSwingImage;
    Button startButton;
    Button finishButton;
    Button heightUndoButton;
    Text confirmLabel;
    Text undoLabel;
    Text startLabel;
    Text finishLabel;
    Text heightUndoLabel;
    Image confirmImage;
    Image undoImage;
    Image startImage;
    Image finishImage;
    Image heightUndoImage;
    Image[] stepDots = System.Array.Empty<Image>();
    RectTransform coachChip;
    Text coachTitle;
    Text coachDetail;
    Button rescanButton;
    Image rescanImage;
    Text rescanLabel;
    float rescanArmedUntil = -1f;
    float nextLiveRefreshAt;
    ARScanGuidance guidance;
    ARAutoRoomScan autoScan;
    RectTransform canvasRect;
    Image dwellRing;
    RectTransform targetArrow;
    Button autoToggleButton;
    Image autoToggleImage;
    Text autoToggleLabel;
    UnityEngine.XR.ARFoundation.ARCameraManager cameraManager;
    Button lightButton;
    Image lightImage;
    Text lightLabel;
    float nextLightCheckAt;
    bool lightSupported;
    bool active;

    bool AutoEnabled => autoScan != null && autoScan.Enabled;

    /// <summary>Automatic scan is driving the floor, height or walls step right now.</summary>
    bool AutoOutlineStep => AutoEnabled && autoScan.IsActive;

    static string StepTitle(int step, string text) => $"Step {step} of {StepCount} · {text}";

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
        if (measurementOnlyMode)
        {
            autoScan = ARAutoRoomScan.EnsureOn(gameObject);
            ARPerfLog.EnsureOn(gameObject);
        }

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
        }

        if (autoScan != null)
            autoScan.Changed += OnCornersChanged;
    }

    void OnDisable()
    {
        if (active) TurnLightOff();
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
        }

        if (autoScan != null)
            autoScan.Changed -= OnCornersChanged;
    }

    void OnSpatialChanged() => RefreshCornerUi();

    void Start()
    {
        if (!active || scanController == null) return;
        OnStatus(scanController.GetScanStatus());
        ApplyReticle(scanController.Phase);
        RefreshCornerUi();
    }

    void OnCornersChanged() => RefreshCornerUi();

    void Update()
    {
        if (!active || cornerBuilder == null) return;
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
        if (autoScan == null) RefreshLightButton();
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(phase != RoomScanController.ScanPhase.Confirmed);
        if (!IsScanning(phase))
            TurnLightOff();
        if (guidance != null)
            guidance.enabled = IsScanning(phase);

        ApplyReticle(phase);
        RefreshCornerUi();
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

        if (topHintLabel != null)
            topHintLabel.text = BuildHintText(status);

        RefreshCornerUi();
    }

    void RefreshCornerUi()
    {
        if (spatialMapping != null
            && spatialMapping.CurrentPhase != ARDesignSpatialMappingController.Phase.Outline)
        {
            RefreshSpatialUi();
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
        var liveHeightCm = cornerBuilder != null && cornerBuilder.HasLiveHeightPreview
            ? Mathf.RoundToInt(cornerBuilder.LiveHeightMeters * 100f)
            : 0;
        var liveWidthCm = cornerBuilder != null && cornerBuilder.HasLivePreview
            ? Mathf.RoundToInt(cornerBuilder.LivePreviewDistanceMeters * 100f)
            : 0;

        if (topHintLabel != null && scanController != null)
            topHintLabel.text = StepTitle(inHeightPhase ? 1 : 2, BuildHintText(scanController.GetScanStatus()));

        if (TryBuildAutoText(liveHeightCm, out var autoTitle, out var autoSubtitle))
        {
            if (topHintLabel != null) topHintLabel.text = autoTitle;
            if (subtitleLabel != null) subtitleLabel.text = autoSubtitle;
        }
        else if (subtitleLabel != null)
        {
            var spotted = spatialMapping != null ? spatialMapping.EarlySightingCount : 0;
            var spottedSuffix = spotted > 0 ? $" · {spotted} furniture spotted" : string.Empty;
            if (inHeightPhase)
            {
                if (!cornerBuilder.HasHeightBase)
                {
                    subtitleLabel.text = measurementOnlyMode
                        ? "Move the marker to the floor, then tap Start"
                        : "Move the marker to the floor start point, then tap";
                }
                else if (liveHeightCm > 0)
                {
                    subtitleLabel.text = liveHeightCm >= 180
                        ? $"H = {liveHeightCm} cm · tap Finish when ready"
                        : $"H = {liveHeightCm} cm · aim higher at the ceiling";
                }
                else
                    subtitleLabel.text = "Aim at the ceiling, or tap Finish to use default height";
            }
            else if (count == 1 && cornerBuilder != null && cornerBuilder.IsHeightLocked)
            {
                subtitleLabel.text = measurementOnlyMode
                    ? "Width starts at Finish point · tap the next floor corner"
                    : "Height base set · tap the next floor corner";
            }
            else if (count == 0)
            {
                subtitleLabel.text = "Walk the room · tap each floor corner";
            }
            else if (outlineCrosses)
            {
                subtitleLabel.text = "Walls cross · tap Undo to fix the last corner";
            }
            else if (canConfirmWidth)
            {
                subtitleLabel.text = $"{count} walls · room closed";
            }
            else if (liveWidthCm > 0)
            {
                subtitleLabel.text = (canCloseWidth
                    ? $"{count} corners · live {liveWidthCm} cm · ready to close"
                    : $"{count} corners · live {liveWidthCm} cm") + spottedSuffix;
            }
            else
            {
                subtitleLabel.text = (canCloseWidth
                    ? $"{count} corners · ready to close"
                    : $"{count} corners · keep outlining") + spottedSuffix;
            }
        }

        for (var i = 0; i < stepDots.Length; i++)
        {
            if (stepDots[i] == null) continue;
            var filled = inHeightPhase
                ? (i == 0 && cornerBuilder.HasHeightBase) || (canConfirmHeight && i < 2)
                : i < count || ((canConfirmWidth || canCloseWidth) && i < 3);
            stepDots[i].color = filled ? DotActive : DotIdle;
            stepDots[i].rectTransform.sizeDelta = filled ? new Vector2(14f, 14f) : new Vector2(10f, 10f);
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
                        confirmLabel.color = canConfirmHeight
                            ? Color.white
                            : new Color(1f, 1f, 1f, 0.55f);
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
                            confirmLabel.text = measurementOnlyMode ? "Create a node" : "Add corners";
                        confirmLabel.color = canConfirm
                            ? Color.white
                            : new Color(1f, 1f, 1f, 0.55f);
                    }
                }

                if (confirmImage != null)
                    confirmImage.color = canConfirm ? AccentReady : new Color(0.55f, 0.56f, 0.58f, 0.85f);
            }
        }
    }

    void RefreshSpatialUi()
    {
        if (spatialMapping == null) return;

        if (bottomDock != null) bottomDock.gameObject.SetActive(true);
        if (bottomShadow != null) bottomShadow.gameObject.SetActive(true);
        if (startButton != null) startButton.gameObject.SetActive(false);
        if (finishButton != null) finishButton.gameObject.SetActive(false);
        if (heightUndoButton != null) heightUndoButton.gameObject.SetActive(false);

        var phase = spatialMapping.CurrentPhase;
        if (topHintLabel != null)
        {
            topHintLabel.text = phase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => spatialMapping.DetectsOpenings
                    ? StepTitle(3, "Look at each door & window")
                    : StepTitle(3, "Mark doors & windows"),
                ARDesignSpatialMappingController.Phase.ExistingFurniture =>
                    StepTitle(4, "Look around at your furniture"),
                _ => StepTitle(5, "Review your room, then tap Scan complete"),
            };
        }

        if (subtitleLabel != null)
        {
            subtitleLabel.text = phase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => spatialMapping.HasPendingOpeningEdge
                    ? $"Now tap the other edge of the {(spatialMapping.OpeningIsDoor ? "door" : "window")} on the same wall"
                    : spatialMapping.DetectsOpenings
                        ? $"{spatialMapping.OpeningCount} found · tap a wrong one to remove · " +
                          $"missed one? tap the floor at both edges ({(spatialMapping.OpeningIsDoor ? "door" : "window")})"
                        : $"Tap the floor at one edge of a {(spatialMapping.OpeningIsDoor ? "door" : "window")} · {spatialMapping.OpeningCount} marked",
                ARDesignSpatialMappingController.Phase.ExistingFurniture =>
                    (spatialMapping.IsFurnitureScanning ? "Scanning… · " : "") +
                    $"{spatialMapping.ObstacleCount} added · tap one to remove · tap orange to add · " +
                    $"manual: {spatialMapping.SelectedObstacleType}",
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
                    ARDesignSpatialMappingController.Phase.Openings =>
                        spatialMapping.OpeningIsDoor ? "Door" : "Window",
                    ARDesignSpatialMappingController.Phase.ExistingFurniture =>
                        spatialMapping.SelectedObstacleType,
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
                    auxSwingLabel.text = spatialMapping.IsFurnitureScanning ? "Scanning…" : "Scan";
                else if (showSwing)
                    auxSwingLabel.text = $"Swing {spatialMapping.OpeningSwing}";
            }
        }

        if (undoButton != null)
        {
            var canUndo = spatialMapping.CanUndo();
            undoButton.interactable = canUndo;
            undoLabel.text = "Undo";
            undoLabel.color = canUndo ? Ink : InkMuted;
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
            confirmLabel.color = Color.white;
            if (confirmImage != null)
                confirmImage.color = AccentReady;
        }

        for (var i = 0; i < stepDots.Length; i++)
        {
            if (stepDots[i] == null) continue;
            var filled = phase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => i <= 0,
                ARDesignSpatialMappingController.Phase.ExistingFurniture => i <= 1,
                ARDesignSpatialMappingController.Phase.ConfirmReview => i <= 2,
                _ => false,
            };
            stepDots[i].color = filled ? DotActive : DotIdle;
            stepDots[i].rectTransform.sizeDelta = filled ? new Vector2(14f, 14f) : new Vector2(10f, 10f);
        }
    }

    /// <summary>Title and detail for the floor, height and walls steps of the automatic scan.</summary>
    bool TryBuildAutoText(int liveHeightCm, out string title, out string subtitle)
    {
        title = null;
        subtitle = null;
        if (!AutoEnabled || cornerBuilder == null) return false;

        var holding = autoScan.DwellProgress > 0f;
        switch (autoScan.CurrentStep)
        {
            case ARAutoRoomScan.Step.Floor:
                title = StepTitle(1, "Point at the floor near a wall");
                subtitle = holding
                    ? "Hold still…"
                    : "It sets itself when you hold still · or tap Start";
                return true;

            case ARAutoRoomScan.Step.Height:
                title = StepTitle(1, "Aim up where the wall meets the ceiling");
                if (holding)
                    subtitle = $"H = {liveHeightCm} cm · hold still…";
                else if (liveHeightCm >= 180)
                    subtitle = $"H = {liveHeightCm} cm · hold still to lock it, or tap Finish";
                else if (liveHeightCm > 0)
                    subtitle = $"H = {liveHeightCm} cm · aim higher";
                else
                    subtitle = "Tilt the phone up toward the ceiling";
                return true;

            case ARAutoRoomScan.Step.Walls:
                if (cornerBuilder.IsOutlineSelfIntersecting)
                {
                    title = StepTitle(2, "Outline crosses itself");
                    subtitle = "Tap a wrong corner to remove it, or tap Undo";
                }
                else if (autoScan.OutlineLooksComplete)
                {
                    title = StepTitle(2, "Room outline found");
                    subtitle = $"{autoScan.CornerCount} corners · check it, then tap Close room";
                }
                else
                {
                    title = StepTitle(2, "Walk slowly along the walls");
                    if (holding)
                        subtitle = "Hold still to place the corner…";
                    else if (autoScan.HasTarget)
                        subtitle = $"{autoScan.CornerCount} corners · aim at the corner by the orange marker and hold";
                    else if (autoScan.WallCount == 0)
                        subtitle = "Point the camera at a wall from about 2 m away";
                    else
                        subtitle = $"Walls: {autoScan.WallCount} · corners: {autoScan.CornerCount} · keep going";
                }
                return true;
        }

        return false;
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

    /// <summary>Hold-still ring around what is about to set itself, and an arrow to a missing corner off screen.</summary>
    void RefreshAutoOverlay()
    {
        if (dwellRing == null || targetArrow == null) return;

        var cam = Camera.main;
        var showRing = AutoOutlineStep && autoScan.HasDwellPoint && autoScan.DwellProgress > 0.02f && cam != null;
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
        if (AutoOutlineStep && autoScan.CurrentStep == ARAutoRoomScan.Step.Walls && autoScan.HasTarget && cam != null)
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

        RefreshAutoToggle();
        RefreshLightButton();
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

        var show = lightSupported && scanController != null && IsScanning(scanController.Phase);
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

    bool TryScreenToCanvas(Vector2 screen, out Vector2 local)
    {
        local = default;
        return canvasRect != null
               && RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, screen, null, out local);
    }

    /// <summary>The Auto on/off switch shows while outlining (floor, height, walls).</summary>
    void RefreshAutoToggle()
    {
        if (autoToggleButton == null || autoScan == null) return;
        var outlining = scanController != null && IsScanning(scanController.Phase)
                        && (spatialMapping == null
                            || spatialMapping.CurrentPhase == ARDesignSpatialMappingController.Phase.Outline)
                        && cornerBuilder != null && !cornerBuilder.IsLoopClosed;
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
        ApplyReticle(scanController != null ? scanController.Phase : RoomScanController.ScanPhase.Scanning);
        RefreshCornerUi();
    }

    static bool IsScanning(RoomScanController.ScanPhase phase) =>
        phase == RoomScanController.ScanPhase.Scanning || phase == RoomScanController.ScanPhase.ReadyToConfirm;

    /// <summary>"L 4.2m × W 3.1m × H 2.5m · 2 doors/windows · 3 furniture" for the review step.</summary>
    string BuildReviewSummary()
    {
        var parts = new System.Collections.Generic.List<string>();
        if (cornerBuilder != null && cornerBuilder.CornerCount >= 3)
        {
            RoomMeasurementUtil.ComputePolygonExtents(cornerBuilder.Corners, out var width, out var depth);
            var size = RoomMeasurementUtil.FormatDimensionLabel(width, depth, cornerBuilder.WallHeight);
            if (!string.IsNullOrEmpty(size)) parts.Add(size);
        }
        parts.Add($"{spatialMapping.OpeningCount} doors/windows");
        parts.Add($"{spatialMapping.ObstacleCount} furniture");
        return string.Join(" · ", parts);
    }

    /// <summary>
    /// Whether the current step needs the camera on the floor, and whether it is.
    /// Null when the step doesn't use the floor (aiming at the ceiling, closed outline, review).
    /// </summary>
    bool? FloorAimForCurrentStep()
    {
        if (scanController == null || cornerBuilder == null || !IsScanning(scanController.Phase)) return null;
        if (spatialMapping != null && spatialMapping.CurrentPhase != ARDesignSpatialMappingController.Phase.Outline)
            return null;

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
        var show = trackingIssue || autoHelp;
        if (coachChip.gameObject.activeSelf != show)
            coachChip.gameObject.SetActive(show);
        if (!show) return;

        coachTitle.text = trackingIssue ? guidance.Title : helpTitle;
        coachDetail.text = trackingIssue ? guidance.Detail : helpDetail;
    }

    /// <summary>Rescan appears once there is something to lose, and asks for a second tap.</summary>
    void RefreshRescanButton()
    {
        if (rescanButton == null || cornerBuilder == null) return;

        var hasProgress = cornerBuilder.HasHeightBase
                          || cornerBuilder.CornerCount > 0
                          || (spatialMapping != null
                              && spatialMapping.CurrentPhase != ARDesignSpatialMappingController.Phase.Outline);
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
            return;
        }

        rescanArmedUntil = -1f;
        if (scanController == null) return;
        scanController.StartRoomScan();
        OnStatus(scanController.GetScanStatus());
        ApplyReticle(scanController.Phase);
        RefreshCornerUi();
        RefreshRescanButton();
    }

    string BuildHintText(ScanStatusPayload status)
    {
        return status.hint switch
        {
            "tapFloorHeight" => "Set the Base Point on a Wall-Floor intersection line",
            "extrudeHeight" => "Aim at the ceiling to measure height",
            "tapFirstCorner" => measurementOnlyMode
                ? "Width starts at your Finish point — tap the next corner"
                : "Tap the first floor corner",
            "tapNextCorner" => "Great job! Keep marking the corners of the room.",
            "tapThirdCorner" => "Tap a third corner",
            "tapMoreCorners" => "Keep tapping corners",
            "closeOutline" => "Tap Close room when every corner is marked",
            "outlineCrosses" => "Walls cross — undo the last corner",
            "readyToConfirm" => measurementOnlyMode
                ? "Looking good — tap Continue"
                : "Looking good — tap Done",
            "findFloor" => "Point at the floor",
            "confirmed" => "Room locked",
            _ => measurementOnlyMode ? "Outline your room" : "Outline your room",
        };
    }

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
        if (spatialMapping != null && spatialMapping.CanUndo())
        {
            spatialMapping.UndoLast();
            RefreshCornerUi();
            return;
        }

        if (cornerBuilder != null && cornerBuilder.IsInHeightPhase)
            cornerBuilder.UndoHeightBase();
        else if (cornerBuilder != null && cornerBuilder.IsLoopClosed)
        {
            cornerBuilder.ReopenLoop();
            spatialMapping?.ResetToOutline(keepSightings: true);
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

        if (spatialMapping != null
            && spatialMapping.CurrentPhase != ARDesignSpatialMappingController.Phase.Outline)
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

        // Top instruction chip (narrow enough to leave room for Rescan on the right)
        CreateShadowChip(root.transform, new Vector2(0.5f, 1f), new Vector2(0f, -124f), new Vector2(680f, 108f));
        var topPill = CreateFrostChip(root.transform, new Vector2(0.5f, 1f), new Vector2(0f, -118f), new Vector2(660f, 96f), 36);
        topHintLabel = ARDesignUiUtil.CreateText(topPill, "Outline your room", 30, FontStyle.Bold, TextAnchor.MiddleCenter);
        topHintLabel.color = Ink;
        ShrinkToFit(topHintLabel, 18);
        var hintRt = topHintLabel.rectTransform;
        hintRt.anchorMin = new Vector2(0.06f, 0.42f);
        hintRt.anchorMax = new Vector2(0.94f, 0.92f);
        hintRt.offsetMin = Vector2.zero;
        hintRt.offsetMax = Vector2.zero;

        subtitleLabel = ARDesignUiUtil.CreateText(topPill, "Walk the room · tap each floor corner", 20, FontStyle.Normal, TextAnchor.MiddleCenter);
        subtitleLabel.color = InkMuted;
        ShrinkToFit(subtitleLabel, 14);
        var subRt = subtitleLabel.rectTransform;
        subRt.anchorMin = new Vector2(0.08f, 0.08f);
        subRt.anchorMax = new Vector2(0.92f, 0.48f);
        subRt.offsetMin = Vector2.zero;
        subRt.offsetMax = Vector2.zero;

        // Coaching chip under the instruction ("Move slowly", "Point at the floor", …)
        coachChip = CreateFrostChip(root.transform, new Vector2(0.5f, 1f), new Vector2(0f, -222f), new Vector2(660f, 84f), 30);
        var coachImage = coachChip.GetComponent<Image>();
        if (coachImage != null)
        {
            coachImage.color = CoachBg;
            coachImage.raycastTarget = false;
        }
        coachTitle = ARDesignUiUtil.CreateText(coachChip, string.Empty, 24, FontStyle.Bold, TextAnchor.MiddleCenter);
        coachTitle.color = CoachInk;
        coachTitle.raycastTarget = false;
        ShrinkToFit(coachTitle, 18);
        var coachTitleRt = coachTitle.rectTransform;
        coachTitleRt.anchorMin = new Vector2(0.05f, 0.48f);
        coachTitleRt.anchorMax = new Vector2(0.95f, 0.94f);
        coachTitleRt.offsetMin = Vector2.zero;
        coachTitleRt.offsetMax = Vector2.zero;
        coachDetail = ARDesignUiUtil.CreateText(coachChip, string.Empty, 18, FontStyle.Normal, TextAnchor.MiddleCenter);
        coachDetail.color = CoachInk;
        coachDetail.raycastTarget = false;
        ShrinkToFit(coachDetail, 13);
        var coachDetailRt = coachDetail.rectTransform;
        coachDetailRt.anchorMin = new Vector2(0.05f, 0.08f);
        coachDetailRt.anchorMax = new Vector2(0.95f, 0.50f);
        coachDetailRt.offsetMin = Vector2.zero;
        coachDetailRt.offsetMax = Vector2.zero;
        coachChip.gameObject.SetActive(false);

        // Rescan, top-right beside the instruction pill (the app's back button sits top-left).
        var rescanHolder = new GameObject("RescanHolder", typeof(RectTransform));
        rescanHolder.transform.SetParent(root.transform, false);
        var rescanRt = (RectTransform)rescanHolder.transform;
        rescanRt.anchorMin = new Vector2(1f, 1f);
        rescanRt.anchorMax = new Vector2(1f, 1f);
        rescanRt.pivot = new Vector2(0.5f, 0.5f);
        rescanRt.anchoredPosition = new Vector2(-100f, -118f);
        rescanRt.sizeDelta = new Vector2(160f, 80f);
        rescanButton = CreatePillButton(
            rescanHolder.transform,
            "Rescan",
            Vector2.zero,
            Vector2.one,
            Frost,
            Ink,
            OnRescanClicked,
            out rescanImage,
            out rescanLabel);
        rescanLabel.fontSize = 24;
        rescanButton.gameObject.SetActive(false);

        if (autoScan != null)
            BuildAutoUi(root.transform);
        BuildLightButton(root.transform, autoScan != null ? -298f : -208f);

        startButton = CreateCenterActionButton(
            root.transform,
            "Start",
            new Vector2(0.5f, 0f),
            new Vector2(0f, 160f),
            156f,
            MeasurePurple,
            OnStartClicked,
            out startImage,
            out startLabel);
        startButton.gameObject.SetActive(false);

        finishButton = CreateCenterActionButton(
            root.transform,
            "Finish",
            new Vector2(0.5f, 0f),
            new Vector2(0f, 160f),
            156f,
            MeasurePurple,
            OnFinishClicked,
            out finishImage,
            out finishLabel);
        finishButton.gameObject.SetActive(false);

        // Undo beside Finish, so a misplaced base point can be set again.
        heightUndoButton = CreateCenterActionButton(
            root.transform,
            "Undo",
            new Vector2(0.5f, 0f),
            new Vector2(-220f, 160f),
            112f,
            Frost,
            OnUndoClicked,
            out heightUndoImage,
            out heightUndoLabel);
        heightUndoLabel.color = Ink;
        heightUndoButton.gameObject.SetActive(false);

        // Bottom dock (hidden during Start / Finish height phase)
        bottomShadow = CreateShadowChip(root.transform, new Vector2(0.5f, 0f), new Vector2(0f, 162f), new Vector2(760f, 200f));
        var bottom = CreateFrostChip(root.transform, new Vector2(0.5f, 0f), new Vector2(0f, 168f), new Vector2(740f, 180f), 40);
        bottomDock = bottom;
        // Start/Finish phase is the default first screen in measurement — keep dock/shadow off until width.
        bottomShadow.gameObject.SetActive(false);
        bottom.gameObject.SetActive(false);

        // Step dots
        var dotsRow = new GameObject("Steps", typeof(RectTransform), typeof(HorizontalLayoutGroup));
        dotsRow.transform.SetParent(bottom, false);
        var dotsRt = dotsRow.GetComponent<RectTransform>();
        dotsRt.anchorMin = new Vector2(0.5f, 0.72f);
        dotsRt.anchorMax = new Vector2(0.5f, 0.72f);
        dotsRt.pivot = new Vector2(0.5f, 0.5f);
        dotsRt.sizeDelta = new Vector2(160f, 20f);
        var layout = dotsRow.GetComponent<HorizontalLayoutGroup>();
        layout.childAlignment = TextAnchor.MiddleCenter;
        layout.spacing = 12f;
        layout.childForceExpandWidth = false;
        layout.childForceExpandHeight = false;
        layout.childControlWidth = false;
        layout.childControlHeight = false;

        stepDots = new Image[4];
        for (var i = 0; i < 4; i++)
        {
            var dot = ARDesignUiUtil.CreateRoundedImage(dotsRow.transform, DotIdle, 64);
            dot.raycastTarget = false;
            var dRt = dot.rectTransform;
            dRt.sizeDelta = new Vector2(10f, 10f);
            stepDots[i] = dot;
        }

        auxTypeButton = CreatePillButton(
            bottom,
            "Door",
            new Vector2(0.05f, 0.60f),
            new Vector2(0.48f, 0.88f),
            FrostSoft,
            Ink,
            OnAuxTypeClicked,
            out auxTypeImage,
            out auxTypeLabel);
        auxTypeButton.gameObject.SetActive(false);

        auxSwingButton = CreatePillButton(
            bottom,
            "Swing",
            new Vector2(0.52f, 0.60f),
            new Vector2(0.95f, 0.88f),
            FrostSoft,
            Ink,
            OnAuxSwingClicked,
            out auxSwingImage,
            out auxSwingLabel);
        auxSwingButton.gameObject.SetActive(false);

        undoButton = CreatePillButton(
            bottom,
            "Undo",
            new Vector2(0.05f, 0.14f),
            new Vector2(0.30f, 0.52f),
            Frost,
            Ink,
            OnUndoClicked,
            out undoImage,
            out undoLabel);

        confirmButton = CreatePillButton(
            bottom,
            "Add corners",
            new Vector2(0.32f, 0.14f),
            new Vector2(0.95f, 0.52f),
            new Color(0.55f, 0.56f, 0.58f, 0.85f),
            Color.white,
            OnConfirmClicked,
            out confirmImage,
            out confirmLabel);
    }

    /// <summary>Auto on/off switch under Rescan, the hold-still ring, and the arrow to a missing corner.</summary>
    void BuildAutoUi(Transform root)
    {
        var toggleHolder = new GameObject("AutoToggleHolder", typeof(RectTransform));
        toggleHolder.transform.SetParent(root, false);
        var toggleRt = (RectTransform)toggleHolder.transform;
        toggleRt.anchorMin = new Vector2(1f, 1f);
        toggleRt.anchorMax = new Vector2(1f, 1f);
        toggleRt.pivot = new Vector2(0.5f, 0.5f);
        toggleRt.anchoredPosition = new Vector2(-100f, -208f);
        toggleRt.sizeDelta = new Vector2(160f, 72f);
        autoToggleButton = CreatePillButton(
            toggleHolder.transform,
            "Auto: On",
            Vector2.zero,
            Vector2.one,
            AccentReady,
            Color.white,
            OnAutoToggleClicked,
            out autoToggleImage,
            out autoToggleLabel);
        autoToggleLabel.fontSize = 22;
        autoToggleButton.gameObject.SetActive(false);

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
        var iconRt = arrowIcon.rectTransform;
        iconRt.anchorMin = new Vector2(0.22f, 0.22f);
        iconRt.anchorMax = new Vector2(0.78f, 0.78f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;
        targetArrow.gameObject.SetActive(false);
    }

    void BuildLightButton(Transform root, float y)
    {
        var holder = new GameObject("LightHolder", typeof(RectTransform));
        holder.transform.SetParent(root, false);
        var rt = (RectTransform)holder.transform;
        rt.anchorMin = new Vector2(1f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = new Vector2(-100f, y);
        rt.sizeDelta = new Vector2(160f, 72f);
        lightButton = CreatePillButton(
            holder.transform,
            "Light: Off",
            Vector2.zero,
            Vector2.one,
            Frost,
            Ink,
            OnLightClicked,
            out lightImage,
            out lightLabel);
        lightLabel.fontSize = 22;
        lightButton.gameObject.SetActive(false);
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

    static RectTransform CreateShadowChip(Transform parent, Vector2 anchor, Vector2 anchoredPos, Vector2 size)
    {
        var shadow = ARDesignUiUtil.CreateRoundedImage(parent, new Color(0f, 0f, 0f, 0.18f), 40);
        shadow.raycastTarget = false;
        var rt = shadow.rectTransform;
        rt.anchorMin = anchor;
        rt.anchorMax = anchor;
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = anchoredPos + new Vector2(0f, -6f);
        rt.sizeDelta = size;
        return rt;
    }

    static RectTransform CreateFrostChip(Transform parent, Vector2 anchor, Vector2 anchoredPos, Vector2 size, int radius)
    {
        var chip = ARDesignUiUtil.CreateRoundedImage(parent, Frost, radius);
        var rt = chip.rectTransform;
        rt.anchorMin = anchor;
        rt.anchorMax = anchor;
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = anchoredPos;
        rt.sizeDelta = size;
        return rt;
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
