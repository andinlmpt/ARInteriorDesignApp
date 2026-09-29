using UnityEngine;

/// <summary>
/// Renders a rounded-rectangle outline flat on the floor around the furniture
/// when it is selected or manipulated. Turns red when placement is unsafe.
/// </summary>
public class ARDragOutline : MonoBehaviour
{
    private LineRenderer lineRenderer;
    private Material lineMaterial;
    private bool isVisible = false;
    private Vector3[] localPoints;
    private Color currentColor = Color.white;

    static readonly Color SafeColor = Color.white;
    static readonly Color DangerColor = new Color(0.92f, 0.18f, 0.2f, 1f);

    [Header("Outline Configuration")]
    [SerializeField] private float lineWidth = 0.028f;
    [SerializeField] private float cornerRadius = 0.08f;
    [SerializeField] private float floorYOffset = 0.003f;
    [SerializeField] private Color lineColor = Color.white;
    [SerializeField] private float padding = 0.04f;

    void Awake()
    {
        currentColor = lineColor;
        GameObject child = new GameObject("DragOutline_Renderer");
        child.transform.SetParent(transform, false);
        child.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);

        lineRenderer = child.AddComponent<LineRenderer>();
        lineRenderer.useWorldSpace = true;
        lineRenderer.loop = true;
        lineRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        lineRenderer.receiveShadows = false;
        lineRenderer.allowOcclusionWhenDynamic = false;
        lineRenderer.alignment = LineAlignment.TransformZ;

        var shader = Shader.Find("Universal Render Pipeline/Unlit") ??
                     Shader.Find("Unlit/Color") ??
                     Shader.Find("Sprites/Default");
        lineMaterial = new Material(shader);
        ApplyColor(currentColor);

        lineRenderer.material = lineMaterial;
        lineRenderer.widthMultiplier = 1f;
        lineRenderer.startWidth = lineWidth;
        lineRenderer.endWidth = lineWidth;

        lineRenderer.enabled = false;
    }

    public void SetupOutline(Bounds localBounds)
    {
        float width = localBounds.size.x + padding * 2f;
        float depth = localBounds.size.z + padding * 2f;
        Vector3 center = localBounds.center;
        float localY = localBounds.min.y + floorYOffset;

        int pointsPerCorner = 8;
        float radius = Mathf.Min(cornerRadius, Mathf.Min(width, depth) * 0.4f);

        int totalPoints = pointsPerCorner * 4;
        localPoints = new Vector3[totalPoints];

        float hw = width * 0.5f;
        float hd = depth * 0.5f;

        Vector2[] cornerCenters = new Vector2[]
        {
            new Vector2(hw - radius, hd - radius),
            new Vector2(-hw + radius, hd - radius),
            new Vector2(-hw + radius, -hd + radius),
            new Vector2(hw - radius, -hd + radius)
        };

        float[] startAngles = new float[] { 0f, 90f, 180f, 270f };

        int index = 0;
        for (int i = 0; i < 4; i++)
        {
            Vector2 c = cornerCenters[i];
            float startAngle = startAngles[i] * Mathf.Deg2Rad;
            for (int j = 0; j < pointsPerCorner; j++)
            {
                float angle = startAngle + (j / (float)(pointsPerCorner - 1)) * (Mathf.PI * 0.5f);
                float x = c.x + radius * Mathf.Cos(angle);
                float z = c.y + radius * Mathf.Sin(angle);
                localPoints[index++] = new Vector3(center.x + x, localY, center.z + z);
            }
        }

        if (lineRenderer != null)
        {
            lineRenderer.positionCount = totalPoints;
        }
        UpdateWorldPositions();
    }

    public void SetVisible(bool visible)
    {
        isVisible = visible;
        if (lineRenderer != null)
        {
            lineRenderer.enabled = visible;
            if (visible)
            {
                UpdateWorldPositions();
            }
        }
    }

    /// <summary>White when safe, red when overlapping furniture or colliding with walls.</summary>
    public void SetPlacementSafe(bool safe)
    {
        ApplyColor(safe ? SafeColor : DangerColor);
    }

    public void SetLineColor(Color color)
    {
        ApplyColor(color);
    }

    void ApplyColor(Color color)
    {
        currentColor = color;
        if (lineMaterial != null)
        {
            if (lineMaterial.HasProperty("_BaseColor"))
                lineMaterial.SetColor("_BaseColor", color);
            lineMaterial.color = color;
        }

        if (lineRenderer != null)
        {
            lineRenderer.startColor = color;
            lineRenderer.endColor = color;
        }
    }

    void Update()
    {
        if (isVisible)
        {
            UpdateWorldPositions();
        }
    }

    private void UpdateWorldPositions()
    {
        if (lineRenderer == null || localPoints == null)
            return;

        Vector3[] worldPoints = new Vector3[localPoints.Length];
        for (int i = 0; i < localPoints.Length; i++)
        {
            worldPoints[i] = transform.TransformPoint(localPoints[i]);
        }
        lineRenderer.SetPositions(worldPoints);
    }

    void OnDestroy()
    {
        if (lineMaterial != null)
        {
            Destroy(lineMaterial);
        }
    }
}
