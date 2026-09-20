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

    Shader furnitureShader;
    Material defaultMaterial;

    protected override Material GenerateDefaultMaterial(bool pointsSupport = false)
    {
        if (defaultMaterial != null)
            return defaultMaterial;

        var shader = ResolveShader();
        if (shader == null)
            return null;

        defaultMaterial = new Material(shader)
        {
            name = DefaultMaterialName,
            color = Color.gray,
        };
        if (defaultMaterial.HasProperty(BaseColorId))
            defaultMaterial.SetColor(BaseColorId, Color.gray);
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

        if (baseColorTexture != null)
        {
            TrySetTexture(baseColorTexture, material, gltf, BaseMapId);
            if (material.HasProperty(MainTexId) && material.GetTexture(BaseMapId) != null)
                material.SetTexture(MainTexId, material.GetTexture(BaseMapId));
            if (material.GetTexture(BaseMapId) != null)
                material.mainTexture = material.GetTexture(BaseMapId);
        }

        material.SetOverrideTag(RenderTypeTag, OpaqueRenderType);
        material.renderQueue = (int)RenderQueue.Geometry;

        if (gltfMaterial != null && gltfMaterial.doubleSided)
            material.SetFloat("_Cull", 0f);

        return material;
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
