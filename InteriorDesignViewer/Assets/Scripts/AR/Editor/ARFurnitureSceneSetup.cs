#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Editor helpers for creating and opening AR furniture development scenes.
/// </summary>
public static class ARFurnitureSceneSetup
{
    const string TemplateScenePath = "Assets/Scenes/ARFurnitureDev.unity";
    const string FallbackTemplatePath = "Assets/Scenes/ARFurniture.unity";
    const string DefaultNewScenePath = "Assets/Scenes/ARFurnitureNew.unity";

    [MenuItem("AR Interior/Open Dev Scene", false, 0)]
    static void OpenDevScene()
    {
        var path = ResolveTemplatePath();
        if (string.IsNullOrEmpty(path))
        {
            EditorUtility.DisplayDialog(
                "AR Interior",
                "No AR furniture template scene found.\n\nExpected:\n" + TemplateScenePath,
                "OK");
            return;
        }

        if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            return;

        EditorSceneManager.OpenScene(path);
        Selection.activeObject = AssetDatabase.LoadAssetAtPath<SceneAsset>(path);
    }

    [MenuItem("AR Interior/Create New AR Furniture Scene...", false, 1)]
    static void CreateNewScene()
    {
        var template = ResolveTemplatePath();
        if (string.IsNullOrEmpty(template))
        {
            EditorUtility.DisplayDialog(
                "AR Interior",
                "No template scene found. Create ARFurnitureDev.unity first.",
                "OK");
            return;
        }

        var savePath = EditorUtility.SaveFilePanelInProject(
            "Create AR Furniture Scene",
            "ARFurnitureNew",
            "unity",
            "Choose a name and folder for the new AR furniture scene.",
            "Assets/Scenes");

        if (string.IsNullOrEmpty(savePath))
            return;

        if (File.Exists(savePath))
        {
            if (!EditorUtility.DisplayDialog(
                    "Overwrite Scene?",
                    $"Replace existing scene?\n\n{savePath}",
                    "Replace",
                    "Cancel"))
                return;
        }

        if (!AssetDatabase.CopyAsset(template, savePath))
        {
            EditorUtility.DisplayDialog("AR Interior", "Failed to copy template scene.", "OK");
            return;
        }

        AssetDatabase.Refresh();
        AddSceneToBuildSettings(savePath, enable: true);

        if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            return;

        EditorSceneManager.OpenScene(savePath);
        Selection.activeObject = AssetDatabase.LoadAssetAtPath<SceneAsset>(savePath);

        Debug.Log($"[AR Interior] Created AR furniture scene: {savePath}");
    }

    [MenuItem("AR Interior/Add Dev Scene To Build Settings", false, 20)]
    static void AddDevSceneToBuild()
    {
        var path = ResolveTemplatePath();
        if (string.IsNullOrEmpty(path))
            return;

        AddSceneToBuildSettings(path, enable: true);
        Debug.Log($"[AR Interior] Added to build settings: {path}");
    }

    [MenuItem("AR Interior/Use Production Scene (ARFurniture) In Build", false, 21)]
    static void UseProductionSceneInBuild()
    {
        const string productionPath = "Assets/Scenes/ARFurniture.unity";
        if (!File.Exists(productionPath))
        {
            EditorUtility.DisplayDialog("AR Interior", "ARFurniture.unity not found.", "OK");
            return;
        }

        DisableAllScenesInBuildSettings();
        AddSceneToBuildSettings(productionPath, enable: true);
        Debug.Log("[AR Interior] Build settings now use ARFurniture.unity (production).");
    }

    static string ResolveTemplatePath()
    {
        if (File.Exists(TemplateScenePath))
            return TemplateScenePath;
        if (File.Exists(FallbackTemplatePath))
            return FallbackTemplatePath;
        return null;
    }

    static void AddSceneToBuildSettings(string scenePath, bool enable)
    {
        var scenes = new System.Collections.Generic.List<EditorBuildSettingsScene>(
            EditorBuildSettings.scenes);

        var found = false;
        for (var i = 0; i < scenes.Count; i++)
        {
            if (scenes[i].path != scenePath)
                continue;

            scenes[i] = new EditorBuildSettingsScene(scenePath, enable);
            found = true;
            break;
        }

        if (!found)
            scenes.Add(new EditorBuildSettingsScene(scenePath, enable));

        if (enable)
        {
            for (var i = 0; i < scenes.Count; i++)
            {
                if (scenes[i].path != scenePath)
                    scenes[i] = new EditorBuildSettingsScene(scenes[i].path, false);
            }
        }

        EditorBuildSettings.scenes = scenes.ToArray();
    }

    static void DisableAllScenesInBuildSettings()
    {
        var scenes = EditorBuildSettings.scenes;
        for (var i = 0; i < scenes.Length; i++)
            scenes[i] = new EditorBuildSettingsScene(scenes[i].path, false);
        EditorBuildSettings.scenes = scenes;
    }
}
#endif
