using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Corner-to-corner scan chrome — ARPlan-inspired frosted pills, step dots, rounded controls.
/// </summary>
[DefaultExecutionOrder(-90)]
public class ARDesignScanHUD : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARSceneBridge bridge;
    [SerializeField] private FurnitureCatalog catalog;
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private ARDesignCornerRoomBuilder cornerBuilder;
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

    Canvas canvas;
    Text topHintLabel;
    Text subtitleLabel;
    RectTransform bottomDock;
    RectTransform bottomShadow;
    Button confirmButton;
    Button undoButton;
    Button startButton;
    Button finishButton;
    Text confirmLabel;
    Text undoLabel;
    Text startLabel;
    Text finishLabel;
    Image confirmImage;
    Image undoImage;
    Image startImage;
    Image finishImage;
    Image[] stepDots = System.Array.Empty<Image>();
    bool active;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (bridge == null) bridge = FindFirstObjectByType<ARSceneBridge>();
        if (catalog == null) catalog = FindFirstObjectByType<FurnitureCatalog>();
        if (placementIndicator == null) placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();
        if (cornerBuilder == null) cornerBuilder = FindFirstObjectByType<ARDesignCornerRoomBuilder>();

        active = enableNativeHud && !ARDesignHostDetect.IsEmbeddedInReactNative();
        if (!active)
        {
            Debug.Log("[ARDesignScanHUD] Native HUD disabled (React Native host or flag off).");
            enabled = false;
            return;
        }

        if (measurementOnlyMode)
            ARMainMenuBackButton.EnsureOn(gameObject);

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
    }

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
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(phase != RoomScanController.ScanPhase.Confirmed);

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
        var inHeightPhase = cornerBuilder != null && cornerBuilder.IsInHeightPhase;
        var count = cornerBuilder != null ? cornerBuilder.CornerCount : 0;
        var canConfirmHeight = cornerBuilder != null && cornerBuilder.CanConfirmHeight;
        var canConfirmWidth = cornerBuilder != null && cornerBuilder.CanConfirm;
        var canConfirm = inHeightPhase ? canConfirmHeight : canConfirmWidth;
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
            else if (liveWidthCm > 0)
            {
                subtitleLabel.text = canConfirmWidth
                    ? $"{count} corners · live {liveWidthCm} cm · ready to lock"
                    : $"{count} corners · live {liveWidthCm} cm";
            }
            else
            {
                subtitleLabel.text = canConfirmWidth
                    ? $"{count} corners · ready to lock"
                    : $"{count} corners · keep outlining";
            }
        }

        for (var i = 0; i < stepDots.Length; i++)
        {
            if (stepDots[i] == null) continue;
            var filled = inHeightPhase
                ? (i == 0 && cornerBuilder.HasHeightBase) || (canConfirmHeight && i < 2)
                : i < count || (canConfirmWidth && i < 3);
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
                undoLabel.color = canUndo ? Ink : InkMuted;
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
                        confirmLabel.text = canConfirmWidth
                            ? (measurementOnlyMode ? "Generate Layout" : "Done")
                            : (measurementOnlyMode ? "Create a node" : "Add corners");
                        confirmLabel.color = canConfirmWidth
                            ? Color.white
                            : new Color(1f, 1f, 1f, 0.55f);
                    }
                }

                if (confirmImage != null)
                    confirmImage.color = canConfirm ? AccentReady : new Color(0.55f, 0.56f, 0.58f, 0.85f);
            }
        }
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
            "readyToConfirm" => measurementOnlyMode
                ? "Looking good — tap Generate Layout"
                : "Looking good — tap Done",
            "findFloor" => "Point at the floor",
            "confirmed" => "Room locked",
            _ => measurementOnlyMode ? "Outline your room" : "Outline your room",
        };
    }

    void OnUndoClicked()
    {
        if (cornerBuilder != null && cornerBuilder.IsInHeightPhase)
            cornerBuilder.UndoHeightBase();
        else
            cornerBuilder?.UndoLastCorner();
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

        if (cornerBuilder != null && !cornerBuilder.CanConfirm)
            return;

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

        // Top instruction chip
        CreateShadowChip(root.transform, new Vector2(0.5f, 1f), new Vector2(0f, -124f), new Vector2(720f, 108f));
        var topPill = CreateFrostChip(root.transform, new Vector2(0.5f, 1f), new Vector2(0f, -118f), new Vector2(700f, 96f), 36);
        topHintLabel = ARDesignUiUtil.CreateText(topPill, "Outline your room", 30, FontStyle.Bold, TextAnchor.MiddleCenter);
        topHintLabel.color = Ink;
        var hintRt = topHintLabel.rectTransform;
        hintRt.anchorMin = new Vector2(0.06f, 0.42f);
        hintRt.anchorMax = new Vector2(0.94f, 0.92f);
        hintRt.offsetMin = Vector2.zero;
        hintRt.offsetMax = Vector2.zero;

        subtitleLabel = ARDesignUiUtil.CreateText(topPill, "Walk the room · tap each floor corner", 20, FontStyle.Normal, TextAnchor.MiddleCenter);
        subtitleLabel.color = InkMuted;
        var subRt = subtitleLabel.rectTransform;
        subRt.anchorMin = new Vector2(0.08f, 0.08f);
        subRt.anchorMax = new Vector2(0.92f, 0.48f);
        subRt.offsetMin = Vector2.zero;
        subRt.offsetMax = Vector2.zero;

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

        undoButton = CreatePillButton(
            bottom,
            "Undo",
            new Vector2(0.05f, 0.14f),
            new Vector2(0.36f, 0.58f),
            Frost,
            Ink,
            OnUndoClicked,
            out undoImage,
            out undoLabel);

        confirmButton = CreatePillButton(
            bottom,
            "Add corners",
            new Vector2(0.40f, 0.14f),
            new Vector2(0.95f, 0.58f),
            new Color(0.55f, 0.56f, 0.58f, 0.85f),
            Color.white,
            OnConfirmClicked,
            out confirmImage,
            out confirmLabel);
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
