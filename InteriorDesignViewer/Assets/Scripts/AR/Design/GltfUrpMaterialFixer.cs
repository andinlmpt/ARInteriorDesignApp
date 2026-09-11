using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// Ensures runtime glTF/glTFast furniture materials render with correct albedo
/// colors/textures under URP in AR (fixes flat white or magenta furniture).
/// </summary>
public static class GltfUrpMaterialFixer
{
    static Shader urpSimpleLitShader;
    static Shader urpLitShader;

    static Shader UrpSimpleLitShader =>
        urpSimpleLitShader ??= Shader.Find("Universal Render Pipeline/Simple Lit")
                           ?? Shader.Find("Universal Render Pipeline/Lit");

    static Shader UrpLitShader =>
        urpLitShader ??= Shader.Find("Universal Render Pipeline/Lit")
                     ?? UrpSimpleLitShader;

    public static void Apply(GameObject root)
    {
        if (root == null) return;

        var shader = UrpSimpleLitShader;
        if (shader == null)
        {
            Debug.LogWarning("[GltfUrpMaterialFixer] URP shader not found — furniture may render pink or white.");
            return;
        }

        foreach (var renderer in root.GetComponentsInChildren<Renderer>(true))
        {
            var sourceMats = renderer.sharedMaterials;
            if (sourceMats == null || sourceMats.Length == 0) continue;

            var fixedMats = new Material[sourceMats.Length];
            for (var i = 0; i < sourceMats.Length; i++)
                fixedMats[i] = EnsureFurnitureMaterial(sourceMats[i], shader);

            renderer.sharedMaterials = fixedMats;
        }
    }

    static Material EnsureFurnitureMaterial(Material source, Shader targetShader)
    {
        Material result;
        if (NeedsRebuild(source))
            result = RebuildMaterial(source, targetShader);
        else
            result = source;

        NormalizeForArFurniture(result);
        LogMaterialSummary(result);
        return result;
    }

    static bool NeedsRebuild(Material source)
    {
        if (source == null) return true;
        if (source.shader == null) return true;

        var shaderName = source.shader.name ?? string.Empty;
        if (shaderName.Contains("InternalError") || shaderName.Contains("Hidden/"))
            return true;

        if (!IsUrpFamilyShader(source.shader))
            return true;

        // glTFast URP materials sometimes keep the shader but lose/alias the base map on device.
        if (!HasAssignedAlbedo(source) && FindAlbedoTexture(source) != null)
            return true;

        if (HasEmissiveBlowout(source))
            return true;

        return false;
    }

    static Material RebuildMaterial(Material source, Shader shader)
    {
        var mat = new Material(shader)
        {
            name = source != null && !string.IsNullOrEmpty(source.name)
                ? $"{source.name}_AR"
                : "FurnitureMaterial_AR",
        };

        if (source == null)
            return mat;

        CopyBaseColor(source, mat);
        AssignAlbedoTexture(source, mat);
        CopyMetallicRoughness(source, mat);
        CopyNormalMap(source, mat);

        if (IsTransparent(source))
            ConfigureTransparent(mat);
        else
            ConfigureOpaque(mat);

        return mat;
    }

    static void NormalizeForArFurniture(Material mat)
    {
        if (mat == null) return;

        if (!HasAssignedAlbedo(mat))
            AssignAlbedoTexture(mat, mat);

        if (mat.HasProperty("_Metallic"))
            mat.SetFloat("_Metallic", Mathf.Clamp(mat.GetFloat("_Metallic"), 0f, 0.15f));

        if (mat.HasProperty("_Smoothness"))
            mat.SetFloat("_Smoothness", Mathf.Clamp(mat.GetFloat("_Smoothness"), 0.2f, 0.45f));

        DisableEmission(mat);

        if (!IsTransparent(mat))
            ConfigureOpaque(mat);
    }

    static void DisableEmission(Material mat)
    {
        mat.DisableKeyword("_EMISSION");
        if (mat.HasProperty("_EmissionColor"))
            mat.SetColor("_EmissionColor", Color.black);
        if (mat.HasProperty("_EmissiveColor"))
            mat.SetColor("_EmissiveColor", Color.black);
        mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.EmissiveIsBlack;
    }

    static bool IsUrpFamilyShader(Shader shader)
    {
        if (shader == null) return false;
        var name = shader.name;
        return name.Contains("Universal Render Pipeline/Lit")
            || name.Contains("Universal Render Pipeline/Simple Lit")
            || name.Contains("Universal Render Pipeline/Unlit");
    }

    static bool HasAssignedAlbedo(Material mat)
    {
        if (mat == null) return false;

        if (mat.HasProperty("_BaseMap") && mat.GetTexture("_BaseMap") != null)
            return true;
        if (mat.HasProperty("_MainTex") && mat.GetTexture("_MainTex") != null)
            return true;

        return mat.mainTexture != null;
    }

    static bool HasEmissiveBlowout(Material mat)
    {
        if (mat == null) return false;
        if (!mat.IsKeywordEnabled("_EMISSION")) return false;

        if (mat.HasProperty("_EmissionColor"))
        {
            var emission = mat.GetColor("_EmissionColor");
            if (emission.maxColorComponent > 0.05f)
                return true;
        }

        return mat.HasProperty("_EmissionMap") && mat.GetTexture("_EmissionMap") != null;
    }

    static void CopyBaseColor(Material source, Material dest)
    {
        var color = ReadBaseColor(source);
        if (dest.HasProperty("_BaseColor")) dest.SetColor("_BaseColor", color);
        if (dest.HasProperty("_Color")) dest.color = color;
    }

    static Color ReadBaseColor(Material source)
    {
        if (source == null) return Color.white;

        string[] candidates = { "_BaseColor", "_Color", "_DiffuseColor", "baseColorFactor" };
        for (var i = 0; i < candidates.Length; i++)
        {
            if (!source.HasProperty(candidates[i])) continue;
            var color = source.GetColor(candidates[i]);
            if (color.a > 0.001f)
                return color;
        }

        return source.color;
    }

    static void AssignAlbedoTexture(Material source, Material dest)
    {
        var texture = FindAlbedoTexture(source);
        if (texture == null) return;

        if (dest.HasProperty("_BaseMap")) dest.SetTexture("_BaseMap", texture);
        if (dest.HasProperty("_MainTex")) dest.SetTexture("_MainTex", texture);
        dest.mainTexture = texture;

        if (source.HasProperty("_BaseMap"))
        {
            if (dest.HasProperty("_BaseMap"))
            {
                dest.SetTextureOffset("_BaseMap", source.GetTextureOffset("_BaseMap"));
                dest.SetTextureScale("_BaseMap", source.GetTextureScale("_BaseMap"));
            }
        }
    }

    static Texture FindAlbedoTexture(Material source)
    {
        if (source == null) return null;

        string[] preferred =
        {
            "_BaseMap",
            "_MainTex",
            "_BaseColorMap",
            "_BaseColorTexture",
            "_DiffuseMap",
            "_AlbedoMap",
            "baseColorTexture",
        };

        for (var i = 0; i < preferred.Length; i++)
        {
            var texture = GetTexture(source, preferred[i]);
            if (IsUsableColorMap(texture)) return texture;
        }

        Texture best = null;
        var bestArea = 0;
        var propertyNames = source.GetTexturePropertyNames();
        for (var i = 0; i < propertyNames.Length; i++)
        {
            var prop = propertyNames[i];
            var lower = prop.ToLowerInvariant();
            if (IsNonAlbedoProperty(lower)) continue;

            var texture = source.GetTexture(prop);
            if (!IsUsableColorMap(texture)) continue;

            var area = texture.width * texture.height;
            if (area <= bestArea) continue;
            bestArea = area;
            best = texture;
        }

        return best ?? source.mainTexture;
    }

    static bool IsNonAlbedoProperty(string lowerName)
    {
        return lowerName.Contains("normal")
            || lowerName.Contains("bump")
            || lowerName.Contains("metal")
            || lowerName.Contains("rough")
            || lowerName.Contains("emiss")
            || lowerName.Contains("occlusion")
            || lowerName.Contains("height")
            || lowerName.Contains("spec")
            || lowerName.Contains("light");
    }

    static bool IsUsableColorMap(Texture texture)
    {
        return texture != null && texture.width > 1 && texture.height > 1;
    }

    static void CopyMetallicRoughness(Material source, Material dest)
    {
        if (TryGetFloat(source, "_Metallic", out var metallic) && dest.HasProperty("_Metallic"))
            dest.SetFloat("_Metallic", Mathf.Clamp(metallic, 0f, 0.15f));

        if (TryGetFloat(source, "_Smoothness", out var smoothness) && dest.HasProperty("_Smoothness"))
        {
            dest.SetFloat("_Smoothness", Mathf.Clamp(smoothness, 0.2f, 0.45f));
            return;
        }

        if (TryGetFloat(source, "_Roughness", out var roughness) && dest.HasProperty("_Smoothness"))
            dest.SetFloat("_Smoothness", Mathf.Clamp(1f - roughness, 0.2f, 0.45f));

        if (TryGetFloat(source, "_Glossiness", out var glossiness) && dest.HasProperty("_Smoothness"))
            dest.SetFloat("_Smoothness", Mathf.Clamp(glossiness, 0.2f, 0.45f));
    }

    static void CopyNormalMap(Material source, Material dest)
    {
        var normalMap = GetTexture(source, "_BumpMap")
                        ?? GetTexture(source, "_NormalMap")
                        ?? GetTexture(source, "normalTexture");
        if (normalMap == null) return;

        if (dest.HasProperty("_BumpMap")) dest.SetTexture("_BumpMap", normalMap);
        if (dest.HasProperty("_NormalMap")) dest.SetTexture("_NormalMap", normalMap);
        dest.EnableKeyword("_NORMALMAP");

        if (TryGetFloat(source, "_BumpScale", out var scale) && dest.HasProperty("_BumpScale"))
            dest.SetFloat("_BumpScale", scale);
    }

    static bool IsTransparent(Material source)
    {
        if (source == null) return false;
        if (source.renderQueue >= (int)RenderQueue.Transparent) return true;

        if (source.HasProperty("_Surface") && source.GetFloat("_Surface") > 0.5f)
            return true;

        if (TryGetColor(source, "_BaseColor", out var baseColor) && baseColor.a < 0.99f)
            return true;

        return TryGetColor(source, "_Color", out var color) && color.a < 0.99f;
    }

    static void ConfigureOpaque(Material mat)
    {
        if (mat.HasProperty("_Surface")) mat.SetFloat("_Surface", 0f);
        mat.SetOverrideTag("RenderType", "Opaque");
        mat.renderQueue = (int)RenderQueue.Geometry;
        mat.DisableKeyword("_SURFACE_TYPE_TRANSPARENT");
    }

    static void ConfigureTransparent(Material mat)
    {
        if (mat.HasProperty("_Surface")) mat.SetFloat("_Surface", 1f);
        if (mat.HasProperty("_Blend")) mat.SetFloat("_Blend", 0f);

        mat.SetOverrideTag("RenderType", "Transparent");
        mat.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
        mat.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
        mat.SetInt("_ZWrite", 0);
        mat.DisableKeyword("_ALPHATEST_ON");
        mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        mat.renderQueue = (int)RenderQueue.Transparent;
    }

    static void LogMaterialSummary(Material mat)
    {
#if UNITY_EDITOR || DEVELOPMENT_BUILD
        if (mat == null) return;

        Texture albedo = null;
        if (mat.HasProperty("_BaseMap")) albedo = mat.GetTexture("_BaseMap");
        albedo ??= mat.mainTexture;

        var color = mat.HasProperty("_BaseColor") ? mat.GetColor("_BaseColor") : mat.color;
        Debug.Log(
            $"[GltfUrpMaterialFixer] {mat.name} shader={mat.shader?.name} " +
            $"albedo={(albedo != null ? albedo.name : "MISSING")} color={color}");
#endif
    }

    static Texture GetTexture(Material material, string property)
    {
        return material != null && material.HasProperty(property) ? material.GetTexture(property) : null;
    }

    static bool TryGetColor(Material material, string property, out Color color)
    {
        color = default;
        if (material == null || !material.HasProperty(property)) return false;
        color = material.GetColor(property);
        return true;
    }

    static bool TryGetFloat(Material material, string property, out float value)
    {
        value = 0f;
        if (material == null || !material.HasProperty(property)) return false;
        value = material.GetFloat(property);
        return true;
    }
}
