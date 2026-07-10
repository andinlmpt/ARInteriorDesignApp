#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Captures prefab thumbnail sprites for the furniture picker (Gabmeister-style icons).
/// </summary>
public static class FurnitureIconCapture
{
    const string OutputFolder = "Assets/UI/FurnitureIcons";

    [MenuItem("AR Interior/Capture Furniture Icons From Catalog", false, 30)]
    static void CaptureFromCatalog()
    {
        var catalog = Object.FindFirstObjectByType<FurnitureCatalog>();
        if (catalog == null)
        {
            EditorUtility.DisplayDialog("AR Interior", "Open a scene with FurnitureCatalog on Managers.", "OK");
            return;
        }

        EnsureFolder(OutputFolder);
        var captured = 0;
        var so       = new SerializedObject(catalog);
        var entries  = so.FindProperty("entries");

        for (var i = 0; i < entries.arraySize; i++)
        {
            var element = entries.GetArrayElementAtIndex(i);
            var idProp  = element.FindPropertyRelative("id");
            var prefab  = element.FindPropertyRelative("prefab").objectReferenceValue as GameObject;
            if (prefab == null)
                continue;

            var sprite = CapturePrefab(prefab, idProp.stringValue);
            if (sprite == null)
                continue;

            element.FindPropertyRelative("icon").objectReferenceValue = sprite;
            captured++;
        }

        so.ApplyModifiedProperties();
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        EditorUtility.DisplayDialog("AR Interior", $"Captured {captured} furniture icon(s) to {OutputFolder}.", "OK");
    }

    static Sprite CapturePrefab(GameObject prefab, string id)
    {
        var bounds = CalculateBounds(prefab);
        var camGo  = new GameObject("IconCaptureCamera");
        var cam    = camGo.AddComponent<Camera>();
        cam.clearFlags      = CameraClearFlags.SolidColor;
        cam.backgroundColor = Color.white;
        cam.orthographic    = true;
        cam.nearClipPlane   = 0.01f;
        cam.farClipPlane    = 100f;

        var instance = Object.Instantiate(prefab);
        instance.transform.position = Vector3.zero;
        instance.transform.rotation = Quaternion.Euler(0f, 35f, 0f);

        var size   = Mathf.Max(bounds.size.x, bounds.size.y, bounds.size.z, 0.5f);
        cam.orthographicSize = size * 0.65f;
        camGo.transform.position = bounds.center + new Vector3(0.4f, size * 0.55f, -size * 1.2f);
        camGo.transform.LookAt(bounds.center);

        var rt = new RenderTexture(256, 256, 24);
        cam.targetTexture = rt;
        cam.Render();

        var tex = new Texture2D(256, 256, TextureFormat.RGBA32, false);
        RenderTexture.active = rt;
        tex.ReadPixels(new Rect(0, 0, 256, 256), 0, 0);
        tex.Apply();
        RenderTexture.active = null;

        Object.DestroyImmediate(instance);
        Object.DestroyImmediate(camGo);
        rt.Release();

        var path = $"{OutputFolder}/{Sanitize(id)}.png";
        File.WriteAllBytes(path, tex.EncodeToPNG());
        AssetDatabase.ImportAsset(path);

        var importer = AssetImporter.GetAtPath(path) as TextureImporter;
        if (importer != null)
        {
            importer.textureType         = TextureImporterType.Sprite;
            importer.spriteImportMode    = SpriteImportMode.Single;
            importer.alphaIsTransparency = true;
            importer.SaveAndReimport();
        }

        return AssetDatabase.LoadAssetAtPath<Sprite>(path);
    }

    static Bounds CalculateBounds(GameObject prefab)
    {
        var instance  = Object.Instantiate(prefab);
        var renderers = instance.GetComponentsInChildren<Renderer>();
        var bounds    = renderers.Length > 0 ? renderers[0].bounds : new Bounds(Vector3.zero, Vector3.one);

        for (var i = 1; i < renderers.Length; i++)
            bounds.Encapsulate(renderers[i].bounds);

        Object.DestroyImmediate(instance);
        return bounds;
    }

    static void EnsureFolder(string path)
    {
        if (!AssetDatabase.IsValidFolder(path))
        {
            if (!AssetDatabase.IsValidFolder("Assets/UI"))
                AssetDatabase.CreateFolder("Assets", "UI");
            AssetDatabase.CreateFolder("Assets/UI", "FurnitureIcons");
        }
    }

    static string Sanitize(string id) => string.IsNullOrEmpty(id) ? "furniture" : id.Replace(' ', '-').ToLowerInvariant();
}
#endif
