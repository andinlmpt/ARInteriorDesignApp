using UnityEngine;

/// <summary>
/// Unlit materials for runtime LineRenderers. <c>Shader.Find</c> only sees shaders that are
/// already loaded in a player build, so the first scene of a cold start can miss URP Unlit
/// and draw nothing; the Resources material keeps it bundled and loaded.
/// </summary>
public static class ARLineMaterialUtil
{
    const string ReferenceMaterialResource = "AR/ARLineUnlit";

    static Material referenceMaterial;

    public static Material Create(Color color)
    {
        var shader = ResolveShader();
        var material = shader != null ? new Material(shader) : new Material(LoadReference());
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        material.color = color;
        return material;
    }

    /// <summary>
    /// See-through tint for AR boxes. Sprites/Default is always included in builds and alpha-blends,
    /// whereas the opaque URP Unlit material ignores alpha and hides the camera feed.
    /// </summary>
    public static Material CreateTransparent(Color color)
    {
        var shader = Shader.Find("Sprites/Default");
        if (!IsUsable(shader)) return Create(color);
        var material = new Material(shader) { color = color };
        material.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
        return material;
    }

    /// <summary>True when the material will actually render (shader present and supported).</summary>
    public static bool IsUsable(Material material)
    {
        return material != null && IsUsable(material.shader);
    }

    static Shader ResolveShader()
    {
        var reference = LoadReference();
        if (reference != null && IsUsable(reference.shader)) return reference.shader;

        var shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (IsUsable(shader)) return shader;
        shader = Shader.Find("Unlit/Color");
        if (IsUsable(shader)) return shader;
        shader = Shader.Find("Sprites/Default");
        return IsUsable(shader) ? shader : null;
    }

    static Material LoadReference()
    {
        if (referenceMaterial == null)
            referenceMaterial = Resources.Load<Material>(ReferenceMaterialResource);
        return referenceMaterial;
    }

    static bool IsUsable(Shader shader)
    {
        return shader != null && shader.isSupported && !shader.name.Contains("InternalError");
    }
}
