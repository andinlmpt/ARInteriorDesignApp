using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// Shared URP-safe materials and LineRenderer setup for AR measurement visuals.
/// </summary>
public static class MeasurementVisualUtility
{
    static Material cachedLineMaterial;
    static Material cachedPointMaterial;

    public static void ConfigureLine(
        LineRenderer lineRenderer,
        Vector3 start,
        Vector3 end,
        Color color,
        float width,
        float floorInset,
        Material materialOverride)
    {
        if (lineRenderer == null)
            return;

        var lift = Vector3.up * floorInset;
        var pointA = start + lift;
        var pointB = end + lift;

        lineRenderer.useWorldSpace = true;
        lineRenderer.loop = false;
        lineRenderer.positionCount = 2;
        lineRenderer.SetPosition(0, pointA);
        lineRenderer.SetPosition(1, pointB);
        lineRenderer.widthMultiplier = 1f;
        lineRenderer.startWidth = width;
        lineRenderer.endWidth = width;
        lineRenderer.startColor = color;
        lineRenderer.endColor = color;
        lineRenderer.numCapVertices = 8;
        lineRenderer.numCornerVertices = 4;
        lineRenderer.alignment = LineAlignment.View;
        lineRenderer.textureMode = LineTextureMode.Stretch;
        lineRenderer.shadowCastingMode = ShadowCastingMode.Off;
        lineRenderer.receiveShadows = false;
        lineRenderer.allowOcclusionWhenDynamic = false;
        lineRenderer.material = ResolveLineMaterial(color, materialOverride);
        lineRenderer.enabled = true;
    }

    public static void ConfigurePoint(
        Renderer renderer,
        Color color,
        Material materialOverride)
    {
        if (renderer == null)
            return;

        renderer.sharedMaterial = ResolvePointMaterial(color, materialOverride);
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;
    }

    static Material ResolveLineMaterial(Color color, Material materialOverride)
    {
        if (materialOverride != null)
            return materialOverride;

        if (cachedLineMaterial == null)
            cachedLineMaterial = CreateUnlitMaterial(color);

        ApplyColor(cachedLineMaterial, color);
        return cachedLineMaterial;
    }

    static Material ResolvePointMaterial(Color color, Material materialOverride)
    {
        if (materialOverride != null)
            return materialOverride;

        if (cachedPointMaterial == null)
            cachedPointMaterial = CreateUnlitMaterial(color);

        ApplyColor(cachedPointMaterial, color);
        return cachedPointMaterial;
    }

    static Material CreateUnlitMaterial(Color color)
    {
        var shader =
            Shader.Find("Universal Render Pipeline/Unlit") ??
            Shader.Find("Unlit/Color") ??
            Shader.Find("Sprites/Default");

        var material = new Material(shader);
        ApplyColor(material, color);
        return material;
    }

    static void ApplyColor(Material material, Color color)
    {
        if (material == null)
            return;

        if (material.HasProperty("_BaseColor"))
            material.SetColor("_BaseColor", color);

        material.color = color;
    }
}
