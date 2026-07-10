using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// Shared URP-safe materials and LineRenderer setup for AR measurement visuals.
/// </summary>
public static class MeasurementVisualUtility
{
    static Material cachedLineMaterial;
    static Material cachedPointMaterial;

    /// <summary>
    /// Configures a horizontal/diagonal floor LineRenderer with a floor inset lift.
    /// </summary>
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

        ApplyLineRenderer(lineRenderer, pointA, pointB, color, width, materialOverride);
    }

    /// <summary>
    /// Configures a perfectly vertical LineRenderer (no floor inset — height lines stay true-vertical).
    /// </summary>
    public static void ConfigureVerticalLine(
        LineRenderer lineRenderer,
        Vector3 basePos,
        Vector3 topPos,
        Color color,
        float width,
        Material materialOverride)
    {
        if (lineRenderer == null)
            return;

        ApplyLineRenderer(lineRenderer, basePos, topPos, color, width, materialOverride);
    }

    static void ApplyLineRenderer(
        LineRenderer lineRenderer,
        Vector3 pointA,
        Vector3 pointB,
        Color color,
        float width,
        Material materialOverride)
    {
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
