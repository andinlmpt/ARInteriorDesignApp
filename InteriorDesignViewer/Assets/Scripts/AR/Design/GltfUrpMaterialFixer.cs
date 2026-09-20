using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// Safety net after glTFast instantiate. Primary coloring is done by
/// <see cref="FurnitureUnlitMaterialGenerator"/> during import.
/// This only repairs leftover magenta/error materials and soft-tunes working ones.
/// </summary>
public static class GltfUrpMaterialFixer
{
    const string FurnitureShaderName = "ARInterior/FurnitureUnlit";
    const string ShaderRefResource = "AR/FurnitureArUnlit";

    static readonly int BaseMapId = Shader.PropertyToID("_BaseMap");
    static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");

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

                // Already on project Unlit with a usable look — keep.
                if (!IsErrorShader(mat.shader) && IsFurnitureShader(mat.shader))
                {
                    fixedMats[i] = mat;
                    continue;
                }

                // Magenta / missing shader — rebuild onto FurnitureUnlit, copying any
                // still-reachable textures (usually already set by the material generator).
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

                // Non-error but not our Unlit (e.g. leftover Lit) — convert to Unlit
                // so AR lighting cannot wash fabric to chalk.
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

                // Prefer waiting until fabric albedo is bound (avoids chalk-white flash).
                var hasMap = false;
                if (mat.HasProperty(BaseMapId) && mat.GetTexture(BaseMapId) != null)
                    hasMap = true;
                else if (mat.mainTexture != null)
                    hasMap = true;

                var color = mat.HasProperty(BaseColorId) ? mat.GetColor(BaseColorId) : mat.color;
                var nearWhite = color.r > 0.97f && color.g > 0.97f && color.b > 0.97f;
                if (!hasMap && nearWhite)
                    return false;
            }
        }

        return any;
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

        if (mat.HasProperty(BaseColorId))
            mat.SetColor(BaseColorId, color);
        mat.color = color;

        Texture albedo = null;
        if (source.HasProperty(BaseMapId))
            albedo = source.GetTexture(BaseMapId);
        if (albedo == null && source.HasProperty("_MainTex"))
            albedo = source.GetTexture("_MainTex");
        if (albedo == null && source.HasProperty("baseColorTexture"))
            albedo = source.GetTexture("baseColorTexture");
        if (albedo == null)
            albedo = source.mainTexture;

        if (albedo != null && albedo.width > 1 && albedo.height > 1)
        {
            if (mat.HasProperty(BaseMapId))
                mat.SetTexture(BaseMapId, albedo);
            if (mat.HasProperty("_MainTex"))
                mat.SetTexture("_MainTex", albedo);
            mat.mainTexture = albedo;
        }

        mat.renderQueue = (int)RenderQueue.Geometry;
        mat.SetOverrideTag("RenderType", "Opaque");
        return mat;
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
