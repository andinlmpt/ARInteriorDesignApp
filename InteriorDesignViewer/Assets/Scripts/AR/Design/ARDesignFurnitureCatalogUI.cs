using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Bottom-action furniture UI: undo / save photo / toggleable catalog strip.
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
    [SerializeField] private float pickerDockHeight = 480f;
    [SerializeField] private float filterIdleSize = 280f;
    [SerializeField] private float filterSelectedSize = 340f;
    [SerializeField] private float sideCircleSize = 112f;
    [SerializeField] private float saveCircleSize = 144f;
    [SerializeField] private float bottomNavClearance = 100f;
    [SerializeField] private float toolButtonSize = 96f;

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
    static readonly Color Navy = new(12f / 255f, 41f / 255f, 95f / 255f, 1f);
    static readonly Color NamePillBg = new(0.18f, 0.18f, 0.2f, 0.92f);
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
    RectTransform bottomCirclesBar;
    RectTransform furnitureDockRt;
    GameObject furnitureDock;
    GameObject namePill;
    RectTransform categoryContent;
    RectTransform itemContent;
    Text panelTitle;
    Text panelCount;
    Image deleteButtonBg;
    Image undoButtonBg;
    Image redoButtonBg;
    Image viewButtonBg;
    Image exportButtonBg;
    Image saveButtonBg;
    Image pickerButtonBg;
    Image deleteIcon;
    Image undoIcon;
    Image redoIcon;
    Image exportIcon;
    Image saveIcon;
    Image pickerIcon;
    Text viewLabel;
    Button deleteButton;
    Button undoButton;
    Button redoButton;
    Button viewButton;
    Button exportButton;
    Button saveButton;
    Button pickerButton;
    readonly List<GameObject> categoryButtons = new();
    readonly List<GameObject> itemButtons = new();
    readonly Dictionary<string, Sprite> glyphSprites = new();

    string selectedCategory = "all";
    string selectedItemId;
    bool active;
    bool panelOpen;
    bool capturingPhoto;
    bool uiBuilt;

    RemoteFurnitureCatalogLoader remoteCatalogLoader;

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (catalog == null) catalog = FindFirstObjectByType<FurnitureCatalog>();
        if (layoutHistory == null) layoutHistory = FindFirstObjectByType<FurnitureLayoutHistory>();
        if (layoutMode == null) layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();
        if (remoteCatalogLoader == null) remoteCatalogLoader = FindFirstObjectByType<RemoteFurnitureCatalogLoader>();
        EnsureExportManager();

        active = enableNativeCatalog && !ARDesignHostDetect.IsEmbeddedInReactNative();
        if (!active)
        {
            Debug.Log("[ARDesignFurnitureCatalogUI] Native catalog disabled (React Native host or flag off).");
            enabled = false;
            return;
        }

        ARMainMenuBackButton.EnsureOn(gameObject);
        NormalizeLayoutSizes();

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

    /// <summary>
    /// Scene YAML still had renamed leftover fields; force readable tap targets if
    /// Inspector values look like the old sidebar/panel sizes.
    /// </summary>
    void NormalizeLayoutSizes()
    {
        if (filterIdleSize < 260f) filterIdleSize = 280f;
        if (filterSelectedSize < 300f) filterSelectedSize = 340f;
        if (pickerDockHeight < 400f) pickerDockHeight = Mathf.Max(480f, filterSelectedSize + 140f);
        if (sideCircleSize < 100f) sideCircleSize = 112f;
        if (saveCircleSize < 120f) saveCircleSize = 144f;
        if (toolButtonSize < 80f) toolButtonSize = 96f;
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
        {
            placementController.SelectionChanged += OnSelectionChanged;
            placementController.ModelReady += OnModelReady;
            placementController.SpawnFailed += OnSpawnFailed;
        }
        if (layoutHistory != null)
            layoutHistory.HistoryChanged += RefreshToolButtons;
        if (layoutMode != null)
            layoutMode.ViewModeChanged += OnViewModeChanged;
        if (exportManager != null)
            exportManager.ExportFinished += OnExportFinished;
        if (remoteCatalogLoader != null)
            remoteCatalogLoader.CatalogLoaded += OnRemoteCatalogLoaded;
    }

    void OnRemoteCatalogLoaded()
    {
        if (!active) return;
        RebuildCategories();
        RebuildItems();
    }

    void OnDisable()
    {
        if (scanController != null)
            scanController.PhaseChanged -= OnPhase;
        if (placementController != null)
        {
            placementController.SelectionChanged -= OnSelectionChanged;
            placementController.ModelReady -= OnModelReady;
            placementController.SpawnFailed -= OnSpawnFailed;
        }
        if (layoutHistory != null)
            layoutHistory.HistoryChanged -= RefreshToolButtons;
        if (layoutMode != null)
            layoutMode.ViewModeChanged -= OnViewModeChanged;
        if (exportManager != null)
            exportManager.ExportFinished -= OnExportFinished;
        if (remoteCatalogLoader != null)
            remoteCatalogLoader.CatalogLoaded -= OnRemoteCatalogLoaded;
    }

    void OnDestroy()
    {
        uiBuilt = false;
        foreach (var kv in glyphSprites)
        {
            var sprite = kv.Value;
            if (sprite == null) continue;

            // Only destroy runtime-generated textures (procedural icons).
            // Never Destroy() Resources / project assets — that causes:
            // "Destroying assets is not permitted to avoid data loss."
            var tex = sprite.texture;
            if (tex != null && (tex.hideFlags & HideFlags.DontSave) != 0)
                Destroy(tex);
        }
        glyphSprites.Clear();
    }

    void Start()
    {
        if (!active) return;
        catalog?.EnsureBundledResourceEntries();
        RebuildCategories();
        RebuildItems();
        RefreshToolButtons();
        ApplyBottomSafeLayout();
        if (scanController != null)
            SetVisible(scanController.IsConfirmed);
    }

    void LateUpdate()
    {
        if (!active || canvas == null || !canvas.gameObject.activeInHierarchy) return;
        // Keep clear of system nav if safe area / resolution changes.
        ApplyBottomSafeLayout();
    }

    public void SetVisible(bool visible)
    {
        if (canvas != null)
            canvas.gameObject.SetActive(visible);
        if (visible)
            ApplyBottomSafeLayout();
    }

    void OnPhase(RoomScanController.ScanPhase phase)
    {
        if (!active) return;
        SetVisible(phase == RoomScanController.ScanPhase.Confirmed);
        if (phase == RoomScanController.ScanPhase.Confirmed)
        {
            // Stay in live AR — plan/orbit mode is not offered in the furniture toolbar.
            layoutMode?.SetViewMode(ARDesignLayoutModeController.ViewMode.RealRoom);
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

    void OnModelReady(string modelId)
    {
        if (!string.IsNullOrEmpty(modelId) && modelId == selectedItemId)
            RefreshFurnitureName();

        if (!string.IsNullOrEmpty(modelId))
            PrefetchNearbyAfterReady(modelId);
    }

    void OnSpawnFailed(string code, string message)
    {
        RefreshFurnitureName();
        if (!string.IsNullOrEmpty(message))
            Debug.LogWarning($"[ARDesignFurnitureCatalogUI] Spawn failed ({code}): {message}");
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

    void OnPickerTogglePressed()
    {
        panelOpen = !panelOpen;
        if (panelOpen)
        {
            RebuildItems();
            if (string.IsNullOrEmpty(selectedItemId))
                SetFurnitureName("Select furniture");
            else
                RefreshFurnitureName();
        }
        UpdatePanelVisibility();
        RefreshPickerButton();
    }

    void OnSavePhotoPressed()
    {
        CapturePhoto();
    }

    /// <summary>
    /// Captures the AR view (hides native UI), writes a PNG, saves to gallery when
    /// possible, and notifies RN via <c>photoCaptured</c>. Safe to call from RN
    /// even when this catalog UI is hidden in embedded mode.
    /// </summary>
    public void CapturePhoto()
    {
        if (capturingPhoto) return;
        StartCoroutine(CapturePhotoCoroutine());
    }

    IEnumerator CapturePhotoCoroutine()
    {
        capturingPhoto = true;
        SetToolEnabled(saveButton, saveButtonBg, saveIcon, false, Navy * 0.75f, InkOnDark);

        var uiWasEnabled = canvas != null && canvas.enabled;
        if (canvas != null) canvas.enabled = false;

        // Let the canvas hide before grabbing pixels.
        yield return null;
        yield return new WaitForEndOfFrame();

        Texture2D shot = null;
        try
        {
            shot = ScreenCapture.CaptureScreenshotAsTexture();
            if (shot == null)
            {
                Debug.LogWarning("[ARDesignFurnitureCatalogUI] Screenshot capture returned null.");
                yield break;
            }

            var dir = Path.Combine(Application.persistentDataPath, "ARPhotos");
            Directory.CreateDirectory(dir);
            var fileName = $"Maharlika_AR_{System.DateTime.Now:yyyy-MM-dd_HHmmss}.png";
            var path = Path.Combine(dir, fileName);
            var pngBytes = shot.EncodeToPNG();
            File.WriteAllBytes(path, pngBytes);
            Debug.Log($"[ARDesignFurnitureCatalogUI] Photo saved: {path}");

            // Write into system Gallery / Photos (share sheet often has no Gallery tile).
            var galleryOk = ARPhotoGallerySaver.SavePngToGallery(pngBytes, fileName);
            Debug.Log(galleryOk
                ? "[ARDesignFurnitureCatalogUI] Also saved to device gallery."
                : "[ARDesignFurnitureCatalogUI] Gallery save unavailable; share sheet can still be used.");

            // Notify React Native (path only — same bridge pattern as exportComplete).
            NotifyReactNativePhotoCaptured(path, fileName, pngBytes.LongLength, galleryOk);

            SharePhoto(path, fileName);
        }
        finally
        {
            if (shot != null) Destroy(shot);
            if (canvas != null) canvas.enabled = uiWasEnabled;
            capturingPhoto = false;
            RefreshToolButtons();
        }
    }

    static void SharePhoto(string absolutePath, string fileName)
    {
        if (string.IsNullOrEmpty(absolutePath) || !File.Exists(absolutePath))
            return;

#if NATIVESHARE_PRESENT
        new NativeShare()
            .AddFile(absolutePath, "image/png")
            .SetSubject("AR photo")
            .SetText($"Maharlika Furniture — AR capture")
            .SetCallback((result, shareTarget) =>
                Debug.Log($"[ARDesignFurnitureCatalogUI] Share result={result} target={shareTarget}"))
            .Share();
#else
        Debug.Log(
            $"[ARDesignFurnitureCatalogUI] Photo saved at {absolutePath}. " +
            "Install NativeShare to open the share / save sheet.");
#endif
    }

    static void NotifyReactNativePhotoCaptured(
        string absolutePath,
        string fileName,
        long byteLength,
        bool gallerySaved)
    {
        var payload = new ARPhotoCapturedPayload
        {
            success = !string.IsNullOrEmpty(absolutePath) && File.Exists(absolutePath),
            path = absolutePath ?? string.Empty,
            fileName = fileName ?? string.Empty,
            byteLength = byteLength,
            mimeType = "image/png",
            gallerySaved = gallerySaved,
            error = string.Empty,
        };

        if (!payload.success)
            payload.error = "Photo file missing after capture.";

        UnityMessageBridge.SendToApp("photoCaptured", JsonUtility.ToJson(payload));
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
        var canUndo = layoutHistory != null && layoutHistory.CanUndo;

        SetToolEnabled(undoButton, undoButtonBg, undoIcon, canUndo,
            ToolBg,
            canUndo ? Ink : InkMuted);

        if (!capturingPhoto)
            SetToolEnabled(saveButton, saveButtonBg, saveIcon, true, Navy, InkOnDark);

        RefreshPickerButton();
    }

    void RefreshPickerButton()
    {
        if (pickerButtonBg == null) return;
        // Open = navy with white icon; closed = white with dark icon.
        // Cube asset is converted to white line-art so it can tint correctly.
        pickerButtonBg.color = panelOpen ? Navy : ToolBg;
        if (pickerIcon != null)
            pickerIcon.color = panelOpen ? Color.white : Ink;
    }

    void RefreshViewButton()
    {
        // Plan mode toggle removed from the furniture toolbar.
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
        var go = new GameObject($"Cat_{cat.id}", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
        go.transform.SetParent(categoryContent, false);

        var image = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyRounded(image, 16);
        image.color = selected ? CategoryActiveBg : new Color(0.92f, 0.92f, 0.94f, 1f);

        var button = go.GetComponent<Button>();
        button.targetGraphic = image;
        var captured = cat.id;
        button.onClick.AddListener(() => OnSelectCategory(captured));

        var layout = go.GetComponent<LayoutElement>();
        layout.minWidth = 44f;
        layout.preferredWidth = 44f;
        layout.minHeight = 44f;
        layout.preferredHeight = 44f;

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(go.transform, false);
        var iconImage = iconGo.GetComponent<Image>();
        iconImage.sprite = GetGlyphSprite(cat.id, cat.glyph);
        iconImage.preserveAspect = true;
        iconImage.raycastTarget = false;
        iconImage.color = selected ? CategoryActiveIcon : Ink;
        var iconRt = iconGo.GetComponent<RectTransform>();
        iconRt.anchorMin = new Vector2(0.22f, 0.22f);
        iconRt.anchorMax = new Vector2(0.78f, 0.78f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;

        categoryButtons.Add(go);
    }

    void OnSelectCategory(string categoryId)
    {
        selectedCategory = categoryId;
        panelOpen = true;
        RebuildCategories();
        RebuildItems();
    }

    void UpdatePanelVisibility()
    {
        if (furnitureDock != null)
            furnitureDock.SetActive(panelOpen);

        if (namePill != null)
        {
            var showName = panelOpen && panelTitle != null && !string.IsNullOrEmpty(panelTitle.text);
            namePill.SetActive(showName);
        }

        ApplyBottomSafeLayout();
    }

    void RebuildItems()
    {
        foreach (var go in itemButtons)
        {
            if (go != null) Destroy(go);
        }
        itemButtons.Clear();
        if (itemContent == null) return;

        List<FurnitureEntry> items;
        if (catalog == null || catalog.Entries.Count == 0)
        {
            if (catalog != null && catalog.RemoteCatalogOnly && remoteCatalogLoader != null && !remoteCatalogLoader.IsLoaded)
            {
                SetFurnitureName("Loading…");
                return;
            }

            if (catalog == null || !catalog.RemoteCatalogOnly)
                CreateItemButton("sample-cube", "Cube", null);
            else
                SetFurnitureName("Catalog unavailable");
            return;
        }

        items = catalog.GetEntriesInCategory(selectedCategory);
        foreach (var entry in items)
            CreateItemButton(entry.id, catalog.GetDisplayName(entry), catalog.GetIcon(entry));

        RefreshFurnitureName();
    }

    void CreateItemButton(string id, string label, Sprite icon)
    {
        var selected = selectedItemId == id;
        var size = selected ? filterSelectedSize : filterIdleSize;

        var tile = new GameObject($"Item_{id}", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
        tile.transform.SetParent(itemContent, false);

        // Transparent hit target (no filled background)
        var ring = tile.GetComponent<Image>();
        ARDesignUiUtil.ApplyCircle(ring);
        ring.color = Color.clear;
        ring.raycastTarget = true;

        var button = tile.GetComponent<Button>();
        button.targetGraphic = ring;
        button.transition = Selectable.Transition.None;
        var capturedId = id;
        button.onClick.AddListener(() => OnSelectItem(capturedId));

        var layout = tile.GetComponent<LayoutElement>();
        layout.minWidth = size;
        layout.preferredWidth = size;
        layout.minHeight = size;
        layout.preferredHeight = size;

        // Furniture thumb — inset so it clears the navy border stroke
        var thumb = new GameObject("Thumb", typeof(RectTransform), typeof(Image));
        thumb.transform.SetParent(tile.transform, false);
        var thumbImg = thumb.GetComponent<Image>();
        thumbImg.raycastTarget = false;
        thumbImg.preserveAspect = true;
        ARDesignUiUtil.ApplyCircle(thumbImg);
        var thumbInset = selected ? 0.14f : 0.12f;
        var thumbRt = thumb.GetComponent<RectTransform>();
        thumbRt.anchorMin = new Vector2(thumbInset, thumbInset);
        thumbRt.anchorMax = new Vector2(1f - thumbInset, 1f - thumbInset);
        thumbRt.offsetMin = Vector2.zero;
        thumbRt.offsetMax = Vector2.zero;

        if (icon != null)
        {
            // Punch studio white backdrops so product photos match transparent icons.
            thumbImg.sprite = ARDesignUiUtil.PunchStudioBackground(icon);
            thumbImg.color = Color.white;
            thumbImg.type = Image.Type.Simple;
        }
        else
        {
            thumbImg.color = new Color(0.22f, 0.22f, 0.24f, 1f);
            var glyph = ARDesignUiUtil.CreateText(thumb.transform, ShortLabel(label), 13, FontStyle.Bold, TextAnchor.MiddleCenter);
            glyph.color = InkOnDark;
            glyph.raycastTarget = false;
            var glyphRt = glyph.rectTransform;
            glyphRt.anchorMin = Vector2.zero;
            glyphRt.anchorMax = Vector2.one;
            glyphRt.offsetMin = Vector2.zero;
            glyphRt.offsetMax = Vector2.zero;
        }

        // Navy stroke only (hollow ring over the icon)
        var borderGo = new GameObject("Border", typeof(RectTransform), typeof(Image));
        borderGo.transform.SetParent(tile.transform, false);
        var borderImg = borderGo.GetComponent<Image>();
        borderImg.raycastTarget = false;
        borderImg.color = Navy;
        ARDesignUiUtil.ApplyCircleRing(borderImg, selected ? 0.075f : 0.055f);
        var borderRt = borderImg.rectTransform;
        borderRt.anchorMin = Vector2.zero;
        borderRt.anchorMax = Vector2.one;
        borderRt.offsetMin = Vector2.zero;
        borderRt.offsetMax = Vector2.zero;

        itemButtons.Add(tile);
    }

    void OnSelectItem(string id)
    {
        selectedItemId = id;
        RefreshFurnitureName();
        RebuildItems();

        if (placementController == null) return;

        var glbUrl = catalog != null ? catalog.GetGlbUrl(id) : null;
        var gltfLoader = FindFirstObjectByType<RuntimeGltfLoader>();
        var alreadyCached = !string.IsNullOrWhiteSpace(glbUrl) && gltfLoader != null && gltfLoader.IsCached(glbUrl);

        // Immediate feedback so a first-time GLB download doesn't feel like a freeze.
        if (!alreadyCached && !string.IsNullOrWhiteSpace(glbUrl))
            SetFurnitureName("Loading…");

        var dims = catalog != null
            ? catalog.GetDefaultDimensions(id)
            : new Vector3(0.6f, 0.6f, 0.6f);

        placementController.SpawnFurniture(new SpawnFurnitureRequest
        {
            modelId = id,
            catalogId = id,
            glbUrl = glbUrl,
            width = dims.x,
            height = dims.y,
            depth = dims.z,
            dimensionLabel = catalog != null ? catalog.GetDimensionLabel(id) : null,
        });

        // Do not prefetch other sofas while this one downloads — each file is
        // ~70–100 MB and parallel downloads make the selected item feel slower.
    }

    void PrefetchNearbyAfterReady(string selectedId)
    {
        if (catalog == null) return;
        var loader = FindFirstObjectByType<RuntimeGltfLoader>();
        if (loader == null || !RuntimeGltfLoader.IsSupported) return;
        if (loader.HasActivePriorityLoad) return;

        var entries = catalog.GetEntriesInCategory(selectedCategory);
        if (entries == null || entries.Count == 0) return;

        var index = -1;
        for (var i = 0; i < entries.Count; i++)
        {
            if (entries[i] != null && entries[i].id == selectedId)
            {
                index = i;
                break;
            }
        }

        // Warm only the next carousel item once the current one is ready.
        var next = index + 1;
        if (next < 0 || next >= entries.Count) return;
        var url = catalog.GetGlbUrl(entries[next].id);
        if (!string.IsNullOrWhiteSpace(url))
            loader.Prefetch(url);
    }

    void RefreshFurnitureName()
    {
        if (string.IsNullOrEmpty(selectedItemId))
        {
            SetFurnitureName("");
            return;
        }

        if (catalog != null)
        {
            var entry = catalog.GetEntry(selectedItemId);
            if (entry != null)
            {
                SetFurnitureName(catalog.GetDisplayName(entry));
                return;
            }
        }

        SetFurnitureName(selectedItemId);
    }

    void SetFurnitureName(string name)
    {
        if (panelTitle != null)
            panelTitle.text = name ?? "";

        if (namePill != null)
            namePill.SetActive(panelOpen && !string.IsNullOrEmpty(name));
    }

    /// <summary>Rebuilds the native catalog after remote items are merged.</summary>
    public void RefreshFromCatalog()
    {
        RebuildCategories();
        RebuildItems();
        RefreshToolButtons();
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
            hideFlags = HideFlags.HideAndDontSave,
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
        if (uiBuilt && canvas != null) return;

        // Tear down leftover HUD from a previous play / hot-reload so the
        // top-right camera cannot stack as a double icon.
        for (var i = transform.childCount - 1; i >= 0; i--)
        {
            var child = transform.GetChild(i);
            if (child != null && child.name == "ARDesignFurnitureCatalogUI")
                Destroy(child.gameObject);
        }

        ARDesignUiUtil.EnsureEventSystem();

        var root = new GameObject("ARDesignFurnitureCatalogUI");
        root.transform.SetParent(transform, false);

        canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 950;
        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.5f;
        root.AddComponent<GraphicRaycaster>();

        // ── IG-style filter carousel (opens above the action circles) ──────
        var dockGo = new GameObject("FurnitureFilterDock", typeof(RectTransform));
        dockGo.transform.SetParent(root.transform, false);
        furnitureDock = dockGo;
        furnitureDockRt = dockGo.GetComponent<RectTransform>();
        furnitureDockRt.anchorMin = new Vector2(0f, 0f);
        furnitureDockRt.anchorMax = new Vector2(1f, 0f);
        furnitureDockRt.pivot = new Vector2(0.5f, 0f);
        furnitureDockRt.sizeDelta = new Vector2(0f, pickerDockHeight);

        var filterScroll = CreateHorizontalScrollArea(
            dockGo.transform,
            anchorY: 1f,
            pivotY: 1f,
            anchoredY: -4f,
            height: filterSelectedSize + 12f,
            sidePad: 8f,
            out itemContent);
        filterScroll.scrollSensitivity = 36f;
        filterScroll.movementType = ScrollRect.MovementType.Elastic;
        var filterLayout = itemContent.GetComponent<HorizontalLayoutGroup>();
        if (filterLayout != null)
        {
            filterLayout.childAlignment = TextAnchor.MiddleCenter;
            filterLayout.spacing = 36f;
            filterLayout.padding = new RectOffset(20, 20, 0, 0);
        }

        // Name pill under the carousel (like IG filter name)
        var pill = ARDesignUiUtil.CreateRoundedImage(dockGo.transform, NamePillBg, 32);
        pill.gameObject.name = "FurnitureNamePill";
        namePill = pill.gameObject;
        var pillRt = pill.rectTransform;
        pillRt.anchorMin = new Vector2(0.5f, 0f);
        pillRt.anchorMax = new Vector2(0.5f, 0f);
        pillRt.pivot = new Vector2(0.5f, 0f);
        pillRt.sizeDelta = new Vector2(480f, 64f);
        pillRt.anchoredPosition = new Vector2(0f, 12f);

        panelTitle = ARDesignUiUtil.CreateText(pill.transform, "", 22, FontStyle.Bold, TextAnchor.MiddleCenter);
        panelTitle.color = InkOnDark;
        panelTitle.raycastTarget = false;
        panelTitle.horizontalOverflow = HorizontalWrapMode.Overflow;
        var titleRt = panelTitle.rectTransform;
        titleRt.anchorMin = Vector2.zero;
        titleRt.anchorMax = Vector2.one;
        titleRt.offsetMin = new Vector2(16f, 0f);
        titleRt.offsetMax = new Vector2(-16f, 0f);

        categoryContent = null;
        panelCount = null;

        BuildBottomCircles(root.transform);
        ApplyBottomSafeLayout();
        UpdatePanelVisibility();
        RefreshToolButtons();
        uiBuilt = true;
    }

    float ResolveBottomClearance()
    {
        // Lift controls above Android/iOS system nav / home indicator.
        var safeBottomPx = Screen.safeArea.yMin;
        var canvasBottom = Screen.height > 0
            ? safeBottomPx * (1920f / Screen.height)
            : 0f;
        return Mathf.Max(bottomNavClearance, canvasBottom + 36f);
    }

    void ApplyBottomSafeLayout()
    {
        var clearance = ResolveBottomClearance();

        if (bottomCirclesBar != null)
            bottomCirclesBar.anchoredPosition = new Vector2(0f, clearance);

        if (furnitureDockRt != null)
        {
            // Sit the filter carousel above the action circles.
            var aboveCircles = clearance + saveCircleSize * 0.5f + 110f;
            furnitureDockRt.anchoredPosition = new Vector2(0f, aboveCircles);
        }
    }

    static ScrollRect CreateHorizontalScrollArea(
        Transform parent,
        float anchorY,
        float pivotY,
        float anchoredY,
        float height,
        float sidePad,
        out RectTransform content)
    {
        var scrollGo = new GameObject("HScroll", typeof(RectTransform), typeof(ScrollRect), typeof(Image), typeof(RectMask2D));
        scrollGo.transform.SetParent(parent, false);

        var scrollRt = scrollGo.GetComponent<RectTransform>();
        scrollRt.anchorMin = new Vector2(0f, anchorY);
        scrollRt.anchorMax = new Vector2(1f, anchorY);
        scrollRt.pivot = new Vector2(0.5f, pivotY);
        scrollRt.anchoredPosition = new Vector2(0f, anchoredY);
        scrollRt.sizeDelta = new Vector2(-(sidePad * 2f), height);

        var scrollImg = scrollGo.GetComponent<Image>();
        scrollImg.color = Color.clear;
        scrollImg.raycastTarget = true;

        var scroll = scrollGo.GetComponent<ScrollRect>();
        scroll.horizontal = true;
        scroll.vertical = false;
        scroll.movementType = ScrollRect.MovementType.Clamped;
        scroll.scrollSensitivity = 28f;

        var contentGo = new GameObject("Content", typeof(RectTransform), typeof(HorizontalLayoutGroup), typeof(ContentSizeFitter));
        contentGo.transform.SetParent(scrollGo.transform, false);
        content = contentGo.GetComponent<RectTransform>();
        content.anchorMin = new Vector2(0f, 0f);
        content.anchorMax = new Vector2(0f, 1f);
        content.pivot = new Vector2(0f, 0.5f);
        content.anchoredPosition = Vector2.zero;
        content.sizeDelta = new Vector2(0f, 0f);

        var layout = contentGo.GetComponent<HorizontalLayoutGroup>();
        layout.childAlignment = TextAnchor.MiddleLeft;
        layout.childControlHeight = false;
        layout.childControlWidth = false;
        layout.childForceExpandHeight = false;
        layout.childForceExpandWidth = false;
        layout.spacing = 10f;
        layout.padding = new RectOffset(4, 16, 0, 0);

        var fitter = contentGo.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
        fitter.verticalFit = ContentSizeFitter.FitMode.Unconstrained;

        scroll.content = content;
        scroll.viewport = scrollRt;
        return scroll;
    }

    void BuildBottomCircles(Transform canvasRoot)
    {
        var bar = new GameObject("BottomCircles", typeof(RectTransform));
        bar.transform.SetParent(canvasRoot, false);
        bottomCirclesBar = bar.GetComponent<RectTransform>();
        bottomCirclesBar.anchorMin = new Vector2(0f, 0f);
        bottomCirclesBar.anchorMax = new Vector2(1f, 0f);
        bottomCirclesBar.pivot = new Vector2(0.5f, 0f);
        bottomCirclesBar.sizeDelta = new Vector2(0f, 200f);
        bottomCirclesBar.anchoredPosition = Vector2.zero;

        CreateCircleButton(
            bar.transform,
            "Undo",
            LoadUiIcon("UIIcons/undo-icon", DrawIconUndo),
            sideCircleSize,
            ToolBg,
            Ink,
            new Vector2(-210f, 72f),
            OnUndoPressed,
            out undoButton,
            out undoButtonBg,
            out undoIcon);

        CreateCircleButton(
            bar.transform,
            "SavePhoto",
            null, // plain navy circle — no camera icon
            saveCircleSize,
            Navy,
            InkOnDark,
            new Vector2(0f, 76f),
            OnSavePhotoPressed,
            out saveButton,
            out saveButtonBg,
            out saveIcon);

        CreateCircleButton(
            bar.transform,
            "FurniturePicker",
            LoadUiIconTintable("UIIcons/cube-icon", DrawIconFurniture),
            sideCircleSize,
            ToolBg,
            Ink,
            new Vector2(210f, 72f),
            OnPickerTogglePressed,
            out pickerButton,
            out pickerButtonBg,
            out pickerIcon);
    }

    void CreateCircleButton(
        Transform parent,
        string name,
        Sprite icon,
        float size,
        Color bgColor,
        Color iconColor,
        Vector2 anchoredPos,
        UnityEngine.Events.UnityAction onClick,
        out Button button,
        out Image background,
        out Image iconImage)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);

        background = go.GetComponent<Image>();
        ARDesignUiUtil.ApplyCircle(background);
        background.color = bgColor;

        button = go.GetComponent<Button>();
        button.targetGraphic = background;
        button.transition = Selectable.Transition.None;
        button.onClick.AddListener(onClick);

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0.5f, 0f);
        rt.anchorMax = new Vector2(0.5f, 0f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(size, size);
        rt.anchoredPosition = anchoredPos;

        iconImage = null;
        if (icon == null)
            return;

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(go.transform, false);
        iconImage = iconGo.GetComponent<Image>();
        iconImage.sprite = icon;
        iconImage.preserveAspect = true;
        iconImage.raycastTarget = false;
        iconImage.color = iconColor;
        var iconRt = iconGo.GetComponent<RectTransform>();
        iconRt.anchorMin = new Vector2(0.22f, 0.22f);
        iconRt.anchorMax = new Vector2(0.78f, 0.78f);
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;

        glyphSprites[$"tool_{name}"] = icon;
    }

    static Sprite LoadUiIcon(string resourcesPath, System.Func<Sprite> fallback)
    {
        var sprite = Resources.Load<Sprite>(resourcesPath);
        if (sprite != null) return sprite;

        var tex = Resources.Load<Texture2D>(resourcesPath);
        if (tex != null)
        {
            return Sprite.Create(
                tex,
                new Rect(0f, 0f, tex.width, tex.height),
                new Vector2(0.5f, 0.5f),
                100f);
        }

        return fallback != null ? fallback() : null;
    }

    /// <summary>
    /// Loads a black line-art icon as white so Image.color tinting works on both
    /// light and dark button backgrounds (black pixels cannot be tinted lighter).
    /// </summary>
    static Sprite LoadUiIconTintable(string resourcesPath, System.Func<Sprite> fallback)
    {
        Texture2D source = null;
        var sprite = Resources.Load<Sprite>(resourcesPath);
        if (sprite != null)
            source = sprite.texture;
        if (source == null)
            source = Resources.Load<Texture2D>(resourcesPath);

        if (source == null)
            return fallback != null ? fallback() : null;

        var w = source.width;
        var h = source.height;
        var readable = new Texture2D(w, h, TextureFormat.RGBA32, false)
        {
            filterMode = FilterMode.Bilinear,
            wrapMode = TextureWrapMode.Clamp,
            hideFlags = HideFlags.HideAndDontSave,
        };

        var tmp = RenderTexture.GetTemporary(w, h, 0, RenderTextureFormat.ARGB32);
        Graphics.Blit(source, tmp);
        var prev = RenderTexture.active;
        RenderTexture.active = tmp;
        readable.ReadPixels(new Rect(0, 0, w, h), 0, 0);
        readable.Apply(false, false);
        RenderTexture.active = prev;
        RenderTexture.ReleaseTemporary(tmp);

        var pixels = readable.GetPixels32();
        for (var i = 0; i < pixels.Length; i++)
        {
            var p = pixels[i];
            if (p.a < 8) continue;
            // Keep alpha, force stroke to white so UI tint can darken/lighten it.
            pixels[i] = new Color32(255, 255, 255, p.a);
        }

        readable.SetPixels32(pixels);
        readable.Apply(false, true);
        return Sprite.Create(readable, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 100f);
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

    static Sprite DrawIconFurniture()
    {
        return DrawIcon(64, (tex, s) =>
        {
            // Simple chair / cube glyph for the picker
            FillRect(tex, s, 18, 14, 28, 6, Color.white);
            FillRect(tex, s, 18, 20, 6, 22, Color.white);
            FillRect(tex, s, 40, 20, 6, 22, Color.white);
            FillRect(tex, s, 18, 36, 28, 8, Color.white);
            FillRect(tex, s, 18, 44, 6, 10, Color.white);
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
