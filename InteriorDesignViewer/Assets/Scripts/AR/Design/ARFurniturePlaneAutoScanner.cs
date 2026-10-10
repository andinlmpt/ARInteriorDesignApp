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
            var size = new Vector3(
                Mathf.Max(MinFootprintSide, plane.size.x),
                Mathf.Max(height, type == "chair" ? 0.9f : height),
                Mathf.Max(MinFootprintSide, plane.size.y));
            center.y = floorY;

            if (ARFurniturePlaneAutoScannerOverlapsHelper.Overlaps(center, size, existing, pending, plane.transform.eulerAngles.y))
                continue;

            counter += 1;
            results.Add(new FurnitureAutoSuggestion
            {
                id = $"plane-{plane.trackableId}-{counter}",
                type = type,
                center = center,
                size = size,
                yaw = plane.transform.eulerAngles.y,
                confidence = Mathf.Clamp(0.52f + area * 0.08f, 0.55f, 0.82f),
                source = "plane",
            });
        }

        return results;
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
