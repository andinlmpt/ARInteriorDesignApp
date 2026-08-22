#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;

/// <summary>
/// Auto-repairs "AR Estimated Light" before Play / on scene open.
/// Unity throws MissingComponentException when a Light-requiring component
/// (e.g. UniversalAdditionalLightData) is present without a Light — that happens
/// before any runtime Awake() can fix it.
/// </summary>
[InitializeOnLoad]
public static class ARDesignLightAutoFix
{
    static ARDesignLightAutoFix()
    {
        EditorApplication.playModeStateChanged += OnPlayModeChanged;
        EditorSceneManager.sceneOpened += (_, _) => { FixAllOpenScenes(); };
        // Delay one tick so domain reload finishes first.
        EditorApplication.delayCall += () => { FixAllOpenScenes(); };
    }

    static void OnPlayModeChanged(PlayModeStateChange state)
    {
        if (state == PlayModeStateChange.ExitingEditMode)
            FixAllOpenScenes();
    }

    [MenuItem("AR Interior/AR Design/Fix AR Estimated Light", false, 40)]
    public static void FixMenu()
    {
        var fixedCount = FixAllOpenScenes();
        EditorUtility.DisplayDialog(
            "AR Design",
            fixedCount > 0
                ? $"Fixed {fixedCount} light object(s). Save the scene (Ctrl+S)."
                : "Nothing to fix (or no AR Estimated Light in open scenes).",
            "OK");
    }

    public static int FixAllOpenScenes()
    {
        var count = 0;
        for (var i = 0; i < SceneManager.sceneCount; i++)
        {
            var scene = SceneManager.GetSceneAt(i);
            if (!scene.isLoaded) continue;
            foreach (var root in scene.GetRootGameObjects())
                count += FixUnder(root);
        }

        // Also catch inactive / Find by name across loaded scenes.
        var named = GameObject.Find("AR Estimated Light");
        if (named != null && FixGameObject(named))
            count++;

        return count;
    }

    static int FixUnder(GameObject root)
    {
        var fixedCount = 0;
        if (root.name == "AR Estimated Light" && FixGameObject(root))
            fixedCount++;

        foreach (Transform child in root.transform)
            fixedCount += FixUnder(child.gameObject);

        return fixedCount;
    }

    static bool FixGameObject(GameObject go)
    {
        if (go == null) return false;

        var changed = false;

        // URP additional light data REQUIRES Light — remove it first if Light is missing
        // so Unity stops throwing MissingComponentException on domain reload / play.
        var light = go.GetComponent<Light>();
        var additional = go.GetComponent<UniversalAdditionalLightData>();
        if (light == null && additional != null)
        {
            Object.DestroyImmediate(additional, true);
            changed = true;
        }

        light = go.GetComponent<Light>();
        if (light == null)
        {
            light = go.AddComponent<Light>();
            changed = true;
        }

        if (light != null)
        {
            if (light.type != LightType.Directional)
            {
                light.type = LightType.Directional;
                changed = true;
            }

            if (light.shadows == LightShadows.None)
            {
                light.shadows = LightShadows.Soft;
                changed = true;
            }

            if (light.intensity < 0.05f)
            {
                light.intensity = 1f;
                changed = true;
            }
        }

        // Ensure our estimation driver exists (without RequireComponent).
        if (go.GetComponent<ARDesignLighting>() == null)
        {
            go.AddComponent<ARDesignLighting>();
            changed = true;
        }

        // Re-add URP data only after Light exists.
        if (light != null && go.GetComponent<UniversalAdditionalLightData>() == null)
        {
            go.AddComponent<UniversalAdditionalLightData>();
            changed = true;
        }

        if (changed)
        {
            EditorUtility.SetDirty(go);
            var scene = go.scene;
            if (scene.IsValid())
                EditorSceneManager.MarkSceneDirty(scene);
            Debug.Log($"[ARDesignLightAutoFix] Repaired '{go.name}'.");
        }

        return changed;
    }
}
#endif
