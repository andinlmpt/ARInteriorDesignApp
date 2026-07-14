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
        cam.backgroundColor = Color.clear;
        cam.orthographic    = true;
        cam.nearClipPlane   = 0.01f;
        cam.farClipPlane    = 100f;

        // Create temporary directional light to illuminate the model
        var lightGo = new GameObject("IconCaptureLight");
        var lightComp = lightGo.AddComponent<Light>();
        lightComp.type = LightType.Directional;
        lightComp.intensity = 1.6f;
        lightGo.transform.rotation = Quaternion.Euler(45f, -35f, 0f);

        var instance = Object.Instantiate(prefab);
        instance.transform.position = Vector3.zero;
        instance.transform.rotation = Quaternion.Euler(0f, 35f, 0f);

        var size   = Mathf.Max(bounds.size.x, bounds.size.y, bounds.size.z, 0.5f);
        cam.orthographicSize = size * 0.48f; // Zoom in closer to make model fill the icon frame
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
        Object.DestroyImmediate(lightGo); // Destroy light
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
        instance.transform.position = Vector3.zero;
        instance.transform.rotation = Quaternion.identity;
        var renderers = instance.GetComponentsInChildren<Renderer>();
        
        Bounds bounds = new Bounds();
        bool hasBound = false;

        foreach (var r in renderers)
        {
            if (r == null || !r.enabled) continue;
            
            // Ignore shadow planes, helper indicators, or colliders which skew the model size bounds
            string name = r.gameObject.name.ToLower();
            if (name.Contains("shadow") || name.Contains("outline") || name.Contains("indicator") || name.Contains("collider"))
                continue;

            // Only bounds-check actual Mesh and Skinned Mesh geometry
            if (!(r is MeshRenderer || r is SkinnedMeshRenderer))
                continue;

            if (!hasBound)
            {
                bounds = r.bounds;
                hasBound = true;
            }
            else
            {
                bounds.Encapsulate(r.bounds);
            }
        }

        if (!hasBound)
        {
            bounds = new Bounds(instance.transform.position, Vector3.one);
        }

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
