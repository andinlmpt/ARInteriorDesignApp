using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Floor-outline geometry on the XZ plane: walls, perimeter, volume, validation
/// and an ear-clipping triangulation that handles concave (L-shaped) rooms.
/// Metres throughout.
/// </summary>
public static class RoomPolygonUtil
{
    public const int MinCorners = 3;
    const float Epsilon = 1e-6f;

    public struct Wall
    {
        public int index;
        public Vector3 start;
        public Vector3 end;
        public float length;
    }

    public static List<Wall> BuildWalls(IReadOnlyList<Vector3> polygon)
    {
        var walls = new List<Wall>();
        if (polygon == null || polygon.Count < 2) return walls;

        var edgeCount = polygon.Count >= MinCorners ? polygon.Count : polygon.Count - 1;
        for (var i = 0; i < edgeCount; i++)
        {
            var a = polygon[i];
            var b = polygon[(i + 1) % polygon.Count];
            walls.Add(new Wall { index = i, start = a, end = b, length = FlatDistance(a, b) });
        }

        return walls;
    }

    public static float ComputePerimeter(IReadOnlyList<Vector3> polygon)
    {
        if (polygon == null || polygon.Count < MinCorners) return 0f;

        var sum = 0f;
        for (var i = 0; i < polygon.Count; i++)
            sum += FlatDistance(polygon[i], polygon[(i + 1) % polygon.Count]);
        return sum;
    }

    /// <summary>True when the XZ point lies inside a closed polygon (ray casting).</summary>
    public static bool PointInsidePolygonXZ(Vector3 world, IReadOnlyList<Vector3> polygon)
    {
        if (polygon == null || polygon.Count < 3) return false;
        var x = world.x;
        var z = world.z;
        var inside = false;
        for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++)
        {
            var zi = polygon[i].z;
            var zj = polygon[j].z;
            if ((zi > z) != (zj > z)
                && x < (polygon[j].x - polygon[i].x) * (z - zi) / (zj - zi + 1e-8f) + polygon[i].x)
                inside = !inside;
        }

        return inside;
    }

    public static float ComputeFloorY(IReadOnlyList<Vector3> polygon)
    {
        if (polygon == null || polygon.Count == 0) return 0f;

        var y = float.PositiveInfinity;
        for (var i = 0; i < polygon.Count; i++)
            y = Mathf.Min(y, polygon[i].y);
        return y;
    }

    /// <summary>Signed shoelace area in XZ. Positive means counter-clockwise viewed from above.</summary>
    public static float SignedArea(IReadOnlyList<Vector3> polygon)
    {
        if (polygon == null || polygon.Count < MinCorners) return 0f;

        var area = 0f;
        for (var i = 0; i < polygon.Count; i++)
        {
            var a = polygon[i];
            var b = polygon[(i + 1) % polygon.Count];
            area += a.x * b.z - b.x * a.z;
        }

        return area * 0.5f;
    }

    /// <summary>True when any two non-adjacent walls cross or touch.</summary>
    public static bool IsSelfIntersecting(IReadOnlyList<Vector3> polygon)
    {
        if (polygon == null || polygon.Count < 4) return false;

        var n = polygon.Count;
        for (var i = 0; i < n; i++)
        {
            var a1 = polygon[i];
            var a2 = polygon[(i + 1) % n];
            for (var j = i + 1; j < n; j++)
            {
                if (j == i || (j + 1) % n == i || (i + 1) % n == j) continue;
                if (SegmentsIntersect(a1, a2, polygon[j], polygon[(j + 1) % n]))
                    return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Validates a closed floor outline. Returns error codes:
    /// "tooFewCorners", "selfIntersecting", "zeroArea".
    /// </summary>
    public static List<string> Validate(IReadOnlyList<Vector3> polygon)
    {
        var errors = new List<string>();
        if (polygon == null || polygon.Count < MinCorners)
        {
            errors.Add("tooFewCorners");
            return errors;
        }

        if (IsSelfIntersecting(polygon))
            errors.Add("selfIntersecting");
        if (Mathf.Abs(SignedArea(polygon)) < 0.05f)
            errors.Add("zeroArea");
        return errors;
    }

    /// <summary>
    /// Ear-clipping triangulation in XZ. Triangles are returned counter-clockwise
    /// (viewed from above) regardless of the input winding. Falls back to a fan
    /// when the outline is degenerate.
    /// </summary>
    public static List<int> TriangulateCcw(IReadOnlyList<Vector3> polygon)
    {
        var triangles = new List<int>();
        if (polygon == null || polygon.Count < MinCorners) return triangles;

        var n = polygon.Count;
        var indices = new List<int>(n);
        if (SignedArea(polygon) >= 0f)
            for (var i = 0; i < n; i++) indices.Add(i);
        else
            for (var i = n - 1; i >= 0; i--) indices.Add(i);

        var guard = 0;
        while (indices.Count > 3 && guard++ < n * n)
        {
            var clipped = false;
            for (var i = 0; i < indices.Count; i++)
            {
                var prev = indices[(i - 1 + indices.Count) % indices.Count];
                var curr = indices[i];
                var next = indices[(i + 1) % indices.Count];
                if (!IsEar(polygon, indices, prev, curr, next)) continue;

                triangles.Add(prev);
                triangles.Add(curr);
                triangles.Add(next);
                indices.RemoveAt(i);
                clipped = true;
                break;
            }

            if (!clipped) break;
        }

        if (indices.Count == 3)
        {
            triangles.Add(indices[0]);
            triangles.Add(indices[1]);
            triangles.Add(indices[2]);
            return triangles;
        }

        triangles.Clear();
        var ccw = SignedArea(polygon) >= 0f;
        for (var i = 1; i < n - 1; i++)
        {
            triangles.Add(0);
            triangles.Add(ccw ? i : i + 1);
            triangles.Add(ccw ? i + 1 : i);
        }

        return triangles;
    }

    static bool IsEar(IReadOnlyList<Vector3> polygon, List<int> indices, int prev, int curr, int next)
    {
        var a = polygon[prev];
        var b = polygon[curr];
        var c = polygon[next];
        if (Cross(a, b, c) <= Epsilon) return false;

        for (var k = 0; k < indices.Count; k++)
        {
            var idx = indices[k];
            if (idx == prev || idx == curr || idx == next) continue;
            if (PointInTriangle(polygon[idx], a, b, c)) return false;
        }

        return true;
    }

    static float Cross(Vector3 a, Vector3 b, Vector3 c) =>
        (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

    static bool PointInTriangle(Vector3 p, Vector3 a, Vector3 b, Vector3 c)
    {
        var d1 = Cross(a, b, p);
        var d2 = Cross(b, c, p);
        var d3 = Cross(c, a, p);
        var hasNeg = d1 < -Epsilon || d2 < -Epsilon || d3 < -Epsilon;
        var hasPos = d1 > Epsilon || d2 > Epsilon || d3 > Epsilon;
        return !(hasNeg && hasPos);
    }

    static bool SegmentsIntersect(Vector3 p1, Vector3 p2, Vector3 q1, Vector3 q2)
    {
        var d1 = Cross(q1, q2, p1);
        var d2 = Cross(q1, q2, p2);
        var d3 = Cross(p1, p2, q1);
        var d4 = Cross(p1, p2, q2);

        if (((d1 > Epsilon && d2 < -Epsilon) || (d1 < -Epsilon && d2 > Epsilon))
            && ((d3 > Epsilon && d4 < -Epsilon) || (d3 < -Epsilon && d4 > Epsilon)))
            return true;

        return (Mathf.Abs(d1) <= Epsilon && OnSegment(q1, q2, p1))
               || (Mathf.Abs(d2) <= Epsilon && OnSegment(q1, q2, p2))
               || (Mathf.Abs(d3) <= Epsilon && OnSegment(p1, p2, q1))
               || (Mathf.Abs(d4) <= Epsilon && OnSegment(p1, p2, q2));
    }

    static bool OnSegment(Vector3 a, Vector3 b, Vector3 p) =>
        p.x >= Mathf.Min(a.x, b.x) - Epsilon && p.x <= Mathf.Max(a.x, b.x) + Epsilon
        && p.z >= Mathf.Min(a.z, b.z) - Epsilon && p.z <= Mathf.Max(a.z, b.z) + Epsilon;

    static float FlatDistance(Vector3 a, Vector3 b)
    {
        var dx = b.x - a.x;
        var dz = b.z - a.z;
        return Mathf.Sqrt(dx * dx + dz * dz);
    }
}
