#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Moves bundled Resources/Furniture prefabs out of the build so the app streams
/// GLBs from MongoDB/GCS instead of shipping 70–80 MB models in the APK.
/// Keeps FurnitureDimensions.json and FurnitureIcons for offline metadata bootstrap.
/// </summary>
public static class StripBundledFurniturePrefabs
{
    const string ResourcesFurniture = "Assets/_App/Furniture/Resources/Furniture";
    const string ArchiveFolder = "Assets/_App/Furniture/_ArchivedPrefabs";

    [MenuItem("AR Interior/AR Design/Strip Bundled Furniture Prefabs (Move to Archive)")]
    public static void MovePrefabsToArchive()
    {
        if (!AssetDatabase.IsValidFolder("Assets/_App/Furniture/Resources"))
        {
            EditorUtility.DisplayDialog(
                "Strip Bundled Prefabs",
                "Resources/Furniture folder was not found.",
                "OK");
            return;
        }

        if (!AssetDatabase.IsValidFolder(ResourcesFurniture))
        {
            EditorUtility.DisplayDialog(
                "Strip Bundled Prefabs",
                "No prefabs folder at Assets/_App/Furniture/Resources/Furniture.",
                "OK");
            return;
        }

        var prefabGuids = AssetDatabase.FindAssets("t:Prefab", new[] { ResourcesFurniture });
        if (prefabGuids.Length == 0)
        {
            EditorUtility.DisplayDialog(
                "Strip Bundled Prefabs",
                "No prefabs found under Resources/Furniture — nothing to move.",
                "OK");
            return;
        }

        var message =
            $"Move {prefabGuids.Length} prefab(s) from Resources/Furniture to\n{ArchiveFolder}?\n\n" +
            "The catalog will stream GLBs from MongoDB/GCS. FurnitureDimensions.json and icons stay in Resources.";

        if (!EditorUtility.DisplayDialog("Strip Bundled Prefabs", message, "Move to Archive", "Cancel"))
            return;

        EnsureFolder("Assets/_App/Furniture", "_ArchivedPrefabs");

        var moved = 0;
        AssetDatabase.StartAssetEditing();
        try
        {
            foreach (var guid in prefabGuids)
            {
                var source = AssetDatabase.GUIDToAssetPath(guid);
                var fileName = Path.GetFileName(source);
                var dest = $"{ArchiveFolder}/{fileName}";
                if (AssetDatabase.LoadAssetAtPath<Object>(dest) != null)
                {
                    Debug.LogWarning($"[StripBundledFurniturePrefabs] Skipping {fileName} — already archived.");
                    continue;
                }

                var error = AssetDatabase.MoveAsset(source, dest);
                if (!string.IsNullOrEmpty(error))
                {
                    Debug.LogError($"[StripBundledFurniturePrefabs] Failed to move {source}: {error}");
                    continue;
                }

                moved++;
            }
        }
        finally
        {
            AssetDatabase.StopAssetEditing();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
        }

        Debug.Log($"[StripBundledFurniturePrefabs] Moved {moved} prefab(s) to {ArchiveFolder}. Rebuild the player to shrink the APK.");
        EditorUtility.DisplayDialog(
            "Strip Bundled Prefabs",
            $"Moved {moved} prefab(s) to {ArchiveFolder}.\n\nRebuild the Unity export and dev client.",
            "OK");
    }

    [MenuItem("AR Interior/AR Design/Restore Archived Furniture Prefabs")]
    public static void RestorePrefabsFromArchive()
    {
        if (!AssetDatabase.IsValidFolder(ArchiveFolder))
        {
            EditorUtility.DisplayDialog("Restore Prefabs", "No archived prefabs folder found.", "OK");
            return;
        }

        var prefabGuids = AssetDatabase.FindAssets("t:Prefab", new[] { ArchiveFolder });
        if (prefabGuids.Length == 0)
        {
            EditorUtility.DisplayDialog("Restore Prefabs", "Archive folder is empty.", "OK");
            return;
        }

        if (!EditorUtility.DisplayDialog(
                "Restore Prefabs",
                $"Restore {prefabGuids.Length} prefab(s) back to Resources/Furniture?",
                "Restore",
                "Cancel"))
            return;

        EnsureFolder("Assets/_App/Furniture/Resources", "Furniture");

        var restored = 0;
        AssetDatabase.StartAssetEditing();
        try
        {
            foreach (var guid in prefabGuids)
            {
                var source = AssetDatabase.GUIDToAssetPath(guid);
                var fileName = Path.GetFileName(source);
                var dest = $"{ResourcesFurniture}/{fileName}";
                var error = AssetDatabase.MoveAsset(source, dest);
                if (!string.IsNullOrEmpty(error))
                {
                    Debug.LogError($"[StripBundledFurniturePrefabs] Failed to restore {source}: {error}");
                    continue;
                }

                restored++;
            }
        }
        finally
        {
            AssetDatabase.StopAssetEditing();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
        }

        EditorUtility.DisplayDialog("Restore Prefabs", $"Restored {restored} prefab(s).", "OK");
    }

    static void EnsureFolder(string parent, string child)
    {
        var path = $"{parent}/{child}";
        if (AssetDatabase.IsValidFolder(path)) return;

        if (!AssetDatabase.IsValidFolder(parent))
            throw new DirectoryNotFoundException($"Parent folder missing: {parent}");

        AssetDatabase.CreateFolder(parent, child);
    }
}
#endif
