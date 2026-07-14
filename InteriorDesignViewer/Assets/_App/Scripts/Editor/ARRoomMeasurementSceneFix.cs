#if UNITY_EDITOR
using System.IO;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

/// <summary>
/// Rebuilds ARRoomMeasurement using the working AR rig from ARFurnitureDev.
/// </summary>
public static class ARRoomMeasurementSceneFix
{
    const string TemplateScenePath = "Assets/Scenes/ARFurnitureDev.unity";
    const string MeasurementScenePath = "Assets/Scenes/ARRoomMeasurement.unity";
    const string PrefabFolder = "Assets/_App/Prefabs/Measurement";

    [MenuItem("AR Interior/Repair ARRoomMeasurement AR Rig", false, 7)]
    public static void RepairMeasurementScene()
    {
        if (!File.Exists(TemplateScenePath))
        {
            EditorUtility.DisplayDialog("AR Interior", "Template scene not found:\n" + TemplateScenePath, "OK");
            return;
        }

        if (File.Exists(MeasurementScenePath) &&
            !EditorUtility.DisplayDialog(
                "Repair ARRoomMeasurement",
                "Rebuild ARRoomMeasurement from ARFurnitureDev?\n\n" +
                "This fixes AR camera tracking and the placement indicator.\n" +
                "Measurement HUD will be recreated.",
                "Repair",
                "Cancel"))
            return;

        BuildFromTemplate(LoadMeasurementPrefabs(), promptOverwrite: false);

        EditorUtility.DisplayDialog(
            "AR Interior",
            "ARRoomMeasurement repaired.\n\nRebuild your APK and test again — the placement indicator should appear when the floor is detected.",
            "OK");
    }

    public static MeasurementPrefabs LoadMeasurementPrefabs()
    {
        return new MeasurementPrefabs
        {
            pointMarker = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabFolder + "/MeasurementPointMarker.prefab"),
            line = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabFolder + "/MeasurementLine.prefab"),
            label = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabFolder + "/MeasurementLabel.prefab"),
        };
    }

    public static void BuildFromTemplate(MeasurementPrefabs prefabs, bool promptOverwrite)
    {
        if (promptOverwrite && File.Exists(MeasurementScenePath) &&
            !EditorUtility.DisplayDialog(
                "Overwrite Scene?",
                "ARRoomMeasurement.unity already exists. Replace it?",
                "Replace",
                "Keep Existing"))
            return;

        AssetDatabase.CopyAsset(TemplateScenePath, MeasurementScenePath);
        AssetDatabase.Refresh();

        var scene = EditorSceneManager.OpenScene(MeasurementScenePath, OpenSceneMode.Single);
        StripFurnitureContent(scene);
        EnsureMeasurementContent(scene, prefabs);
        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene);
    }

    static void StripFurnitureContent(Scene scene)
    {
        var managers = FindRootObject(scene, "Managers");
        if (managers != null)
        {
            RemoveComponentIfExists<FurnitureCatalog>(managers);
            RemoveComponentIfExists<ARFurniturePlacer>(managers);
            RemoveComponentIfExists<UnityMessageBridge>(managers);
            RemoveComponentIfExists<ARFurnitureLighting>(managers);
            RemoveComponentIfExists<ARFurnitureGestureController>(managers);
            RemoveComponentIfExists<ARFurniturePickerUI>(managers);
            RemoveComponentIfExists<ARSessionStateHandler>(managers);
            RemoveComponentIfExists<MeasurementScanController>(managers);
            RemoveComponentIfExists<MeasurementController>(managers);
            RemoveComponentIfExists<MeasurementHUDController>(managers);
        }

        DestroyRootObject(scene, "FurnitureRoot");
        DestroyRootObject(scene, "MeasurementHUD");
        DestroyRootObject(scene, "MeasurementScanOverlay");
        DestroyRootObject(scene, "MeasurementRoot");
        DestroyRootObject(scene, "EventSystem");
    }

    static void EnsureMeasurementContent(Scene scene, MeasurementPrefabs prefabs)
    {
        var placementIndicator = FindRootObject(scene, "PlacementIndicator");
        var placement = EnsurePlacementIndicator(placementIndicator);

        var measurementRoot = new GameObject("MeasurementRoot");
        SceneManager.MoveGameObjectToScene(measurementRoot, scene);

        var managers = FindRootObject(scene, "Managers") ?? new GameObject("Managers");
        if (managers.scene != scene)
            SceneManager.MoveGameObjectToScene(managers, scene);

        if (managers.GetComponent<MeasurementScanController>() == null)
            managers.AddComponent<MeasurementScanController>();

        var controller = managers.GetComponent<MeasurementController>() ?? managers.AddComponent<MeasurementController>();

        var xrOrigin = FindRootObject(scene, "XR Origin");
        var planeManager = xrOrigin != null ? xrOrigin.GetComponent<UnityEngine.XR.ARFoundation.ARPlaneManager>() : null;
        var mainCamera = Camera.main;

        var scan = managers.GetComponent<MeasurementScanController>();
        var scanSo = new SerializedObject(scan);
        scanSo.FindProperty("planeManager").objectReferenceValue = planeManager;
        scanSo.FindProperty("arCamera").objectReferenceValue = mainCamera;
        scanSo.FindProperty("placementIndicator").objectReferenceValue = placement;
        scanSo.FindProperty("minDepthBelowCamera").floatValue = 0.35f;
        scanSo.FindProperty("scanMinArea").floatValue = 0.15f;
        scanSo.FindProperty("scanRequiredDuration").floatValue = 1f;
        scanSo.ApplyModifiedPropertiesWithoutUndo();

        var controllerSo = new SerializedObject(controller);
        controllerSo.FindProperty("placementIndicator").objectReferenceValue = placement;
        controllerSo.FindProperty("arCamera").objectReferenceValue = mainCamera;
        controllerSo.FindProperty("scanController").objectReferenceValue = scan;
        controllerSo.FindProperty("pointMarkerPrefab").objectReferenceValue = prefabs.pointMarker;
        controllerSo.FindProperty("linePrefab").objectReferenceValue = prefabs.line;
        controllerSo.FindProperty("labelPrefab").objectReferenceValue = prefabs.label;
        controllerSo.FindProperty("measurementRoot").objectReferenceValue = measurementRoot.transform;
        controllerSo.FindProperty("lineWidth").floatValue = 0.02f;
        controllerSo.FindProperty("pointScale").floatValue = 0.06f;
        controllerSo.FindProperty("floorVisualInset").floatValue = 0.015f;
        controllerSo.FindProperty("maxHeightMeters").floatValue = 6f;
        controllerSo.ApplyModifiedPropertiesWithoutUndo();

        var overlayGo = new GameObject("MeasurementScanOverlay");
        SceneManager.MoveGameObjectToScene(overlayGo, scene);
        overlayGo.AddComponent<MeasurementScanOverlay>();

        CreateMeasurementHud(managers, controller, scan, scene);

        var eventSystemGo = new GameObject("EventSystem");
        SceneManager.MoveGameObjectToScene(eventSystemGo, scene);
        eventSystemGo.AddComponent<EventSystem>();
        eventSystemGo.AddComponent<InputSystemUIInputModule>();
    }

    static ARPlacementIndicator EnsurePlacementIndicator(GameObject placementObject)
    {
        if (placementObject == null)
            return null;

        var placement = placementObject.GetComponent<ARPlacementIndicator>();
        if (placement == null)
            placement = placementObject.AddComponent<PlacementIndicator>();

        var placementSo = new SerializedObject(placement);
        placementSo.FindProperty("minDepthBelowCamera").floatValue = 0.35f;
        placementSo.ApplyModifiedPropertiesWithoutUndo();
        return placement;
    }

    static void CreateMeasurementHud(
        GameObject managersGo,
        MeasurementController controller,
        MeasurementScanController scanController,
        Scene scene)
    {
        var canvasGo = new GameObject("MeasurementHUD");
        SceneManager.MoveGameObjectToScene(canvasGo, scene);

        var canvas = canvasGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 10;
        canvasGo.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        canvasGo.AddComponent<GraphicRaycaster>();

        var controlsRoot = new GameObject("MeasurementControls");
        controlsRoot.transform.SetParent(canvasGo.transform, false);
        var controlsRect = controlsRoot.AddComponent<RectTransform>();
        controlsRect.anchorMin = Vector2.zero;
        controlsRect.anchorMax = Vector2.one;
        controlsRect.offsetMin = Vector2.zero;
        controlsRect.offsetMax = Vector2.zero;

        var hud = canvasGo.AddComponent<MeasurementHUDController>();
        var scanOverlay = FindRootObject(scene, "MeasurementScanOverlay")?.GetComponent<MeasurementScanOverlay>();

        // ── Shared UI ──────────────────────────────────────────────────────────
        var scanHint = CreateHudText(controlsRoot.transform, "ScanHintText", new Vector2(0.5f, 0.92f),
            new Vector2(720f, 56f), 24, "Move phone to start");
        var status = CreateHudText(controlsRoot.transform, "StatusText", new Vector2(0.5f, 0.84f),
            new Vector2(720f, 48f), 20, "Tap to place the first point.");

        // ── Distance UI ────────────────────────────────────────────────────────
        var live = CreateHudText(controlsRoot.transform, "LiveDistanceText", new Vector2(0.5f, 0.76f),
            new Vector2(480f, 64f), 34, string.Empty);
        live.fontStyle = FontStyles.Bold;



        // ── Mode / Tool Selection Dropdown ─────────────────────────────────────
        var dropdownGo = CreateDropdown(controlsRoot.transform, "ModeDropdown",
            new Vector2(0.5f, 0.09f), new Vector2(360f, 56f));


        // ── Height UI ──────────────────────────────────────────────────────────

        // "Move aim Up to extrude Height" banner — dark pill container + text child.
        // Image and TextMeshProUGUI cannot share the same GameObject (both are Graphic).
        // Solution: Image on parent, TMP_Text on child; toggle the parent to show/hide both.
        var heightBannerGo = new GameObject("HeightInstructionBanner");
        heightBannerGo.transform.SetParent(controlsRoot.transform, false);
        var heightBannerGoRect = heightBannerGo.AddComponent<RectTransform>();
        heightBannerGoRect.anchorMin = new Vector2(0.5f, 0.78f);
        heightBannerGoRect.anchorMax = new Vector2(0.5f, 0.78f);
        heightBannerGoRect.pivot = new Vector2(0.5f, 0.5f);
        heightBannerGoRect.sizeDelta = new Vector2(640f, 52f);
        heightBannerGoRect.anchoredPosition = Vector2.zero;
        var heightBannerImg = heightBannerGo.AddComponent<Image>();
        heightBannerImg.color = new Color(0.122f, 0.122f, 0.122f, 0.82f); // overlay rgba(31,31,31,0.82)
        ConfigureRoundedImage(heightBannerImg);
        heightBannerGo.SetActive(false); // hidden until Extruding

        // TMP_Text child inside the banner container
        var heightBannerTextGo = new GameObject("HeightInstructionText");
        heightBannerTextGo.transform.SetParent(heightBannerGo.transform, false);
        var heightBannerTextRect = heightBannerTextGo.AddComponent<RectTransform>();
        heightBannerTextRect.anchorMin = Vector2.zero;
        heightBannerTextRect.anchorMax = Vector2.one;
        heightBannerTextRect.offsetMin = Vector2.zero;
        heightBannerTextRect.offsetMax = Vector2.zero;
        var heightBanner = heightBannerTextGo.AddComponent<TextMeshProUGUI>();
        heightBanner.text = "Move aim Up to extrude Height";
        heightBanner.fontSize = 22f;
        heightBanner.alignment = TextAlignmentOptions.Center;
        heightBanner.color = Color.white;
        heightBanner.raycastTarget = false;

        // Start button — bottom-center
        var startGo = CreateHudButton(controlsRoot.transform, "StartButton",
            new Vector2(0.5f, 0.17f), new Vector2(240f, 64f), "Start");
        startGo.SetActive(false); // hidden initially

        // Finish button — bottom-center
        var finishGo = CreateHudButton(controlsRoot.transform, "FinishButton",
            new Vector2(0.5f, 0.17f), new Vector2(240f, 64f), "Finish");
        finishGo.GetComponent<Image>().color = new Color(0.380f, 0.451f, 0.392f, 0.95f); // accentDark #617364 Deep Sage
        finishGo.SetActive(false); // hidden initially


        // ── Clear / Undo buttons ───────────────────────────────────────────────
        var clearGo = CreateHudButton(controlsRoot.transform, "ClearButton", new Vector2(0.15f, 0.09f),
            new Vector2(160f, 52f), "Clear");
        var undoGo = CreateHudButton(controlsRoot.transform, "UndoButton", new Vector2(0.85f, 0.09f),
            new Vector2(160f, 52f), "Undo");

        // ── Wire HUD serialized fields ─────────────────────────────────────────
        var hudSo = new SerializedObject(hud);
        hudSo.FindProperty("scanController").objectReferenceValue = scanController;
        hudSo.FindProperty("scanOverlay").objectReferenceValue = scanOverlay;
        hudSo.FindProperty("measurementControlsRoot").objectReferenceValue = controlsRoot;
        hudSo.FindProperty("measurementController").objectReferenceValue = controller;
        hudSo.FindProperty("scanHintText").objectReferenceValue = scanHint;
        hudSo.FindProperty("statusText").objectReferenceValue = status;
        // Distance
        hudSo.FindProperty("liveDistanceText").objectReferenceValue = live;
        hudSo.FindProperty("modeDropdown").objectReferenceValue = dropdownGo.GetComponent<TMP_Dropdown>();
        // Height
        hudSo.FindProperty("heightInstructionText").objectReferenceValue = heightBanner;
        hudSo.FindProperty("heightBannerRoot").objectReferenceValue = heightBannerGo;
        // Action Buttons
        hudSo.FindProperty("startButton").objectReferenceValue = startGo.GetComponent<Button>();
        hudSo.FindProperty("finishButton").objectReferenceValue = finishGo.GetComponent<Button>();
        // Buttons
        hudSo.FindProperty("clearButton").objectReferenceValue = clearGo.GetComponent<Button>();
        hudSo.FindProperty("undoButton").objectReferenceValue = undoGo.GetComponent<Button>();
        hudSo.ApplyModifiedPropertiesWithoutUndo();

    }

    static TMP_Text CreateHudText(Transform parent, string name, Vector2 anchor, Vector2 size, float fontSize, string text)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = anchor;
        rect.anchorMax = anchor;
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.sizeDelta = size;
        rect.anchoredPosition = Vector2.zero;

        var tmp = go.AddComponent<TextMeshProUGUI>();
        tmp.text = text;
        tmp.fontSize = fontSize;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = Color.white;
        tmp.raycastTarget = false;
        return tmp;
    }

    static GameObject CreateHudButton(Transform parent, string name, Vector2 anchor, Vector2 size, string label)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = anchor;
        rect.anchorMax = anchor;
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.sizeDelta = size;
        rect.anchoredPosition = Vector2.zero;

        var image = go.AddComponent<Image>();
        image.color = new Color(0.478f, 0.561f, 0.482f, 0.92f); // accent #7A8F7B Muted Sage
        ConfigureRoundedImage(image);

        var button = go.AddComponent<Button>();
        button.targetGraphic = image;

        var textGo = new GameObject("Label");
        textGo.transform.SetParent(go.transform, false);
        var textRect = textGo.AddComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;

        var tmp = textGo.AddComponent<TextMeshProUGUI>();
        tmp.text = label;
        tmp.fontSize = 22f;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = Color.white;
        tmp.raycastTarget = false;

        return go;
    }

    static GameObject CreateDropdown(Transform parent, string name, Vector2 anchor, Vector2 size)
    {
        var resources = new TMPro.TMP_DefaultControls.Resources();
        resources.standard = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/Background.psd");
        resources.background = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/Background.psd");
        resources.inputField = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/InputFieldBackground.psd");
        resources.knob = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/Knob.psd");
        resources.checkmark = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/Checkmark.psd");
        resources.dropdown = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/DropdownArrow.psd");
        resources.mask = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/UIMask.psd");

        var go = TMPro.TMP_DefaultControls.CreateDropdown(resources);
        go.name = name;
        go.transform.SetParent(parent, false);

        var rect = go.GetComponent<RectTransform>();
        rect.anchorMin = anchor;
        rect.anchorMax = anchor;
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.sizeDelta = size;
        rect.anchoredPosition = Vector2.zero;

        // Customize dropdown colors and rounded corner borders
        var image = go.GetComponent<Image>();
        if (image != null)
        {
            image.color = new Color(0.478f, 0.561f, 0.482f, 0.92f); // accent #7A8F7B Muted Sage
            ConfigureRoundedImage(image);
        }

        var labelText = go.transform.Find("Label")?.GetComponent<TextMeshProUGUI>();
        if (labelText != null)
        {
            labelText.text = "Single Measurement";
            labelText.color = Color.white;
            labelText.alignment = TextAlignmentOptions.Center;
            labelText.fontSize = 20f;
        }

        var arrowImg = go.transform.Find("Arrow")?.GetComponent<Image>();
        if (arrowImg != null)
        {
            arrowImg.color = Color.white;
        }

        // Populate dropdown options list and refresh the display value at design-time
        var dropdown = go.GetComponent<TMP_Dropdown>();
        if (dropdown != null)
        {
            dropdown.ClearOptions();
            dropdown.options.Add(new TMP_Dropdown.OptionData("Single Measurement"));
            dropdown.options.Add(new TMP_Dropdown.OptionData("Chained / Perimeter"));
            dropdown.options.Add(new TMP_Dropdown.OptionData("Height Measurement"));
            dropdown.RefreshShownValue();
        }

        // Customize the template scrollview styling when dropdown is expanded
        var template = go.transform.Find("Template")?.gameObject;
        if (template != null)
        {
            var templateImg = template.GetComponent<Image>();
            if (templateImg != null)
            {
                templateImg.color = Color.white; // Clean white background for the options list
                ConfigureRoundedImage(templateImg);
            }

            // Set item label text to Soft Black #1F1F1F for high contrast readability
            var itemText = template.transform.Find("Viewport/Content/Item/Item Label")?.GetComponent<TextMeshProUGUI>();
            if (itemText != null)
            {
                itemText.color = new Color(0.122f, 0.122f, 0.122f, 1f);
                itemText.fontSize = 20f;
            }

            // Set checkmark color to Muted Sage #7A8F7B
            var checkmarkImg = template.transform.Find("Viewport/Content/Item/Item Checkmark")?.GetComponent<Image>();
            if (checkmarkImg != null)
            {
                checkmarkImg.color = new Color(0.478f, 0.561f, 0.482f, 1f);
            }
        }

        return go;
    }

    static void ConfigureRoundedImage(Image image)

    {
        if (image == null) return;
        var sprite = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/UISprite.psd");
        if (sprite != null)
        {
            image.sprite = sprite;
            image.type = Image.Type.Sliced;
        }
    }


    static GameObject FindRootObject(Scene scene, string name)
    {
        foreach (var root in scene.GetRootGameObjects())
        {
            if (root.name == name)
                return root;
        }

        return null;
    }

    static void DestroyRootObject(Scene scene, string name)
    {
        var obj = FindRootObject(scene, name);
        if (obj != null)
            Object.DestroyImmediate(obj);
    }

    static void RemoveComponentIfExists<T>(GameObject go) where T : Component
    {
        var component = go.GetComponent<T>();
        if (component != null)
            Object.DestroyImmediate(component);
    }

    public struct MeasurementPrefabs
    {
        public GameObject pointMarker;
        public GameObject line;
        public GameObject label;
    }
}
#endif
