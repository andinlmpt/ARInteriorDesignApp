#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Captures prefab thumbnail sprites for the furniture catalog.
/// Writes PNGs under Resources/FurnitureIcons so the player can load them
/// without serializing the 3D prefabs on the scene.
/// </summary>
public static class FurnitureIconCapture
{
    public const string OutputFolder = "Assets/_App/Furniture/Resources/FurnitureIcons";

    [MenuItem("AR Interior/Capture Furniture Icons From Catalog", false, 30)]
    public static void CaptureFromCatalog()
    {
        var catalog = Object.FindFirstObjectByType<FurnitureCatalog>();
        if (catalog == null)
        {
            EditorUtility.DisplayDialog("AR Interior", "Open ARDesignScene (FurnitureCatalog on Managers).", "OK");
            return;
        }

        EnsureFolder(OutputFolder);
        var captured = 0;
        var so = new SerializedObject(catalog);
        var entries = so.FindProperty("entries");

        for (var i = 0; i < entries.arraySize; i++)
        {
            var element = entries.GetArrayElementAtIndex(i);
            var id = element.FindPropertyRelative("id").stringValue;
            var prefab = ResolvePrefab(element, id);
            if (prefab == null) continue;

            EditorUtility.DisplayProgressBar("Furniture icons", $"Capturing {id}", (float)i / Mathf.Max(1, entries.arraySize));
            var sprite = CaptureToResources(prefab, id);
            if (sprite == null) continue;

            element.FindPropertyRelative("icon").objectReferenceValue = sprite;
            captured++;
        }

        EditorUtility.ClearProgressBar();
        so.ApplyModifiedProperties();
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        EditorUtility.DisplayDialog("AR Interior", $"Captured {captured} furniture icon(s) to {OutputFolder}.", "OK");
    }

    public static Sprite CaptureToResources(GameObject prefab, string id)
    {
        if (prefab == null || string.IsNullOrEmpty(id)) return null;
        EnsureFolder(OutputFolder);
        return CapturePrefab(prefab, id);
    }

    static GameObject ResolvePrefab(SerializedProperty element, string id)
    {
        var prefab = element.FindPropertyRelative("prefab").objectReferenceValue as GameObject;
        if (prefab != null) return prefab;

        var resourceProp = element.FindPropertyRelative("resourcePath");
        var resourcePath = resourceProp != null ? resourceProp.stringValue : null;
        if (string.IsNullOrWhiteSpace(resourcePath))
            resourcePath = $"Furniture/{id}";

        return Resources.Load<GameObject>(resourcePath)
               ?? AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/_App/Furniture/Resources/{resourcePath}.prefab");
    }

    static Sprite CapturePrefab(GameObject prefab, string id)
    {
        var bounds = CalculateBounds(prefab);
        var camGo = new GameObject("IconCaptureCamera");
        var cam = camGo.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.93f, 0.93f, 0.94f, 1f);
        cam.orthographic = true;
        cam.nearClipPlane = 0.01f;
        cam.farClipPlane = 100f;
        cam.allowHDR = false;
        cam.enabled = false;

        var lightGo = new GameObject("IconCaptureLight");
        var lightComp = lightGo.AddComponent<Light>();
        lightComp.type = LightType.Directional;
        lightComp.intensity = 1.6f;
        lightGo.transform.rotation = Quaternion.Euler(45f, -35f, 0f);

        var instance = Object.Instantiate(prefab);
        instance.hideFlags = HideFlags.HideAndDontSave;
        instance.transform.position = Vector3.zero;
        instance.transform.rotation = Quaternion.Euler(0f, 35f, 0f);

        var size = Mathf.Max(bounds.size.x, bounds.size.y, bounds.size.z, 0.5f);
        cam.orthographicSize = size * 0.48f;
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
        Object.DestroyImmediate(lightGo);
        rt.Release();

        var path = $"{OutputFolder}/{Sanitize(id)}.png";
        File.WriteAllBytes(path, tex.EncodeToPNG());
        Object.DestroyImmediate(tex);
        AssetDatabase.ImportAsset(path);

        var importer = AssetImporter.GetAtPath(path) as TextureImporter;
        if (importer != null)
        {
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.alphaIsTransparency = true;
            importer.isReadable = true;
            importer.mipmapEnabled = false;
            importer.maxTextureSize = 256;
            importer.SaveAndReimport();
        }

        return AssetDatabase.LoadAssetAtPath<Sprite>(path);
    }

    static Bounds CalculateBounds(GameObject prefab)
    {
        var instance = Object.Instantiate(prefab);
        instance.hideFlags = HideFlags.HideAndDontSave;
        instance.transform.position = Vector3.zero;
        instance.transform.rotation = Quaternion.identity;
        var renderers = instance.GetComponentsInChildren<Renderer>();

        Bounds bounds = new Bounds();
        bool hasBound = false;

        foreach (var r in renderers)
        {
            if (r == null || !r.enabled) continue;

            string name = r.gameObject.name.ToLower();
            if (name.Contains("shadow") || name.Contains("outline") || name.Contains("indicator") || name.Contains("collider"))
                continue;

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
            bounds = new Bounds(instance.transform.position, Vector3.one);

        Object.DestroyImmediate(instance);
        return bounds;
    }

    static void EnsureFolder(string path)
    {
        if (AssetDatabase.IsValidFolder(path)) return;
        var parts = path.Replace('\\', '/').Split('/');
        var current = parts[0];
        for (var i = 1; i < parts.Length; i++)
        {
            var next = current + "/" + parts[i];
            if (!AssetDatabase.IsValidFolder(next))
                AssetDatabase.CreateFolder(current, parts[i]);
            current = next;
        }
    }

    static string Sanitize(string id) => string.IsNullOrEmpty(id) ? "furniture" : id.Replace(' ', '-').ToLowerInvariant();
}
#endif
