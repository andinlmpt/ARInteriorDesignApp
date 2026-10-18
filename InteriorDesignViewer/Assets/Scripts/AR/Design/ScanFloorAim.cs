using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Where the scan's aim lands on the floor, also past the patch ARCore has recognized as floor
/// (it stops short of the walls and almost never reaches into a corner). The aim follows the flat
/// floor, stops at the bottom of a wall it would pass behind, and snaps to a room corner close by.
/// Floor-plan math only (x = world x, y = world z), so it is checked without a phone.
/// </summary>
public static class ScanFloorAim
{
    public enum Kind
    {
        None,
        Floor,
        /// <summary>Stopped at the bottom of a wall (the floor point was behind it).</summary>
        WallBase,
        Corner,
    }

    public struct Settings
    {
        /// <summary>The aim must point at least this far down (unit ray y); flatter aims land too far to trust.</summary>
        public float minDownward;
        /// <summary>Farthest floor point used, along the floor from the camera (m).</summary>
        public float maxDistance;
        /// <summary>How far past the part ARCore saw a wall still stops the aim (wall pieces end short of corners).</summary>
        public float wallReach;
        /// <summary>A floor point further than this behind a wall means the aim is on the wall itself: no floor.</summary>
        public float maxBehindWall;
        /// <summary>A corner this close to the aim pulls it in.</summary>
        public float cornerSnap;

        public static Settings Default => new()
        {
            minDownward = 0.17f,
            maxDistance = 6f,
            wallReach = 0.75f,
            maxBehindWall = 1.5f,
            cornerSnap = 0.3f,
        };
    }

    /// <summary>
    /// The floor point under the aim ray (floor at <paramref name="floorY"/>), stopped by
    /// <paramref name="walls"/> and snapped to <paramref name="corners"/>. <see cref="Kind.None"/>
    /// when the aim isn't on the floor.
    /// </summary>
    public static Kind Resolve(Vector3 origin, Vector3 direction, float floorY,
        IReadOnlyList<AutoWallGeometry.Wall> walls, IReadOnlyList<Vector2> corners, Settings settings,
        out Vector3 point)
    {
        point = default;
        if (direction.sqrMagnitude < 1e-8f) return Kind.None;
        direction.Normalize();
        if (direction.y > -settings.minDownward) return Kind.None;

        var t = (floorY - origin.y) / direction.y;
        if (t <= 0f) return Kind.None;

        var hit = origin + direction * t;
        var from = new Vector2(origin.x, origin.z);
        var to = new Vector2(hit.x, hit.z);
        if (Vector2.Distance(from, to) > settings.maxDistance) return Kind.None;

        var kind = Kind.Floor;
        if (walls != null && TryFirstWallCrossing(from, to, walls, settings.wallReach, out var crossing))
        {
            if (Vector2.Distance(crossing, to) > settings.maxBehindWall) return Kind.None;

            // Just in front of the wall.
            var back = from - crossing;
            to = back.sqrMagnitude > 1e-6f ? crossing + back.normalized * 0.01f : crossing;
            kind = Kind.WallBase;
        }

        if (corners != null)
        {
            var best = settings.cornerSnap;
            for (var i = 0; i < corners.Count; i++)
            {
                var d = Vector2.Distance(corners[i], to);
                if (d > best) continue;
                best = d;
                to = corners[i];
                kind = Kind.Corner;
            }
        }

        point = new Vector3(to.x, floorY, to.y);
        return kind;
    }

    /// <summary>The first wall line the camera-to-floor-point segment passes through (on or near its seen part).</summary>
    static bool TryFirstWallCrossing(Vector2 from, Vector2 to, IReadOnlyList<AutoWallGeometry.Wall> walls,
        float reach, out Vector2 crossing)
    {
        crossing = default;
        var found = false;
        var bestU = float.MaxValue;
        var segment = to - from;
        for (var i = 0; i < walls.Count; i++)
        {
            var wall = walls[i];
            var denominator = Cross(segment, wall.dir);
            if (Mathf.Abs(denominator) < 1e-6f) continue;

            var diff = wall.origin - from;
            var u = Cross(diff, wall.dir) / denominator;
            if (u <= 0f || u >= 1f || u >= bestU) continue;

            var along = Cross(diff, segment) / denominator;
            if (along < wall.tMin - reach || along > wall.tMax + reach) continue;

            bestU = u;
            crossing = from + segment * u;
            found = true;
        }

        return found;
    }

    static float Cross(Vector2 a, Vector2 b) => a.x * b.y - a.y * b.x;
}
