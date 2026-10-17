using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

/// <summary>
/// What the room scan has found, drawn in the room: doors and windows as framed see-through
/// panels on the walls, furniture as see-through boxes, each with a small name label, plus faint
/// "maybe" boxes (tap to add) and the first edge of a door/window being added by hand.
/// </summary>
public class ARDesignSpatialMappingVisualizer : MonoBehaviour
{
    [SerializeField] private Color doorColor = new(0.2f, 0.55f, 0.95f, 0.3f);
    [SerializeField] private Color windowColor = new(0.95f, 0.8f, 0.2f, 0.3f);
    [SerializeField] private Color obstacleColor = new(0.55f, 0.35f, 0.2f, 0.35f);
    [SerializeField] private Color suggestionColor = new(1f, 0.55f, 0.12f, 0.22f);
    [SerializeField] private Color edgeMarkerColor = new(1f, 1f, 1f, 0.95f);
    [SerializeField] private bool showLabels = true;

    /// <summary>Everything to draw. Lists may be null.</summary>
    public struct Contents
    {
        /// <summary>Floor outline; needed for <see cref="openings"/> (they are placed by wall index).</summary>
        public IReadOnlyList<Vector3> corners;
        public float wallHeight;
        public IReadOnlyList<RoomOpeningPayload> openings;
        /// <summary>Doors and windows found during the walk (placed in the room, no wall index yet).</summary>
        public IReadOnlyList<AutoOpeningResolver.LiveOpening> liveOpenings;
        public IReadOnlyList<RoomObstaclePayload> obstacles;
        /// <summary>Furniture found during the walk.</summary>
        public IReadOnlyList<FurnitureAutoSuggestion> furniture;
        /// <summary>Detections not yet added: drawn faint, labelled with a question mark.</summary>
        public IReadOnlyList<FurnitureAutoSuggestion> maybe;
        public Vector3? pendingEdge;
    }

    Transform root;
    readonly List<GameObject> spawned = new();
    readonly Dictionary<Color, Material> fills = new();
    readonly Dictionary<Color, Material> lines = new();

    void Awake()
    {
        root = new GameObject("SpatialMappingVisuals").transform;
        root.SetParent(transform, false);
    }

    public void Rebuild(Contents c)
    {
        Clear();
        if (root == null) return;

        var floorY = c.corners != null && c.corners.Count > 0 ? RoomPolygonUtil.ComputeFloorY(c.corners) : 0f;
        if (c.pendingEdge.HasValue)
            SpawnEdgeMarker(c.pendingEdge.Value, c.wallHeight);

        if (c.openings != null && c.corners != null && c.corners.Count >= 3)
        {
            foreach (var opening in c.openings)
            {
                var i = opening.wallIndex;
                if (i < 0 || i >= c.corners.Count) continue;
                var wall = new AutoOpeningResolver.WallSegment(c.corners[i], c.corners[(i + 1) % c.corners.Count]);
                SpawnOpening(
                    opening.type,
                    wall.PointAt(opening.offsetAlongWall),
                    wall.PointAt(opening.offsetAlongWall + opening.width),
                    floorY,
                    opening.sillHeight,
                    opening.height);
            }
        }

        if (c.liveOpenings != null)
        {
            foreach (var opening in c.liveOpenings)
                SpawnOpening(opening.kind, opening.a, opening.b, opening.a.y, opening.sill, opening.top - opening.sill);
        }

        if (c.obstacles != null)
        {
            foreach (var o in c.obstacles)
            {
                if (o?.center == null || o.size == null) continue;
                SpawnBox(Label(o.type), new Vector3(o.center.x, o.center.y, o.center.z), new Vector3(o.size.x, o.size.y, o.size.z), o.yaw, obstacleColor);
            }
        }

        if (c.furniture != null)
        {
            foreach (var s in c.furniture)
                SpawnBox(Label(s.type), s.center, s.size, s.yaw, obstacleColor);
        }

        if (c.maybe != null)
        {
            foreach (var s in c.maybe)
                SpawnBox($"{Label(s.type)}?", s.center, s.size, s.yaw, suggestionColor);
        }
    }

    void SpawnOpening(string type, Vector3 a, Vector3 b, float floorY, float sill, float height)
    {
        var along = new Vector3(b.x - a.x, 0f, b.z - a.z);
        var width = along.magnitude;
        if (width < 0.05f || height < 0.05f) return;
        var dir = along / width;
        var isDoor = type == "door";
        var color = isDoor ? doorColor : windowColor;

        var bottomA = new Vector3(a.x, floorY + sill, a.z);
        var bottomB = new Vector3(b.x, floorY + sill, b.z);
        var up = Vector3.up * height;

        var panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
        panel.name = type;
        panel.transform.SetParent(root, false);
        panel.transform.position = (bottomA + bottomB) * 0.5f + up * 0.5f;
        panel.transform.rotation = Quaternion.LookRotation(dir, Vector3.up);
        panel.transform.localScale = new Vector3(0.04f, height, width);
        Destroy(panel.GetComponent<Collider>());
        SetMaterial(panel.GetComponent<MeshRenderer>(), Fill(color));
        spawned.Add(panel);

        // A solid frame reads as a door or window much better than the tint alone.
        var frameColor = new Color(color.r, color.g, color.b, 1f);
        SpawnLine(new[] { bottomA, bottomA + up, bottomB + up, bottomB }, frameColor, !isDoor);

        SpawnLabel(isDoor ? "Door" : "Window", (bottomA + bottomB) * 0.5f + up + Vector3.up * 0.12f);
    }

    void SpawnBox(string label, Vector3 center, Vector3 size, float yaw, Color color)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = label;
        go.transform.SetParent(root, false);
        go.transform.position = new Vector3(center.x, center.y + size.y * 0.5f, center.z);
        go.transform.rotation = Quaternion.Euler(0f, yaw, 0f);
        go.transform.localScale = size;
        Destroy(go.GetComponent<Collider>());
        SetMaterial(go.GetComponent<MeshRenderer>(), Fill(color));
        spawned.Add(go);

        SpawnLabel(label, new Vector3(center.x, center.y + size.y + 0.15f, center.z));
    }

    void SpawnEdgeMarker(Vector3 point, float wallHeight)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        go.name = "opening_edge";
        go.transform.SetParent(root, false);
        var height = Mathf.Min(2.1f, wallHeight);
        go.transform.position = point + Vector3.up * (height * 0.5f);
        go.transform.localScale = new Vector3(0.04f, height * 0.5f, 0.04f);
        Destroy(go.GetComponent<Collider>());
        SetMaterial(go.GetComponent<MeshRenderer>(), Fill(edgeMarkerColor));
        spawned.Add(go);
    }

    void SpawnLine(Vector3[] points, Color color, bool loop)
    {
        var go = new GameObject("frame");
        go.transform.SetParent(root, false);
        var line = go.AddComponent<LineRenderer>();
        line.sharedMaterial = Line(color);
        line.useWorldSpace = true;
        line.loop = loop;
        line.startWidth = line.endWidth = 0.02f;
        line.numCornerVertices = 2;
        line.numCapVertices = 2;
        line.alignment = LineAlignment.View;
        line.shadowCastingMode = ShadowCastingMode.Off;
        line.receiveShadows = false;
        line.positionCount = points.Length;
        line.SetPositions(points);
        spawned.Add(go);
    }

    /// <summary>Small name tag that always faces the camera.</summary>
    void SpawnLabel(string text, Vector3 position)
    {
        if (!showLabels || string.IsNullOrEmpty(text)) return;

        var go = new GameObject($"Label_{text}");
        go.transform.SetParent(root, false);
        go.transform.position = position;
        var canvas = go.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        canvas.sortingOrder = 30;
        var rt = (RectTransform)go.transform;
        rt.sizeDelta = new Vector2(Mathf.Max(120f, 26f * text.Length + 40f), 48f);
        go.transform.localScale = Vector3.one * 0.0035f;

        var bg = ARDesignUiUtil.CreateRoundedImage(go.transform, new Color(1f, 1f, 1f, 0.92f), 24);
        bg.raycastTarget = false;
        var bgRt = bg.rectTransform;
        bgRt.anchorMin = Vector2.zero;
        bgRt.anchorMax = Vector2.one;
        bgRt.offsetMin = Vector2.zero;
        bgRt.offsetMax = Vector2.zero;

        var label = ARDesignUiUtil.CreateText(bg.transform, text, 30, FontStyle.Bold, TextAnchor.MiddleCenter);
        label.color = new Color(0.12f, 0.12f, 0.14f, 1f);
        label.raycastTarget = false;
        var labelRt = label.rectTransform;
        labelRt.anchorMin = Vector2.zero;
        labelRt.anchorMax = Vector2.one;
        labelRt.offsetMin = new Vector2(8f, 4f);
        labelRt.offsetMax = new Vector2(-8f, -4f);

        go.AddComponent<ARDesignBillboard>();
        spawned.Add(go);
    }

    static string Label(string type)
    {
        if (string.IsNullOrEmpty(type)) return "Furniture";
        return char.ToUpperInvariant(type[0]) + type.Substring(1);
    }

    static void SetMaterial(MeshRenderer renderer, Material material)
    {
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;
    }

    Material Fill(Color color)
    {
        if (!fills.TryGetValue(color, out var material) || material == null)
            fills[color] = material = ARLineMaterialUtil.CreateTransparent(color);
        return material;
    }

    Material Line(Color color)
    {
        if (!lines.TryGetValue(color, out var material) || material == null)
            lines[color] = material = ARLineMaterialUtil.Create(color);
        return material;
    }

    void Clear()
    {
        for (var i = 0; i < spawned.Count; i++)
        {
            if (spawned[i] != null)
                Destroy(spawned[i]);
        }

        spawned.Clear();
    }

    void OnDestroy()
    {
        Clear();
        foreach (var material in fills.Values)
        {
            if (material != null) Destroy(material);
        }

        foreach (var material in lines.Values)
        {
            if (material != null) Destroy(material);
        }
    }
}
