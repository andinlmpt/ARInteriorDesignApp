using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Cleans up a room outline tapped corner by corner (floor-plan points, metres):
///   • <see cref="SpreadClosingGap"/> — walking round the room, ARCore drifts a little. Tapping
///     corner 1 again shows how far: the gap is spread over every corner along the walk instead of
///     all landing in the last wall.
///   • <see cref="Square"/> — walls within a few degrees of the room's main directions are turned
///     onto them, so near-square corners come out square. Walls at a real angle stay as they are.
/// Only Vector2/Mathf, so it runs in the off-device checks.
/// </summary>
public static class RoomOutlineCleanup
{
    /// <summary>A closing gap larger than this (m) is a rough tap near corner 1, not drift: left alone.</summary>
    public const float MaxClosingGap = 0.2f;
    /// <summary>A wall within this many degrees of the room's main directions is turned onto them.</summary>
    public const float SquareWithinDegrees = 5f;
    /// <summary>Squaring that would move any corner further than this (m) is not done.</summary>
    public const float MaxSquareMove = 0.2f;
    /// <summary>Two neighbouring walls closer than this (degrees) to parallel keep their corner as it is.</summary>
    const float MinCornerAngle = 20f;

    /// <summary>
    /// Moves corners 1..n-1 so the walk ends exactly on corner 0. <paramref name="closingPoint"/> is
    /// where corner 1 was tapped again. Each corner takes the share of the gap that matches how far
    /// along the walk it is. Returns the shift of each corner (all zero when nothing was done).
    /// </summary>
    public static Vector2[] SpreadClosingGap(IList<Vector2> corners, Vector2 closingPoint, float maxGap = MaxClosingGap)
    {
        var n = corners.Count;
        var shifts = new Vector2[n];
        if (n < 3) return shifts;
        var gap = closingPoint - corners[0];
        var gapLength = gap.magnitude;
        if (gapLength < 1e-4f || gapLength > maxGap) return shifts;

        var along = new float[n];
        for (var i = 1; i < n; i++)
            along[i] = along[i - 1] + Vector2.Distance(corners[i - 1], corners[i]);
        var total = along[n - 1] + Vector2.Distance(corners[n - 1], closingPoint);
        if (total < 1e-3f) return shifts;

        for (var i = 1; i < n; i++)
        {
            shifts[i] = -gap * (along[i] / total);
            corners[i] += shifts[i];
        }

        return shifts;
    }

    /// <summary>
    /// Turns walls within <paramref name="withinDegrees"/> of the room's main directions onto them
    /// and puts each corner where its two walls now meet. A wall keeps its middle point, so the room
    /// stays where it was. Nothing changes when no wall is close to square or a corner would move
    /// more than <paramref name="maxMove"/>. Returns the shift of each corner.
    /// </summary>
    public static Vector2[] Square(IList<Vector2> corners, float withinDegrees = SquareWithinDegrees, float maxMove = MaxSquareMove)
    {
        var n = corners.Count;
        var shifts = new Vector2[n];
        if (n < 3) return shifts;

        var main = MainDirection(corners, withinDegrees);
        // Wall i runs from corner i to corner i+1: a point on it and its direction after squaring.
        var points = new Vector2[n];
        var directions = new Vector2[n];
        var turned = 0;
        for (var i = 0; i < n; i++)
        {
            var a = corners[i];
            var b = corners[(i + 1) % n];
            var d = b - a;
            points[i] = (a + b) * 0.5f;
            if (d.sqrMagnitude < 1e-6f)
            {
                directions[i] = Vector2.zero;
                continue;
            }

            var angle = Mathf.Atan2(d.y, d.x) * Mathf.Rad2Deg;
            var off = Mathf.DeltaAngle(main, angle);
            var nearest = Mathf.Round(off / 90f) * 90f;
            if (Mathf.Abs(off - nearest) <= withinDegrees)
            {
                var snapped = (main + nearest) * Mathf.Deg2Rad;
                directions[i] = new Vector2(Mathf.Cos(snapped), Mathf.Sin(snapped));
                if (Mathf.Abs(off - nearest) > 0.01f) turned++;
            }
            else
            {
                directions[i] = d.normalized;
            }
        }

        if (turned == 0) return shifts;

        var result = new Vector2[n];
        for (var i = 0; i < n; i++)
        {
            // Corner i is where wall i-1 (coming in) meets wall i (going out).
            var prev = (i + n - 1) % n;
            result[i] = corners[i];
            if (directions[prev] == Vector2.zero || directions[i] == Vector2.zero) continue;
            var sin = Mathf.Abs(Cross(directions[prev], directions[i]));
            if (sin < Mathf.Sin(MinCornerAngle * Mathf.Deg2Rad)) continue;
            if (!TryMeet(points[prev], directions[prev], points[i], directions[i], out var meet)) continue;
            if (Vector2.Distance(meet, corners[i]) > maxMove) return new Vector2[n];
            result[i] = meet;
        }

        for (var i = 0; i < n; i++)
        {
            shifts[i] = result[i] - corners[i];
            corners[i] = result[i];
        }

        return shifts;
    }

    /// <summary>
    /// The room's main wall direction (degrees, 0–90): wall directions folded onto a quarter turn,
    /// averaged with longer walls counting more. A second pass leaves out walls more than
    /// <paramref name="withinDegrees"/> off the first guess, so a real angled wall doesn't tilt it.
    /// </summary>
    public static float MainDirection(IList<Vector2> corners, float withinDegrees = SquareWithinDegrees)
    {
        var first = FoldedAverage(corners, float.NaN, 0f);
        return FoldedAverage(corners, first, withinDegrees);
    }

    static float FoldedAverage(IList<Vector2> corners, float around, float withinDegrees)
    {
        // Folding by 90° = multiplying the angle by 4 before averaging, then dividing back.
        var sum = Vector2.zero;
        var n = corners.Count;
        for (var i = 0; i < n; i++)
        {
            var d = corners[(i + 1) % n] - corners[i];
            var length = d.magnitude;
            if (length < 1e-3f) continue;
            var angle = Mathf.Atan2(d.y, d.x) * Mathf.Rad2Deg;
            if (!float.IsNaN(around))
            {
                var off = Mathf.DeltaAngle(around, angle);
                if (Mathf.Abs(off - Mathf.Round(off / 90f) * 90f) > withinDegrees) continue;
            }

            var a4 = angle * Mathf.Deg2Rad * 4f;
            sum += new Vector2(Mathf.Cos(a4), Mathf.Sin(a4)) * length;
        }

        if (sum.sqrMagnitude < 1e-8f) return float.IsNaN(around) ? 0f : around;
        var main = Mathf.Atan2(sum.y, sum.x) * Mathf.Rad2Deg / 4f;
        return main < 0f ? main + 90f : main;
    }

    static float Cross(Vector2 a, Vector2 b) => a.x * b.y - a.y * b.x;

    static bool TryMeet(Vector2 p, Vector2 d, Vector2 q, Vector2 e, out Vector2 meet)
    {
        meet = default;
        var denominator = Cross(d, e);
        if (Mathf.Abs(denominator) < 1e-6f) return false;
        var t = Cross(q - p, e) / denominator;
        meet = p + d * t;
        return true;
    }
}
