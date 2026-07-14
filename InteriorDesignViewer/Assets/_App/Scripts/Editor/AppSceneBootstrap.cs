#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

/// <summary>
/// One-click setup for _App measurement scenes, prefabs, and build settings.
/// Menu: AR Interior → Setup _App Measurement Scenes
/// </summary>
public static class AppSceneBootstrap
{
    const string ScenesFolder = "Assets/Scenes";
    const string PrefabFolder = "Assets/_App/Prefabs/Measurement";
    const string MainMenuScenePath = ScenesFolder + "/MainMenu.unity";
    const string MeasurementScenePath = ScenesFolder + "/ARRoomMeasurement.unity";
    const string FurnitureScenePath = ScenesFolder + "/ARFurnitureDev.unity";
    const string FurnitureFallbackPath = ScenesFolder + "/ARFurniture.unity";
    const string CursorMaterialPath = "Assets/Materials/cursor.mat";
    const string MaterialsFolder = "Assets/_App/Materials";

    [MenuItem("AR Interior/Fix Measurement Line Visuals", false, 6)]
    public static void FixMeasurementVisuals()
    {
        EnsureMaterialFolder();
        var lineMat = GetOrCreateLineMaterial();
        var pointMat = GetOrCreatePointMaterial();
        RefreshLinePrefab(lineMat);
        RefreshPointPrefab(pointMat);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        EditorUtility.DisplayDialog(
            "AR Interior",
            "Measurement line and point prefabs updated with URP-safe materials.\n\nRebuild your APK to see lines on device.",
            "OK");
    }

    static void EnsureMaterialFolder()
    {
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "_App/Materials"));
        AssetDatabase.Refresh();
    }

    static Material GetOrCreateLineMaterial()
    {
        const string path = MaterialsFolder + "/MeasurementLine.mat";
        var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing != null)
            return existing;

        var mat = CreateUnlitMaterial(new Color(0.12f, 0.75f, 1f, 1f));
        AssetDatabase.CreateAsset(mat, path);
        return mat;
    }

    static Material GetOrCreatePointMaterial()
    {
        const string path = MaterialsFolder + "/MeasurementPoint.mat";
        var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing != null)
            return existing;

        var mat = CreateUnlitMaterial(new Color(1f, 0.85f, 0.15f, 1f));
        AssetDatabase.CreateAsset(mat, path);
        return mat;
    }

    static Material CreateUnlitMaterial(Color color)
    {
        var shader =
            Shader.Find("Universal Render Pipeline/Unlit") ??
            Shader.Find("Unlit/Color") ??
            Shader.Find("Sprites/Default");

        var mat = new Material(shader);
        if (mat.HasProperty("_BaseColor"))
            mat.SetColor("_BaseColor", color);
        mat.color = color;
        return mat;
    }

    static void RefreshLinePrefab(Material lineMat)
    {
        var linePath = PrefabFolder + "/MeasurementLine.prefab";
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(linePath);
        if (prefab == null)
            return;

        var instance = PrefabUtility.LoadPrefabContents(linePath);
        var lr = instance.GetComponent<LineRenderer>();
        if (lr != null)
        {
            lr.useWorldSpace = true;
            lr.startWidth = 0.02f;
            lr.endWidth = 0.02f;
            lr.numCapVertices = 8;
            lr.alignment = LineAlignment.View;
            lr.material = lineMat;
            lr.startColor = lineMat.color;
            lr.endColor = lineMat.color;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
        }

        PrefabUtility.SaveAsPrefabAsset(instance, linePath);
        PrefabUtility.UnloadPrefabContents(instance);
    }

    static void RefreshPointPrefab(Material pointMat)
    {
        var pointPath = PrefabFolder + "/MeasurementPointMarker.prefab";
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(pointPath);
        if (prefab == null)
            return;

        var instance = PrefabUtility.LoadPrefabContents(pointPath);
        instance.transform.localScale = Vector3.one * 0.06f;
        var renderer = instance.GetComponent<Renderer>();
        if (renderer != null)
        {
            renderer.sharedMaterial = pointMat;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
        }

        PrefabUtility.SaveAsPrefabAsset(instance, pointPath);
        PrefabUtility.UnloadPrefabContents(instance);
    }

    [MenuItem("AR Interior/Setup AR Measurement Scene", false, 5)]
    public static void SetupAppScenes()
    {
        EnsureFolders();
        var prefabs = CreateMeasurementPrefabs();
        CreateMeasurementScene(prefabs);
        CreateMainMenuScene();
        ConfigureBuildSettings();

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        EditorUtility.DisplayDialog(
            "AR Interior",
            "Setup complete.\n\n" +
            "Scenes saved under Assets/Scenes/:\n" +
            "• MainMenu.unity\n" +
            "• ARRoomMeasurement.unity\n" +
            "(Furniture uses existing ARFurnitureDev.unity)\n\n" +
            "Open MainMenu.unity and press Play to test scene switching.",
            "OK");

        EditorSceneManager.OpenScene(MainMenuScenePath);
    }

    static void EnsureFolders()
    {
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "Scenes"));
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "_App/Prefabs/Measurement"));
        AssetDatabase.Refresh();
    }

    struct MeasurementPrefabs
    {
        public GameObject pointMarker;
        public GameObject line;
        public GameObject label;
    }

    static MeasurementPrefabs CreateMeasurementPrefabs()
    {
        EnsureMaterialFolder();
        var pointPath = PrefabFolder + "/MeasurementPointMarker.prefab";
        var linePath = PrefabFolder + "/MeasurementLine.prefab";
        var labelPath = PrefabFolder + "/MeasurementLabel.prefab";

        var pointMat = GetOrCreatePointMaterial();
        var lineMat = GetOrCreateLineMaterial();

        var point = AssetDatabase.LoadAssetAtPath<GameObject>(pointPath);
        if (point == null)
        {
            var root = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            root.name = "MeasurementPointMarker";
            root.transform.localScale = Vector3.one * 0.06f;
            Object.DestroyImmediate(root.GetComponent<Collider>());
            var renderer = root.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.sharedMaterial = pointMat;
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                renderer.receiveShadows = false;
            }

            point = PrefabUtility.SaveAsPrefabAsset(root, pointPath);
            Object.DestroyImmediate(root);
        }

        var line = AssetDatabase.LoadAssetAtPath<GameObject>(linePath);
        if (line == null)
        {
            var root = new GameObject("MeasurementLine");
            var lr = root.AddComponent<LineRenderer>();
            lr.useWorldSpace = true;
            lr.positionCount = 2;
            lr.startWidth = 0.02f;
            lr.endWidth = 0.02f;
            lr.numCapVertices = 8;
            lr.alignment = LineAlignment.View;
            lr.material = lineMat;
            lr.startColor = lineMat.color;
            lr.endColor = lineMat.color;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;

            line = PrefabUtility.SaveAsPrefabAsset(root, linePath);
            Object.DestroyImmediate(root);
        }

        var label = AssetDatabase.LoadAssetAtPath<GameObject>(labelPath);
        if (label == null)
        {
            var root = new GameObject("MeasurementLabel");
            root.transform.localScale = Vector3.one * 0.001f;
            var billboard = root.AddComponent<MeasurementLabel>();

            var canvasGo = new GameObject("Canvas");
            canvasGo.transform.SetParent(root.transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            var rect = canvasGo.GetComponent<RectTransform>();
            rect.sizeDelta = new Vector2(200f, 60f);

            var textGo = new GameObject("DistanceText");
            textGo.transform.SetParent(canvasGo.transform, false);
            var textRect = textGo.AddComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;

            var tmp = textGo.AddComponent<TextMeshProUGUI>();
            tmp.text = "0.00 m";
            tmp.fontSize = 36f;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = Color.white;

            var so = new SerializedObject(billboard);
            so.FindProperty("labelText").objectReferenceValue = tmp;
            so.FindProperty("billboardTarget").objectReferenceValue = root.transform;
            so.ApplyModifiedPropertiesWithoutUndo();

            label = PrefabUtility.SaveAsPrefabAsset(root, labelPath);
            Object.DestroyImmediate(root);
        }

        return new MeasurementPrefabs
        {
            pointMarker = point,
            line = line,
            label = label,
        };
    }

    static void CreateMeasurementScene(MeasurementPrefabs prefabs)
    {
        ARRoomMeasurementSceneFix.BuildFromTemplate(new ARRoomMeasurementSceneFix.MeasurementPrefabs
        {
            pointMarker = prefabs.pointMarker,
            line = prefabs.line,
            label = prefabs.label,
        }, promptOverwrite: true);
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

        var sprite = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/UISprite.psd");
        if (sprite != null)
        {
            image.sprite = sprite;
            image.type = Image.Type.Sliced;
        }

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

        return go;
    }

    [MenuItem("AR Interior/Repair MainMenu Scene", false, 8)]
    public static void RepairMainMenuScene()
    {
        CreateMainMenuScene();
        EditorUtility.DisplayDialog(
            "AR Interior",
            "MainMenu scene rebuilt and styled to match the color palette.",
            "OK");
    }

    static void CreateMainMenuScene()
    {
        if (File.Exists(MainMenuScenePath))
        {
            if (!EditorUtility.DisplayDialog(
                    "Overwrite Scene?",
                    "MainMenu.unity already exists. Replace it?",
                    "Replace",
                    "Keep Existing"))
                return;
        }

        var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);

        // Style the Main Camera to use solid Warm Ivory background instead of skybox
        var mainCam = Camera.main;
        if (mainCam != null)
        {
            mainCam.clearFlags = CameraClearFlags.SolidColor;
            mainCam.backgroundColor = new Color(0.980f, 0.976f, 0.969f, 1f); // Warm Ivory #FAF9F7
        }

        var canvasGo = new GameObject("MainMenuCanvas");
        var canvas = canvasGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvasGo.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        canvasGo.AddComponent<GraphicRaycaster>();

        // Create gradient background panel matching the login page aesthetic
        var bgGo = new GameObject("BackgroundPanel");
        bgGo.transform.SetParent(canvasGo.transform, false);
        var bgRect = bgGo.AddComponent<RectTransform>();
        bgRect.anchorMin = Vector2.zero;
        bgRect.anchorMax = Vector2.one;
        bgRect.offsetMin = Vector2.zero;
        bgRect.offsetMax = Vector2.zero;
        var bgImg = bgGo.AddComponent<Image>();
        bgImg.color = Color.white;
        var gradient = bgGo.AddComponent<UIGradient>();
        gradient.ColorTop = new Color(0.773f, 0.827f, 0.780f, 1f);    // Soft Sage #C5D3C7
        gradient.ColorBottom = new Color(0.980f, 0.976f, 0.969f, 1f); // Warm Ivory #FAF9F7
        bgGo.transform.SetAsFirstSibling();

        var controllerGo = new GameObject("MainMenuController");
        var controller = controllerGo.AddComponent<MainMenuController>();

        // Title text using Soft Black #1F1F1F centered and offset upwards
        var title = CreateHudText(canvasGo.transform, "Title", new Vector2(0.5f, 0.5f),
            new Vector2(500f, 60f), 34, "AR Interior Design");
        title.rectTransform.anchoredPosition = new Vector2(0f, 180f);
        title.color = new Color(0.122f, 0.122f, 0.122f, 1f);
        title.fontStyle = FontStyles.Bold;

        // Place Furniture button offset 50px above center
        var furnitureBtn = CreateHudButton(canvasGo.transform, "FurnitureButton", new Vector2(0.5f, 0.5f),
            new Vector2(360f, 64f), "Place Furniture");
        furnitureBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(0f, 50f);

        // Measure Room button offset 50px below center
        var measureBtn = CreateHudButton(canvasGo.transform, "MeasurementButton", new Vector2(0.5f, 0.5f),
            new Vector2(360f, 64f), "Measure Room");
        measureBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(0f, -50f);

        var controllerSo = new SerializedObject(controller);
        controllerSo.FindProperty("furnitureButton").objectReferenceValue = furnitureBtn.GetComponent<Button>();
        controllerSo.FindProperty("measurementButton").objectReferenceValue = measureBtn.GetComponent<Button>();
        controllerSo.ApplyModifiedPropertiesWithoutUndo();

        var eventSystemGo = new GameObject("EventSystem");
        eventSystemGo.AddComponent<EventSystem>();
        eventSystemGo.AddComponent<InputSystemUIInputModule>();

        EditorSceneManager.SaveScene(scene, MainMenuScenePath);
    }

    static void ConfigureBuildSettings()
    {
        var furniturePath = File.Exists(FurnitureScenePath) ? FurnitureScenePath : FurnitureFallbackPath;
        var orderedPaths = new List<string>
        {
            MainMenuScenePath,
            furniturePath,
            MeasurementScenePath,
        };

        var scenes = new List<EditorBuildSettingsScene>();
        foreach (var path in orderedPaths)
        {
            if (!File.Exists(path))
                continue;

            scenes.Add(new EditorBuildSettingsScene(path, true));
        }

        EditorBuildSettings.scenes = scenes.ToArray();
        Debug.Log("[AppSceneBootstrap] Build settings: MainMenu → ARFurnitureDev → ARRoomMeasurement");
    }
}
#endif
