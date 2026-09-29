using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// Safety net after glTFast instantiate. Primary coloring is done by
/// <see cref="FurnitureUnlitMaterialGenerator"/> during import.
/// Repairs missing UVs, error shaders, and textureless gray placeholders.
/// </summary>
public static class GltfUrpMaterialFixer
{
    const string FurnitureShaderName = "ARInterior/FurnitureUnlit";
    const string ShaderRefResource = "AR/FurnitureArUnlit";

    static readonly int BaseMapId = Shader.PropertyToID("_BaseMap");
    static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
    static readonly int BaseMapStId = Shader.PropertyToID("_BaseMap_ST");

    static Shader furnitureShader;
    static Material shaderRefMaterial;

    static Shader FurnitureShader
    {
        get
        {
            if (furnitureShader != null && !IsErrorShader(furnitureShader))
                return furnitureShader;

            if (shaderRefMaterial == null)
                shaderRefMaterial = Resources.Load<Material>(ShaderRefResource);

            if (shaderRefMaterial != null && !IsErrorShader(shaderRefMaterial.shader))
                furnitureShader = shaderRefMaterial.shader;

            if (furnitureShader == null || IsErrorShader(furnitureShader))
                furnitureShader = Shader.Find(FurnitureShaderName);

            return furnitureShader;
        }
    }

    public static void Apply(GameObject root)
    {
        if (root == null) return;

        EnsurePrimaryUVs(root);

        var fallback = FurnitureShader;

        foreach (var renderer in root.GetComponentsInChildren<Renderer>(true))
        {
            if (renderer == null) continue;

            var mats = renderer.sharedMaterials;
            if (mats == null || mats.Length == 0) continue;

            var fixedMats = new Material[mats.Length];
            var changed = false;

            for (var i = 0; i < mats.Length; i++)
            {
                var mat = mats[i];
                if (mat == null)
                {
                    fixedMats[i] = mat;
                    continue;
                }

                if (!IsErrorShader(mat.shader) && IsFurnitureShader(mat.shader))
                {
                    EnsureTextureAliases(mat);
                    fixedMats[i] = mat;
                    continue;
                }

                if (IsErrorShader(mat.shader))
                {
                    if (fallback == null || IsErrorShader(fallback))
                    {
                        fixedMats[i] = mat;
                        continue;
                    }

                    fixedMats[i] = RebuildOnFurnitureUnlit(fallback, mat);
                    changed = true;
                    continue;
                }

                // Lit / Shader Graph leftovers → Unlit so AR ambient cannot wash fabric.
                if (fallback != null && !IsErrorShader(fallback))
                {
                    fixedMats[i] = RebuildOnFurnitureUnlit(fallback, mat);
                    changed = true;
                    continue;
                }

                fixedMats[i] = mat;
            }

            if (changed)
                renderer.sharedMaterials = fixedMats;
        }
    }

    public static bool HasUsableAlbedo(GameObject root) => LooksReady(root);

    /// <summary>
    /// True when every renderer has a non-error shader AND either a real albedo
    /// map or a clearly tinted base color (not the gray/white placeholder look).
    /// </summary>
    public static bool LooksReady(GameObject root)
    {
        if (root == null) return false;

        var any = false;
        foreach (var renderer in root.GetComponentsInChildren<Renderer>(true))
        {
            var mats = renderer.sharedMaterials;
            if (mats == null || mats.Length == 0) continue;

            for (var i = 0; i < mats.Length; i++)
            {
                any = true;
                var mat = mats[i];
                if (mat == null || IsErrorShader(mat.shader))
                    return false;

                if (HasBoundAlbedoMap(mat))
                    continue;

                var color = mat.HasProperty(BaseColorId) ? mat.GetColor(BaseColorId) : mat.color;
                // Textureless neutral gray/white/black = placeholder, not product fabric.
                if (IsNeutralPlaceholderColor(color))
                    return false;
            }
        }

        return any;
    }

    /// <summary>
    /// Many retail GLBs put baseColor on UV1 while our Unlit shader samples UV0.
    /// Copy the first non-degenerate UV set onto mesh.uv so albedo shows.
    /// </summary>
    public static void EnsurePrimaryUVs(GameObject root)
    {
        if (root == null) return;

        foreach (var filter in root.GetComponentsInChildren<MeshFilter>(true))
        {
            if (filter == null) continue;
            var mesh = filter.sharedMesh;
            if (mesh == null) continue;
            if (TryPromoteUVs(mesh, out var promoted))
                filter.sharedMesh = promoted;
        }

        foreach (var skin in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            if (skin == null) continue;
            var mesh = skin.sharedMesh;
            if (mesh == null) continue;
            if (TryPromoteUVs(mesh, out var promoted))
                skin.sharedMesh = promoted;
        }
    }

    static bool TryPromoteUVs(Mesh mesh, out Mesh promoted)
    {
        promoted = null;
        if (mesh == null || mesh.vertexCount <= 0) return false;

        var uv0 = mesh.uv;
        if (!IsDegenerateUvSet(uv0, mesh.vertexCount))
            return false;

        Vector2[] replacement = null;
        if (!IsDegenerateUvSet(mesh.uv2, mesh.vertexCount))
            replacement = mesh.uv2;
        else if (!IsDegenerateUvSet(mesh.uv3, mesh.vertexCount))
            replacement = mesh.uv3;
        else if (!IsDegenerateUvSet(mesh.uv4, mesh.vertexCount))
            replacement = mesh.uv4;

        if (replacement == null || replacement.Length != mesh.vertexCount)
            return false;

        promoted = Object.Instantiate(mesh);
        promoted.name = string.IsNullOrEmpty(mesh.name) ? "Furniture_UV0" : $"{mesh.name}_UV0";
        promoted.uv = replacement;
        return true;
    }

    static bool IsDegenerateUvSet(Vector2[] uvs, int vertexCount)
    {
        if (uvs == null || uvs.Length != vertexCount || vertexCount == 0)
            return true;

        var min = uvs[0];
        var max = uvs[0];
        for (var i = 1; i < uvs.Length; i++)
        {
            min = Vector2.Min(min, uvs[i]);
            max = Vector2.Max(max, uvs[i]);
        }

        var span = max - min;
        // All vertices share ~one texel → shader paints a flat color (often gray).
        return span.x < 0.0001f && span.y < 0.0001f;
    }

    static Material RebuildOnFurnitureUnlit(Shader shader, Material source)
    {
        var mat = new Material(shader)
        {
            name = string.IsNullOrEmpty(source.name) ? "Furniture_AR" : $"{source.name}_AR",
        };

        var color = Color.white;
        if (source.HasProperty(BaseColorId))
            color = source.GetColor(BaseColorId);
        else if (source.HasProperty("_Color"))
            color = source.GetColor("_Color");
        else if (source.HasProperty("baseColorFactor"))
            color = source.GetColor("baseColorFactor");
        else
            color = source.color;

        // Don't carry over the generator's gray placeholder tint.
        if (IsNeutralPlaceholderColor(color) && HasBoundAlbedoMap(source))
            color = Color.white;

        if (mat.HasProperty(BaseColorId))
            mat.SetColor(BaseColorId, color);
        mat.color = color;

        var albedo = FindAlbedoTexture(source);
        if (albedo != null && albedo.width > 1 && albedo.height > 1)
        {
            if (mat.HasProperty(BaseMapId))
                mat.SetTexture(BaseMapId, albedo);
            if (mat.HasProperty("_MainTex"))
                mat.SetTexture("_MainTex", albedo);
            mat.mainTexture = albedo;

            if (source.HasProperty(BaseMapStId) && mat.HasProperty(BaseMapStId))
                mat.SetVector(BaseMapStId, source.GetVector(BaseMapStId));
            else if (mat.HasProperty(BaseMapStId))
                mat.SetVector(BaseMapStId, new Vector4(1f, 1f, 0f, 0f));
        }

        mat.renderQueue = (int)RenderQueue.Geometry;
        mat.SetOverrideTag("RenderType", "Opaque");
        EnsureTextureAliases(mat);
        return mat;
    }

    static Texture FindAlbedoTexture(Material source)
    {
        if (source == null) return null;

        Texture albedo = null;
        if (source.HasProperty(BaseMapId))
            albedo = source.GetTexture(BaseMapId);
        if (albedo == null && source.HasProperty("_MainTex"))
            albedo = source.GetTexture("_MainTex");
        if (albedo == null && source.HasProperty("baseColorTexture"))
            albedo = source.GetTexture("baseColorTexture");
        if (albedo == null && source.HasProperty("_BaseColorMap"))
            albedo = source.GetTexture("_BaseColorMap");
        if (albedo == null)
            albedo = source.mainTexture;
        return albedo;
    }

    static void EnsureTextureAliases(Material mat)
    {
        if (mat == null) return;
        var albedo = FindAlbedoTexture(mat);
        if (albedo == null) return;

        if (mat.HasProperty(BaseMapId) && mat.GetTexture(BaseMapId) == null)
            mat.SetTexture(BaseMapId, albedo);
        if (mat.HasProperty("_MainTex") && mat.GetTexture("_MainTex") == null)
            mat.SetTexture("_MainTex", albedo);
        if (mat.mainTexture == null)
            mat.mainTexture = albedo;
    }

    static bool HasBoundAlbedoMap(Material mat)
    {
        var albedo = FindAlbedoTexture(mat);
        return albedo != null && albedo.width > 1 && albedo.height > 1;
    }

    static bool IsNeutralPlaceholderColor(Color color)
    {
        // Near white (chalk), near black, or the generator's Color.gray placeholder.
        var nearWhite = color.r > 0.95f && color.g > 0.95f && color.b > 0.95f;
        var nearBlack = color.r < 0.08f && color.g < 0.08f && color.b < 0.08f;
        var nearGray = Mathf.Abs(color.r - color.g) < 0.04f
                       && Mathf.Abs(color.g - color.b) < 0.04f
                       && color.r > 0.35f && color.r < 0.65f;
        return nearWhite || nearBlack || nearGray;
    }

    static bool IsFurnitureShader(Shader shader) =>
        shader != null && shader.name == FurnitureShaderName;

    static bool IsErrorShader(Shader shader)
    {
        if (shader == null) return true;
        var name = shader.name ?? string.Empty;
        return name.Contains("InternalError")
               || name.Contains("FallbackError")
               || name == "Hidden/InternalErrorShader";
    }
}
