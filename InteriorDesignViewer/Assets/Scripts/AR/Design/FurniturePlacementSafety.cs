using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Placement safety checks for furniture: furniture-furniture footprint overlap
/// and wall proximity / out-of-room footprint corners.
/// </summary>
public static class FurniturePlacementSafety
{
    public const float MinFurnitureClearanceMetres = 0.02f;
    public const float MinWallClearanceMetres = 0.15f;

    public struct Result
    {
        public bool isSafe;
        public bool hasFurnitureCollision;
        public bool hasWallCollision;
        public bool isTooCloseToWall;
        public float nearestFurnitureDistance;
        public float nearestWallDistance;
        public string reason;

        public static Result Safe()
        {
            return new Result
            {
                isSafe = true,
                nearestFurnitureDistance = float.PositiveInfinity,
                nearestWallDistance = float.PositiveInfinity,
                reason = string.Empty,
            };
        }
    }

    public static Result Evaluate(
        PlacedFurniture target,
        IReadOnlyList<PlacedFurniture> others,
        RoomScanController room)
    {
        if (target == null) return Result.Safe();
        return EvaluateAtPivot(target, target.transform.position, others, room);
    }

    /// <summary>
    /// Evaluates safety as if <paramref name="target"/> were moved to <paramref name="worldPivot"/>
    /// (XZ only; Y is ignored for footprint checks).
    /// </summary>
    public static Result EvaluateAtPivot(
        PlacedFurniture target,
        Vector3 worldPivot,
        IReadOnlyList<PlacedFurniture> others,
        RoomScanController room)
    {
        var result = Result.Safe();
        if (target == null) return result;

        var targetRect = GetFootprintRectXZAt(target, worldPivot);

        var nearestFurniture = float.PositiveInfinity;
        if (others != null)
        {
            for (var i = 0; i < others.Count; i++)
            {
                var other = others[i];
                if (other == null || other == target) continue;
                if (other.InstanceId == target.InstanceId) continue;
                if (!other.gameObject.activeInHierarchy) continue;

                var otherRect = GetFootprintRectXZ(other);
                var separation = RectSeparationXZ(targetRect, otherRect);
                nearestFurniture = Mathf.Min(nearestFurniture, separation);

                if (RectsOverlapXZ(targetRect, otherRect, MinFurnitureClearanceMetres))
                    result.hasFurnitureCollision = true;
            }
        }

        result.nearestFurnitureDistance = nearestFurniture;

        var nearestWall = float.PositiveInfinity;
        var outside = false;
        var roomReady = room != null && room.IsConfirmed;
        if (roomReady)
        {
            foreach (var corner in GetWorldFootprintCornersAt(target, worldPivot))
            {
                if (!room.IsInsideRoom(corner))
                    outside = true;

                var edgeDist = room.DistanceToFloorBoundaryXZ(corner);
                if (edgeDist < nearestWall)
                    nearestWall = edgeDist;
            }
        }

        result.nearestWallDistance = nearestWall;
        result.hasWallCollision = outside;
        result.isTooCloseToWall = !outside
                                  && nearestWall < MinWallClearanceMetres
                                  && float.IsFinite(nearestWall);

        if (result.hasFurnitureCollision)
        {
            result.isSafe = false;
            result.reason = "Overlaps another furniture piece";
        }
        else if (result.hasWallCollision)
        {
            result.isSafe = false;
            result.reason = "Collides with the wall";
        }
        else if (result.isTooCloseToWall)
        {
            result.isSafe = false;
            result.reason = "Too close to the wall";
        }

        return result;
    }

    /// <summary>
    /// Pushes <paramref name="desiredPivot"/> away from overlapping furniture until clear,
    /// or returns the original pivot of the piece if a clear spot cannot be found nearby.
    /// </summary>
    public static Vector3 ResolveAwayFromFurnitureOverlaps(
        PlacedFurniture target,
        Vector3 desiredPivot,
        IReadOnlyList<PlacedFurniture> others,
        Vector3 fallbackPivot,
        int maxIterations = 14)
    {
        if (target == null) return desiredPivot;
        if (others == null || others.Count == 0) return desiredPivot;

        var resolved = desiredPivot;
        resolved.y = desiredPivot.y;

        for (var iter = 0; iter < maxIterations; iter++)
        {
            var result = EvaluateAtPivot(target, resolved, others, null);
            if (!result.hasFurnitureCollision)
                return resolved;

            var push = Vector3.zero;
            var myRect = GetFootprintRectXZAt(target, resolved);
            var myCenter = new Vector3(myRect.center.x, 0f, myRect.center.y);

            for (var i = 0; i < others.Count; i++)
            {
                var other = others[i];
                if (other == null || other == target) continue;
                if (other.InstanceId == target.InstanceId) continue;
                if (!other.gameObject.activeInHierarchy) continue;

                var otherRect = GetFootprintRectXZ(other);
                if (!RectsOverlapXZ(myRect, otherRect, MinFurnitureClearanceMetres))
                    continue;

                var otherCenter = new Vector3(otherRect.center.x, 0f, otherRect.center.y);
                var dir = myCenter - otherCenter;
                dir.y = 0f;
                if (dir.sqrMagnitude < 1e-8f)
                    dir = new Vector3(1f, 0f, 0f);
                else
                    dir.Normalize();

                var penetration = RectPenetrationDepthXZ(myRect, otherRect);
                push += dir * (penetration + MinFurnitureClearanceMetres + 0.02f);
            }

            if (push.sqrMagnitude < 1e-8f)
                break;

            resolved += push;
            resolved.y = desiredPivot.y;
        }

        var finalCheck = EvaluateAtPivot(target, resolved, others, null);
        if (finalCheck.hasFurnitureCollision)
            return fallbackPivot;

        return resolved;
    }

    public static Rect GetFootprintRectXZ(PlacedFurniture furniture)
    {
        return GetFootprintRectXZAt(furniture, furniture.transform.position);
    }

    public static Rect GetFootprintRectXZAt(PlacedFurniture furniture, Vector3 worldPivot)
    {
        var corners = GetWorldFootprintCornersAt(furniture, worldPivot);
        var minX = float.PositiveInfinity;
        var maxX = float.NegativeInfinity;
        var minZ = float.PositiveInfinity;
        var maxZ = float.NegativeInfinity;

        for (var i = 0; i < corners.Length; i++)
        {
            var c = corners[i];
            if (c.x < minX) minX = c.x;
            if (c.x > maxX) maxX = c.x;
            if (c.z < minZ) minZ = c.z;
            if (c.z > maxZ) maxZ = c.z;
        }

        return Rect.MinMaxRect(minX, minZ, maxX, maxZ);
    }

    public static Vector3[] GetWorldFootprintCorners(PlacedFurniture furniture)
    {
        return GetWorldFootprintCornersAt(furniture, furniture.transform.position);
    }

    public static Vector3[] GetWorldFootprintCornersAt(PlacedFurniture furniture, Vector3 worldPivot)
    {
        var local = GetLocalFootprintCorners(furniture);
        var delta = worldPivot - furniture.transform.position;
        delta.y = 0f;
        var world = new Vector3[local.Length];
        for (var i = 0; i < local.Length; i++)
        {
            var p = furniture.transform.TransformPoint(local[i]);
            world[i] = new Vector3(p.x + delta.x, p.y, p.z + delta.z);
        }
        return world;
    }

    static Vector3[] GetLocalFootprintCorners(PlacedFurniture furniture)
    {
        var b = furniture.LocalBounds;
        if (b.size.sqrMagnitude < 1e-6f)
        {
            var d = furniture.CurrentDimensions;
            var hx = d.x * 0.5f;
            var hz = d.z * 0.5f;
            return new[]
            {
                new Vector3(-hx, 0f, -hz),
                new Vector3(hx, 0f, -hz),
                new Vector3(hx, 0f, hz),
                new Vector3(-hx, 0f, hz),
            };
        }

        var min = b.min;
        var max = b.max;
        return new[]
        {
            new Vector3(min.x, min.y, min.z),
            new Vector3(max.x, min.y, min.z),
            new Vector3(max.x, min.y, max.z),
            new Vector3(min.x, min.y, max.z),
        };
    }

    static bool RectsOverlapXZ(Rect a, Rect b, float clearance)
    {
        // Expand each rect by half clearance so "almost touching" still warns.
        var pad = clearance * 0.5f;
        a.xMin -= pad;
        a.xMax += pad;
        a.yMin -= pad;
        a.yMax += pad;
        return a.Overlaps(b);
    }

    static float RectPenetrationDepthXZ(Rect a, Rect b)
    {
        var overlapX = Mathf.Min(a.xMax, b.xMax) - Mathf.Max(a.xMin, b.xMin);
        var overlapZ = Mathf.Min(a.yMax, b.yMax) - Mathf.Max(a.yMin, b.yMin);
        if (overlapX <= 0f || overlapZ <= 0f) return 0f;
        return Mathf.Min(overlapX, overlapZ);
    }

    static float RectSeparationXZ(Rect a, Rect b)
    {
        var dx = 0f;
        if (a.xMax < b.xMin) dx = b.xMin - a.xMax;
        else if (b.xMax < a.xMin) dx = a.xMin - b.xMax;

        var dz = 0f;
        if (a.yMax < b.yMin) dz = b.yMin - a.yMax;
        else if (b.yMax < a.yMin) dz = a.yMin - b.yMax;

        if (dx == 0f && dz == 0f) return 0f;
        if (dx == 0f) return dz;
        if (dz == 0f) return dx;
        return Mathf.Sqrt(dx * dx + dz * dz);
    }
}
