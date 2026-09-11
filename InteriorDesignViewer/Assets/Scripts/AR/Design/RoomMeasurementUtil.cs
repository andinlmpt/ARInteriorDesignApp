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

        var minX = polygon[0].x;
        var maxX = polygon[0].x;
        var minZ = polygon[0].z;
        var maxZ = polygon[0].z;

        for (var i = 1; i < polygon.Count; i++)
        {
            minX = Mathf.Min(minX, polygon[i].x);
            maxX = Mathf.Max(maxX, polygon[i].x);
            minZ = Mathf.Min(minZ, polygon[i].z);
            maxZ = Mathf.Max(maxZ, polygon[i].z);
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
