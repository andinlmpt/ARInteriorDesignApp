#if GLTFAST_PRESENT
using GLTFast;
using GLTFast.Materials;
using GLTFast.Schema;
using UnityEngine;
using UnityEngine.Rendering;
using Material = UnityEngine.Material;

/// <summary>
/// Builds AR furniture materials with the project <c>ARInterior/FurnitureUnlit</c> shader
/// during glTFast import — before Shader Graph materials can become InternalErrorShader
/// (magenta) on Android device builds.
///
/// Textures are taken from <see cref="IGltfReadable"/>, not from Material properties,
/// so albedo survives even when URP Shader Graph variants are stripped.
/// </summary>
public sealed class FurnitureUnlitMaterialGenerator : MaterialGenerator
{
    const string ShaderName = "ARInterior/FurnitureUnlit";
    const string ShaderRefResource = "AR/FurnitureArUnlit";

    static readonly int BaseMapId = Shader.PropertyToID("_BaseMap");
    static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
    static readonly int MainTexId = Shader.PropertyToID("_MainTex");
    static readonly int BaseMapStId = Shader.PropertyToID("_BaseMap_ST");

    Shader furnitureShader;
    Material defaultMaterial;

    protected override Material GenerateDefaultMaterial(bool pointsSupport = false)
    {
        if (defaultMaterial != null)
            return defaultMaterial;

        var shader = ResolveShader();
        if (shader == null)
            return null;

        // White — never gray. Gray was being treated as "ready" and cached as a blank sofa.
        defaultMaterial = new Material(shader)
        {
            name = DefaultMaterialName,
            color = Color.white,
        };
        if (defaultMaterial.HasProperty(BaseColorId))
            defaultMaterial.SetColor(BaseColorId, Color.white);
        return defaultMaterial;
    }

    public override Material GenerateMaterial(
        MaterialBase gltfMaterial,
        IGltfReadable gltf,
        bool pointsSupport = false)
    {
        var shader = ResolveShader();
        if (shader == null)
        {
            Debug.LogError(
                "[FurnitureUnlitMaterialGenerator] ARInterior/FurnitureUnlit missing from build. " +
                "Ensure Assets/Resources/AR/FurnitureArUnlit.mat exists.");
            return null;
        }

        var material = new Material(shader)
        {
            name = string.IsNullOrEmpty(gltfMaterial?.name) ? "Furniture" : gltfMaterial.name,
        };

        var baseColorLinear = Color.white;
        TextureInfoBase baseColorTexture = null;

        if (gltfMaterial?.Extensions?.KHR_materials_pbrSpecularGlossiness != null)
        {
            var specGloss = gltfMaterial.Extensions.KHR_materials_pbrSpecularGlossiness;
            baseColorLinear = specGloss.DiffuseColor;
            baseColorTexture = specGloss.diffuseTexture;
        }
        else if (gltfMaterial?.PbrMetallicRoughness != null)
        {
            baseColorLinear = gltfMaterial.PbrMetallicRoughness.BaseColor;
            baseColorTexture = gltfMaterial.PbrMetallicRoughness.BaseColorTexture;
        }

        // Match glTFast URP generator: store gamma for Unity color properties.
        var baseColor = baseColorLinear.gamma;
        if (material.HasProperty(BaseColorId))
            material.SetColor(BaseColorId, baseColor);
        material.color = baseColor;

        var bound = false;
        if (baseColorTexture != null)
        {
            bound = TrySetTexture(baseColorTexture, material, gltf, BaseMapId);
            if (!bound)
                bound = TryBindTextureManual(baseColorTexture, material, gltf);
        }

        // Last resort: first available glTF texture (some exports omit material texture refs).
        if (!bound && gltf != null && gltf.TextureCount > 0)
        {
            for (var i = 0; i < gltf.TextureCount; i++)
            {
                var tex = gltf.GetTexture(i);
                if (tex == null || tex.width <= 1) continue;
                ApplyAlbedo(material, tex, gltf.IsTextureYFlipped(i));
                bound = true;
                break;
            }
        }

        if (bound)
        {
            // With a map, keep tint close to white so fabric colors aren't crushed.
            if (baseColor.r > 0.85f && baseColor.g > 0.85f && baseColor.b > 0.85f)
            {
                if (material.HasProperty(BaseColorId))
                    material.SetColor(BaseColorId, Color.white);
                material.color = Color.white;
            }
        }
        else
        {
            Debug.LogWarning(
                $"[FurnitureUnlitMaterialGenerator] No albedo for '{material.name}' " +
                $"(textures={gltf?.TextureCount ?? 0}).");
        }

        material.SetOverrideTag(RenderTypeTag, OpaqueRenderType);
        material.renderQueue = (int)RenderQueue.Geometry;

        if (gltfMaterial != null && gltfMaterial.doubleSided)
            material.SetFloat("_Cull", 0f);

        return material;
    }

    bool TryBindTextureManual(TextureInfoBase textureInfo, Material material, IGltfReadable gltf)
    {
        if (textureInfo == null || gltf == null || textureInfo.index < 0)
            return false;

        var texture = gltf.GetTexture(textureInfo.index);
        if (texture == null)
            texture = gltf.GetImage(textureInfo.index);
        if (texture == null || texture.width <= 1)
            return false;

        ApplyAlbedo(material, texture, gltf.IsTextureYFlipped(textureInfo.index));
        return true;
    }

    static void ApplyAlbedo(Material material, UnityEngine.Texture texture, bool flipY)
    {
        if (material.HasProperty(BaseMapId))
            material.SetTexture(BaseMapId, texture);
        if (material.HasProperty(MainTexId))
            material.SetTexture(MainTexId, texture);
        material.mainTexture = texture;

        // glTF often stores textures flipped vs Unity — fix without a custom UV channel prop.
        if (material.HasProperty(BaseMapStId))
        {
            material.SetVector(
                BaseMapStId,
                flipY ? new Vector4(1f, -1f, 0f, 1f) : new Vector4(1f, 1f, 0f, 0f));
        }
    }

    Shader ResolveShader()
    {
        if (furnitureShader != null && furnitureShader.name != "Hidden/InternalErrorShader")
            return furnitureShader;

        var refMat = Resources.Load<Material>(ShaderRefResource);
        if (refMat != null && refMat.shader != null && refMat.shader.name != "Hidden/InternalErrorShader")
            furnitureShader = refMat.shader;

        if (furnitureShader == null)
            furnitureShader = FindShader(ShaderName, Logger);

        return furnitureShader;
    }
}
#endif
