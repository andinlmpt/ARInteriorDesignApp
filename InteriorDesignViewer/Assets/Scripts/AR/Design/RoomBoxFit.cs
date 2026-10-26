using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Fits a furniture box found by the scan (detector or flat AR surface) to the room's floor plan
/// (points in metres: x, and z as y):
///   • <see cref="NearestWallYaw"/> / <see cref="SquareTo"/> — turned square to the nearest wall.
///     Boxes used to face the camera, or the AR surface's own axes, so they sat at odd angles.
///   • <see cref="KeepInside"/> — cut back where they run out through a wall (or, past half their
///     size, moved in). The back of a box is a guess (the camera only sees the front) and an AR
///     surface spreads past the bed it is on, so boxes ran through the wall (phone test, 2026-10-24).
/// Only Vector2/Mathf, so it runs in the off-device checks.
/// </summary>
public static class RoomBoxFit
{
    /// <summary>A box keeps at least this share of its size on each side when it's cut back at a wall.</summary>
    public const float MinKeptShare = 0.5f;
    /// <summary>Gap left between a box and the wall it was cut back at (m).</summary>
    public const float WallGap = 0.02f;

    static readonly Vector2[] Samples =
    {
        new(-1f, -1f), new(1f, -1f), new(1f, 1f), new(-1f, 1f),
        new(0f, -1f), new(1f, 0f), new(0f, 1f), new(-1f, 0f),
    };

    /// <summary>
    /// Yaw (degrees, Unity's turn about Y, as FurnitureAutoSuggestion.yaw) that lays a box's width
    /// along the wall nearest <paramref name="point"/>. NaN when there is no wall yet.
    /// </summary>
    public static float NearestWallYaw(IReadOnlyList<Vector2> outline, bool closed, Vector2 point)
    {
        if (outline == null || outline.Count < 2) return float.NaN;
        var edges = closed ? outline.Count : outline.Count - 1;
        var best = float.MaxValue;
        var yaw = float.NaN;
        for (var i = 0; i < edges; i++)
        {
            var a = outline[i];
            var b = outline[(i + 1) % outline.Count];
            var d = b - a;
            if (d.sqrMagnitude < 1e-6f) continue;
            var distance = Vector2.Distance(point, ClosestOnSegment(a, b, point));
            if (distance >= best) continue;
            best = distance;
            yaw = Mathf.Atan2(-d.y, d.x) * Mathf.Rad2Deg;
        }

        return float.IsNaN(yaw) ? yaw : Mathf.Repeat(yaw, 360f);
    }

    /// <summary>The yaw closest to <paramref name="yaw"/> that is square to <paramref name="wallYaw"/> (0–360).</summary>
    public static float SquareTo(float yaw, float wallYaw)
    {
        var quarterTurns = Mathf.Round(Mathf.DeltaAngle(wallYaw, yaw) / 90f);
        return Mathf.Repeat(wallYaw + quarterTurns * 90f, 360f);
    }

    /// <summary>The smallest box turned by <paramref name="yaw"/> around <paramref name="points"/>: centre and (width, depth).</summary>
    public static void BoundsAt(IReadOnlyList<Vector2> points, float yaw, out Vector2 center, out Vector2 size)
    {
        Axes(yaw, out var ax, out var az);
        float minX = float.MaxValue, maxX = float.MinValue, minZ = float.MaxValue, maxZ = float.MinValue;
        foreach (var p in points)
        {
            var x = Vector2.Dot(p, ax);
            var z = Vector2.Dot(p, az);
            minX = Mathf.Min(minX, x);
            maxX = Mathf.Max(maxX, x);
            minZ = Mathf.Min(minZ, z);
            maxZ = Mathf.Max(maxZ, z);
        }

        center = ax * ((minX + maxX) * 0.5f) + az * ((minZ + maxZ) * 0.5f);
        size = new Vector2(maxX - minX, maxZ - minZ);
    }

    /// <summary>
    /// Cuts the box back where it runs out of the closed <paramref name="outline"/> (down to
    /// <see cref="MinKeptShare"/> of its size), then moves it in if it still does.
    /// </summary>
    public static void KeepInside(IReadOnlyList<Vector2> outline, ref Vector2 center, ref Vector2 size, float yaw)
    {
        if (outline == null || outline.Count < 3) return;
        Axes(yaw, out var ax, out var az);
        var original = size;
        // Corners are corrected by the wall nearest them, so a few rounds settle a box in a room corner.
        for (var round = 0; round < 4; round++)
        {
            float plusX = 0f, minusX = 0f, plusZ = 0f, minusZ = 0f;
            var outside = false;
            foreach (var s in Samples)
            {
                var p = center + ax * (s.x * size.x * 0.5f) + az * (s.y * size.y * 0.5f);
                if (Contains(outline, p)) continue;
                outside = true;
                var v = ClosestOnOutline(outline, p) - p;
                v += v.normalized * WallGap;
                var vx = Vector2.Dot(v, ax);
                var vz = Vector2.Dot(v, az);
                if (s.x > 0f && vx < 0f) plusX = Mathf.Max(plusX, -vx);
                if (s.x < 0f && vx > 0f) minusX = Mathf.Max(minusX, vx);
                if (s.y > 0f && vz < 0f) plusZ = Mathf.Max(plusZ, -vz);
                if (s.y < 0f && vz > 0f) minusZ = Mathf.Max(minusZ, vz);
            }

            if (!outside) return;
            center += ax * Pull(ref size.x, original.x, plusX, minusX);
            center += az * Pull(ref size.y, original.y, plusZ, minusZ);
        }
    }

    /// <summary>Squares the box to the nearest wall and, once the outline is closed, keeps it inside.</summary>
    public static void Fit(IReadOnlyList<Vector2> outline, bool closed, ref Vector2 center, ref Vector2 size, ref float yaw)
    {
        var wallYaw = NearestWallYaw(outline, closed, center);
        if (!float.IsNaN(wallYaw)) yaw = SquareTo(yaw, wallYaw);
        if (closed) KeepInside(outline, ref center, ref size, yaw);
    }

    /// <summary>
    /// One axis of <see cref="KeepInside"/>: cuts each side back by how far it pokes out (as far as
    /// the size allows), and returns how far the centre moves along the axis.
    /// </summary>
    static float Pull(ref float width, float original, float plus, float minus)
    {
        var poking = plus + minus;
        if (poking <= 0f) return 0f;
        var cut = Mathf.Min(poking, Mathf.Max(0f, width - original * MinKeptShare));
        var cutPlus = plus * cut / poking;
        var cutMinus = minus * cut / poking;
        width -= cutPlus + cutMinus;
        // Cutting one side moves the centre away from it; what still pokes out is moved in.
        return (cutMinus - cutPlus) * 0.5f + (minus - cutMinus) - (plus - cutPlus);
    }

    /// <summary>A box's width and depth directions on the floor plan for a Unity yaw.</summary>
    static void Axes(float yaw, out Vector2 ax, out Vector2 az)
    {
        var r = yaw * Mathf.Deg2Rad;
        ax = new Vector2(Mathf.Cos(r), -Mathf.Sin(r));
        az = new Vector2(Mathf.Sin(r), Mathf.Cos(r));
    }

    public static bool Contains(IReadOnlyList<Vector2> outline, Vector2 p)
    {
        var inside = false;
        for (int i = 0, j = outline.Count - 1; i < outline.Count; j = i++)
        {
            var a = outline[i];
            var b = outline[j];
            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)
                inside = !inside;
        }

        return inside;
    }

    static Vector2 ClosestOnOutline(IReadOnlyList<Vector2> outline, Vector2 p)
    {
        var best = outline[0];
        var bestDistance = float.MaxValue;
        for (var i = 0; i < outline.Count; i++)
        {
            var q = ClosestOnSegment(outline[i], outline[(i + 1) % outline.Count], p);
            var d = (q - p).sqrMagnitude;
            if (d >= bestDistance) continue;
            bestDistance = d;
            best = q;
        }

        return best;
    }

    static Vector2 ClosestOnSegment(Vector2 a, Vector2 b, Vector2 p)
    {
        var ab = b - a;
        var t = ab.sqrMagnitude > 1e-9f ? Mathf.Clamp01(Vector2.Dot(p - a, ab) / ab.sqrMagnitude) : 0f;
        return a + ab * t;
    }
}
