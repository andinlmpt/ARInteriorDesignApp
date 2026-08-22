#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Imports downloaded GLB furniture into lightweight runtime prefabs under
/// Resources/Furniture so ARDesignScene does not serialize 70–80 MB GLBs.
/// Requires com.unity.cloud.gltfast (added to Packages/manifest.json).
/// </summary>
public static class GlbFurnitureImporter
{
    const string GlbFolder = "Assets/_App/Furniture/GLB";
    const string ResourcesFurniture = "Assets/_App/Furniture/Resources/Furniture";
    const string BakedRoot = "Assets/_App/Furniture/Baked";
    const int MaxTextureSize = 1024;

    static readonly HashSet<string> SkipSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        "washing-machine",
        "sofa-3230",
        "accent-chair",
        "kids-armchair",
        "unimat-mattress",
    };

    struct GlbDef
    {
        public string id;
        public string displayName;
        public string assetPath;
        public string category;
        public float width;
        public float height;
        public float depth;
    }

    static GlbDef[] CollectDefs()
    {
        var folder = Path.Combine(Application.dataPath, "_App/Furniture/GLB");
        if (!Directory.Exists(folder)) return Array.Empty<GlbDef>();

        var files = Directory.GetFiles(folder, "*.glb", SearchOption.AllDirectories);
        var list = new List<GlbDef>(files.Length);
        for (var i = 0; i < files.Length; i++)
        {
            var full = files[i];
            var fileName = Path.GetFileNameWithoutExtension(full);
            var id = Slug(fileName);
            if (SkipSlugs.Contains(id)) continue;

            var relative = "Assets" + full.Substring(Application.dataPath.Length).Replace('\\', '/');
            var parent = Path.GetFileName(Path.GetDirectoryName(full) ?? string.Empty);

            list.Add(new GlbDef
            {
                id = id,
                displayName = ToDisplayName(fileName),
                assetPath = relative,
                category = CategoryFromFolder(parent),
                width = 0f,
                height = 0f,
                depth = 0f,
            });
        }

        return list.ToArray();
    }

    static string CategoryFromFolder(string folder)
    {
        var key = (folder ?? string.Empty).Trim().ToLowerInvariant();
        if (key.Contains("sofa") || key.Contains("love") || key.Contains("chair") || key.Contains("seat"))
            return "seating";
        if (key.Contains("table"))
            return "tables";
        if (key.Contains("bed") || key.Contains("mattress"))
            return "beds";
        if (key.Contains("lamp") || key.Contains("light"))
            return "lighting";
        return "other";
    }

    static string Slug(string name)
    {
        if (string.IsNullOrEmpty(name)) return "furniture";
        var chars = name.Trim().ToLowerInvariant().ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            if (char.IsLetterOrDigit(chars[i])) continue;
            chars[i] = '-';
        }

        var slug = new string(chars);
        while (slug.Contains("--"))
            slug = slug.Replace("--", "-");
        return slug.Trim('-');
    }

    static string ToDisplayName(string id)
    {
        if (string.IsNullOrEmpty(id)) return "Furniture";
        var parts = id.Replace('_', ' ').Replace('-', ' ').Split(' ');
        for (var i = 0; i < parts.Length; i++)
        {
            if (parts[i].Length == 0) continue;
            parts[i] = char.ToUpperInvariant(parts[i][0]) + parts[i].Substring(1);
        }

        return string.Join(" ", parts);
    }

    [MenuItem("AR Interior/AR Design/Import Downloaded GLB Furniture", priority = 55)]
    public static void ImportMenu()
    {
        if (!Directory.Exists(Path.Combine(Application.dataPath, "_App/Furniture/GLB")))
        {
            EditorUtility.DisplayDialog("GLB Furniture",
                $"Missing folder:\n{GlbFolder}\n\nCopy your .glb files there first.", "OK");
            return;
        }

        EnsureFolder(ResourcesFurniture);
        EnsureFolder(BakedRoot);
        AssetDatabase.Refresh();

        var defs = CollectDefs();
        if (defs.Length == 0)
        {
            EditorUtility.DisplayDialog("GLB Furniture",
                $"No .glb files in:\n{GlbFolder}\n\nCopy your new furniture set there, wait for Unity to import, then run this again.",
                "OK");
            return;
        }

        var created = 0;
        var skipped = 0;

        try
        {
            for (var i = 0; i < defs.Length; i++)
            {
                var def = defs[i];
                EditorUtility.DisplayProgressBar(
                    "Importing GLB furniture",
                    $"Baking mobile prefab {i + 1}/{defs.Length}: {def.displayName}",
                    (float)i / defs.Length);

                var diskPath = Path.Combine(Application.dataPath, def.assetPath.Substring("Assets/".Length).Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(diskPath))
                {
                    Debug.LogWarning($"[GlbFurnitureImporter] Missing {def.assetPath}");
                    skipped++;
                    continue;
                }

                var source = AssetDatabase.LoadAssetAtPath<GameObject>(def.assetPath);
                if (source == null)
                {
                    Debug.LogWarning(
                        $"[GlbFurnitureImporter] Unity could not load {def.assetPath} as a GameObject. " +
                        "Wait for glTFast to finish importing, then run this menu again.");
                    skipped++;
                    continue;
                }

                try
                {
                    var prefab = BakeRuntimePrefab(source, def.id);
                    if (prefab != null)
                    {
                        FurnitureIconCapture.CaptureToResources(prefab, def.id);
                        created++;
                        Debug.Log($"[GlbFurnitureImporter] Baked Resources prefab → {ResourcesFurniture}/{def.id}.prefab");
                    }
                    else
                    {
                        skipped++;
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"[GlbFurnitureImporter] Bake failed for {def.id}: {e}");
                    skipped++;
                }
            }
        }
        finally
        {
            EditorUtility.ClearProgressBar();
        }

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        var managers = GameObject.Find("Managers");
        if (managers == null)
        {
            EditorUtility.DisplayDialog("GLB Furniture",
                $"Created {created} mobile prefab(s), skipped {skipped}.\n\nOpen ARDesignScene, then run this menu again to register them in the catalog.",
                "OK");
            return;
        }

        AppendGlbEntriesToCatalog(managers);
        EditorUtility.DisplayDialog("GLB Furniture",
            $"Baked {created} mobile furniture prefab(s) (textures ≤ {MaxTextureSize}px).\nSkipped: {skipped}.\n\nOriginal GLBs are NOT loaded when the app starts — that was causing the black screen.\n\nFile ▸ Build And Run again.",
            "OK");
    }

    static GameObject BakeRuntimePrefab(GameObject source, string id)
    {
        var instance = UnityEngine.Object.Instantiate(source);
        instance.name = id;

        var bakedDir = $"{BakedRoot}/{id}";
        EnsureFolder(bakedDir);

        var meshIndex = 0;
        foreach (var filter in instance.GetComponentsInChildren<MeshFilter>(true))
        {
            if (filter.sharedMesh == null) continue;
            filter.sharedMesh = SaveMeshCopy(filter.sharedMesh, $"{bakedDir}/{id}_mesh_{meshIndex}.asset");
            meshIndex++;
        }

        foreach (var skin in instance.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            if (skin.sharedMesh == null) continue;
            skin.sharedMesh = SaveMeshCopy(skin.sharedMesh, $"{bakedDir}/{id}_mesh_{meshIndex}.asset");
            meshIndex++;
        }

        var texIndex = 0;
        var matIndex = 0;
        foreach (var renderer in instance.GetComponentsInChildren<Renderer>(true))
        {
            var sourceMats = renderer.sharedMaterials;
            if (sourceMats == null || sourceMats.Length == 0) continue;

            var bakedMats = new Material[sourceMats.Length];
            for (var i = 0; i < sourceMats.Length; i++)
            {
                bakedMats[i] = BakeMaterial(
                    sourceMats[i],
                    $"{bakedDir}/{id}_mat_{matIndex}.mat",
                    bakedDir,
                    id,
                    ref texIndex);
                matIndex++;
            }

            renderer.sharedMaterials = bakedMats;
        }

        var resourcesPath = $"{ResourcesFurniture}/{id}.prefab";
        var prefab = PrefabUtility.SaveAsPrefabAsset(instance, resourcesPath);
        UnityEngine.Object.DestroyImmediate(instance);
        return prefab;
    }

    static Mesh SaveMeshCopy(Mesh source, string assetPath)
    {
        var copy = UnityEngine.Object.Instantiate(source);
        copy.name = Path.GetFileNameWithoutExtension(assetPath);
        AssetDatabase.CreateAsset(copy, assetPath);
        return AssetDatabase.LoadAssetAtPath<Mesh>(assetPath);
    }

    static Material BakeMaterial(Material source, string matPath, string bakedDir, string id, ref int texIndex)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit")
                     ?? Shader.Find("Universal Render Pipeline/Simple Lit")
                     ?? Shader.Find("Sprites/Default");
        var mat = shader != null ? new Material(shader) : new Material(source);

        if (source != null)
        {
            if (mat.HasProperty("_BaseColor") && source.HasProperty("_BaseColor"))
                mat.SetColor("_BaseColor", source.GetColor("_BaseColor"));
            else if (mat.HasProperty("_BaseColor") && source.HasProperty("_Color"))
                mat.SetColor("_BaseColor", source.color);
            else if (mat.HasProperty("_Color"))
                mat.color = source.HasProperty("_Color") ? source.color : Color.white;

            Texture main = null;
            if (source.HasProperty("_BaseMap")) main = source.GetTexture("_BaseMap");
            if (main == null && source.HasProperty("_MainTex")) main = source.GetTexture("_MainTex");
            if (main == null) main = source.mainTexture;

            if (main != null)
            {
                var texPath = $"{bakedDir}/{id}_tex_{texIndex}.png";
                texIndex++;
                var baked = BakeTexture(main, texPath);
                if (baked != null)
                {
                    if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", baked);
                    if (mat.HasProperty("_MainTex")) mat.SetTexture("_MainTex", baked);
                }
            }
        }

        AssetDatabase.CreateAsset(mat, matPath);
        return AssetDatabase.LoadAssetAtPath<Material>(matPath);
    }

    static Texture2D BakeTexture(Texture source, string assetPath)
    {
        if (source == null) return null;

        var srcW = Mathf.Max(1, source.width);
        var srcH = Mathf.Max(1, source.height);
        var scale = Mathf.Min(1f, MaxTextureSize / (float)Mathf.Max(srcW, srcH));
        var w = Mathf.Max(1, Mathf.RoundToInt(srcW * scale));
        var h = Mathf.Max(1, Mathf.RoundToInt(srcH * scale));

        var rt = RenderTexture.GetTemporary(w, h, 0, RenderTextureFormat.ARGB32);
        var prev = RenderTexture.active;
        try
        {
            Graphics.Blit(source, rt);
            RenderTexture.active = rt;
            var readable = new Texture2D(w, h, TextureFormat.RGBA32, false);
            readable.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            readable.Apply();

            var absPath = Path.Combine(Application.dataPath, assetPath.Substring("Assets/".Length).Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(absPath) ?? Application.dataPath);
            File.WriteAllBytes(absPath, readable.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(readable);
        }
        finally
        {
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);
        }

        AssetDatabase.ImportAsset(assetPath);
        if (AssetImporter.GetAtPath(assetPath) is TextureImporter importer)
        {
            importer.maxTextureSize = MaxTextureSize;
            importer.textureCompression = TextureImporterCompression.Compressed;
            importer.mipmapEnabled = true;
            importer.SaveAndReimport();
        }

        return AssetDatabase.LoadAssetAtPath<Texture2D>(assetPath);
    }

    static void EnsureFolder(string assetFolder)
    {
        if (AssetDatabase.IsValidFolder(assetFolder)) return;
        var parts = assetFolder.Replace('\\', '/').Split('/');
        var current = parts[0];
        for (var i = 1; i < parts.Length; i++)
        {
            var next = current + "/" + parts[i];
            if (!AssetDatabase.IsValidFolder(next))
                AssetDatabase.CreateFolder(current, parts[i]);
            current = next;
        }
    }

    static void AppendGlbEntriesToCatalog(GameObject managers)
    {
        var catalog = managers.GetComponent<FurnitureCatalog>() ?? managers.AddComponent<FurnitureCatalog>();
        var so = new SerializedObject(catalog);
        var entries = so.FindProperty("entries");

        foreach (var def in CollectDefs())
        {
            var prefabPath = $"{ResourcesFurniture}/{def.id}.prefab";
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
            if (prefab == null) continue;

            var index = -1;
            for (var i = 0; i < entries.arraySize; i++)
            {
                var idProp = entries.GetArrayElementAtIndex(i).FindPropertyRelative("id");
                if (idProp != null && idProp.stringValue == def.id)
                {
                    index = i;
                    break;
                }
            }

            if (index < 0)
            {
                index = entries.arraySize;
                entries.InsertArrayElementAtIndex(index);
            }

            var width = 0.8f;
            var height = 0.8f;
            var depth = 0.8f;
            if (ARFurnitureGrounding.TryGetLocalFurnitureBounds(prefab, out var bounds))
            {
                width = Mathf.Max(0.1f, bounds.size.x);
                height = Mathf.Max(0.1f, bounds.size.y);
                depth = Mathf.Max(0.1f, bounds.size.z);
            }

            var element = entries.GetArrayElementAtIndex(index);
            element.FindPropertyRelative("id").stringValue = def.id;
            element.FindPropertyRelative("displayName").stringValue = def.displayName;
            element.FindPropertyRelative("category").stringValue = def.category;
            // Do NOT serialize the prefab on the scene — that loads every sofa at startup.
            element.FindPropertyRelative("prefab").objectReferenceValue = null;
            var resourceProp = element.FindPropertyRelative("resourcePath");
            if (resourceProp != null)
                resourceProp.stringValue = $"Furniture/{def.id}";
            element.FindPropertyRelative("width").floatValue = width;
            element.FindPropertyRelative("height").floatValue = height;
            element.FindPropertyRelative("depth").floatValue = depth;
            var icon = AssetDatabase.LoadAssetAtPath<Sprite>($"{FurnitureIconCapture.OutputFolder}/{def.id}.png");
            element.FindPropertyRelative("icon").objectReferenceValue = icon;
        }

        so.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(catalog);
        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
            UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene());
    }
}
#endif
