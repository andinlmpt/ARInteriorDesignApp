using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Gabmeister-style furniture picker: horizontal ScrollRect of circular icons,
/// stacked utility buttons (grid + delete), and animated selection highlights.
/// </summary>
public class ARFurniturePickerUI : MonoBehaviour
{
    // ── References ────────────────────────────────────────────────────────────
    [Header("References")]
    [SerializeField] private FurnitureCatalog     catalog;
    [SerializeField] private ARFurniturePlacer    placer;
    [SerializeField] private ARPlacementIndicator placementIndicator;
    [SerializeField] private ARPlaneManager       planeManager;
    [SerializeField] private ARFloorGuide         floorGuide;

    [Header("Layout (Gabmeister-style)")]
    [SerializeField] private float iconSize            = 96f;
    [SerializeField] private float iconSpacing         = 16f;
    [SerializeField] private float scrollBarHeight     = 124f;
    [SerializeField] private float utilityButtonSize   = 58f;
    [SerializeField] private float utilityButtonGap    = 12f;
    [SerializeField] private float bottomMargin        = 24f;
    [SerializeField] private float sideMargin          = 16f;

    [Header("Selection highlight")]
    [SerializeField] private float selectedScale       = 1.12f;
    [SerializeField] private float unselectedScale       = 1f;
    [SerializeField] private float unselectedAlpha       = 0.72f;
    [SerializeField] private float ringThickness         = 4f;
    [SerializeField] private float selectionLerpSpeed    = 14f;
    [SerializeField] private bool  scrollToSelection     = true;

    [Header("Colors")]
    [SerializeField] private Color barBackgroundColor  = new(1f, 1f, 1f, 0.94f);
    [SerializeField] private Color barShadowColor        = new(0f, 0f, 0f, 0.18f);
    [SerializeField] private Color iconBackgroundColor = Color.white;
    [SerializeField] private Color selectedRingColor   = new(0.1f, 0.52f, 0.98f, 1f);
    [SerializeField] private Color fallbackLabelColor  = new(0.22f, 0.22f, 0.22f, 1f);
    [SerializeField] private Color utilityIconColor    = new(0.12f, 0.12f, 0.12f, 1f);
    [SerializeField] private Color utilityBgColor      = new(1f, 1f, 1f, 0.94f);

    // ── Runtime ─────────────────────────────────────────────────────────────
    readonly List<IconButton> iconButtons = new();
    Sprite circleSprite;
    Sprite roundedBarSprite;
    Sprite gridSprite;
    Sprite trashSprite;
    ScrollRect furnitureScroll;
    RectTransform scrollContent;
    string selectedEntryId;
    bool   gridVisible = true;
    Image  gridButtonBg;

    sealed class IconButton
    {
        public string        entryId;
        public RectTransform root;
        public Image         ring;
        public CanvasGroup   canvasGroup;
        public float         scale;
        public float         alpha;
    }

    void Awake()
    {
        if (catalog == null)            catalog            = FindFirstObjectByType<FurnitureCatalog>();
        if (placer == null)             placer             = FindFirstObjectByType<ARFurniturePlacer>();
        if (placementIndicator == null) placementIndicator = FindFirstObjectByType<ARPlacementIndicator>();
        if (planeManager == null)       planeManager       = FindFirstObjectByType<ARPlaneManager>();
        if (floorGuide == null)         floorGuide         = FindFirstObjectByType<ARFloorGuide>();

        circleSprite     = CreateCircleSprite(128);
        roundedBarSprite = CreateRoundedRectSprite(64, 64, 20);
        gridSprite       = CreateGridSprite(64);
        trashSprite      = CreateTrashSprite(64);
    }

    void Start()
    {
        BuildUI();
        SelectFirstEntry();
    }

    void Update()
    {
        AnimateSelectionStates();
    }

    void BuildUI()
    {
        EnsureEventSystem();

        var canvasGo = new GameObject("ARFurnitureUI");
        var canvas   = canvasGo.AddComponent<Canvas>();
        canvas.renderMode   = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;

        var scaler = canvasGo.AddComponent<CanvasScaler>();
        scaler.uiScaleMode         = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight  = 0.5f;
        canvasGo.AddComponent<GraphicRaycaster>();

        var root = CreateRect("Root", canvasGo.transform);
        Stretch(root, 0f, 0f, 0f, 0f);

        BuildUtilityButtons(root);
        BuildFurnitureScrollBar(root);
    }

    void BuildUtilityButtons(RectTransform root)
    {
        var totalHeight = utilityButtonSize * 2f + utilityButtonGap;
        var panel       = CreateRect("UtilityButtons", root);
        panel.anchorMin        = new Vector2(1f, 1f);
        panel.anchorMax        = new Vector2(1f, 1f);
        panel.pivot            = new Vector2(1f, 1f);
        panel.anchoredPosition = new Vector2(-sideMargin, -sideMargin);
        panel.sizeDelta        = new Vector2(utilityButtonSize, totalHeight);

        gridButtonBg = CreateUtilityButton(panel, "GridToggle", gridSprite, 0f, ToggleGrid);
        CreateUtilityButton(panel, "Delete", trashSprite, utilityButtonSize + utilityButtonGap, DeletePlacedFurniture);
    }

    void BuildFurnitureScrollBar(RectTransform root)
    {
        var shadow = CreateRect("BarShadow", root);
        shadow.anchorMin        = new Vector2(0f, 0f);
        shadow.anchorMax        = new Vector2(1f, 0f);
        shadow.pivot            = new Vector2(0.5f, 0f);
        shadow.anchoredPosition = new Vector2(0f, bottomMargin - 4f);
        shadow.sizeDelta        = new Vector2(-sideMargin * 2f + 8f, scrollBarHeight + 8f);
        var shadowImg = shadow.gameObject.AddComponent<Image>();
        shadowImg.sprite = roundedBarSprite;
        shadowImg.type   = Image.Type.Sliced;
        shadowImg.color  = barShadowColor;

        var bar = CreateRect("FurnitureBar", root);
        bar.anchorMin        = new Vector2(0f, 0f);
        bar.anchorMax        = new Vector2(1f, 0f);
        bar.pivot            = new Vector2(0.5f, 0f);
        bar.anchoredPosition = new Vector2(0f, bottomMargin);
        bar.sizeDelta        = new Vector2(-sideMargin * 2f, scrollBarHeight);

        var barBg = bar.gameObject.AddComponent<Image>();
        barBg.sprite = roundedBarSprite;
        barBg.type   = Image.Type.Sliced;
        barBg.color  = barBackgroundColor;

        var scrollGo = CreateRect("ScrollView", bar);
        Stretch(scrollGo, 12f, 12f, 10f, 10f);

        furnitureScroll = scrollGo.gameObject.AddComponent<ScrollRect>();
        furnitureScroll.horizontal        = true;
        furnitureScroll.vertical          = false;
        furnitureScroll.movementType      = ScrollRect.MovementType.Elastic;
        furnitureScroll.elasticity        = 0.08f;
        furnitureScroll.scrollSensitivity = 28f;
        furnitureScroll.inertia           = true;
        furnitureScroll.decelerationRate  = 0.135f;

        var viewport = CreateRect("Viewport", scrollGo);
        Stretch(viewport, 0f, 0f, 0f, 0f);
        viewport.gameObject.AddComponent<Mask>().showMaskGraphic = false;
        viewport.gameObject.AddComponent<Image>().color = new Color(1f, 1f, 1f, 0.01f);

        scrollContent = CreateRect("Content", viewport);
        scrollContent.anchorMin        = new Vector2(0f, 0.5f);
        scrollContent.anchorMax        = new Vector2(0f, 0.5f);
        scrollContent.pivot            = new Vector2(0f, 0.5f);
        scrollContent.anchoredPosition = Vector2.zero;
        scrollContent.sizeDelta        = new Vector2(0f, iconSize + 8f);

        var layout = scrollContent.gameObject.AddComponent<HorizontalLayoutGroup>();
        layout.spacing                = iconSpacing;
        layout.childAlignment         = TextAnchor.MiddleLeft;
        layout.childControlWidth      = false;
        layout.childControlHeight     = false;
        layout.childForceExpandWidth  = false;
        layout.childForceExpandHeight = false;
        layout.padding                = new RectOffset(10, 10, 4, 4);

        var fitter = scrollContent.gameObject.AddComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
        fitter.verticalFit   = ContentSizeFitter.FitMode.Unconstrained;

        furnitureScroll.viewport = viewport;
        furnitureScroll.content  = scrollContent;

        if (catalog == null)
        {
            Debug.LogWarning("[ARFurniturePickerUI] No FurnitureCatalog assigned.");
            return;
        }

        foreach (var entry in catalog.Entries)
        {
            if (entry?.prefab == null)
                continue;

            iconButtons.Add(CreateFurnitureIcon(scrollContent, entry));
        }
    }

    IconButton CreateFurnitureIcon(RectTransform parent, FurnitureEntry entry)
    {
        var item = CreateRect($"Icon_{entry.id}", parent);
        item.sizeDelta = new Vector2(iconSize, iconSize);

        var canvasGroup = item.gameObject.AddComponent<CanvasGroup>();
        canvasGroup.alpha = unselectedAlpha;

        var ring = item.gameObject.AddComponent<Image>();
        ring.sprite        = circleSprite;
        ring.color         = Color.clear;
        ring.raycastTarget = false;

        var ringInset = ringThickness + 2f;
        var bg = CreateRect("Background", item);
        Stretch(bg, ringInset, ringInset, ringInset, ringInset);
        var bgImg = bg.gameObject.AddComponent<Image>();
        bgImg.sprite = circleSprite;
        bgImg.color  = iconBackgroundColor;

        var iconRect = CreateRect("Icon", bg);
        Stretch(iconRect, 8f, 8f, 8f, 8f);

        if (entry.icon != null)
        {
            var iconImg = iconRect.gameObject.AddComponent<Image>();
            iconImg.sprite         = entry.icon;
            iconImg.preserveAspect = true;
            iconImg.raycastTarget  = false;
        }
        else
        {
            var label = iconRect.gameObject.AddComponent<Text>();
            label.text               = GetShortLabel(catalog.GetDisplayName(entry));
            label.font               = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            label.fontSize           = 24;
            label.fontStyle          = FontStyle.Bold;
            label.alignment          = TextAnchor.MiddleCenter;
            label.color              = fallbackLabelColor;
            label.raycastTarget      = false;
            label.horizontalOverflow = HorizontalWrapMode.Overflow;
        }

        var button = item.gameObject.AddComponent<Button>();
        button.targetGraphic = bgImg;
        var colors = button.colors;
        colors.highlightedColor = new Color(0.95f, 0.97f, 1f, 1f);
        colors.pressedColor     = new Color(0.88f, 0.92f, 0.98f, 1f);
        button.colors = colors;

        var capturedId = entry.id;
        button.onClick.AddListener(() => OnFurnitureSelected(capturedId));

        return new IconButton
        {
            entryId     = entry.id,
            root        = item,
            ring        = ring,
            canvasGroup = canvasGroup,
            scale       = unselectedScale,
            alpha       = unselectedAlpha,
        };
    }

    Image CreateUtilityButton(RectTransform parent, string name, Sprite icon, float yOffset, UnityEngine.Events.UnityAction onClick)
    {
        var btnRect = CreateRect(name, parent);
        btnRect.anchorMin        = new Vector2(0f, 1f);
        btnRect.anchorMax        = new Vector2(1f, 1f);
        btnRect.pivot            = new Vector2(0.5f, 1f);
        btnRect.anchoredPosition = new Vector2(0f, -yOffset);
        btnRect.sizeDelta        = new Vector2(0f, utilityButtonSize);

        var bg = btnRect.gameObject.AddComponent<Image>();
        bg.sprite = circleSprite;
        bg.color  = utilityBgColor;

        var iconRect = CreateRect("Icon", btnRect);
        Stretch(iconRect, 13f, 13f, 13f, 13f);
        var iconImg = iconRect.gameObject.AddComponent<Image>();
        iconImg.sprite         = icon;
        iconImg.color          = utilityIconColor;
        iconImg.preserveAspect = true;

        var button = btnRect.gameObject.AddComponent<Button>();
        button.targetGraphic = bg;
        button.onClick.AddListener(onClick);
        return bg;
    }

    void AnimateSelectionStates()
    {
        var dt = Time.unscaledDeltaTime * selectionLerpSpeed;

        foreach (var icon in iconButtons)
        {
            if (icon.root == null)
                continue;

            var isSelected  = icon.entryId == selectedEntryId;
            var targetScale = isSelected ? selectedScale : unselectedScale;
            var targetAlpha = isSelected ? 1f : unselectedAlpha;

            icon.scale = Mathf.Lerp(icon.scale, targetScale, dt);
            icon.alpha = Mathf.Lerp(icon.alpha, targetAlpha, dt);

            icon.root.localScale = Vector3.one * icon.scale;

            if (icon.canvasGroup != null)
                icon.canvasGroup.alpha = icon.alpha;

            if (icon.ring != null)
                icon.ring.color = isSelected ? selectedRingColor : Color.clear;
        }
    }

    void ScrollToSelectedIcon()
    {
        if (!scrollToSelection || furnitureScroll == null || scrollContent == null)
            return;

        var index = iconButtons.FindIndex(i => i.entryId == selectedEntryId);
        if (index < 0)
            return;

        var itemWidth = iconSize + iconSpacing;
        var contentW  = scrollContent.rect.width;
        var viewportW = furnitureScroll.viewport.rect.width;
        if (contentW <= viewportW)
            return;

        var itemCenter = 10f + index * itemWidth + iconSize * 0.5f;
        furnitureScroll.horizontalNormalizedPosition =
            Mathf.Clamp01((itemCenter - viewportW * 0.5f) / (contentW - viewportW));
    }

    void OnFurnitureSelected(string entryId)
    {
        if (catalog == null || placer == null)
            return;

        var entry = catalog.GetEntry(entryId);
        if (entry?.prefab == null)
            return;

        selectedEntryId = entryId;
        placer.SetPrefab(entry.prefab);
        ScrollToSelectedIcon();
        UnityMessageBridge.SendToApp("furnitureSelected", entryId);
        Debug.Log($"[ARFurniturePickerUI] Selected '{catalog.GetDisplayName(entry)}'.");
    }

    void SelectFirstEntry()
    {
        if (catalog == null)
            return;

        foreach (var entry in catalog.Entries)
        {
            if (entry?.prefab == null)
                continue;

            OnFurnitureSelected(entry.id);
            return;
        }
    }

    void ToggleGrid()
    {
        gridVisible = !gridVisible;

        if (floorGuide != null)
            floorGuide.SetPlanesVisible(gridVisible);
        else if (planeManager != null)
        {
            foreach (var plane in planeManager.trackables)
            {
                foreach (var renderer in plane.GetComponentsInChildren<Renderer>())
                    renderer.enabled = gridVisible;
            }
        }

        if (placementIndicator != null)
        {
            if (gridVisible)
                placementIndicator.StartTracking();
            else
                placementIndicator.StopTracking();
        }

        if (gridButtonBg != null)
            gridButtonBg.color = gridVisible ? utilityBgColor : new Color(0.85f, 0.92f, 1f, 0.98f);
    }

    void DeletePlacedFurniture()
    {
        placer?.ClearPlacedFurniture();
        placementIndicator?.StartTracking();
        UnityMessageBridge.SendToApp("furnitureCleared", "true");
    }

    static void EnsureEventSystem()
    {
        if (FindFirstObjectByType<EventSystem>() != null)
            return;

        var esGo = new GameObject("EventSystem");
#if ENABLE_INPUT_SYSTEM
        esGo.AddComponent<EventSystem>();
        esGo.AddComponent<InputSystemUIInputModule>();
#else
        esGo.AddComponent<EventSystem>();
        esGo.AddComponent<StandaloneInputModule>();
#endif
    }

    static string GetShortLabel(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return "?";

        var parts = name.Trim().Split(' ', System.StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2)
            return $"{parts[0][0]}{parts[1][0]}".ToUpperInvariant();

        return name.Length >= 2 ? name[..2].ToUpperInvariant() : name.ToUpperInvariant();
    }

    static RectTransform CreateRect(string name, Transform parent)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        return go.GetComponent<RectTransform>();
    }

    static void Stretch(RectTransform rect, float left, float right, float top, float bottom)
    {
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.offsetMin = new Vector2(left, bottom);
        rect.offsetMax = new Vector2(-right, -top);
    }

    static Sprite CreateCircleSprite(int size)
    {
        var tex    = new Texture2D(size, size, TextureFormat.RGBA32, false);
        var center = (size - 1) * 0.5f;
        var radius = size * 0.5f - 1f;

        for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++)
        {
            var dist = Vector2.Distance(new Vector2(x, y), new Vector2(center, center));
            tex.SetPixel(x, y, dist <= radius ? Color.white : Color.clear);
        }

        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    static Sprite CreateRoundedRectSprite(int width, int height, int radius)
    {
        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false);
        Fill(tex, Color.clear);

        for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++)
            if (IsInsideRoundedRect(x, y, width, height, radius))
                tex.SetPixel(x, y, Color.white);

        tex.Apply();
        var border = radius + 2;
        return Sprite.Create(tex, new Rect(0, 0, width, height), new Vector2(0.5f, 0.5f), 100f,
            0, SpriteMeshType.FullRect, new Vector4(border, border, border, border));
    }

    static bool IsInsideRoundedRect(int x, int y, int w, int h, int r)
    {
        if (x >= r && x < w - r) return true;
        if (y >= r && y < h - r) return true;
        var cx = x < r ? r : w - r - 1;
        var cy = y < r ? r : h - r - 1;
        return Vector2.Distance(new Vector2(x, y), new Vector2(cx, cy)) <= r;
    }

    static Sprite CreateGridSprite(int size)
    {
        var tex  = new Texture2D(size, size, TextureFormat.RGBA32, false);
        var cell = size / 4;
        Fill(tex, Color.clear);
        for (var i = 1; i < 4; i++)
        {
            var p = i * cell;
            for (var x = cell; x < size - cell; x++) { tex.SetPixel(x, p, Color.black); tex.SetPixel(x, p + 1, Color.black); }
            for (var y = cell; y < size - cell; y++) { tex.SetPixel(p, y, Color.black); tex.SetPixel(p + 1, y, Color.black); }
        }
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    static Sprite CreateTrashSprite(int size)
    {
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        Fill(tex, Color.clear);
        var c = Color.black;
        DrawRect(tex, size / 5, size * 3 / 5, size * 4 / 5, size * 4 / 5 + 2, c);
        DrawRect(tex, size / 4, size / 2, size * 3 / 4, size / 2 + 3, c);
        DrawRect(tex, size * 2 / 5, size * 3 / 5, size * 3 / 5, size * 2 / 5, c);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    static void Fill(Texture2D tex, Color color)
    {
        var pixels = tex.GetPixels();
        for (var i = 0; i < pixels.Length; i++) pixels[i] = color;
        tex.SetPixels(pixels);
    }

    static void DrawRect(Texture2D tex, int x0, int y0, int x1, int y1, Color color)
    {
        for (var y = y0; y <= y1; y++)
        for (var x = x0; x <= x1; x++)
            if (x >= 0 && x < tex.width && y >= 0 && y < tex.height)
                tex.SetPixel(x, y, color);
    }
}
