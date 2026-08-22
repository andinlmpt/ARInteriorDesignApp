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
    [SerializeField] private bool enableNativeHud = true;

    static readonly Color Ink = new(0.10f, 0.10f, 0.12f, 1f);
    static readonly Color InkMuted = new(0.35f, 0.36f, 0.40f, 1f);
    static readonly Color Frost = new(1f, 1f, 1f, 0.94f);
    static readonly Color FrostSoft = new(1f, 1f, 1f, 0.82f);
    static readonly Color Accent = new(0.12f, 0.12f, 0.14f, 1f);
    static readonly Color AccentReady = new(0.18f, 0.55f, 0.42f, 1f);
    static readonly Color DotIdle = new(0.78f, 0.79f, 0.82f, 1f);
    static readonly Color DotActive = new(0.12f, 0.12f, 0.14f, 1f);

    Canvas canvas;
    Text topHintLabel;
    Text subtitleLabel;
    Button confirmButton;
    Button undoButton;
    Text confirmLabel;
    Text undoLabel;
    Image confirmImage;
    Image undoImage;
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
            cornerBuilder.CornersChanged += OnCornersChanged;
    }

    void OnDisable()
    {
        if (scanController == null) return;
        scanController.StatusChanged -= OnStatus;
        scanController.PhaseChanged -= OnPhase;
        if (cornerBuilder != null)
            cornerBuilder.CornersChanged -= OnCornersChanged;
    }

    void Start()
    {
        if (!active || scanController == null) return;
        OnStatus(scanController.GetScanStatus());
        ApplyReticle(scanController.Phase);
        RefreshCornerUi();
    }

    void OnCornersChanged() => RefreshCornerUi();

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

        if (phase == RoomScanController.ScanPhase.Scanning
            || phase == RoomScanController.ScanPhase.ReadyToConfirm)
            placementIndicator.StartTracking();
        else
            placementIndicator.StopTracking();
    }

    void OnStatus(ScanStatusPayload status)
    {
        if (!active || status == null) return;

        if (topHintLabel != null)
            topHintLabel.text = HintText(status);

        RefreshCornerUi();
    }

    void RefreshCornerUi()
    {
        var count = cornerBuilder != null ? cornerBuilder.CornerCount : 0;
        var canConfirm = cornerBuilder != null && cornerBuilder.CanConfirm;

        if (subtitleLabel != null)
        {
            subtitleLabel.text = count == 0
                ? "Walk the room · tap each floor corner"
                : canConfirm
                    ? $"{count} corners · ready to lock"
                    : $"{count} corners · keep outlining";
        }

        for (var i = 0; i < stepDots.Length; i++)
        {
            if (stepDots[i] == null) continue;
            var filled = i < count || (canConfirm && i < 3);
            stepDots[i].color = filled ? DotActive : DotIdle;
            stepDots[i].rectTransform.sizeDelta = filled ? new Vector2(14f, 14f) : new Vector2(10f, 10f);
        }

        if (undoButton != null)
        {
            undoButton.interactable = count > 0;
            if (undoImage != null)
                undoImage.color = count > 0 ? Frost : FrostSoft;
            if (undoLabel != null)
                undoLabel.color = count > 0 ? Ink : InkMuted;
        }

        if (confirmButton != null)
        {
            confirmButton.interactable = canConfirm;
            if (confirmLabel != null)
            {
                confirmLabel.text = canConfirm ? "Done" : "Add corners";
                confirmLabel.color = canConfirm ? Color.white : new Color(1f, 1f, 1f, 0.55f);
            }

            if (confirmImage != null)
                confirmImage.color = canConfirm ? AccentReady : new Color(0.55f, 0.56f, 0.58f, 0.85f);
        }
    }

    static string HintText(ScanStatusPayload status)
    {
        return status.hint switch
        {
            "tapFirstCorner" => "Tap the first floor corner",
            "tapNextCorner" => "Tap the next corner",
            "tapThirdCorner" => "Tap a third corner",
            "tapMoreCorners" => "Keep tapping corners",
            "readyToConfirm" => "Looking good — tap Done",
            "findFloor" => "Point at the floor",
            "confirmed" => "Room locked",
            _ => "Outline your room",
        };
    }

    void OnUndoClicked()
    {
        cornerBuilder?.UndoLastCorner();
        RefreshCornerUi();
    }

    void OnConfirmClicked()
    {
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

        placementIndicator?.StopTracking();

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

        // Bottom dock
        CreateShadowChip(root.transform, new Vector2(0.5f, 0f), new Vector2(0f, 162f), new Vector2(760f, 200f));
        var bottom = CreateFrostChip(root.transform, new Vector2(0.5f, 0f), new Vector2(0f, 168f), new Vector2(740f, 180f), 40);

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
