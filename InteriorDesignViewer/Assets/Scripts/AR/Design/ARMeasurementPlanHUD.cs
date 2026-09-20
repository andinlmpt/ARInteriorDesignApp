using System;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

/// <summary>
/// Post-measurement layout viewer for the standalone AR Measurement scene.
/// Shows 2D / 3D toggles, dimension readouts, overflow Export 3D, and back-to-menu.
/// </summary>
[DefaultExecutionOrder(-70)]
public class ARMeasurementPlanHUD : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private ARDesignLayoutModeController layoutMode;
    [SerializeField] private RoomExportManager exportManager;
    [SerializeField] private string mainMenuSceneName = "MainMenu";
    [SerializeField] private bool enableNativeHud = true;
    [SerializeField] private float topSafePadding = 56f;

    static readonly Color Ink = new(0.10f, 0.10f, 0.12f, 1f);
    static readonly Color InkMuted = new(0.40f, 0.42f, 0.46f, 1f);
    static readonly Color Frost = new(1f, 1f, 1f, 0.96f);
    // Navy (#0C295F) — replaces the previous purple accent.
    static readonly Color Navy = new(12f / 255f, 41f / 255f, 95f / 255f, 1f);
    static readonly Color InkOnNavy = new(1f, 1f, 1f, 0.96f);
    static readonly Color MenuShadow = new(0f, 0f, 0f, 0.12f);

    Canvas canvas;
    RectTransform topBarRt;
    RectTransform statsRt;
    GameObject overflowMenu;
    Text titleLabel;
    Text widthLabel;
    Text depthLabel;
    Text heightLabel;
    Text areaLabel;
    Text view2dLabel;
    Text view3dLabel;
    Button view2dButton;
    Button view3dButton;
    Image view2dImage;
    Image view3dImage;
    bool active;
    bool showingTopDown = true;
    bool roomReady;

    public event Action LayoutViewOpened;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (layoutMode == null) layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();
        EnsureExportManager();

        active = enableNativeHud;
        if (!active)
        {
            enabled = false;
            return;
        }

        BuildUi();
        SetVisible(false);
    }

    void EnsureExportManager()
    {
        if (exportManager == null)
            exportManager = FindFirstObjectByType<RoomExportManager>();

        if (exportManager != null) return;

        var managers = GameObject.Find("Managers");
        if (managers == null) return;
        exportManager = managers.AddComponent<RoomExportManager>();
    }

    void OnEnable()
    {
        if (!active) return;
        RoomMeasurementSaveModal.RoomNameCommitted += OnRoomNameCommitted;
        if (scanController != null)
            scanController.PhaseChanged += OnPhaseChanged;
    }

    void OnDisable()
    {
        RoomMeasurementSaveModal.RoomNameCommitted -= OnRoomNameCommitted;
        if (scanController != null)
            scanController.PhaseChanged -= OnPhaseChanged;
    }

    void LateUpdate()
    {
        if (!active || canvas == null || !canvas.gameObject.activeInHierarchy) return;
        ApplySafeAreaLayout();
    }

    void OnPhaseChanged(RoomScanController.ScanPhase phase)
    {
        if (phase != RoomScanController.ScanPhase.Confirmed)
        {
            roomReady = false;
            SetOverflowMenuVisible(false);
            SetVisible(false);
        }
    }

    void OnRoomNameCommitted()
    {
        if (scanController == null || !scanController.IsConfirmed)
            return;

        roomReady = true;
        RefreshLabels();
        ApplyViewPreset(showingTopDown);
        SetVisible(true);
        LayoutViewOpened?.Invoke();
    }

    void RefreshLabels()
    {
        if (scanController == null) return;

        var room = scanController.ConfirmedRoom;
        var wallHeight = scanController.CornerBuilder != null
            ? scanController.CornerBuilder.WallHeight
            : 0f;
        var dims = RoomMeasurementUtil.Compute(
            room,
            scanController.FloorPolygon,
            wallHeight,
            scanController.GetScanStatus().horizontalAreaSqm);

        var title = string.IsNullOrWhiteSpace(ARMeasurementSession.RoomName)
            ? "Untitled room"
            : ARMeasurementSession.RoomName;
        if (titleLabel != null)
            titleLabel.text = title;

        if (widthLabel != null)
            widthLabel.text = $"W = {FormatCm(dims.width)}";
        if (depthLabel != null)
            depthLabel.text = $"L = {FormatCm(dims.depth)}";
        if (heightLabel != null)
            heightLabel.text = $"H = {FormatCm(dims.height)}";
        if (areaLabel != null)
        {
            areaLabel.text = dims.floorAreaSqm > 0.01f
                ? $"{dims.floorAreaSqm * 10000f:0.##} · 10² cm²"
                : string.Empty;
        }
    }

    static string FormatCm(float metres) => $"{Mathf.RoundToInt(Mathf.Max(0f, metres) * 100f)} cm";

    void ApplyViewPreset(bool topDown)
    {
        showingTopDown = topDown;
        layoutMode?.ApplyMeasurementViewPreset(topDown);
        RefreshToggleStyles();
    }

    void RefreshToggleStyles()
    {
        if (view2dImage != null)
            view2dImage.color = showingTopDown ? Navy : Frost;
        if (view3dImage != null)
            view3dImage.color = showingTopDown ? Frost : Navy;
        if (view2dLabel != null)
            view2dLabel.color = showingTopDown ? InkOnNavy : Ink;
        if (view3dLabel != null)
            view3dLabel.color = showingTopDown ? Ink : InkOnNavy;
    }

    void OnBackClicked()
    {
        ARMeasurementSession.Reset();

        if (ARDesignHostDetect.IsEmbeddedInReactNative())
        {
            var measurementBridge = UnityEngine.Object.FindFirstObjectByType<ARMeasurementRnBridge>();
            if (measurementBridge != null)
            {
                measurementBridge.RequestClose();
                return;
            }

            UnityMessageBridge.SendToApp("requestClose", "ARRoomMeasurement");
            return;
        }

        if (!string.IsNullOrWhiteSpace(mainMenuSceneName))
            SceneManager.LoadScene(mainMenuSceneName);
    }

    void OnOverflowToggleClicked()
    {
        SetOverflowMenuVisible(overflowMenu == null || !overflowMenu.activeSelf);
    }

    void SetOverflowMenuVisible(bool visible)
    {
        if (overflowMenu != null)
            overflowMenu.SetActive(visible);
    }

    void OnExport3dClicked()
    {
        SetOverflowMenuVisible(false);
        EnsureExportManager();
        if (exportManager == null)
        {
            Debug.LogWarning("[ARMeasurementPlanHUD] RoomExportManager missing.");
            return;
        }

        if (exportManager.IsExporting) return;
        exportManager.ExportLayout();
    }

    void SetVisible(bool visible)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(visible);

        // Plan HUD has its own Back — hide the global floating back to avoid duplicates.
        ARMainMenuBackButton.SetUiVisible(!visible);

        if (!visible)
            SetOverflowMenuVisible(false);

        if (visible)
            ApplySafeAreaLayout();

        if (ARDesignHostDetect.IsEmbeddedInReactNative())
            UnityMessageBridge.SendToApp(visible ? "measurementPlanReady" : "measurementPlanClosed", "");
    }

    float ResolveTopSafeInset()
    {
        // Screen.safeArea.yMax is the top of the safe rect in screen pixels.
        var unsafeTopPx = Mathf.Max(0f, Screen.height - Screen.safeArea.yMax);
        var canvasTop = Screen.height > 0
            ? unsafeTopPx * (1920f / Screen.height)
            : 0f;
        return Mathf.Max(topSafePadding, canvasTop + 24f);
    }

    void ApplySafeAreaLayout()
    {
        var topInset = ResolveTopSafeInset();

        if (topBarRt != null)
            topBarRt.anchoredPosition = new Vector2(0f, -topInset);

        if (statsRt != null)
            statsRt.anchoredPosition = new Vector2(24f, -(topInset + 108f));
    }

    void BuildUi()
    {
        ARDesignUiUtil.EnsureEventSystem();

        var root = new GameObject("ARMeasurementPlanHUD");
        root.transform.SetParent(transform, false);

        canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 900;
        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.5f;
        root.AddComponent<GraphicRaycaster>();

        // Full-width top bar (back + title + 2D/3D + ⋮), cleared below status bar.
        var topBar = CreateFrostChip(
            root.transform,
            new Vector2(0.5f, 1f),
            new Vector2(0f, -72f),
            new Vector2(0f, 96f),
            stretchWidth: true);
        topBarRt = topBar;

        // Standalone builds keep a Unity back control; RN embeds use the RN back button.
        if (!ARDesignHostDetect.IsEmbeddedInReactNative())
            CreateCircleBackButton(topBar, OnBackClicked);

        titleLabel = ARDesignUiUtil.CreateText(topBar, "Untitled room", 28, FontStyle.Bold, TextAnchor.MiddleCenter);
        titleLabel.color = Ink;
        titleLabel.raycastTarget = false;
        var titleRt = titleLabel.rectTransform;
        titleRt.anchorMin = new Vector2(0.18f, 0.1f);
        titleRt.anchorMax = new Vector2(0.52f, 0.9f);
        titleRt.offsetMin = Vector2.zero;
        titleRt.offsetMax = Vector2.zero;

        // Segmented 2D / 3D control — left of the overflow ⋮ button
        var toggleHost = new GameObject("ViewToggle", typeof(RectTransform), typeof(Image));
        toggleHost.transform.SetParent(topBar, false);
        var toggleBg = toggleHost.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(toggleBg, 18);
        toggleBg.color = new Color(0.93f, 0.93f, 0.95f, 1f);
        var toggleRt = toggleHost.GetComponent<RectTransform>();
        toggleRt.anchorMin = new Vector2(1f, 0.5f);
        toggleRt.anchorMax = new Vector2(1f, 0.5f);
        toggleRt.pivot = new Vector2(1f, 0.5f);
        toggleRt.anchoredPosition = new Vector2(-92f, 0f);
        toggleRt.sizeDelta = new Vector2(200f, 64f);

        view2dButton = CreateToggleButton(
            toggleHost.transform,
            "2D",
            new Vector2(0.26f, 0.5f),
            new Vector2(92f, 52f),
            () => ApplyViewPreset(true),
            out view2dImage,
            out view2dLabel);
        view3dButton = CreateToggleButton(
            toggleHost.transform,
            "3D",
            new Vector2(0.74f, 0.5f),
            new Vector2(92f, 52f),
            () => ApplyViewPreset(false),
            out view3dImage,
            out view3dLabel);
        RefreshToggleStyles();

        // RN owns Export when embedded (Unity Input / share sheet are awkward in UaaL).
        if (!ARDesignHostDetect.IsEmbeddedInReactNative())
            CreateOverflowMenu(root.transform, topBar);
        else
            toggleRt.anchoredPosition = new Vector2(-16f, 0f);

        // Dimension card (top-left), matching the reference layout.
        var stats = CreateFrostChip(
            root.transform,
            new Vector2(0f, 1f),
            new Vector2(24f, -180f),
            new Vector2(280f, 150f),
            stretchWidth: false);
        statsRt = stats;

        widthLabel = ARDesignUiUtil.CreateText(stats, "—", 24, FontStyle.Bold, TextAnchor.MiddleLeft);
        widthLabel.color = Ink;
        widthLabel.raycastTarget = false;
        PlaceLabel(widthLabel.rectTransform, 0.72f, 0.96f);

        depthLabel = ARDesignUiUtil.CreateText(stats, "—", 24, FontStyle.Bold, TextAnchor.MiddleLeft);
        depthLabel.color = Ink;
        depthLabel.raycastTarget = false;
        PlaceLabel(depthLabel.rectTransform, 0.42f, 0.72f);

        heightLabel = ARDesignUiUtil.CreateText(stats, "—", 22, FontStyle.Normal, TextAnchor.MiddleLeft);
        heightLabel.color = InkMuted;
        heightLabel.raycastTarget = false;
        PlaceLabel(heightLabel.rectTransform, 0.12f, 0.42f);

        areaLabel = ARDesignUiUtil.CreateText(root.transform, "", 18, FontStyle.Normal, TextAnchor.MiddleCenter);
        areaLabel.color = InkMuted;
        areaLabel.raycastTarget = false;
        var areaRt = areaLabel.rectTransform;
        areaRt.anchorMin = new Vector2(0.5f, 0.5f);
        areaRt.anchorMax = new Vector2(0.5f, 0.5f);
        areaRt.pivot = new Vector2(0.5f, 0.5f);
        areaRt.sizeDelta = new Vector2(640f, 40f);
        areaRt.anchoredPosition = new Vector2(0f, -36f);

        ApplySafeAreaLayout();
    }

    void CreateOverflowMenu(Transform canvasRoot, Transform topBar)
    {
        // ⋮ button — far right of the top bar
        var moreGo = new GameObject("More", typeof(RectTransform), typeof(Image), typeof(Button));
        moreGo.transform.SetParent(topBar, false);
        var moreBg = moreGo.GetComponent<Image>();
        moreBg.color = Color.clear;
        moreBg.raycastTarget = true;
        var moreBtn = moreGo.GetComponent<Button>();
        moreBtn.targetGraphic = moreBg;
        moreBtn.transition = Selectable.Transition.None;
        moreBtn.onClick.AddListener(OnOverflowToggleClicked);
        var moreRt = moreGo.GetComponent<RectTransform>();
        moreRt.anchorMin = new Vector2(1f, 0.5f);
        moreRt.anchorMax = new Vector2(1f, 0.5f);
        moreRt.pivot = new Vector2(1f, 0.5f);
        moreRt.anchoredPosition = new Vector2(-12f, 0f);
        moreRt.sizeDelta = new Vector2(64f, 64f);

        var dots = ARDesignUiUtil.CreateText(moreGo.transform, "⋮", 36, FontStyle.Bold, TextAnchor.MiddleCenter);
        dots.color = Ink;
        dots.raycastTarget = false;
        var dotsRt = dots.rectTransform;
        dotsRt.anchorMin = Vector2.zero;
        dotsRt.anchorMax = Vector2.one;
        dotsRt.offsetMin = Vector2.zero;
        dotsRt.offsetMax = Vector2.zero;

        // Full-screen dismiss + dropdown panel
        overflowMenu = new GameObject("OverflowMenu", typeof(RectTransform));
        overflowMenu.transform.SetParent(canvasRoot, false);
        var menuRootRt = overflowMenu.GetComponent<RectTransform>();
        menuRootRt.anchorMin = Vector2.zero;
        menuRootRt.anchorMax = Vector2.one;
        menuRootRt.offsetMin = Vector2.zero;
        menuRootRt.offsetMax = Vector2.zero;

        var dismissGo = new GameObject("Dismiss", typeof(RectTransform), typeof(Image), typeof(Button));
        dismissGo.transform.SetParent(overflowMenu.transform, false);
        var dismissImg = dismissGo.GetComponent<Image>();
        dismissImg.color = new Color(0f, 0f, 0f, 0.01f);
        dismissImg.raycastTarget = true;
        var dismissBtn = dismissGo.GetComponent<Button>();
        dismissBtn.targetGraphic = dismissImg;
        dismissBtn.transition = Selectable.Transition.None;
        dismissBtn.onClick.AddListener(() => SetOverflowMenuVisible(false));
        var dismissRt = dismissGo.GetComponent<RectTransform>();
        dismissRt.anchorMin = Vector2.zero;
        dismissRt.anchorMax = Vector2.one;
        dismissRt.offsetMin = Vector2.zero;
        dismissRt.offsetMax = Vector2.zero;

        var panel = ARDesignUiUtil.CreateRoundedImage(overflowMenu.transform, Frost, 20);
        panel.gameObject.name = "MenuPanel";
        panel.raycastTarget = true;
        var panelRt = panel.rectTransform;
        panelRt.anchorMin = new Vector2(1f, 1f);
        panelRt.anchorMax = new Vector2(1f, 1f);
        panelRt.pivot = new Vector2(1f, 1f);
        panelRt.sizeDelta = new Vector2(320f, 88f);
        panelRt.anchoredPosition = new Vector2(-20f, -168f);

        // Soft shadow behind panel
        var shadow = ARDesignUiUtil.CreateRoundedImage(overflowMenu.transform, MenuShadow, 22);
        shadow.gameObject.name = "MenuShadow";
        shadow.raycastTarget = false;
        shadow.transform.SetSiblingIndex(panel.transform.GetSiblingIndex());
        var shadowRt = shadow.rectTransform;
        shadowRt.anchorMin = panelRt.anchorMin;
        shadowRt.anchorMax = panelRt.anchorMax;
        shadowRt.pivot = panelRt.pivot;
        shadowRt.sizeDelta = panelRt.sizeDelta + new Vector2(8f, 8f);
        shadowRt.anchoredPosition = panelRt.anchoredPosition + new Vector2(0f, -4f);

        CreateMenuRow(panel.transform, "Export 3D", DrawExportIcon(), Ink, OnExport3dClicked);

        overflowMenu.SetActive(false);
    }

    static void CreateMenuRow(Transform parent, string label, Sprite icon, Color color, Action onClick)
    {
        var row = new GameObject(label.Replace(" ", ""), typeof(RectTransform), typeof(Image), typeof(Button));
        row.transform.SetParent(parent, false);
        var rowBg = row.GetComponent<Image>();
        rowBg.color = Color.clear;
        rowBg.raycastTarget = true;
        var rowBtn = row.GetComponent<Button>();
        rowBtn.targetGraphic = rowBg;
        rowBtn.transition = Selectable.Transition.None;
        rowBtn.onClick.AddListener(() => onClick?.Invoke());
        var rowRt = row.GetComponent<RectTransform>();
        rowRt.anchorMin = Vector2.zero;
        rowRt.anchorMax = Vector2.one;
        rowRt.offsetMin = new Vector2(8f, 6f);
        rowRt.offsetMax = new Vector2(-8f, -6f);

        var text = ARDesignUiUtil.CreateText(row.transform, label, 22, FontStyle.Normal, TextAnchor.MiddleLeft);
        text.color = color;
        text.raycastTarget = false;
        var textRt = text.rectTransform;
        textRt.anchorMin = new Vector2(0f, 0f);
        textRt.anchorMax = new Vector2(1f, 1f);
        textRt.offsetMin = new Vector2(20f, 0f);
        textRt.offsetMax = new Vector2(-72f, 0f);

        if (icon == null) return;

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(row.transform, false);
        var iconImg = iconGo.GetComponent<Image>();
        iconImg.sprite = icon;
        iconImg.preserveAspect = true;
        iconImg.raycastTarget = false;
        iconImg.color = color;
        var iconRt = iconImg.rectTransform;
        iconRt.anchorMin = new Vector2(1f, 0.5f);
        iconRt.anchorMax = new Vector2(1f, 0.5f);
        iconRt.pivot = new Vector2(1f, 0.5f);
        iconRt.sizeDelta = new Vector2(36f, 36f);
        iconRt.anchoredPosition = new Vector2(-18f, 0f);
    }

    static Sprite DrawExportIcon()
    {
        const int size = 64;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            wrapMode = TextureWrapMode.Clamp,
            filterMode = FilterMode.Bilinear,
            hideFlags = HideFlags.HideAndDontSave,
        };
        var clear = new Color(1f, 1f, 1f, 0f);
        var pixels = new Color[size * size];
        for (var i = 0; i < pixels.Length; i++)
            pixels[i] = clear;
        tex.SetPixels(pixels);

        void FillRect(int x, int y, int w, int h)
        {
            for (var py = y; py < y + h && py < size; py++)
            for (var px = x; px < x + w && px < size; px++)
            {
                if (px < 0 || py < 0) continue;
                tex.SetPixel(px, py, Color.white);
            }
        }

        // Tray + up arrow (share/export glyph)
        FillRect(14, 12, 36, 6);
        FillRect(14, 12, 6, 18);
        FillRect(44, 12, 6, 18);
        FillRect(29, 22, 6, 26);
        for (var y = 34; y <= 48; y++)
        for (var x = 20; x <= 44; x++)
        {
            var dy = 48 - y;
            var half = dy;
            if (Mathf.Abs(x - 32) <= half)
                tex.SetPixel(x, y, Color.white);
        }

        tex.Apply(false, true);
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    static void PlaceLabel(RectTransform rt, float anchorMinY, float anchorMaxY)
    {
        rt.anchorMin = new Vector2(0.1f, anchorMinY);
        rt.anchorMax = new Vector2(0.9f, anchorMaxY);
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    static RectTransform CreateFrostChip(
        Transform parent,
        Vector2 anchor,
        Vector2 anchoredPos,
        Vector2 size,
        bool stretchWidth)
    {
        var chip = ARDesignUiUtil.CreateRoundedImage(parent, Frost, 24);
        var rt = chip.rectTransform;
        if (stretchWidth)
        {
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(1f, 1f);
            rt.pivot = new Vector2(0.5f, 1f);
            rt.sizeDelta = new Vector2(-24f, size.y);
            rt.anchoredPosition = new Vector2(0f, anchoredPos.y);
        }
        else
        {
            rt.anchorMin = anchor;
            rt.anchorMax = anchor;
            rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = size;
            rt.anchoredPosition = anchoredPos;
        }

        return rt;
    }

    static void CreateCircleBackButton(Transform parent, Action onClick)
    {
        var go = new GameObject("Back", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);

        var image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyCircle(image);
        image.color = Frost;

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        button.onClick.AddListener(() => onClick?.Invoke());

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0f, 0.5f);
        rt.anchorMax = new Vector2(0f, 0.5f);
        rt.pivot = new Vector2(0f, 0.5f);
        rt.anchoredPosition = new Vector2(16f, 0f);
        rt.sizeDelta = new Vector2(64f, 64f);

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(go.transform, false);
        var icon = iconGo.GetComponent<Image>();
        icon.sprite = LoadBackArrowSprite();
        icon.preserveAspect = true;
        icon.raycastTarget = false;
        icon.color = Ink;
        if (icon.sprite == null)
        {
            // Fallback glyph if Resources icon is missing.
            var fallback = ARDesignUiUtil.CreateText(go.transform, "←", 28, FontStyle.Bold, TextAnchor.MiddleCenter);
            fallback.color = Ink;
            fallback.raycastTarget = false;
            icon.enabled = false;
        }
        var iconRt = icon.rectTransform;
        iconRt.anchorMin = new Vector2(0.22f, 0.22f);
        iconRt.anchorMax = new Vector2(0.78f, 0.78f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;
    }

    static Sprite LoadBackArrowSprite()
    {
        var sprite = Resources.Load<Sprite>("UIIcons/back-arrow");
        if (sprite != null) return sprite;

        var tex = Resources.Load<Texture2D>("UIIcons/back-arrow");
        if (tex != null)
        {
            return Sprite.Create(
                tex,
                new Rect(0f, 0f, tex.width, tex.height),
                new Vector2(0.5f, 0.5f),
                100f);
        }

        return null;
    }

    static Button CreateToggleButton(
        Transform parent,
        string label,
        Vector2 anchor,
        Vector2 size,
        Action onClick,
        out Image image,
        out Text text)
    {
        var go = new GameObject(label + "Toggle", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(image, 16);
        image.color = Frost;

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        button.onClick.AddListener(() => onClick?.Invoke());

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = anchor;
        rt.anchorMax = anchor;
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = size;
        rt.anchoredPosition = Vector2.zero;

        text = ARDesignUiUtil.CreateText(go.transform, label, 22, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = Ink;
        text.raycastTarget = false;
        var textRt = text.rectTransform;
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = Vector2.zero;
        textRt.offsetMax = Vector2.zero;
        return button;
    }
}
