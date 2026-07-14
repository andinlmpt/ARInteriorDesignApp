using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Procedural vertical gradient effect for Unity UI Graphic components.
/// Works with URP and requires no custom shader.
/// </summary>
[AddComponentMenu("UI/Effects/Gradient")]
public class UIGradient : BaseMeshEffect
{
    [SerializeField] private Color colorTop = Color.white;
    [SerializeField] private Color colorBottom = Color.black;

    public Color ColorTop
    {
        get => colorTop;
        set { colorTop = value; graphic.SetVerticesDirty(); }
    }

    public Color ColorBottom
    {
        get => colorBottom;
        set { colorBottom = value; graphic.SetVerticesDirty(); }
    }

    public override void ModifyMesh(VertexHelper vh)
    {
        if (!IsActive())
            return;

        int count = vh.currentVertCount;
        if (count == 0)
            return;

        UIVertex vertex = new UIVertex();
        float minY = float.MaxValue;
        float maxY = float.MinValue;

        // Find min/max Y coordinates to calculate height span
        for (int i = 0; i < count; i++)
        {
            vh.PopulateUIVertex(ref vertex, i);
            float y = vertex.position.y;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        float height = maxY - minY;
        if (Mathf.Approximately(height, 0f))
            return;

        // Apply vertical interpolation to vertex colors
        for (int i = 0; i < count; i++)
        {
            vh.PopulateUIVertex(ref vertex, i);
            float normY = (vertex.position.y - minY) / height;
            
            // Multiply standard color with the gradient color to respect overall alpha/tint
            Color lerpedColor = Color.Lerp(colorBottom, colorTop, normY);
            vertex.color = lerpedColor * vertex.color;
            
            vh.SetUIVertex(vertex, i);
        }
    }
}
