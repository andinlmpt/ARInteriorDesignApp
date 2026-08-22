#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
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
/// Builds Assets/Scenes/ARDesignScene.unity — the single scene RN embeds for the
/// AR Design step.
///
/// The scene is generated from ARFurnitureDev rather than from scratch because
/// that scene already carries a known-good AR rig (XR Origin, camera stack,
/// tracked pose driver, placement reticle) that has been debugged on device.
/// This builder strips the single-item furniture flow off it and installs the
/// scan → confirm → place → export pipeline in its place.
///
/// Re-running the command is safe and idempotent: it always rebuilds from the
/// template, so tweak the code here rather than hand-editing the scene if you
/// want a change to survive.
/// </summary>
public static class ARDesignSceneBuilder
{
    const string TemplateScenePath = "Assets/Scenes/ARFurnitureDev.unity";
    const string FallbackTemplatePath = "Assets/Scenes/ARFurniture.unity";
    const string DesignScenePath = "Assets/Scenes/ARDesignScene.unity";

    const string GeneratedFolder = "Assets/_App/Generated/ARDesign";
    const string FurnitureModelsFolder = "Assets/_App/Furniture";

    const string GltfastPackage = "com.unity.cloud.gltfast";
    const string GltfastDefine = "GLTFAST_PRESENT";
    const string UnityGltfPackage = "org.khronos.unitygltf";
    const string UnityGltfDefine = "UNITYGLTF_PRESENT";
    const string NativeSharePackage = "com.yasirkula.nativeshare";
    const string NativeShareDefine = "NATIVESHARE_PRESENT";

    [MenuItem("AR Interior/AR Design/Build ARDesignScene", false, 40)]
    public static void BuildScene()
    {
        var template = ResolveTemplatePath();
        if (string.IsNullOrEmpty(template))
        {
            EditorUtility.DisplayDialog(
                "AR Design",
                $"No template scene found.\n\nExpected {TemplateScenePath} or {FallbackTemplatePath}.",
                "OK");
            return;
        }

        if (File.Exists(DesignScenePath) &&
            !EditorUtility.DisplayDialog(
                "Rebuild ARDesignScene?",
                "ARDesignScene.unity already exists and will be regenerated from ARFurnitureDev.\n\n" +
                "Any manual edits made in the Unity editor will be lost.",
                "Rebuild",
                "Cancel"))
            return;

        if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            return;

        EnsureFolder(GeneratedFolder);

        AssetDatabase.DeleteAsset(DesignScenePath);
        if (!AssetDatabase.CopyAsset(template, DesignScenePath))
        {
            EditorUtility.DisplayDialog("AR Design", "Failed to copy the template scene.", "OK");
            return;
        }

        AssetDatabase.Refresh();

        var scene = EditorSceneManager.OpenScene(DesignScenePath, OpenSceneMode.Single);

        // Built after the scene is open: the prefab sources are temporary scene
        // objects, and creating them in whatever scene was previously loaded
        // would dirty it for no reason.
        var assets = BuildSharedAssets();

        StripTemplateContent(scene);
        var rig = ConfigureArRig(scene, assets);
        ConfigureManagers(rig, assets);
        PopulateFurnitureCatalog(rig.managers);
        ConfigureLighting(scene, rig);
        EnsureEventSystem(scene);

        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene);

        AddSceneToBuildSettings(DesignScenePath);
        SyncGltfastDefine(silent: true);
        SyncExportPackageDefines(silent: true);

        AssetDatabase.SaveAssets();
        Selection.activeObject = AssetDatabase.LoadAssetAtPath<SceneAsset>(DesignScenePath);

        Debug.Log($"[AR Design] Built {DesignScenePath}");

        EditorUtility.DisplayDialog(
            "AR Design",
            "ARDesignScene built and added to Build Settings.\n\n" +
            "Furniture Catalog was filled from ARProjectFurniture prefabs.\n\n" +
            "Next steps:\n" +
            "• Run AR Interior ▸ AR Design ▸ Enable Read-Write On Furniture Meshes\n" +
            "  (required before glTF export can read prefab geometry)\n" +
            "• Install com.unity.cloud.gltfast if you need runtime GLB loading",
            "OK");
    }

    [MenuItem("AR Interior/AR Design/Populate Furniture Catalog", false, 44)]
    public static void PopulateFurnitureCatalogMenu()
    {
        var managers = GameObject.Find("Managers");
        if (managers == null)
        {
            EditorUtility.DisplayDialog("AR Design", "Open ARDesignScene (or any scene with a Managers object) first.", "OK");
            return;
        }

        var count = PopulateFurnitureCatalog(managers);
        EditorSceneManager.MarkSceneDirty(managers.scene);
        EditorUtility.DisplayDialog("AR Design", $"Furniture Catalog now has {count} items.", "OK");
    }

    /// <summary>
    /// Fills Managers ▸ FurnitureCatalog from the project's furniture prefabs so
    /// the side rail always has plenty to place after a room confirm.
    /// </summary>
    static int PopulateFurnitureCatalog(GameObject managers)
    {
        if (managers == null) return 0;

        var catalog = managers.GetComponent<FurnitureCatalog>() ?? managers.AddComponent<FurnitureCatalog>();
        var so = new SerializedObject(catalog);
        var entries = so.FindProperty("entries");
        entries.ClearArray();

        // Catalog is filled from Assets/_App/Furniture/Prefabs after you import a new set.
        // Drop .glb files into Assets/_App/Furniture/GLB, then run
        // AR Interior → AR Design → Import Downloaded GLB Furniture.
        var defs = System.Array.Empty<CatalogDef>();

        var added = 0;
        GameObject defaultPrefab = null;

        foreach (var def in defs)
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(def.prefabPath);
            if (prefab == null)
            {
                Debug.LogWarning($"[AR Design] Missing furniture prefab: {def.prefabPath}");
                continue;
            }

            defaultPrefab ??= prefab;

            entries.InsertArrayElementAtIndex(entries.arraySize);
            var element = entries.GetArrayElementAtIndex(entries.arraySize - 1);
            element.FindPropertyRelative("id").stringValue = def.id;
            element.FindPropertyRelative("displayName").stringValue = def.displayName;
            element.FindPropertyRelative("category").stringValue = def.category;
            element.FindPropertyRelative("prefab").objectReferenceValue = prefab;
            element.FindPropertyRelative("width").floatValue = def.width;
            element.FindPropertyRelative("height").floatValue = def.height;
            element.FindPropertyRelative("depth").floatValue = def.depth;

            Sprite icon = null;
            if (!string.IsNullOrEmpty(def.iconPath))
                icon = AssetDatabase.LoadAssetAtPath<Sprite>(def.iconPath);
            element.FindPropertyRelative("icon").objectReferenceValue = icon;

            added++;
        }

        so.FindProperty("defaultPrefab").objectReferenceValue = defaultPrefab;
        so.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(catalog);

        Debug.Log($"[AR Design] Populated Furniture Catalog with {added} items.");
        return added;
    }

    readonly struct CatalogDef
    {
        public readonly string id;
        public readonly string displayName;
        public readonly string prefabPath;
        public readonly string iconPath;
        public readonly string category;
        public readonly float width;
        public readonly float height;
        public readonly float depth;

        public CatalogDef(string id, string displayName, string prefabPath, string iconPath, string category, float width, float height, float depth)
        {
            this.id = id;
            this.displayName = displayName;
            this.prefabPath = prefabPath;
            this.iconPath = iconPath;
            this.category = category;
            this.width = width;
            this.height = height;
            this.depth = depth;
        }
    }

    // ── Template cleanup ──────────────────────────────────────────────────────

    /// <summary>
    /// Removes the single-instance furniture flow and the wall-paint mode. The
    /// AR rig, catalog and reticle are deliberately kept.
    /// </summary>
    static void StripTemplateContent(Scene scene)
    {
        var managers = FindRoot(scene, "Managers");
        if (managers != null)
        {
            // UnityMessageBridge must go: UnitySendMessage dispatches to every
            // component with a matching method name, and ARSceneBridge now owns
            // ReceiveMessage for this scene.
            RemoveComponent<UnityMessageBridge>(managers);
            RemoveComponent<ARFurniturePlacer>(managers);
            RemoveComponent<ARFurnitureGestureController>(managers);
            RemoveComponent<ARFurniturePickerUI>(managers);
            RemoveComponent<ARFurnitureLighting>(managers);
            RemoveComponent<ARModeSwitcher>(managers);
            RemoveComponent<WallSelector>(managers);
            RemoveComponent<WallPainter>(managers);
            RemoveComponent<ColorPickerUIController>(managers);
            // These belong on XR Origin only — a second copy on Managers breaks
            // FindFirstObjectByType lookups and can leave the camera black.
            // Remove dependents before XROrigin (RequireComponent order).
            RemoveComponent<ARRaycastManager>(managers);
            RemoveComponent<ARPlaneManager>(managers);
            RemoveComponent<ARAnchorManager>(managers);
            RemoveComponent<ARPointCloudManager>(managers);
            RemoveComponent<XROrigin>(managers);
        }

        var xrOrigin = FindRoot(scene, "XR Origin");
        if (xrOrigin != null)
        {
            // ScanVisualizationController owns plane visibility now.
            RemoveComponent<ARFloorGuide>(xrOrigin);
        }

        DestroyRoot(scene, "FurniturePickerUI");
        DestroyRoot(scene, "ColorPickerUI");
        DestroyRoot(scene, "EventSystem");
    }

    // ── AR rig ────────────────────────────────────────────────────────────────

    static Rig ConfigureArRig(Scene scene, SharedAssets assets)
    {
        var rig = new Rig
        {
            managers = FindRoot(scene, "Managers"),
            xrOrigin = FindRoot(scene, "XR Origin"),
            placementIndicator = FindRoot(scene, "PlacementIndicator")?.GetComponent<ARPlacementIndicator>(),
            furnitureRoot = FindRoot(scene, "FurnitureRoot")?.transform,
            camera = Camera.main,
        };

        if (rig.managers == null)
        {
            rig.managers = new GameObject("Managers");
            SceneManager.MoveGameObjectToScene(rig.managers, scene);
        }

        if (rig.furnitureRoot == null)
        {
            var root = new GameObject("FurnitureRoot");
            SceneManager.MoveGameObjectToScene(root, scene);
            rig.furnitureRoot = root.transform;
        }

        if (rig.xrOrigin == null)
        {
            Debug.LogError("[AR Design] Template scene has no 'XR Origin' root — the AR rig cannot be configured.");
            return rig;
        }

        // Furniture must live under XR Origin so it shares AR session space with
        // the tracked camera (scene-root parenting causes live-AR tremble/drift).
        if (rig.furnitureRoot.parent != rig.xrOrigin.transform)
        {
            rig.furnitureRoot.SetParent(rig.xrOrigin.transform, true);
            EditorUtility.SetDirty(rig.furnitureRoot);
        }

        // Ensure anchors exist for live-AR furniture pinning.
        if (rig.xrOrigin.GetComponent<ARAnchorManager>() == null)
            rig.xrOrigin.AddComponent<ARAnchorManager>();

        // Walls matter as much as the floor here: the room scan needs vertical
        // geometry, not just a surface to stand a chair on.
        rig.planeManager = rig.xrOrigin.GetComponent<ARPlaneManager>();
        if (rig.planeManager != null)
        {
            rig.planeManager.requestedDetectionMode = PlaneDetectionMode.Horizontal | PlaneDetectionMode.Vertical;
            rig.planeManager.planePrefab = assets.planePrefab;
            EditorUtility.SetDirty(rig.planeManager);
        }

        rig.raycastManager = rig.xrOrigin.GetComponent<ARRaycastManager>();

        rig.pointCloudManager = rig.xrOrigin.GetComponent<ARPointCloudManager>();
        if (rig.pointCloudManager == null)
            rig.pointCloudManager = rig.xrOrigin.AddComponent<ARPointCloudManager>();

        // AR Foundation has no meshing provider for ARCore, so this produces
        // nothing on Android today. It is wired up anyway so the scan upgrades
        // for free on any provider that does implement XRMeshSubsystem.
        // Disable the Mesh Root object if the empty subsystem gets noisy.
        var meshRoot = rig.xrOrigin.transform.Find("Mesh Root");
        if (meshRoot == null)
        {
            var go = new GameObject("Mesh Root");
            go.transform.SetParent(rig.xrOrigin.transform, false);
            meshRoot = go.transform;
        }

        rig.meshManager = meshRoot.GetComponent<ARMeshManager>() ?? meshRoot.gameObject.AddComponent<ARMeshManager>();
        rig.meshManager.meshPrefab = assets.meshChunkPrefab;
        EditorUtility.SetDirty(rig.meshManager);

        return rig;
    }

    // ── Managers ──────────────────────────────────────────────────────────────

    static void ConfigureManagers(Rig rig, SharedAssets assets)
    {
        var managers = rig.managers;

        var catalog = managers.GetComponent<FurnitureCatalog>() ?? managers.AddComponent<FurnitureCatalog>();
        var scanController = Ensure<RoomScanController>(managers);
        var scanVisualization = Ensure<ScanVisualizationController>(managers);
        var roomMeshVisualizer = Ensure<RoomMeshVisualizer>(managers);
        var gltfLoader = Ensure<RuntimeGltfLoader>(managers);
        var placementController = Ensure<FurniturePlacementController>(managers);
        var manipulator = Ensure<FurnitureManipulator>(managers);
        var layoutHistory = Ensure<FurnitureLayoutHistory>(managers);
        var exportService = Ensure<LayoutExportService>(managers);
        var roomExport = Ensure<RoomExportManager>(managers);
        var bridge = Ensure<ARSceneBridge>(managers);
        var scanHud = Ensure<ARDesignScanHUD>(managers);
        var catalogUi = Ensure<ARDesignFurnitureCatalogUI>(managers);
        var edgeVisualizer = Ensure<ARDesignEdgeVisualizer>(managers);
        var cornerBuilder = Ensure<ARDesignCornerRoomBuilder>(managers);
        var layoutMode = Ensure<ARDesignLayoutModeController>(managers);

        // Plane-boundary outlines are replaced by corner-to-corner tapping.
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
        });

        Wire(scanVisualization, so =>
        {
            so.Set("scanController", scanController);
            so.Set("planeManager", rig.planeManager);
            so.Set("pointCloudManager", rig.pointCloudManager);
            so.Set("meshManager", rig.meshManager);
        });

        Wire(edgeVisualizer, so =>
        {
            so.Set("scanController", scanController);
            so.Set("planeManager", rig.planeManager);
        });

        Wire(cornerBuilder, so =>
        {
            so.Set("scanController", scanController);
            so.Set("raycastManager", rig.raycastManager);
            so.Set("planeManager", rig.planeManager);
            so.Set("arCamera", rig.camera);
            so.Set("placementIndicator", rig.placementIndicator);
        });

        Wire(roomMeshVisualizer, so =>
        {
            so.Set("scanController", scanController);
        });

        Wire(placementController, so =>
        {
            so.Set("raycastManager", rig.raycastManager);
            so.Set("planeManager", rig.planeManager);
            so.Set("anchorManager", rig.xrOrigin != null
                ? rig.xrOrigin.GetComponent<ARAnchorManager>()
                : null);
            so.Set("placementIndicator", rig.placementIndicator);
            so.Set("arCamera", rig.camera);
            so.Set("furnitureParent", rig.furnitureRoot);
            so.Set("layoutMode", layoutMode);
            so.Set("scanController", scanController);
            so.Set("catalog", catalog);
            so.Set("gltfLoader", gltfLoader);
            so.Set("placeholderPrefab", assets.placeholderPrefab);
        });

        Wire(manipulator, so =>
        {
            so.Set("placementController", placementController);
            so.Set("arCamera", rig.camera);
        });

        Wire(layoutHistory, so =>
        {
            so.Set("placementController", placementController);
            so.Set("manipulator", manipulator);
        });

        Wire(exportService, so =>
        {
            so.Set("scanController", scanController);
            so.Set("placementController", placementController);
        });

        Wire(bridge, so =>
        {
            so.Set("scanController", scanController);
            so.Set("placementController", placementController);
            so.Set("exportService", exportService);
            so.Set("layoutHistory", layoutHistory);
            so.Set("roomMeshVisualizer", roomMeshVisualizer);
        });

        Wire(scanHud, so =>
        {
            so.Set("scanController", scanController);
            so.Set("bridge", bridge);
            so.Set("catalog", catalog);
            so.Set("placementIndicator", rig.placementIndicator);
            so.Set("cornerBuilder", cornerBuilder);
        });

        Wire(catalogUi, so =>
        {
            so.Set("scanController", scanController);
            so.Set("placementController", placementController);
            so.Set("catalog", catalog);
            so.Set("layoutHistory", layoutHistory);
            so.Set("layoutMode", layoutMode);
            so.Set("exportManager", roomExport);
        });

        Wire(roomExport, so =>
        {
            so.Set("placementController", placementController);
            so.Set("scanController", scanController);
            so.Set("meshManager", rig.meshManager);
            so.Set("legacyExportService", exportService);
        });

        Wire(layoutMode, so =>
        {
            so.Set("scanController", scanController);
            so.Set("placementController", placementController);
            so.Set("arCamera", rig.camera);
            so.Set("cameraBackground", cameraBackground);
            so.Set("trackedPoseDriver", trackedPose);
            so.Set("placementIndicator", rig.placementIndicator);
            so.Set("roomMeshVisualizer", roomMeshVisualizer);
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

        // Strip Light-requiring URP data first — otherwise Unity throws
        // MissingComponentException before we can AddComponent<Light>().
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

    // ── Generated assets ──────────────────────────────────────────────────────

    static SharedAssets BuildSharedAssets()
    {
        return new SharedAssets
        {
            planePrefab = BuildPlanePrefab(),
            meshChunkPrefab = BuildMeshChunkPrefab(),
            placeholderPrefab = BuildPlaceholderPrefab(),
        };
    }

    /// <summary>Invisible plane prefab — detection only; ScanVisualizationController also hides any leftover visuals.</summary>
    static GameObject BuildPlanePrefab()
    {
        const string path = GeneratedFolder + "/ARDesignPlaneVisualizer.prefab";

        // Fully transparent — we never want the ARCore plane wash on screen.
        var material = CreateTransparentUnlitMaterial(
            new Color(1f, 1f, 1f, 0f),
            GeneratedFolder + "/ARDesignPlane.mat");

        var go = new GameObject("ARDesignPlaneVisualizer",
            typeof(ARPlane),
            typeof(MeshFilter),
            typeof(MeshRenderer),
            typeof(ARPlaneMeshVisualizer));

        var renderer = go.GetComponent<MeshRenderer>();
        renderer.sharedMaterial = material;
        renderer.enabled = false;
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;

        var visualizer = go.GetComponent<ARPlaneMeshVisualizer>();
        visualizer.enabled = false;

        var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
        Object.DestroyImmediate(go);
        return prefab;
    }

    /// <summary>Environment mesh chunk visual. Only ever instantiated on platforms with a meshing provider.</summary>
    static MeshFilter BuildMeshChunkPrefab()
    {
        const string path = GeneratedFolder + "/ARDesignMeshChunk.prefab";

        var material = CreateTransparentUnlitMaterial(
            new Color(0.70f, 0.72f, 0.75f, 0.28f),
            GeneratedFolder + "/ARDesignMesh.mat");

        var go = new GameObject("ARDesignMeshChunk", typeof(MeshFilter), typeof(MeshRenderer));

        var renderer = go.GetComponent<MeshRenderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;

        var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
        Object.DestroyImmediate(go);
        return prefab != null ? prefab.GetComponent<MeshFilter>() : null;
    }

    /// <summary>
    /// 1×1×1 metre cube used to validate the placement pipeline before real
    /// models are wired up, and as the fallback whenever a model fails to
    /// resolve. Unit-sized so the real-world dimension scaling maps 1:1.
    /// </summary>
    static GameObject BuildPlaceholderPrefab()
    {
        const string path = GeneratedFolder + "/ARDesignPlaceholderCube.prefab";

        var material = CreateLitMaterial(
            new Color(0.478f, 0.561f, 0.482f, 1f),
            GeneratedFolder + "/ARDesignPlaceholder.mat");

        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = "ARDesignPlaceholderCube";

        var renderer = go.GetComponent<MeshRenderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.On;
        renderer.receiveShadows = true;

        // Pivot at the centre; the grounding helpers resolve the actual foot height.
        var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
        Object.DestroyImmediate(go);
        return prefab;
    }

    static Material CreateTransparentUnlitMaterial(Color color, string path)
    {
        var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color");
        var material = new Material(shader);

        if (material.HasProperty("_Surface"))
        {
            material.SetFloat("_Surface", 1f); // transparent
            material.SetFloat("_Blend", 0f);   // alpha
            material.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            material.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
            material.SetFloat("_ZWrite", 0f);
            material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            material.renderQueue = (int)RenderQueue.Transparent;
        }

        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        material.color = color;

        return SaveMaterial(material, path);
    }

    static Material CreateLitMaterial(Color color, string path)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
        var material = new Material(shader);

        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", 0.2f);
        material.color = color;

        return SaveMaterial(material, path);
    }

    static Material SaveMaterial(Material material, string path)
    {
        var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing != null)
        {
            existing.shader = material.shader;
            EditorUtility.CopySerialized(material, existing);
            Object.DestroyImmediate(material);
            EditorUtility.SetDirty(existing);
            return existing;
        }

        AssetDatabase.CreateAsset(material, path);
        return material;
    }

    // ── Extra commands ────────────────────────────────────────────────────────

    /// <summary>
    /// glTF export reads mesh vertices at runtime, which fails silently on
    /// imported models unless Read/Write is enabled on the importer.
    /// </summary>
    [MenuItem("AR Interior/AR Design/Enable Read-Write On Furniture Meshes", false, 41)]
    public static void EnableReadWriteOnFurnitureMeshes()
    {
        if (!AssetDatabase.IsValidFolder(FurnitureModelsFolder))
        {
            EditorUtility.DisplayDialog("AR Design", $"Folder not found:\n{FurnitureModelsFolder}", "OK");
            return;
        }

        var changed = new List<string>();
        var guids = AssetDatabase.FindAssets("t:Model", new[] { FurnitureModelsFolder });

        try
        {
            for (var i = 0; i < guids.Length; i++)
            {
                var path = AssetDatabase.GUIDToAssetPath(guids[i]);
                EditorUtility.DisplayProgressBar("AR Design", path, (i + 1) / (float)guids.Length);

                if (AssetImporter.GetAtPath(path) is not ModelImporter importer) continue;
                if (importer.isReadable) continue;

                importer.isReadable = true;
                importer.SaveAndReimport();
                changed.Add(path);
            }
        }
        finally
        {
            EditorUtility.ClearProgressBar();
        }

        Debug.Log($"[AR Design] Enabled Read/Write on {changed.Count} of {guids.Length} models.");

        EditorUtility.DisplayDialog(
            "AR Design",
            changed.Count == 0
                ? $"All {guids.Length} models already had Read/Write enabled."
                : $"Enabled Read/Write on {changed.Count} models.\n\nThis increases build size — meshes now stay in " +
                  "CPU memory as well as GPU memory — but glTF export cannot read their vertices otherwise.",
            "OK");
    }

    /// <summary>
    /// Keeps the GLTFAST_PRESENT scripting define in step with whether glTFast is
    /// actually installed, so RuntimeGltfLoader compiles either way.
    /// </summary>
    [MenuItem("AR Interior/AR Design/Sync glTFast Scripting Define", false, 42)]
    public static void SyncGltfastDefineMenu() => SyncGltfastDefine(silent: false);

    // Fix AR Estimated Light menu lives in ARDesignLightAutoFix (auto-runs before Play).

    /// <summary>
    /// Enables UNITYGLTF_PRESENT / NATIVESHARE_PRESENT once those packages resolve
    /// in Package Manager (required for RoomExportManager backends).
    /// </summary>
    [MenuItem("AR Interior/AR Design/Sync Export Package Defines", false, 41)]
    public static void SyncExportPackageDefinesMenu() => SyncExportPackageDefines(silent: false);

    static void SyncExportPackageDefines(bool silent)
    {
        // Only enable defines after UPM has actually resolved the package into
        // PackageCache / Packages — listing it in manifest.json alone is not enough
        // and would break compilation.
        var unityGltf = (Directory.Exists("Library/PackageCache") &&
                         Directory.GetDirectories("Library/PackageCache", "org.khronos.unitygltf@*").Length > 0)
                        || Directory.Exists("Packages/org.khronos.unitygltf");
        var nativeShare = (Directory.Exists("Library/PackageCache") &&
                           Directory.GetDirectories("Library/PackageCache", "com.yasirkula.nativeshare@*").Length > 0)
                          || Directory.Exists("Packages/com.yasirkula.nativeshare");

        ApplyDefine(NamedBuildTarget.Android, UnityGltfDefine, unityGltf);
        ApplyDefine(NamedBuildTarget.iOS, UnityGltfDefine, unityGltf);
        ApplyDefine(NamedBuildTarget.Standalone, UnityGltfDefine, unityGltf);
        ApplyDefine(NamedBuildTarget.Android, NativeShareDefine, nativeShare);
        ApplyDefine(NamedBuildTarget.iOS, NativeShareDefine, nativeShare);
        ApplyDefine(NamedBuildTarget.Standalone, NativeShareDefine, nativeShare);

        if (!silent)
        {
            var manifestListed = File.Exists("Packages/manifest.json") &&
                                 File.ReadAllText("Packages/manifest.json").Contains(UnityGltfPackage);
            EditorUtility.DisplayDialog(
                "AR Design",
                $"UnityGLTF: {(unityGltf ? "RESOLVED → " + UnityGltfDefine : manifestListed ? "in manifest, waiting for Package Manager…" : "not in manifest")}\n" +
                $"NativeShare: {(nativeShare ? "RESOLVED → " + NativeShareDefine : "waiting / missing")}\n\n" +
                "Export still works via the built-in GlbExporter until UnityGLTF resolves.\n" +
                "After Package Manager finishes, run this menu again.",
                "OK");
        }

        Debug.Log($"[AR Design] Export defines — {UnityGltfDefine}={unityGltf}, {NativeShareDefine}={nativeShare}");
    }

    static void ApplyDefine(NamedBuildTarget target, string define, bool enable)
    {
        var defines = PlayerSettings.GetScriptingDefineSymbols(target);
        var list = new List<string>(defines.Split(';'));
        list.RemoveAll(string.IsNullOrWhiteSpace);
        var has = list.Contains(define);
        if (has == enable) return;
        if (enable) list.Add(define);
        else list.Remove(define);
        PlayerSettings.SetScriptingDefineSymbols(target, string.Join(";", list));
    }

    static void SyncGltfastDefine(bool silent)
    {
        var installed = File.Exists("Packages/manifest.json") &&
                        File.ReadAllText("Packages/manifest.json").Contains(GltfastPackage);

        var target = NamedBuildTarget.Android;
        var defines = PlayerSettings.GetScriptingDefineSymbols(target);
        var list = new List<string>(defines.Split(';'));
        list.RemoveAll(string.IsNullOrWhiteSpace);

        var has = list.Contains(GltfastDefine);
        if (has == installed)
        {
            if (!silent)
                EditorUtility.DisplayDialog("AR Design",
                    $"Already in sync — glTFast is {(installed ? "installed" : "not installed")}.", "OK");
            return;
        }

        if (installed) list.Add(GltfastDefine);
        else list.Remove(GltfastDefine);

        PlayerSettings.SetScriptingDefineSymbols(target, string.Join(";", list));
        Debug.Log($"[AR Design] {(installed ? "Added" : "Removed")} {GltfastDefine} for Android.");
    }

    [MenuItem("AR Interior/AR Design/Make ARDesignScene The Startup Scene", false, 43)]
    public static void MakeStartupScene()
    {
        if (!File.Exists(DesignScenePath))
        {
            EditorUtility.DisplayDialog("AR Design", "Build ARDesignScene first.", "OK");
            return;
        }

        var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        scenes.RemoveAll(s => s.path == DesignScenePath);
        scenes.Insert(0, new EditorBuildSettingsScene(DesignScenePath, true));

        EditorBuildSettings.scenes = scenes.ToArray();
        Debug.Log("[AR Design] ARDesignScene is now scene index 0 and will load on launch.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    static string ResolveTemplatePath()
    {
        if (File.Exists(TemplateScenePath)) return TemplateScenePath;
        if (File.Exists(FallbackTemplatePath)) return FallbackTemplatePath;
        return null;
    }

    static void AddSceneToBuildSettings(string path)
    {
        var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        if (scenes.Exists(s => s.path == path)) return;

        scenes.Add(new EditorBuildSettingsScene(path, true));
        EditorBuildSettings.scenes = scenes.ToArray();
    }

    static void EnsureFolder(string folder)
    {
        if (AssetDatabase.IsValidFolder(folder)) return;

        var parts = folder.Split('/');
        var current = parts[0];

        for (var i = 1; i < parts.Length; i++)
        {
            var next = current + "/" + parts[i];
            if (!AssetDatabase.IsValidFolder(next))
                AssetDatabase.CreateFolder(current, parts[i]);
            current = next;
        }
    }

    static T Ensure<T>(GameObject go) where T : Component
    {
        return go.GetComponent<T>() ?? go.AddComponent<T>();
    }

    static void RemoveComponent<T>(GameObject go) where T : Component
    {
        var component = go.GetComponent<T>();
        if (component == null) return;
        try
        {
            Object.DestroyImmediate(component);
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[AR Design] Could not remove {typeof(T).Name} from '{go.name}': {e.Message}");
        }
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
            {
                Debug.LogWarning($"[AR Design] {owner.GetType().Name} has no serialized field '{propertyName}'.");
                return;
            }

            property.objectReferenceValue = value;
        }
    }

    sealed class SharedAssets
    {
        public GameObject planePrefab;
        public MeshFilter meshChunkPrefab;
        public GameObject placeholderPrefab;
    }

    sealed class Rig
    {
        public GameObject managers;
        public GameObject xrOrigin;
        public Camera camera;
        public Transform furnitureRoot;
        public ARPlaneManager planeManager;
        public ARRaycastManager raycastManager;
        public ARPointCloudManager pointCloudManager;
        public ARMeshManager meshManager;
        public ARPlacementIndicator placementIndicator;
    }
}
#endif
