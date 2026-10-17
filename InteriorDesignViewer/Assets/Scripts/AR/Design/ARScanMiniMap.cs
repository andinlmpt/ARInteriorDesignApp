using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Top-down floor plan in the scan HUD: walls found so far, the outline, a missing corner, doors
/// and windows, furniture, and where the user stands and faces. Each refresh the HUD calls
/// <see cref="Begin"/>, adds shapes in floor-plan metres (x = world x, y = world z) and calls
/// <see cref="End"/>; the map fits them in with <see cref="ScanMapFrame"/>. Sizes (line widths,
/// dot radii) are in map units, so they stay the same however big the room is.
/// </summary>
// Graphic doesn't add a CanvasRenderer by itself (Image and Text each ask for one); without it
// the map silently draws nothing.
[RequireComponent(typeof(CanvasRenderer))]
public class ARScanMiniMap : MaskableGraphic
{
    struct Line
    {
        public Vector2 a;
        public Vector2 b;
        public float width;
        public Color32 color;
    }

    struct Dot
    {
        public Vector2 p;
        public float radius;
        public Color32 color;
    }

    struct Fill
    {
        public int start;
        public int count;
        public Color32 color;
    }

    struct Label
    {
        public Vector2 p;
        public Vector2 push;
        public string text;
    }

    const int DotSegments = 14;

    readonly List<Line> lines = new();
    readonly List<Dot> dots = new();
    readonly List<Fill> fills = new();
    readonly List<Vector2> fillPoints = new();
    readonly List<Vector2> fitPoints = new();
    readonly List<Label> pendingLabels = new();
    readonly List<Text> labelPool = new();
    readonly List<Vector3> triangulateScratch = new();

    bool hasMarker;
    Vector2 markerPoint;
    Vector2 markerForward;
    Color32 markerColor;

    public readonly ScanMapFrame Frame = new();

    /// <summary>The map always shows at least this many metres across.</summary>
    public float minSpan = 3f;
    /// <summary>Map units kept clear around the drawing.</summary>
    public float padding = 22f;
    public Color labelColor = new(0.10f, 0.10f, 0.12f, 1f);
    public int labelFontSize = 20;

    float MapSize
    {
        get
        {
            var r = rectTransform.rect;
            return Mathf.Max(1f, Mathf.Min(r.width, r.height));
        }
    }

    public void Begin()
    {
        lines.Clear();
        dots.Clear();
        fills.Clear();
        fillPoints.Clear();
        fitPoints.Clear();
        pendingLabels.Clear();
        hasMarker = false;
    }

    public void AddLine(Vector2 a, Vector2 b, float width, Color color, bool fit = true)
    {
        lines.Add(new Line { a = a, b = b, width = width, color = color });
        if (!fit) return;
        fitPoints.Add(a);
        fitPoints.Add(b);
    }

    public void AddDot(Vector2 p, float radius, Color color, bool fit = true)
    {
        dots.Add(new Dot { p = p, radius = radius, color = color });
        if (fit) fitPoints.Add(p);
    }

    public void AddPolygon(IReadOnlyList<Vector2> points, Color color, bool fit = true)
    {
        if (points == null || points.Count < 3) return;
        fills.Add(new Fill { start = fillPoints.Count, count = points.Count, color = color });
        fillPoints.AddRange(points);
        if (fit) fitPoints.AddRange(points);
    }

    /// <summary>A footprint, turned <paramref name="yawDegrees"/> about the vertical like the furniture itself.</summary>
    public void AddBox(Vector2 center, Vector2 size, float yawDegrees, Color color, bool fit = true)
    {
        var r = yawDegrees * Mathf.Deg2Rad;
        // Unity turns +x toward −z for a positive yaw (seen from above).
        var axisX = new Vector2(Mathf.Cos(r), -Mathf.Sin(r)) * (size.x * 0.5f);
        var axisZ = new Vector2(Mathf.Sin(r), Mathf.Cos(r)) * (size.y * 0.5f);
        AddPolygon(new[]
        {
            center - axisX - axisZ,
            center + axisX - axisZ,
            center + axisX + axisZ,
            center - axisX + axisZ,
        }, color, fit);
    }

    /// <summary>The user: a dot with a wedge pointing the way the camera faces.</summary>
    public void AddMarker(Vector2 p, Vector2 forward, Color color, bool fit = true)
    {
        hasMarker = true;
        markerPoint = p;
        markerForward = forward.sqrMagnitude > 1e-6f ? forward.normalized : Vector2.up;
        markerColor = color;
        if (fit) fitPoints.Add(p);
    }

    /// <summary>Text at a floor-plan point, pushed <paramref name="push"/> map units sideways on the map.</summary>
    public void AddLabel(Vector2 p, Vector2 push, string text)
    {
        pendingLabels.Add(new Label { p = p, push = push, text = text });
    }

    /// <param name="ease">How far (0–1) the framing moves toward fitting the new shapes; 1 jumps.</param>
    public void End(float ease)
    {
        Frame.Fit(fitPoints, MapSize, padding, minSpan, ease);
        PlaceLabels();
        SetVerticesDirty();
    }

    void PlaceLabels()
    {
        // Labels are anchored to the middle of the map, which is where Project puts (0, 0).
        for (var i = 0; i < pendingLabels.Count; i++)
        {
            if (i >= labelPool.Count) labelPool.Add(CreateLabel());
            var label = labelPool[i];
            var item = pendingLabels[i];
            label.gameObject.SetActive(true);
            label.text = item.text;
            label.rectTransform.anchoredPosition = Frame.Project(item.p) + item.push;
        }

        for (var i = pendingLabels.Count; i < labelPool.Count; i++)
            labelPool[i].gameObject.SetActive(false);
    }

    Text CreateLabel()
    {
        var text = ARDesignUiUtil.CreateText(transform, string.Empty, labelFontSize, FontStyle.Bold, TextAnchor.MiddleCenter);
        text.color = labelColor;
        text.raycastTarget = false;
        text.horizontalOverflow = HorizontalWrapMode.Overflow;
        var rt = text.rectTransform;
        rt.anchorMin = new Vector2(0.5f, 0.5f);
        rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(120f, 28f);
        return text;
    }

    protected override void OnPopulateMesh(VertexHelper vh)
    {
        vh.Clear();
        var origin = rectTransform.rect.center;

        foreach (var fill in fills) DrawFill(vh, origin, fill);
        foreach (var line in lines) DrawLine(vh, origin, line);
        foreach (var dot in dots) DrawDot(vh, origin + Frame.Project(dot.p), dot.radius, dot.color);
        if (hasMarker) DrawMarker(vh, origin);
    }

    void DrawFill(VertexHelper vh, Vector2 origin, Fill fill)
    {
        triangulateScratch.Clear();
        for (var i = 0; i < fill.count; i++)
        {
            var m = origin + Frame.Project(fillPoints[fill.start + i]);
            triangulateScratch.Add(new Vector3(m.x, 0f, m.y));
        }

        var triangles = RoomPolygonUtil.TriangulateCcw(triangulateScratch);
        var first = vh.currentVertCount;
        foreach (var p in triangulateScratch)
            vh.AddVert(new Vector3(p.x, p.z, 0f), fill.color, Vector4.zero);
        for (var i = 0; i + 2 < triangles.Count; i += 3)
            vh.AddTriangle(first + triangles[i], first + triangles[i + 1], first + triangles[i + 2]);
    }

    void DrawLine(VertexHelper vh, Vector2 origin, Line line)
    {
        var a = origin + Frame.Project(line.a);
        var b = origin + Frame.Project(line.b);
        var d = b - a;
        if (d.sqrMagnitude < 1e-4f)
        {
            DrawDot(vh, a, line.width * 0.5f, line.color);
            return;
        }

        var n = new Vector2(-d.y, d.x).normalized * (line.width * 0.5f);
        var first = vh.currentVertCount;
        vh.AddVert(a + n, line.color, Vector4.zero);
        vh.AddVert(b + n, line.color, Vector4.zero);
        vh.AddVert(b - n, line.color, Vector4.zero);
        vh.AddVert(a - n, line.color, Vector4.zero);
        vh.AddTriangle(first, first + 1, first + 2);
        vh.AddTriangle(first, first + 2, first + 3);

        // Round ends so walls meet cleanly at corners.
        DrawDot(vh, a, line.width * 0.5f, line.color);
        DrawDot(vh, b, line.width * 0.5f, line.color);
    }

    static void DrawDot(VertexHelper vh, Vector2 center, float radius, Color32 color)
    {
        var first = vh.currentVertCount;
        vh.AddVert(center, color, Vector4.zero);
        for (var i = 0; i < DotSegments; i++)
        {
            var a = i * Mathf.PI * 2f / DotSegments;
            vh.AddVert(center + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * radius, color, Vector4.zero);
        }

        for (var i = 0; i < DotSegments; i++)
            vh.AddTriangle(first, first + 1 + i, first + 1 + (i + 1) % DotSegments);
    }

    void DrawMarker(VertexHelper vh, Vector2 origin)
    {
        var p = origin + Frame.Project(markerPoint);
        var f = Frame.ProjectDirection(markerForward).normalized;
        var side = new Vector2(-f.y, f.x);
        const float reach = 20f;
        const float halfWidth = 11f;

        // A soft wedge for the view direction, then the dot on top.
        var wedge = markerColor;
        wedge.a = (byte)(wedge.a * 0.35f);
        var first = vh.currentVertCount;
        vh.AddVert(p, wedge, Vector4.zero);
        vh.AddVert(p + f * reach + side * halfWidth, wedge, Vector4.zero);
        vh.AddVert(p + f * reach - side * halfWidth, wedge, Vector4.zero);
        vh.AddTriangle(first, first + 1, first + 2);

        DrawDot(vh, p, 9f, new Color32(255, 255, 255, 255));
        DrawDot(vh, p, 6.5f, markerColor);
    }
}
