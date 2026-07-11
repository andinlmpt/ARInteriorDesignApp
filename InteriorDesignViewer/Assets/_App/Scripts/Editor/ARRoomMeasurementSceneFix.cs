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
            new Vector2(680f, 48f), 22, "Move phone to start");
        var status = CreateHudText(controlsRoot.transform, "StatusText", new Vector2(0.5f, 0.84f),
            new Vector2(680f, 40f), 18, "Tap to place the first point.");

        // ── Distance UI ────────────────────────────────────────────────────────
        var live = CreateHudText(controlsRoot.transform, "LiveDistanceText", new Vector2(0.5f, 0.76f),
            new Vector2(420f, 56f), 30, string.Empty);
        live.fontStyle = FontStyles.Bold;

        var total = CreateHudText(controlsRoot.transform, "TotalDistanceText", new Vector2(0.5f, 0.12f),
            new Vector2(320f, 44f), 26, "Total: —");

        // Distance sub-mode toggle (Single / Chained)
        var toggleGo = new GameObject("ModeToggle");
        toggleGo.transform.SetParent(controlsRoot.transform, false);
        var toggleRect = toggleGo.AddComponent<RectTransform>();
        toggleRect.anchorMin = new Vector2(0.5f, 0.05f);
        toggleRect.anchorMax = new Vector2(0.5f, 0.05f);
        toggleRect.pivot = new Vector2(0.5f, 0.5f);
        toggleRect.sizeDelta = new Vector2(280f, 44f);
        toggleRect.anchoredPosition = Vector2.zero;
        var toggleBg = toggleGo.AddComponent<Image>();
        toggleBg.color = new Color(0.478f, 0.561f, 0.482f, 0.92f); // accent #7A8F7B Muted Sage
        ConfigureRoundedImage(toggleBg);
        var toggle = toggleGo.AddComponent<Toggle>();
        toggle.targetGraphic = toggleBg;
        var toggleLabelGo = new GameObject("Label");
        toggleLabelGo.transform.SetParent(toggleGo.transform, false);
        var toggleLabelRect = toggleLabelGo.AddComponent<RectTransform>();
        toggleLabelRect.anchorMin = Vector2.zero;
        toggleLabelRect.anchorMax = Vector2.one;
        toggleLabelRect.offsetMin = Vector2.zero;
        toggleLabelRect.offsetMax = Vector2.zero;
        var toggleLabel = toggleLabelGo.AddComponent<TextMeshProUGUI>();
        toggleLabel.text = "Single measurement";
        toggleLabel.fontSize = 20f;
        toggleLabel.alignment = TextAlignmentOptions.Center;
        toggleLabel.color = Color.white;

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

        // Finish button — bottom-center large pill
        var finishGo = CreateHudButton(controlsRoot.transform, "FinishHeightButton",
            new Vector2(0.5f, 0.10f), new Vector2(220f, 56f), "Finish");
        finishGo.GetComponent<Image>().color = new Color(0.380f, 0.451f, 0.392f, 0.95f); // accentDark #617364 Deep Sage
        finishGo.SetActive(false); // hidden until Extruding

        // Tool toggle (Distance | Height) — top-right pill
        var toolToggleGo = new GameObject("ToolToggle");
        toolToggleGo.transform.SetParent(controlsRoot.transform, false);
        var toolToggleRect = toolToggleGo.AddComponent<RectTransform>();
        toolToggleRect.anchorMin = new Vector2(0.88f, 0.92f);
        toolToggleRect.anchorMax = new Vector2(0.88f, 0.92f);
        toolToggleRect.pivot = new Vector2(0.5f, 0.5f);
        toolToggleRect.sizeDelta = new Vector2(160f, 44f);
        toolToggleRect.anchoredPosition = Vector2.zero;
        var toolToggleBg = toolToggleGo.AddComponent<Image>();
        toolToggleBg.color = new Color(0.478f, 0.561f, 0.482f, 0.92f); // accent #7A8F7B Muted Sage
        ConfigureRoundedImage(toolToggleBg);
        var toolToggle = toolToggleGo.AddComponent<Toggle>();
        toolToggle.targetGraphic = toolToggleBg;
        var toolToggleLabelGo = new GameObject("Label");
        toolToggleLabelGo.transform.SetParent(toolToggleGo.transform, false);
        var toolToggleLabelRect = toolToggleLabelGo.AddComponent<RectTransform>();
        toolToggleLabelRect.anchorMin = Vector2.zero;
        toolToggleLabelRect.anchorMax = Vector2.one;
        toolToggleLabelRect.offsetMin = Vector2.zero;
        toolToggleLabelRect.offsetMax = Vector2.zero;
        var toolToggleLabel = toolToggleLabelGo.AddComponent<TextMeshProUGUI>();
        toolToggleLabel.text = "Distance";
        toolToggleLabel.fontSize = 18f;
        toolToggleLabel.alignment = TextAlignmentOptions.Center;
        toolToggleLabel.color = Color.white;

        // ── Clear / Undo buttons ───────────────────────────────────────────────
        var clearGo = CreateHudButton(controlsRoot.transform, "ClearButton", new Vector2(0.14f, 0.05f),
            new Vector2(140f, 44f), "Clear");
        var undoGo = CreateHudButton(controlsRoot.transform, "UndoButton", new Vector2(0.86f, 0.05f),
            new Vector2(140f, 44f), "Undo");

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
        hudSo.FindProperty("totalDistanceText").objectReferenceValue = total;
        hudSo.FindProperty("modeToggle").objectReferenceValue = toggle;
        // Height
        hudSo.FindProperty("heightInstructionText").objectReferenceValue = heightBanner;
        hudSo.FindProperty("heightBannerRoot").objectReferenceValue = heightBannerGo;
        hudSo.FindProperty("finishHeightButton").objectReferenceValue = finishGo.GetComponent<Button>();
        // Tool
        hudSo.FindProperty("toolToggle").objectReferenceValue = toolToggle;
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
        tmp.fontSize = 20f;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = Color.white;
        tmp.raycastTarget = false;

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
