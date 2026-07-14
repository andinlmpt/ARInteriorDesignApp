using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Runs automatically in the Unity Editor to inspect the active scene.
/// If the scene is ARFurnitureDev, it finds the 'Managers' GameObject and adds the Wall Paint scripts.
/// </summary>
[InitializeOnLoad]
public static class ARWallPaintAutoSetup
{
    static ARWallPaintAutoSetup()
    {
        // delayCall ensures the scene is fully loaded and hierarchy is populated
        EditorApplication.delayCall += AutoSetup;
    }

    private static void AutoSetup()
    {
        var activeScene = SceneManager.GetActiveScene();
        if (activeScene.name != "ARFurnitureDev") return;

        var managersGo = GameObject.Find("Managers");
        if (managersGo == null)
        {
            Debug.LogWarning("[AR Interior] Auto Setup: 'Managers' GameObject not found in active scene.");
            return;
        }

        bool modified = false;

        // Check and add mode switcher
        var modeSwitcher = managersGo.GetComponent<ARModeSwitcher>();
        if (modeSwitcher == null)
        {
            managersGo.AddComponent<ARModeSwitcher>();
            modified = true;
            Debug.Log("[AR Interior] Auto Setup: Added ARModeSwitcher to Managers.");
        }

        // Check and add wall selector
        var wallSelector = managersGo.GetComponent<WallSelector>();
        if (wallSelector == null)
        {
            managersGo.AddComponent<WallSelector>();
            modified = true;
            Debug.Log("[AR Interior] Auto Setup: Added WallSelector to Managers.");
        }

        // Check and add wall painter
        var wallPainter = managersGo.GetComponent<WallPainter>();
        if (wallPainter == null)
        {
            managersGo.AddComponent<WallPainter>();
            modified = true;
            Debug.Log("[AR Interior] Auto Setup: Added WallPainter to Managers.");
        }

        // Check and add color picker controller
        var colorPicker = managersGo.GetComponent<ColorPickerUIController>();
        if (colorPicker == null)
        {
            managersGo.AddComponent<ColorPickerUIController>();
            modified = true;
            Debug.Log("[AR Interior] Auto Setup: Added ColorPickerUIController to Managers.");
        }

        // Save modification changes to the scene
        if (modified)
        {
            EditorUtility.SetDirty(managersGo);
            EditorSceneManager.MarkSceneDirty(activeScene);
            EditorSceneManager.SaveScene(activeScene);
            Debug.Log("[AR Interior] Auto Setup: Successfully saved scene modifications.");
        }
    }
}
