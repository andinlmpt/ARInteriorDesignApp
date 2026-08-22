using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// IKEA-style furniture browser: dark left category rail + filtered item panel.
/// </summary>
[DefaultExecutionOrder(-85)]
public class ARDesignFurnitureCatalogUI : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private FurniturePlacementController placementController;
    [SerializeField] private FurnitureCatalog catalog;
    [SerializeField] private FurnitureLayoutHistory layoutHistory;
    [SerializeField] private ARDesignLayoutModeController layoutMode;
    [SerializeField] private RoomExportManager exportManager;
    [SerializeField] private bool enableNativeCatalog = true;

    [Header("Layout")]
    [SerializeField] private float sidebarWidth = 72f;
    [SerializeField] private float panelWidth = 220f;
    [SerializeField] private float categoryButtonSize = 52f;
    [SerializeField] private float itemTileSize = 56f;
    [SerializeField] private float toolButtonSize = 52f;

    static readonly Color SidebarBg = new(0.14f, 0.14f, 0.15f, 0.96f);
    static readonly Color CategoryActiveBg = new(1f, 1f, 1f, 1f);
    static readonly Color CategoryIdleIcon = new(1f, 1f, 1f, 0.92f);
    static readonly Color CategoryActiveIcon = new(0.12f, 0.12f, 0.14f, 1f);
    static readonly Color PanelBg = new(1f, 1f, 1f, 0.96f);
    static readonly Color ItemTile = new(0.95f, 0.95f, 0.96f, 1f);
    static readonly Color ItemSelected = new(0.12f, 0.12f, 0.14f, 1f);
    static readonly Color ToolBg = new(1f, 1f, 1f, 0.96f);
    static readonly Color ToolDisabled = new(0.88f, 0.88f, 0.9f, 0.85f);
    static readonly Color DeleteAccent = new(0.86f, 0.28f, 0.28f, 1f);
    static readonly Color Ink = new(0.12f, 0.12f, 0.14f, 1f);
    static readonly Color InkMuted = new(0.45f, 0.45f, 0.48f, 1f);
    static readonly Color InkOnDark = new(1f, 1f, 1f, 0.95f);

    struct CategoryDef
    {
        public string id;
        public string title;
        public string glyph;
    }

    static readonly CategoryDef[] Categories =
    {
        new() { id = "all", title = "All", glyph = "all" },
        new() { id = "seating", title = "Seating", glyph = "seat" },
        new() { id = "tables", title = "Tables", glyph = "table" },
        new() { id = "beds", title = "Beds", glyph = "bed" },
        new() { id = "lighting", title = "Lighting", glyph = "lamp" },
        new() { id = "appliances", title = "Appliances", glyph = "app" },
        new() { id = "other", title = "More", glyph = "more" },
    };

    Canvas canvas;
    RectTransform categoryContent;
    RectTransform itemContent;
    Text panelTitle;
    Text panelCount;
    Image deleteButtonBg;
    Image undoButtonBg;
    Image redoButtonBg;
    Image viewButtonBg;
    Image exportButtonBg;
    Image deleteIcon;
    Image undoIcon;
    Image redoIcon;
    Image exportIcon;
    Text viewLabel;
    Button deleteButton;
    Button undoButton;
    Button redoButton;
    Button viewButton;
    Button exportButton;
    readonly List<GameObject> categoryButtons = new();
    readonly List<GameObject> itemButtons = new();
    readonly Dictionary<string, Sprite> glyphSprites = new();

    string selectedCategory = "all";
    string selectedItemId;
    bool active;
    bool panelOpen = true;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (catalog == null) catalog = FindFirstObjectByType<FurnitureCatalog>();
        if (layoutHistory == null) layoutHistory = FindFirstObjectByType<FurnitureLayoutHistory>();
        if (layoutMode == null) layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();
        EnsureExportManager();

        active = enableNativeCatalog && !ARDesignHostDetect.IsEmbeddedInReactNative();
        if (!active)
        {
            Debug.Log("[ARDesignFurnitureCatalogUI] Native catalog disabled (React Native host or flag off).");
            enabled = false;
            return;
        }

        try
        {
            BuildUi();
            SetVisible(false);
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[ARDesignFurnitureCatalogUI] Failed to build UI: {e}");
            active = false;
            enabled = false;
        }
    }

    void EnsureExportManager()
    {
        if (exportManager == null)
            exportManager = FindFirstObjectByType<RoomExportManager>();

        if (exportManager != null) return;

        // Older ARDesignScene builds never had this component serialized — create it
        // on Managers (or this object) so Export is never permanently disabled.
        var host = GameObject.Find("Managers");
        if (host == null) host = gameObject;
        exportManager = host.GetComponent<RoomExportManager>() ?? host.AddComponent<RoomExportManager>();
        Debug.Log("[ARDesignFurnitureCatalogUI] Created missing RoomExportManager at runtime.");
    }

    void OnEnable()
    {
        if (!active) return;
        EnsureExportManager();
        if (scanController != null)
            scanController.PhaseChanged += OnPhase;
        if (placementController != null)
            placementController.SelectionChanged += OnSelectionChanged;
        if (layoutHistory != null)
            layoutHistory.HistoryChanged += RefreshToolButtons;
        if (layoutMode != null)
            layoutMode.ViewModeChanged += OnViewModeChanged;
        if (exportManager != null)
            exportManager.ExportFinished += OnExportFinished;
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhase;
        if (placementController != null)
            placementController.SelectionChanged -= OnSelectionChanged;
        if (layoutHistory != null)
            layoutHistory.HistoryChanged -= RefreshToolButtons;
        if (layoutMode != null)
            layoutMode.ViewModeChanged -= OnViewModeChanged;
        if (exportManager != null)
            exportManager.ExportFinished -= OnExportFinished;
    }

    void OnDestroy()
    {
        foreach (var kv in glyphSprites)
        {
            if (kv.Value != null && kv.Value.texture != null)
                Destroy(kv.Value.texture);
        }
        glyphSprites.Clear();
    }

    void Start()
    {
        if (!active) return;
        RebuildCategories();
        RebuildItems();
        RefreshToolButtons();
        if (scanController != null)
            SetVisible(scanController.IsConfirmed);
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        if (!active) return;
        SetVisible(phase == RoomScanController.ScanPhase.Confirmed);
        if (phase == RoomScanController.ScanPhase.Confirmed)
        {
            RebuildCategories();
            RebuildItems();
            RefreshToolButtons();
            RefreshViewButton();
        }
    }

    void OnSelectionChanged(PlacedFurniture _)
    {
        RefreshToolButtons();
    }

    void OnViewModeChanged(ARDesignLayoutModeController.ViewMode _)
    {
        RefreshViewButton();
        RefreshToolButtons();
    }

    void OnDeletePressed()
    {
        if (placementController == null || placementController.Selected == null) return;
        placementController.RemoveSelectedFurniture();
        RefreshToolButtons();
    }

    void OnUndoPressed()
    {
        layoutHistory?.Undo();
        RefreshToolButtons();
    }

    void OnRedoPressed()
    {
        layoutHistory?.Redo();
        RefreshToolButtons();
    }

    void OnViewTogglePressed()
    {
        layoutMode?.ToggleViewMode();
        RefreshViewButton();
    }

    void OnExportPressed()
    {
        EnsureExportManager();
        if (exportManager == null)
        {
            Debug.LogWarning("[ARDesignFurnitureCatalogUI] RoomExportManager missing.");
            return;
        }

        if (exportManager.IsExporting) return;

        // Re-subscribe in case the manager was created after OnEnable.
        exportManager.ExportFinished -= OnExportFinished;
        exportManager.ExportFinished += OnExportFinished;

        SetToolEnabled(exportButton, exportButtonBg, exportIcon, false, ToolDisabled, InkMuted);
        exportManager.ExportLayout();
    }

    void OnExportFinished(RoomExportManager.ExportProgress progress)
    {
        RefreshToolButtons();
        if (progress == null) return;
        if (progress.success)
            Debug.Log($"[ARDesignFurnitureCatalogUI] Export OK: {progress.fileName}");
        else
            Debug.LogWarning($"[ARDesignFurnitureCatalogUI] Export failed: {progress.error}");
    }

    void RefreshToolButtons()
    {
        var hasSelection = placementController != null && placementController.Selected != null;
        var canUndo = layoutHistory != null && layoutHistory.CanUndo;
        var canRedo = layoutHistory != null && layoutHistory.CanRedo;

        SetToolEnabled(deleteButton, deleteButtonBg, deleteIcon, hasSelection,
            hasSelection ? DeleteAccent : ToolDisabled,
            hasSelection ? InkOnDark : InkMuted);
        SetToolEnabled(undoButton, undoButtonBg, undoIcon, canUndo,
            canUndo ? ToolBg : ToolDisabled,
            canUndo ? Ink : InkMuted);
        SetToolEnabled(redoButton, redoButtonBg, redoIcon, canRedo,
            canRedo ? ToolBg : ToolDisabled,
            canRedo ? Ink : InkMuted);

        var canExport = !exportManager || !exportManager.IsExporting;
        // Always allow the tap — EnsureExportManager runs on press if needed.
        SetToolEnabled(exportButton, exportButtonBg, exportIcon, canExport,
            canExport ? ToolBg : ToolDisabled,
            canExport ? Ink : InkMuted);
        RefreshViewButton();
    }

    void RefreshViewButton()
    {
        if (viewButton == null) return;
        var planner = layoutMode != null && layoutMode.IsPlannerOrbitActive;
        // Label shows the mode you can switch TO.
        if (viewLabel != null)
        {
            viewLabel.text = planner ? "AR" : "Plan";
            viewLabel.color = planner ? CategoryActiveIcon : Ink;
        }
        if (viewButtonBg != null)
            viewButtonBg.color = planner ? CategoryActiveBg : ToolBg;
        viewButton.interactable = layoutMode != null && layoutMode.IsLayoutActive;
    }

    static void SetToolEnabled(
        Button button,
        Image bg,
        Image icon,
        bool enabled,
        Color bgColor,
        Color iconColor)
    {
        if (button != null) button.interactable = enabled;
        if (bg != null) bg.color = bgColor;
        if (icon != null) icon.color = iconColor;
    }

    public void SetVisible(bool visible)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(visible);
    }

    void RebuildCategories()
    {
        foreach (var go in categoryButtons)
        {
            if (go != null) Destroy(go);
        }
        categoryButtons.Clear();
        if (categoryContent == null) return;

        // Only show categories that currently have items (always keep All).
        var available = new HashSet<string> { "all" };
        if (catalog != null)
        {
            foreach (var entry in catalog.Entries)
            {
                if (entry == null || string.IsNullOrWhiteSpace(entry.id)) continue;
                available.Add(catalog.ResolveCategory(entry));
            }
        }
        else
        {
            available.Add("other");
        }

        foreach (var cat in Categories)
        {
            if (!available.Contains(cat.id) && cat.id != "all") continue;
            CreateCategoryButton(cat);
        }
    }

    void CreateCategoryButton(CategoryDef cat)
    {
        var selected = selectedCategory == cat.id;
        var go = new GameObject($"Cat_{cat.id}", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(categoryContent, false);

        var image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(image, 16);
        image.color = selected ? CategoryActiveBg : new Color(1f, 1f, 1f, 0f);

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        var captured = cat.id;
        button.onClick.AddListener(() => OnSelectCategory(captured));

        var rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(categoryButtonSize, categoryButtonSize);

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(go.transform, false);
        var iconImage = iconGo.GetComponent<Image>();
        iconImage.sprite = GetGlyphSprite(cat.id, cat.glyph);
        iconImage.preserveAspect = true;
        iconImage.raycastTarget = false;
        iconImage.color = selected ? CategoryActiveIcon : CategoryIdleIcon;
        var iconRt = iconGo.GetComponent<RectTransform>();
        iconRt.anchorMin = new Vector2(0.22f, 0.22f);
        iconRt.anchorMax = new Vector2(0.78f, 0.78f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;

        categoryButtons.Add(go);
    }

    void OnSelectCategory(string categoryId)
    {
        if (selectedCategory == categoryId)
        {
            panelOpen = !panelOpen;
        }
        else
        {
            selectedCategory = categoryId;
            panelOpen = true;
        }

        RebuildCategories();
        RebuildItems();
        UpdatePanelVisibility();
    }

    void UpdatePanelVisibility()
    {
        Transform t = itemContent;
        while (t != null && t.name != "ItemPanel")
            t = t.parent;
        if (t != null)
            t.gameObject.SetActive(panelOpen);
    }

    void RebuildItems()
    {
        foreach (var go in itemButtons)
        {
            if (go != null) Destroy(go);
        }
        itemButtons.Clear();
        if (itemContent == null) return;

        var title = CategoryTitle(selectedCategory);
        if (panelTitle != null) panelTitle.text = title;

        List<FurnitureEntry> items;
        if (catalog == null || catalog.Entries.Count == 0)
        {
            items = new List<FurnitureEntry>();
            CreateItemButton("sample-cube", "Cube", null, new Vector3(0.6f, 0.6f, 0.6f));
            if (panelCount != null) panelCount.text = "1 item";
            UpdatePanelVisibility();
            return;
        }

        items = catalog.GetEntriesInCategory(selectedCategory);
        if (panelCount != null)
            panelCount.text = items.Count == 1 ? "1 item" : $"{items.Count} items";

        foreach (var entry in items)
            CreateItemButton(
                entry.id,
                catalog.GetDisplayName(entry),
                catalog.GetIcon(entry),
                catalog.GetDefaultDimensions(entry.id));

        UpdatePanelVisibility();
    }

    void CreateItemButton(string id, string label, Sprite icon, Vector3 dims)
    {
        var selected = selectedItemId == id;
        var row = new GameObject($"Item_{id}", typeof(RectTransform), typeof(Image), typeof(Button));
        row.transform.SetParent(itemContent, false);

        var bg = row.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(bg, 18);
        bg.color = selected ? ItemSelected : ItemTile;

        var button = row.GetComponent<Button>();
        button.targetGraphic = bg;
        var capturedId = id;
        button.onClick.AddListener(() => OnSelectItem(capturedId));

        var rowRt = row.GetComponent<RectTransform>();
        rowRt.sizeDelta = new Vector2(0f, 72f);

        var layout = row.AddComponent<LayoutElement>();
        layout.minHeight = 72f;
        layout.preferredHeight = 72f;
        layout.flexibleWidth = 1f;

        // Thumbnail
        var thumb = new GameObject("Thumb", typeof(RectTransform), typeof(Image));
        thumb.transform.SetParent(row.transform, false);
        var thumbImg = thumb.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(thumbImg, 14);
        thumbImg.raycastTarget = false;
        thumbImg.preserveAspect = true;
        var thumbRt = thumb.GetComponent<RectTransform>();
        thumbRt.anchorMin = new Vector2(0f, 0.5f);
        thumbRt.anchorMax = new Vector2(0f, 0.5f);
        thumbRt.pivot = new Vector2(0f, 0.5f);
        thumbRt.sizeDelta = new Vector2(itemTileSize, itemTileSize);
        thumbRt.anchoredPosition = new Vector2(8f, 0f);

        if (icon != null)
        {
            thumbImg.sprite = icon;
            thumbImg.color = Color.white;
            thumbImg.type = Image.Type.Simple;
        }
        else
        {
            thumbImg.color = selected ? new Color(1f, 1f, 1f, 0.12f) : Color.white;
            var glyph = ARDesignUiUtil.CreateText(thumb.transform, ShortLabel(label), 16, FontStyle.Bold, TextAnchor.MiddleCenter);
            glyph.color = selected ? InkOnDark : Ink;
            glyph.raycastTarget = false;
            var glyphRt = glyph.rectTransform;
            glyphRt.anchorMin = Vector2.zero;
            glyphRt.anchorMax = Vector2.one;
            glyphRt.offsetMin = Vector2.zero;
            glyphRt.offsetMax = Vector2.zero;
        }

        // Labels
        var nameText = ARDesignUiUtil.CreateText(row.transform, label, 15, FontStyle.Bold, TextAnchor.MiddleLeft);
        nameText.color = selected ? InkOnDark : Ink;
        nameText.raycastTarget = false;
        nameText.horizontalOverflow = HorizontalWrapMode.Wrap;
        var nameRt = nameText.rectTransform;
        nameRt.anchorMin = new Vector2(0f, 0.5f);
        nameRt.anchorMax = new Vector2(1f, 1f);
        nameRt.offsetMin = new Vector2(76f, 2f);
        nameRt.offsetMax = new Vector2(-10f, -8f);

        var dimLabel =
            $"{Mathf.RoundToInt(dims.x * 100)}×{Mathf.RoundToInt(dims.z * 100)}×{Mathf.RoundToInt(dims.y * 100)} cm";
        var dimText = ARDesignUiUtil.CreateText(row.transform, dimLabel, 12, FontStyle.Normal, TextAnchor.UpperLeft);
        dimText.color = selected ? new Color(1f, 1f, 1f, 0.7f) : InkMuted;
        dimText.raycastTarget = false;
        var dimRt = dimText.rectTransform;
        dimRt.anchorMin = new Vector2(0f, 0f);
        dimRt.anchorMax = new Vector2(1f, 0.5f);
        dimRt.offsetMin = new Vector2(76f, 8f);
        dimRt.offsetMax = new Vector2(-10f, -2f);

        itemButtons.Add(row);
    }

    void OnSelectItem(string id)
    {
        selectedItemId = id;
        RebuildItems();

        if (placementController == null) return;

        var dims = catalog != null
            ? catalog.GetDefaultDimensions(id)
            : new Vector3(0.6f, 0.6f, 0.6f);

        placementController.SpawnFurniture(new SpawnFurnitureRequest
        {
            modelId = id,
            catalogId = id,
            width = dims.x,
            height = dims.y,
            depth = dims.z,
        });
    }

    static string CategoryTitle(string id)
    {
        foreach (var cat in Categories)
        {
            if (cat.id == id) return cat.title;
        }
        return "Furniture";
    }

    static string ShortLabel(string label)
    {
        if (string.IsNullOrEmpty(label)) return "?";
        var cleaned = label.Replace(" ", string.Empty);
        return cleaned.Length <= 4 ? cleaned : cleaned.Substring(0, 4);
    }

    Sprite GetGlyphSprite(string id, string fallbackGlyph)
    {
        if (glyphSprites.TryGetValue(id, out var cached) && cached != null)
            return cached;

        // Simple geometric icons — more reliable than emoji fonts on Android.
        var sprite = id switch
        {
            "all" => DrawIconHome(),
            "seating" => DrawIconChair(),
            "tables" => DrawIconTable(),
            "beds" => DrawIconBed(),
            "lighting" => DrawIconLamp(),
            "appliances" => DrawIconAppliance(),
            _ => DrawIconSpark(),
        };

        glyphSprites[id] = sprite;
        return sprite;
    }

    static Sprite DrawIconHome()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 18, 30, 28, 22, Color.white);
            FillTriangle(tex, s, 12, 32, 32, 12, 52, 32, Color.white);
        });
    }

    static Sprite DrawIconChair()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 20, 14, 8, 22, Color.white);
            FillRect(tex, s, 36, 14, 8, 14, Color.white);
            FillRect(tex, s, 18, 28, 28, 10, Color.white);
            FillRect(tex, s, 18, 38, 10, 16, Color.white);
        });
    }

    static Sprite DrawIconTable()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 12, 36, 40, 8, Color.white);
            FillRect(tex, s, 18, 14, 6, 22, Color.white);
            FillRect(tex, s, 40, 14, 6, 22, Color.white);
        });
    }

    static Sprite DrawIconBed()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 10, 18, 8, 28, Color.white);
            FillRect(tex, s, 18, 18, 34, 16, Color.white);
            FillRect(tex, s, 18, 14, 6, 8, Color.white);
            FillRect(tex, s, 46, 14, 6, 8, Color.white);
        });
    }

    static Sprite DrawIconLamp()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 30, 12, 4, 22, Color.white);
            FillTriangle(tex, s, 18, 40, 32, 50, 46, 40, Color.white);
            FillRect(tex, s, 24, 10, 16, 4, Color.white);
        });
    }

    static Sprite DrawIconAppliance()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 16, 12, 32, 40, Color.white);
            FillCircle(tex, s, 32, 30, 10, new Color(0.2f, 0.2f, 0.2f, 1f));
            FillRect(tex, s, 22, 44, 20, 4, new Color(0.2f, 0.2f, 0.2f, 1f));
        });
    }

    static Sprite DrawIconSpark()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 28, 14, 8, 36, Color.white);
            FillRect(tex, s, 14, 28, 36, 8, Color.white);
        });
    }

    delegate void IconPainter(Texture2D tex, int size);

    static Sprite DrawIcon(int size, IconPainter paint)
    {
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            filterMode = FilterMode.Bilinear,
            wrapMode = TextureWrapMode.Clamp,
        };
        var clear = new Color(1f, 1f, 1f, 0f);
        var pixels = new Color[size * size];
        for (var i = 0; i < pixels.Length; i++) pixels[i] = clear;
        tex.SetPixels(pixels);
        paint(tex, size);
        tex.Apply(false, false);
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    static void FillRect(Texture2D tex, int size, int x, int y, int w, int h, Color color)
    {
        for (var py = y; py < y + h; py++)
        {
            if (py < 0 || py >= size) continue;
            for (var px = x; px < x + w; px++)
            {
                if (px < 0 || px >= size) continue;
                tex.SetPixel(px, py, color);
            }
        }
    }

    static void FillCircle(Texture2D tex, int size, int cx, int cy, int r, Color color)
    {
        var r2 = r * r;
        for (var py = cy - r; py <= cy + r; py++)
        {
            if (py < 0 || py >= size) continue;
            for (var px = cx - r; px <= cx + r; px++)
            {
                if (px < 0 || px >= size) continue;
                var dx = px - cx;
                var dy = py - cy;
                if (dx * dx + dy * dy <= r2)
                    tex.SetPixel(px, py, color);
            }
        }
    }

    static void FillTriangle(Texture2D tex, int size, int x0, int y0, int x1, int y1, int x2, int y2, Color color)
    {
        var minX = Mathf.Min(x0, Mathf.Min(x1, x2));
        var maxX = Mathf.Max(x0, Mathf.Max(x1, x2));
        var minY = Mathf.Min(y0, Mathf.Min(y1, y2));
        var maxY = Mathf.Max(y0, Mathf.Max(y1, y2));
        for (var py = minY; py <= maxY; py++)
        {
            if (py < 0 || py >= size) continue;
            for (var px = minX; px <= maxX; px++)
            {
                if (px < 0 || px >= size) continue;
                if (PointInTriangle(px, py, x0, y0, x1, y1, x2, y2))
                    tex.SetPixel(px, py, color);
            }
        }
    }

    static bool PointInTriangle(int px, int py, int x0, int y0, int x1, int y1, int x2, int y2)
    {
        var d1 = Sign(px, py, x0, y0, x1, y1);
        var d2 = Sign(px, py, x1, y1, x2, y2);
        var d3 = Sign(px, py, x2, y2, x0, y0);
        var hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        var hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        return !(hasNeg && hasPos);
    }

    static float Sign(int px, int py, int x0, int y0, int x1, int y1) =>
        (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1);

    void BuildUi()
    {
        ARDesignUiUtil.EnsureEventSystem();

        var root = new GameObject("ARDesignFurnitureCatalogUI");
        root.transform.SetParent(transform, false);

        canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 950;
        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.55f;
        root.AddComponent<GraphicRaycaster>();

        // ── Left dark category sidebar ─────────────────────────────────────
        var sidebar = ARDesignUiUtil.CreateRoundedImage(root.transform, SidebarBg, 28);
        sidebar.gameObject.name = "CategorySidebar";
        var sidebarRt = sidebar.rectTransform;
        sidebarRt.anchorMin = new Vector2(0f, 0.12f);
        sidebarRt.anchorMax = new Vector2(0f, 0.88f);
        sidebarRt.pivot = new Vector2(0f, 0.5f);
        sidebarRt.sizeDelta = new Vector2(sidebarWidth, 0f);
        sidebarRt.anchoredPosition = new Vector2(14f, 0f);

        var catScrollGo = new GameObject("CategoryScroll", typeof(RectTransform), typeof(ScrollRect), typeof(Image));
        catScrollGo.transform.SetParent(sidebar.transform, false);
        var catScrollImg = catScrollGo.GetComponent<Image>();
        catScrollImg.color = Color.clear;
        var catScroll = catScrollGo.GetComponent<ScrollRect>();
        catScroll.horizontal = false;
        catScroll.vertical = true;
        catScroll.movementType = ScrollRect.MovementType.Clamped;
        catScroll.scrollSensitivity = 28f;
        var catScrollRt = catScrollGo.GetComponent<RectTransform>();
        catScrollRt.anchorMin = Vector2.zero;
        catScrollRt.anchorMax = Vector2.one;
        catScrollRt.offsetMin = new Vector2(8f, 16f);
        catScrollRt.offsetMax = new Vector2(-8f, -16f);

        var catContent = new GameObject("Content", typeof(RectTransform), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
        catContent.transform.SetParent(catScrollGo.transform, false);
        categoryContent = catContent.GetComponent<RectTransform>();
        categoryContent.anchorMin = new Vector2(0f, 1f);
        categoryContent.anchorMax = new Vector2(1f, 1f);
        categoryContent.pivot = new Vector2(0.5f, 1f);
        categoryContent.anchoredPosition = Vector2.zero;
        categoryContent.sizeDelta = Vector2.zero;

        var catLayout = catContent.GetComponent<VerticalLayoutGroup>();
        catLayout.childAlignment = TextAnchor.UpperCenter;
        catLayout.childControlHeight = false;
        catLayout.childControlWidth = false;
        catLayout.childForceExpandHeight = false;
        catLayout.childForceExpandWidth = false;
        catLayout.spacing = 10f;
        catLayout.padding = new RectOffset(0, 0, 4, 8);

        var catFitter = catContent.GetComponent<ContentSizeFitter>();
        catFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        catScroll.content = categoryContent;
        catScroll.viewport = catScrollRt;

        // ── Item panel (IKEA product list) ─────────────────────────────────
        var panel = ARDesignUiUtil.CreateRoundedImage(root.transform, PanelBg, 28);
        panel.gameObject.name = "ItemPanel";
        var panelRt = panel.rectTransform;
        panelRt.anchorMin = new Vector2(0f, 0.12f);
        panelRt.anchorMax = new Vector2(0f, 0.88f);
        panelRt.pivot = new Vector2(0f, 0.5f);
        panelRt.sizeDelta = new Vector2(panelWidth, 0f);
        panelRt.anchoredPosition = new Vector2(14f + sidebarWidth + 10f, 0f);

        panelTitle = ARDesignUiUtil.CreateText(panel.transform, "All", 20, FontStyle.Bold, TextAnchor.MiddleLeft);
        panelTitle.color = Ink;
        panelTitle.raycastTarget = false;
        var titleRt = panelTitle.rectTransform;
        titleRt.anchorMin = new Vector2(0f, 1f);
        titleRt.anchorMax = new Vector2(1f, 1f);
        titleRt.pivot = new Vector2(0f, 1f);
        titleRt.anchoredPosition = new Vector2(16f, -12f);
        titleRt.sizeDelta = new Vector2(-28f, 28f);

        panelCount = ARDesignUiUtil.CreateText(panel.transform, "0 items", 13, FontStyle.Normal, TextAnchor.MiddleLeft);
        panelCount.color = InkMuted;
        panelCount.raycastTarget = false;
        var countRt = panelCount.rectTransform;
        countRt.anchorMin = new Vector2(0f, 1f);
        countRt.anchorMax = new Vector2(1f, 1f);
        countRt.pivot = new Vector2(0f, 1f);
        countRt.anchoredPosition = new Vector2(16f, -40f);
        countRt.sizeDelta = new Vector2(-28f, 20f);

        var closeGo = new GameObject("Close", typeof(RectTransform), typeof(Image), typeof(Button));
        closeGo.transform.SetParent(panel.transform, false);
        var closeImg = closeGo.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(closeImg, 18);
        closeImg.color = new Color(0.92f, 0.92f, 0.93f, 1f);
        var closeBtn = closeGo.GetComponent<Button>();
        closeBtn.targetGraphic = closeImg;
        closeBtn.onClick.AddListener(() =>
        {
            panelOpen = false;
            UpdatePanelVisibility();
        });
        var closeRt = closeGo.GetComponent<RectTransform>();
        closeRt.anchorMin = new Vector2(1f, 1f);
        closeRt.anchorMax = new Vector2(1f, 1f);
        closeRt.pivot = new Vector2(1f, 1f);
        closeRt.sizeDelta = new Vector2(34f, 34f);
        closeRt.anchoredPosition = new Vector2(-12f, -12f);
        var closeX = ARDesignUiUtil.CreateText(closeGo.transform, "×", 22, FontStyle.Bold, TextAnchor.MiddleCenter);
        closeX.color = Ink;
        closeX.raycastTarget = false;

        var itemScrollGo = new GameObject("ItemScroll", typeof(RectTransform), typeof(ScrollRect), typeof(Image));
        itemScrollGo.transform.SetParent(panel.transform, false);
        var itemScrollImg = itemScrollGo.GetComponent<Image>();
        itemScrollImg.color = Color.clear;
        var itemScroll = itemScrollGo.GetComponent<ScrollRect>();
        itemScroll.horizontal = false;
        itemScroll.vertical = true;
        itemScroll.movementType = ScrollRect.MovementType.Clamped;
        itemScroll.scrollSensitivity = 28f;
        var itemScrollRt = itemScrollGo.GetComponent<RectTransform>();
        itemScrollRt.anchorMin = Vector2.zero;
        itemScrollRt.anchorMax = Vector2.one;
        itemScrollRt.offsetMin = new Vector2(10f, 12f);
        itemScrollRt.offsetMax = new Vector2(-10f, -68f);

        var items = new GameObject("Content", typeof(RectTransform), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
        items.transform.SetParent(itemScrollGo.transform, false);
        itemContent = items.GetComponent<RectTransform>();
        itemContent.anchorMin = new Vector2(0f, 1f);
        itemContent.anchorMax = new Vector2(1f, 1f);
        itemContent.pivot = new Vector2(0.5f, 1f);
        itemContent.anchoredPosition = Vector2.zero;
        itemContent.sizeDelta = Vector2.zero;

        var itemLayout = items.GetComponent<VerticalLayoutGroup>();
        itemLayout.childAlignment = TextAnchor.UpperCenter;
        itemLayout.childControlHeight = false;
        itemLayout.childControlWidth = true;
        itemLayout.childForceExpandHeight = false;
        itemLayout.childForceExpandWidth = true;
        itemLayout.spacing = 10f;
        itemLayout.padding = new RectOffset(0, 0, 4, 12);

        var itemFitter = items.GetComponent<ContentSizeFitter>();
        itemFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        itemScroll.content = itemContent;
        itemScroll.viewport = itemScrollRt;

        BuildToolsBar(root.transform);
        RefreshToolButtons();
    }

    void BuildToolsBar(Transform canvasRoot)
    {
        var bar = ARDesignUiUtil.CreateRoundedImage(canvasRoot, ToolBg, 28);
        bar.gameObject.name = "FurnitureTools";
        var barRt = bar.rectTransform;
        barRt.anchorMin = new Vector2(0.5f, 0f);
        barRt.anchorMax = new Vector2(0.5f, 0f);
        barRt.pivot = new Vector2(0.5f, 0f);
        barRt.sizeDelta = new Vector2(340f, 68f);
        barRt.anchoredPosition = new Vector2(0f, 28f);

        var row = new GameObject("Row", typeof(RectTransform), typeof(HorizontalLayoutGroup));
        row.transform.SetParent(bar.transform, false);
        var rowRt = row.GetComponent<RectTransform>();
        rowRt.anchorMin = Vector2.zero;
        rowRt.anchorMax = Vector2.one;
        rowRt.offsetMin = new Vector2(10f, 8f);
        rowRt.offsetMax = new Vector2(-10f, -8f);

        var layout = row.GetComponent<HorizontalLayoutGroup>();
        layout.childAlignment = TextAnchor.MiddleCenter;
        layout.childControlHeight = false;
        layout.childControlWidth = false;
        layout.childForceExpandHeight = false;
        layout.childForceExpandWidth = false;
        layout.spacing = 8f;

        CreateToolButton(row.transform, "Undo", DrawIconUndo(), OnUndoPressed, out undoButton, out undoButtonBg, out undoIcon);
        CreateToolButton(row.transform, "Delete", DrawIconTrash(), OnDeletePressed, out deleteButton, out deleteButtonBg, out deleteIcon);
        CreateToolButton(row.transform, "Redo", DrawIconRedo(), OnRedoPressed, out redoButton, out redoButtonBg, out redoIcon);
        CreateToolButton(row.transform, "Export", DrawIconExport(), OnExportPressed, out exportButton, out exportButtonBg, out exportIcon);
        CreateViewToggleButton(row.transform);
        RefreshViewButton();
    }

    void CreateViewToggleButton(Transform parent)
    {
        var go = new GameObject("ViewMode", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);

        viewButtonBg = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(viewButtonBg, 18);
        viewButtonBg.color = ToolBg;

        viewButton = go.GetComponent<Button>();
        viewButton.targetGraphic = viewButtonBg;
        viewButton.onClick.AddListener(OnViewTogglePressed);

        var rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(toolButtonSize + 8f, toolButtonSize);

        viewLabel = ARDesignUiUtil.CreateText(go.transform, "Plan", 16, FontStyle.Bold, TextAnchor.MiddleCenter);
        viewLabel.color = Ink;
        viewLabel.raycastTarget = false;
        viewLabel.horizontalOverflow = HorizontalWrapMode.Overflow;
        var labelRt = viewLabel.rectTransform;
        labelRt.anchorMin = Vector2.zero;
        labelRt.anchorMax = Vector2.one;
        labelRt.offsetMin = Vector2.zero;
        labelRt.offsetMax = Vector2.zero;
    }

    void CreateToolButton(
        Transform parent,
        string name,
        Sprite icon,
        UnityEngine.Events.UnityAction onClick,
        out Button button,
        out Image background,
        out Image iconImage)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);

        background = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(background, 18);
        background.color = ToolBg;

        button = go.GetComponent<Button>();
        button.targetGraphic = background;
        button.onClick.AddListener(onClick);

        var rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(toolButtonSize, toolButtonSize);

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(go.transform, false);
        iconImage = iconGo.GetComponent<Image>();
        iconImage.sprite = icon;
        iconImage.preserveAspect = true;
        iconImage.raycastTarget = false;
        iconImage.color = Ink;
        var iconRt = iconGo.GetComponent<RectTransform>();
        iconRt.anchorMin = new Vector2(0.22f, 0.22f);
        iconRt.anchorMax = new Vector2(0.78f, 0.78f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;

        glyphSprites[$"tool_{name}"] = icon;
    }

    static Sprite DrawIconTrash()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 18, 12, 28, 4, Color.white);
            FillRect(tex, s, 26, 44, 12, 6, Color.white);
            FillRect(tex, s, 16, 38, 32, 6, Color.white);
            FillRect(tex, s, 20, 16, 6, 22, Color.white);
            FillRect(tex, s, 29, 16, 6, 22, Color.white);
            FillRect(tex, s, 38, 16, 6, 22, Color.white);
        });
    }

    static Sprite DrawIconUndo()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 18, 28, 28, 6, Color.white);
            FillRect(tex, s, 18, 20, 6, 22, Color.white);
            FillTriangle(tex, s, 12, 28, 24, 40, 24, 16, Color.white);
        });
    }

    static Sprite DrawIconRedo()
    {
        return DrawIcon(64, (tex, s) =>
        {
            FillRect(tex, s, 18, 28, 28, 6, Color.white);
            FillRect(tex, s, 40, 20, 6, 22, Color.white);
            FillTriangle(tex, s, 52, 28, 40, 40, 40, 16, Color.white);
        });
    }

    static Sprite DrawIconExport()
    {
        return DrawIcon(64, (tex, s) =>
        {
            // Share / export glyph: tray + up arrow.
            FillRect(tex, s, 14, 12, 36, 6, Color.white);
            FillRect(tex, s, 14, 12, 6, 18, Color.white);
            FillRect(tex, s, 44, 12, 6, 18, Color.white);
            FillRect(tex, s, 29, 22, 6, 26, Color.white);
            FillTriangle(tex, s, 32, 48, 20, 34, 44, 34, Color.white);
        });
    }
}
