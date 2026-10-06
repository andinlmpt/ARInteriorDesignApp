using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Derives room width / depth / height and display labels from a confirmed scan.
/// Metres throughout. Width = X span, Depth = Z span (length), Height = wall height.
/// </summary>
public static class RoomMeasurementUtil
{
    public struct RoomDimensions
    {
        public float width;
        public float depth;
        public float height;
        public float floorAreaSqm;
        public float wallHeight;
        public string dimensionLabel;
        public Vector3 boundsMin;
        public Vector3 boundsMax;
        public bool hasBounds;
    }

    public static RoomDimensions Compute(
        RoomGeometrySnapshot room,
        IReadOnlyList<Vector3> floorPolygon,
        float wallHeight,
        float horizontalAreaSqm)
    {
        var result = new RoomDimensions
        {
            wallHeight = wallHeight > 0.01f ? wallHeight : 2.4f,
            height = wallHeight > 0.01f ? wallHeight : 2.4f,
        };

        if (room != null && room.hasBounds)
        {
            result.boundsMin = room.bounds.min;
            result.boundsMax = room.bounds.max;
            result.hasBounds = true;
            result.width = Mathf.Max(0.01f, room.bounds.size.x);
            result.depth = Mathf.Max(0.01f, room.bounds.size.z);
            if (result.height < 0.01f)
                result.height = Mathf.Max(0.01f, room.bounds.size.y);
        }

        var polygonArea = ComputePolygonAreaSqm(floorPolygon);
        if (polygonArea > 0.01f)
            result.floorAreaSqm = polygonArea;
        else if (horizontalAreaSqm > 0.01f)
            result.floorAreaSqm = horizontalAreaSqm;
        else if (result.hasBounds)
            result.floorAreaSqm = result.width * result.depth;

        if (floorPolygon != null && floorPolygon.Count >= 3)
        {
            ComputePolygonExtents(floorPolygon, out var polyWidth, out var polyDepth);
            if (polyWidth > 0.01f) result.width = polyWidth;
            if (polyDepth > 0.01f) result.depth = polyDepth;
        }

        result.dimensionLabel = FormatDimensionLabel(result.width, result.depth, result.height);
        return result;
    }

    public static float ComputePolygonAreaSqm(IReadOnlyList<Vector3> polygon)
    {
        if (polygon == null || polygon.Count < 3) return 0f;

        var area = 0f;
        for (var i = 0; i < polygon.Count; i++)
        {
            var a = polygon[i];
            var b = polygon[(i + 1) % polygon.Count];
            area += a.x * b.z - b.x * a.z;
        }

        return Mathf.Abs(area) * 0.5f;
    }

    public static void ComputePolygonExtents(IReadOnlyList<Vector3> polygon, out float width, out float depth)
    {
        width = 0f;
        depth = 0f;
        if (polygon == null || polygon.Count == 0) return;

        // Measure along the longest wall: world axes rarely line up with the room,
        // and a world-axis box overstates the size of a rotated room.
        var angle = 0f;
        var longest = 0f;
        for (var i = 0; i < polygon.Count; i++)
        {
            var a = polygon[i];
            var b = polygon[(i + 1) % polygon.Count];
            var dx = b.x - a.x;
            var dz = b.z - a.z;
            var len = dx * dx + dz * dz;
            if (len > longest)
            {
                longest = len;
                angle = Mathf.Atan2(dz, dx);
            }
        }

        var cos = Mathf.Cos(-angle);
        var sin = Mathf.Sin(-angle);
        var minX = float.MaxValue;
        var maxX = float.MinValue;
        var minZ = float.MaxValue;
        var maxZ = float.MinValue;

        for (var i = 0; i < polygon.Count; i++)
        {
            var x = polygon[i].x * cos - polygon[i].z * sin;
            var z = polygon[i].x * sin + polygon[i].z * cos;
            minX = Mathf.Min(minX, x);
            maxX = Mathf.Max(maxX, x);
            minZ = Mathf.Min(minZ, z);
            maxZ = Mathf.Max(maxZ, z);
        }

        width = Mathf.Max(0f, maxX - minX);
        depth = Mathf.Max(0f, maxZ - minZ);
    }

    public static string FormatDimensionLabel(float widthMetres, float depthMetres, float heightMetres)
    {
        if (widthMetres <= 0.01f || depthMetres <= 0.01f || heightMetres <= 0.01f)
            return string.Empty;

        return $"L {FormatMetres(depthMetres)} × W {FormatMetres(widthMetres)} × H {FormatMetres(heightMetres)}";
    }

    static string FormatMetres(float metres) =>
        metres >= 1f ? $"{metres:0.0}m" : $"{Mathf.RoundToInt(metres * 100f)}cm";
}
