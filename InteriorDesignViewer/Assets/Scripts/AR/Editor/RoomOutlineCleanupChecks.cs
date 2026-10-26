#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>Device-independent checks for spreading the closing gap and squaring a hand-tapped room outline.</summary>
public static class RoomOutlineCleanupChecks
{
    public static void Run()
    {
        var room = new[] { new Vector2(0, 0), new Vector2(4, 0), new Vector2(4, 3), new Vector2(0, 3) };

        // Drift that grows along the walk: tapping corner 1 again shows it, spreading it undoes it.
        var drift = new Vector2(0.12f, 0.08f);
        var walked = new List<Vector2>();
        var along = 0f;
        for (var i = 0; i < 4; i++)
        {
            if (i > 0) along += Vector2.Distance(room[i - 1], room[i]);
            walked.Add(room[i] + drift * (along / 14f));
        }
        RoomOutlineCleanup.SpreadClosingGap(walked, room[0] + drift);
        for (var i = 0; i < 4; i++)
            Check(Vector2.Distance(walked[i], room[i]) < 0.01f, $"closing gap spread puts corner {i} back");

        // A rough tap near corner 1 (gap over the limit) changes nothing.
        var rough = new List<Vector2>(room);
        var roughShifts = RoomOutlineCleanup.SpreadClosingGap(rough, new Vector2(0.25f, 0.1f));
        Check(Same(rough, room) && AllZero(roughShifts), "rough closing tap leaves corners alone");

        // A turned rectangle with a few cm of error in each corner comes out square, barely moved.
        var turned = Turn(room, 30f, new Vector2(1.5f, -2f));
        var noisy = new List<Vector2>
        {
            turned[0] + new Vector2(0.03f, -0.02f),
            turned[1] + new Vector2(-0.02f, 0.03f),
            turned[2] + new Vector2(0.025f, 0.01f),
            turned[3] + new Vector2(-0.01f, -0.03f),
        };
        var before = new List<Vector2>(noisy);
        var shifts = RoomOutlineCleanup.Square(noisy);
        Check(!AllZero(shifts), "noisy rectangle gets squared");
        Check(AllRight(noisy, 0.3f), "squared rectangle has right angles");
        for (var i = 0; i < 4; i++)
            Check(Vector2.Distance(noisy[i], before[i]) < 0.06f, $"squaring moves corner {i} only a little");
        Check(Mathf.Abs(Area(noisy) - 12f) < 0.3f, "squared rectangle keeps its area");

        // An L-shaped room keeps its six corners, all square.
        var ell = new List<Vector2>
        {
            new(0, 0), new(5.02f, 0.03f), new(5f, 2.04f), new(2.97f, 2f), new(3.01f, 4f), new(-0.02f, 3.98f),
        };
        RoomOutlineCleanup.Square(ell);
        Check(ell.Count == 6 && AllRight(ell, 0.3f), "L-shaped room comes out square");

        // A real 45° wall across one corner stays at 45°; the rest are squared.
        var cut = new List<Vector2>
        {
            new(0, 0), new(4.03f, 0.02f), new(4f, 2f), new(3f, 3.02f), new(0.02f, 3f),
        };
        RoomOutlineCleanup.Square(cut);
        var cutWall = cut[3] - cut[2];
        var cutAngle = Mathf.Atan2(cutWall.y, cutWall.x) * Mathf.Rad2Deg;
        Check(Mathf.Abs(Mathf.DeltaAngle(cutAngle, 135f)) < 3f, "45-degree wall keeps its angle");
        Check(Mathf.Abs(Vector2.Angle(cut[1] - cut[0], cut[4] - cut[0]) - 90f) < 0.3f, "square corner next to it is squared");

        // A real angled wall doesn't tilt the others: only the near-square ones are touched.
        var angled = new List<Vector2> { new(0, 0), new(8, 0), new(8.6f, 0.2f), new(8.6f, 6f), new(0, 6) };
        var angledBefore = new List<Vector2>(angled);
        Check(AllZero(RoomOutlineCleanup.Square(angled)) && Same(angled, angledBefore), "angled wall doesn't tilt square walls");

        // An already square room is left exactly as it is.
        var square = new List<Vector2>(room);
        Check(AllZero(RoomOutlineCleanup.Square(square)) && Same(square, room), "square room unchanged");

        // A wall 12° off is a real angle, not an error: not turned.
        var skew = new List<Vector2> { new(0, 0), new(4, 0), new(4f + 3f * Mathf.Tan(12f * Mathf.Deg2Rad), 3f), new(0, 3) };
        var skewBefore = new List<Vector2>(skew);
        RoomOutlineCleanup.Square(skew);
        var skewWall = skew[2] - skew[1];
        var skewWallBefore = skewBefore[2] - skewBefore[1];
        Check(Vector2.Angle(skewWall, skewWallBefore) < 0.5f, "12-degree wall is not turned");

        // A corner that would have to move a long way stops squaring altogether.
        // Top wall 3.6° off over 8 m: squaring it would move a corner about 25 cm.
        var far = new List<Vector2> { new(0, 0), new(8, 0), new(8, 6.5f), new(0, 6) };
        var farBefore = new List<Vector2>(far);
        var farShifts = RoomOutlineCleanup.Square(far, 5f, 0.05f);
        Check(AllZero(farShifts) && Same(far, farBefore), "squaring skipped when a corner would move too far");

        Debug.Log("[RoomOutlineCleanupChecks] Passed closing-gap and squaring checks.");
    }

    static List<Vector2> Turn(IList<Vector2> points, float degrees, Vector2 offset)
    {
        var r = degrees * Mathf.Deg2Rad;
        var c = Mathf.Cos(r);
        var s = Mathf.Sin(r);
        var result = new List<Vector2>();
        foreach (var p in points) result.Add(new Vector2(p.x * c - p.y * s, p.x * s + p.y * c) + offset);
        return result;
    }

    static bool AllRight(IList<Vector2> outline, float tolerance)
    {
        var n = outline.Count;
        for (var i = 0; i < n; i++)
        {
            var angle = Vector2.Angle(outline[(i + n - 1) % n] - outline[i], outline[(i + 1) % n] - outline[i]);
            if (Mathf.Abs(angle - 90f) > tolerance) return false;
        }

        return true;
    }

    static bool AllZero(Vector2[] shifts)
    {
        foreach (var s in shifts)
        {
            if (s != Vector2.zero) return false;
        }

        return true;
    }

    static bool Same(IList<Vector2> a, IList<Vector2> b)
    {
        if (a.Count != b.Count) return false;
        for (var i = 0; i < a.Count; i++)
        {
            if (a[i] != b[i]) return false;
        }

        return true;
    }

    static float Area(IList<Vector2> outline)
    {
        var area = 0f;
        for (var i = 0; i < outline.Count; i++)
        {
            var a = outline[i];
            var b = outline[(i + 1) % outline.Count];
            area += a.x * b.y - b.x * a.y;
        }

        return Mathf.Abs(area) * 0.5f;
    }

    static void Check(bool condition, string scenario)
    {
        if (!condition) throw new InvalidOperationException($"Room outline cleanup regression: {scenario}");
    }
}
#endif
