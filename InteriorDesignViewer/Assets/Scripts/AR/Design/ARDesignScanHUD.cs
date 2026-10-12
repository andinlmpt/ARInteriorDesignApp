using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Corner-to-corner scan chrome — ARPlan-inspired frosted pills, step dots, rounded controls,
/// live coaching ("Move slowly", "Point at the floor"), Rescan, and a final "Scan complete".
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
    ARScanGuidance guidance;
    bool active;

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
    }

    void OnDisable()
    {
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
        // Live height / width readouts change every frame while aiming.
        if (cornerBuilder.IsInHeightPhase || cornerBuilder.CornerCount > 0)
            RefreshCornerUi();
        RefreshCoaching();
        RefreshRescanButton();
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(phase != RoomScanController.ScanPhase.Confirmed);
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

            if (measurementOnlyMode && cornerBuilder.IsHeightLocked)
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

        if (auxTypeButton != null)
            auxTypeButton.gameObject.SetActive(false);

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
            topHintLabel.text = BuildHintText(scanController.GetScanStatus());

        if (subtitleLabel != null)
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
            var canUndo = inHeightPhase ? cornerBuilder.HasHeightBase : count > 0;
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
                ARDesignSpatialMappingController.Phase.Openings =>
                    "Mark doors & windows",
                ARDesignSpatialMappingController.Phase.ExistingFurniture =>
                    "Mark existing furniture",
                _ => "Review your room, then tap Scan complete",
            };
        }

        if (subtitleLabel != null)
        {
            subtitleLabel.text = phase switch
            {
                ARDesignSpatialMappingController.Phase.Openings => spatialMapping.HasPendingOpeningEdge
                    ? $"Now tap the other edge of the {(spatialMapping.OpeningIsDoor ? "door" : "window")} on the same wall"
                    : $"Tap the floor at one edge of a {(spatialMapping.OpeningIsDoor ? "door" : "window")} · {spatialMapping.OpeningCount} marked",
                ARDesignSpatialMappingController.Phase.ExistingFurniture =>
                    (spatialMapping.IsFurnitureScanning ? "Scanning furniture… · " : "") +
                    $"{spatialMapping.PendingSuggestionCount} auto · tap orange to add · " +
                    $"{spatialMapping.ObstacleCount} saved · manual: {spatialMapping.SelectedObstacleType}",
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
        return cornerBuilder.CornerCount > 0 ? cornerBuilder.IsAimOnFloor : indicatorOnFloor;
    }

    void RefreshCoaching()
    {
        if (coachChip == null || guidance == null) return;

        guidance.FloorAim = FloorAimForCurrentStep();
        var show = guidance.isActiveAndEnabled && guidance.Current != ARScanGuidance.Issue.None;
        if (coachChip.gameObject.activeSelf != show)
            coachChip.gameObject.SetActive(show);
        if (!show) return;

        coachTitle.text = guidance.Title;
        coachDetail.text = guidance.Detail;
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
            spatialMapping?.ResetToOutline();
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
