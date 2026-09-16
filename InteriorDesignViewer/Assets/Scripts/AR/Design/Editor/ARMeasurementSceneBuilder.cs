#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Unity.XR.CoreUtils;

/// <summary>
/// Builds Assets/Scenes/ARRoomMeasurement.unity — standalone room measurement
/// (height + corners → Generate Layout → 2D/3D plan). Furniture placement is
/// intentionally excluded; use ARDesignScene for that flow.
/// </summary>
public static class ARMeasurementSceneBuilder
{
    const string TemplateScenePath = "Assets/Scenes/ARFurnitureDev.unity";
    const string FallbackTemplatePath = "Assets/Scenes/ARDesignScene.unity";
    const string MeasurementScenePath = "Assets/Scenes/ARRoomMeasurement.unity";
    const string MainMenuScenePath = "Assets/Scenes/MainMenu.unity";
    const string FurnitureScenePath = "Assets/Scenes/ARDesignScene.unity";

    const string GeneratedFolder = "Assets/_App/Generated/ARDesign";
    const string PlanePrefabPath = GeneratedFolder + "/ARDesignPlaneVisualizer.prefab";
    const string MeshChunkPrefabPath = GeneratedFolder + "/ARDesignMeshChunk.prefab";

    [MenuItem("AR Interior/Build AR Room Measurement Scene", false, 5)]
    public static void BuildScene() => BuildSceneInternal(promptUser: true);

    public static void BuildSceneBatch() => BuildSceneInternal(promptUser: false);

    static void BuildSceneInternal(bool promptUser)
    {
        var batch = Application.isBatchMode || !promptUser;

        var template = ResolveTemplatePath();
        if (string.IsNullOrEmpty(template))
        {
            if (!batch)
            {
                EditorUtility.DisplayDialog(
                    "AR Measurement",
                    $"No template scene found.\n\nExpected {TemplateScenePath} or {FallbackTemplatePath}.",
                    "OK");
            }
            else
                Debug.LogError("[AR Measurement] No template scene found.");
            return;
        }

        if (!batch && File.Exists(MeasurementScenePath) &&
            !EditorUtility.DisplayDialog(
                "Rebuild ARRoomMeasurement?",
                "ARRoomMeasurement.unity already exists and will be regenerated.\n\nAny manual edits will be lost.",
                "Rebuild",
                "Cancel"))
            return;

        if (!batch && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            return;

        if (File.Exists(MeasurementScenePath))
            AssetDatabase.DeleteAsset(MeasurementScenePath);

        if (!AssetDatabase.CopyAsset(template, MeasurementScenePath))
        {
            EditorUtility.DisplayDialog("AR Measurement", "Failed to copy the template scene.", "OK");
            return;
        }

        AssetDatabase.Refresh();
        var scene = EditorSceneManager.OpenScene(MeasurementScenePath, OpenSceneMode.Single);

        StripTemplateContent(scene);
        var rig = ConfigureArRig(scene);
        ConfigureMeasurementManagers(rig);
        ConfigureLighting(scene, rig);
        EnsureEventSystem(scene);

        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene);
        ConfigureBuildSettings();

        AssetDatabase.SaveAssets();
        Selection.activeObject = AssetDatabase.LoadAssetAtPath<SceneAsset>(MeasurementScenePath);

        Debug.Log("[AR Measurement] ARRoomMeasurement built and build settings updated.");

        if (!batch)
        {
            EditorUtility.DisplayDialog(
                "AR Measurement",
                "ARRoomMeasurement built.\n\n" +
                "Startup order: MainMenu → AR Measurement / AR Furniture.\n\n" +
                "Run AR Interior → Make MainMenu Startup Scene if the app still opens ARDesignScene directly.",
                "OK");
        }
    }

    [MenuItem("AR Interior/Make MainMenu Startup Scene", false, 6)]
    public static void MakeMainMenuStartupScene()
    {
        if (!File.Exists(MainMenuScenePath))
        {
            EditorUtility.DisplayDialog(
                "AR Interior",
                "MainMenu.unity not found.\n\nRun AR Interior → Setup AR Measurement Scene first.",
                "OK");
            return;
        }

        ConfigureBuildSettings();
        Debug.Log("[AR Measurement] MainMenu is scene index 0.");
        EditorUtility.DisplayDialog(
            "AR Interior",
            "Build settings updated:\n\n" +
            "1. MainMenu (launcher)\n" +
            "2. ARDesignScene (AR Furniture)\n" +
            "3. ARRoomMeasurement (AR Measurement)",
            "OK");
    }

    static void ConfigureBuildSettings()
    {
        var ordered = new List<string>();
        if (File.Exists(MainMenuScenePath)) ordered.Add(MainMenuScenePath);
        if (File.Exists(FurnitureScenePath)) ordered.Add(FurnitureScenePath);
        if (File.Exists(MeasurementScenePath)) ordered.Add(MeasurementScenePath);

        var scenes = new List<EditorBuildSettingsScene>();
        foreach (var path in ordered)
            scenes.Add(new EditorBuildSettingsScene(path, true));

        EditorBuildSettings.scenes = scenes.ToArray();
    }

    static string ResolveTemplatePath()
    {
        if (File.Exists(TemplateScenePath)) return TemplateScenePath;
        if (File.Exists(FallbackTemplatePath)) return FallbackTemplatePath;
        return null;
    }

    static void StripTemplateContent(Scene scene)
    {
        var managers = FindRoot(scene, "Managers");
        if (managers != null)
        {
            RemoveComponent<UnityMessageBridge>(managers);
            RemoveComponent<ARFurniturePlacer>(managers);
            RemoveComponent<ARFurnitureGestureController>(managers);
            RemoveComponent<ARFurniturePickerUI>(managers);
            RemoveComponent<ARFurnitureLighting>(managers);
            RemoveComponent<ARModeSwitcher>(managers);
            RemoveComponent<WallSelector>(managers);
            RemoveComponent<WallPainter>(managers);
            RemoveComponent<ColorPickerUIController>(managers);
            RemoveComponent<FurnitureCatalog>(managers);
            RemoveComponent<FurniturePlacementController>(managers);
            RemoveComponent<FurnitureManipulator>(managers);
            RemoveComponent<FurnitureLayoutHistory>(managers);
            RemoveComponent<LayoutExportService>(managers);
            // Keep RoomExportManager — plan HUD uses it for Export 3D.
            RemoveComponent<ARSceneBridge>(managers);
            RemoveComponent<ARDesignFurnitureCatalogUI>(managers);
            RemoveComponent<RemoteFurnitureCatalogLoader>(managers);
            RemoveComponent<RuntimeGltfLoader>(managers);
            RemoveComponent<MeasurementController>(managers);
            RemoveComponent<MeasurementHUDController>(managers);
            RemoveComponent<MeasurementScanController>(managers);
            RemoveComponent<ARRaycastManager>(managers);
            RemoveComponent<ARPlaneManager>(managers);
            RemoveComponent<ARAnchorManager>(managers);
            RemoveComponent<ARPointCloudManager>(managers);
            RemoveComponent<XROrigin>(managers);
        }

        var xrOrigin = FindRoot(scene, "XR Origin");
        if (xrOrigin != null)
            RemoveComponent<ARFloorGuide>(xrOrigin);

        DestroyRoot(scene, "FurniturePickerUI");
        DestroyRoot(scene, "ColorPickerUI");
        DestroyRoot(scene, "FurnitureRoot");
        DestroyRoot(scene, "MeasurementHUD");
        DestroyRoot(scene, "MeasurementScanOverlay");
        DestroyRoot(scene, "MeasurementRoot");
        DestroyRoot(scene, "EventSystem");
    }

    static Rig ConfigureArRig(Scene scene)
    {
        var rig = new Rig
        {
            managers = FindRoot(scene, "Managers"),
            xrOrigin = FindRoot(scene, "XR Origin"),
            placementIndicator = FindRoot(scene, "PlacementIndicator")?.GetComponent<ARPlacementIndicator>(),
            camera = Camera.main,
        };

        if (rig.managers == null)
        {
            rig.managers = new GameObject("Managers");
            SceneManager.MoveGameObjectToScene(rig.managers, scene);
        }

        if (rig.xrOrigin == null)
        {
            Debug.LogError("[AR Measurement] Template scene has no XR Origin.");
            return rig;
        }

        if (rig.xrOrigin.GetComponent<ARAnchorManager>() == null)
            rig.xrOrigin.AddComponent<ARAnchorManager>();

        rig.planeManager = rig.xrOrigin.GetComponent<ARPlaneManager>();
        if (rig.planeManager != null)
        {
            rig.planeManager.requestedDetectionMode = PlaneDetectionMode.Horizontal | PlaneDetectionMode.Vertical;
            var planePrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PlanePrefabPath);
            if (planePrefab != null)
                rig.planeManager.planePrefab = planePrefab;
            EditorUtility.SetDirty(rig.planeManager);
        }

        rig.raycastManager = rig.xrOrigin.GetComponent<ARRaycastManager>();
        rig.pointCloudManager = rig.xrOrigin.GetComponent<ARPointCloudManager>()
            ?? rig.xrOrigin.AddComponent<ARPointCloudManager>();

        var meshRoot = rig.xrOrigin.transform.Find("Mesh Root");
        if (meshRoot == null)
        {
            var go = new GameObject("Mesh Root");
            go.transform.SetParent(rig.xrOrigin.transform, false);
            meshRoot = go.transform;
        }

        rig.meshManager = meshRoot.GetComponent<ARMeshManager>() ?? meshRoot.gameObject.AddComponent<ARMeshManager>();
        var meshChunk = AssetDatabase.LoadAssetAtPath<MeshFilter>(MeshChunkPrefabPath);
        if (meshChunk != null)
            rig.meshManager.meshPrefab = meshChunk;
        EditorUtility.SetDirty(rig.meshManager);

        if (rig.xrOrigin.GetComponent<ARBootstrap>() == null)
            rig.xrOrigin.AddComponent<ARBootstrap>();

        return rig;
    }

    static void ConfigureMeasurementManagers(Rig rig)
    {
        var managers = rig.managers;
        var scanController = Ensure<RoomScanController>(managers);
        var scanVisualization = Ensure<ScanVisualizationController>(managers);
        var roomMeshVisualizer = Ensure<RoomMeshVisualizer>(managers);
        var cornerBuilder = Ensure<ARDesignCornerRoomBuilder>(managers);
        var scanHud = Ensure<ARDesignScanHUD>(managers);
        var layoutMode = Ensure<ARDesignLayoutModeController>(managers);
        var planHud = Ensure<ARMeasurementPlanHUD>(managers);
        var saveModal = Ensure<RoomMeasurementSaveModal>(managers);
        var edgeVisualizer = Ensure<ARDesignEdgeVisualizer>(managers);
        var exportManager = Ensure<RoomExportManager>(managers);
        Ensure<ARMainMenuBackButton>(managers);
        edgeVisualizer.enabled = false;

        var cameraBackground = rig.camera != null
            ? rig.camera.GetComponent<ARCameraBackground>()
            : null;
        var trackedPose = rig.camera != null
            ? rig.camera.GetComponent<UnityEngine.InputSystem.XR.TrackedPoseDriver>()
            : null;

        Wire(scanController, so =>
        {
            so.Set("planeManager", rig.planeManager);
            so.Set("pointCloudManager", rig.pointCloudManager);
            so.Set("meshManager", rig.meshManager);
            so.Set("arCamera", rig.camera);
            so.Set("cornerBuilder", cornerBuilder);
            so.SetBool("autoStartScanOnLoad", true);
        });

        Wire(scanVisualization, so =>
        {
            so.Set("scanController", scanController);
            so.Set("planeManager", rig.planeManager);
            so.Set("pointCloudManager", rig.pointCloudManager);
            so.Set("meshManager", rig.meshManager);
        });

        Wire(cornerBuilder, so =>
        {
            so.Set("scanController", scanController);
            so.Set("raycastManager", rig.raycastManager);
            so.Set("planeManager", rig.planeManager);
            so.Set("arCamera", rig.camera);
            so.Set("placementIndicator", rig.placementIndicator);
            so.SetBool("requireStartButtonForHeightBase", true);
        });

        Wire(roomMeshVisualizer, so => so.Set("scanController", scanController));

        Wire(scanHud, so =>
        {
            so.Set("scanController", scanController);
            so.Set("placementIndicator", rig.placementIndicator);
            so.Set("cornerBuilder", cornerBuilder);
            so.SetBool("measurementOnlyMode", true);
            so.SetBool("spawnSampleOnConfirm", false);
        });

        Wire(layoutMode, so =>
        {
            so.Set("scanController", scanController);
            so.Set("arCamera", rig.camera);
            so.Set("cameraBackground", cameraBackground);
            so.Set("trackedPoseDriver", trackedPose);
            so.Set("placementIndicator", rig.placementIndicator);
            so.Set("roomMeshVisualizer", roomMeshVisualizer);
            so.SetEnum("defaultViewMode", 1); // Planner
        });

        Wire(planHud, so =>
        {
            so.Set("scanController", scanController);
            so.Set("layoutMode", layoutMode);
            so.Set("exportManager", exportManager);
            so.SetString("mainMenuSceneName", "MainMenu");
        });

        Wire(exportManager, so =>
        {
            so.Set("scanController", scanController);
            so.Set("meshManager", rig.meshManager);
            so.SetBool("includeRoomGeometry", true);
            so.SetBool("includeLiveArMeshes", true);
            so.SetBool("shareAfterExport", true);
        });

        Wire(saveModal, so =>
        {
            so.Set("scanController", scanController);
            so.SetBool("measurementOnlyMode", true);
        });
    }

    static void ConfigureLighting(Scene scene, Rig rig)
    {
        var lightObject = FindRoot(scene, "AR Estimated Light");
        if (lightObject == null)
        {
            lightObject = new GameObject("AR Estimated Light");
            SceneManager.MoveGameObjectToScene(lightObject, scene);
        }

        lightObject.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

        var brokenUrp = lightObject.GetComponent<UniversalAdditionalLightData>();
        if (lightObject.GetComponent<Light>() == null && brokenUrp != null)
            Object.DestroyImmediate(brokenUrp);

        var light = lightObject.GetComponent<Light>() ?? lightObject.AddComponent<Light>();
        light.type = LightType.Directional;
        light.shadows = LightShadows.Soft;
        light.shadowStrength = 0.6f;
        light.intensity = 1f;

        if (lightObject.GetComponent<UniversalAdditionalLightData>() == null)
            lightObject.AddComponent<UniversalAdditionalLightData>();

        var estimation = Ensure<ARDesignLighting>(lightObject);
        Wire(estimation, so => so.Set("cameraManager", rig.camera != null
            ? rig.camera.GetComponent<ARCameraManager>()
            : Object.FindFirstObjectByType<ARCameraManager>()));
    }

    static void EnsureEventSystem(Scene scene)
    {
        if (FindRoot(scene, "EventSystem") != null) return;

        var go = new GameObject("EventSystem");
        SceneManager.MoveGameObjectToScene(go, scene);
        go.AddComponent<EventSystem>();
        go.AddComponent<InputSystemUIInputModule>();
    }

    static T Ensure<T>(GameObject go) where T : Component => go.GetComponent<T>() ?? go.AddComponent<T>();

    static void RemoveComponent<T>(GameObject go) where T : Component
    {
        var component = go.GetComponent<T>();
        if (component != null)
            Object.DestroyImmediate(component);
    }

    static GameObject FindRoot(Scene scene, string name)
    {
        foreach (var root in scene.GetRootGameObjects())
        {
            if (root.name == name) return root;
        }

        return null;
    }

    static void DestroyRoot(Scene scene, string name)
    {
        var go = FindRoot(scene, name);
        if (go != null) Object.DestroyImmediate(go);
    }

    static void Wire(Component component, System.Action<Wiring> configure)
    {
        if (component == null) return;
        var serialized = new SerializedObject(component);
        configure(new Wiring(serialized, component));
        serialized.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(component);
    }

    sealed class Wiring
    {
        readonly SerializedObject serialized;
        readonly Component owner;

        public Wiring(SerializedObject serialized, Component owner)
        {
            this.serialized = serialized;
            this.owner = owner;
        }

        public void Set(string propertyName, Object value)
        {
            var property = serialized.FindProperty(propertyName);
            if (property == null)
                Debug.LogWarning($"[AR Measurement] {owner.GetType().Name} has no field '{propertyName}'.");
            else
                property.objectReferenceValue = value;
        }

        public void SetBool(string propertyName, bool value)
        {
            var property = serialized.FindProperty(propertyName);
            if (property != null)
                property.boolValue = value;
        }

        public void SetString(string propertyName, string value)
        {
            var property = serialized.FindProperty(propertyName);
            if (property != null)
                property.stringValue = value;
        }

        public void SetEnum(string propertyName, int enumIndex)
        {
            var property = serialized.FindProperty(propertyName);
            if (property != null)
                property.enumValueIndex = enumIndex;
        }
    }

    sealed class Rig
    {
        public GameObject managers;
        public GameObject xrOrigin;
        public Camera camera;
        public ARPlaneManager planeManager;
        public ARRaycastManager raycastManager;
        public ARPointCloudManager pointCloudManager;
        public ARMeshManager meshManager;
        public ARPlacementIndicator placementIndicator;
    }
}
#endif
