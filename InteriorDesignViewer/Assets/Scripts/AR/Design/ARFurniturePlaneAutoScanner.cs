using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Suggests existing furniture from horizontal AR planes inside the room outline
/// (table tops, sofa seats, etc.). Works on Android without an ML model.
/// </summary>
public static class ARFurniturePlaneAutoScanner
{
    const float MinAreaSqm = 0.12f;
    const float MaxAreaSqm = 5f;
    const float MaxHeightAboveFloor = 1.35f;
    /// <summary>Lower surfaces are floor patches (ARCore often splits the floor), not furniture.</summary>
    const float MinHeightAboveFloor = 0.25f;
    const float MinFootprintSide = 0.35f;

    public static List<FurnitureAutoSuggestion> Scan(
        ARPlaneManager planeManager,
        IReadOnlyList<Vector3> corners,
        float floorY,
        IReadOnlyList<RoomObstaclePayload> existing,
        IReadOnlyList<FurnitureAutoSuggestion> pending)
    {
        var results = new List<FurnitureAutoSuggestion>();
        if (planeManager == null || corners == null || corners.Count < 3)
            return results;

        var outline = new List<Vector2>(corners.Count);
        foreach (var c in corners) outline.Add(new Vector2(c.x, c.z));
        var candidates = new List<(ARPlane plane, float area)>();

        foreach (var plane in planeManager.trackables)
        {
            if (plane == null || plane.trackingState == TrackingState.None || plane.subsumedBy != null)
                continue;
            if (plane.alignment != PlaneAlignment.HorizontalUp)
                continue;

            var center = plane.center;
            if (!RoomPolygonUtil.PointInsidePolygonXZ(center, corners))
                continue;

            var area = Mathf.Max(0.01f, plane.size.x * plane.size.y);
            candidates.Add((plane, area));
        }

        var counter = 0;
        foreach (var (plane, area) in candidates)
        {
            if (area < MinAreaSqm || area > MaxAreaSqm)
                continue;

            var center = plane.center;
            var height = center.y - floorY;
            if (height < MinHeightAboveFloor || height > MaxHeightAboveFloor)
                continue;

            var type = Classify(height, area);
            // Measured along the nearest wall and cut back at the walls: the surface's own axes
            // are ARCore's choice, and a surface spreads past the bed it's on, through the wall.
            var yaw = plane.transform.eulerAngles.y;
            var footprint = new Vector2(plane.size.x, plane.size.y);
            var middle = new Vector2(center.x, center.z);
            var wallYaw = RoomBoxFit.NearestWallYaw(outline, true, middle);
            if (!float.IsNaN(wallYaw) && TryBoundary(plane, out var boundary))
            {
                yaw = wallYaw;
                RoomBoxFit.BoundsAt(boundary, yaw, out middle, out footprint);
            }
            footprint = Vector2.Max(footprint, new Vector2(MinFootprintSide, MinFootprintSide));
            RoomBoxFit.KeepInside(outline, ref middle, ref footprint, yaw);

            var size = new Vector3(footprint.x, Mathf.Max(height, type == "chair" ? 0.9f : height), footprint.y);
            center = new Vector3(middle.x, floorY, middle.y);

            if (ARFurniturePlaneAutoScannerOverlapsHelper.Overlaps(center, size, existing, pending, yaw))
                continue;

            counter += 1;
            results.Add(new FurnitureAutoSuggestion
            {
                id = $"plane-{plane.trackableId}-{counter}",
                type = type,
                center = center,
                size = size,
                yaw = yaw,
                confidence = Mathf.Clamp(0.52f + area * 0.08f, 0.55f, 0.82f),
                source = "plane",
            });
        }

        return results;
    }

    /// <summary>The surface's outline on the floor plan (x, z).</summary>
    static bool TryBoundary(ARPlane plane, out List<Vector2> points)
    {
        points = null;
        var boundary = plane.boundary;
        if (!boundary.IsCreated || boundary.Length < 3) return false;
        points = new List<Vector2>(boundary.Length);
        var t = plane.transform;
        for (var i = 0; i < boundary.Length; i++)
        {
            var w = t.TransformPoint(new Vector3(boundary[i].x, 0f, boundary[i].y));
            points.Add(new Vector2(w.x, w.z));
        }

        return true;
    }

    /// <summary>Seat-height surfaces are beds/sofas/chairs; table-height ones tables/desks.</summary>
    static string Classify(float heightAboveFloor, float area)
    {
        if (heightAboveFloor < 0.62f)
        {
            if (area >= 1.6f) return "bed";
            if (area >= 0.6f) return "sofa";
            return "chair";
        }

        if (heightAboveFloor < 0.95f)
            return area >= 0.6f ? "table" : "desk";

        return "other";
    }

}
