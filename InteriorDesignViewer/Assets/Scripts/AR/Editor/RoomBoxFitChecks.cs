#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>Device-independent checks for fitting found furniture boxes to the room: square to the walls, inside them.</summary>
public static class RoomBoxFitChecks
{
    public static void Run()
    {
        var room = new List<Vector2> { new(0, 0), new(4, 0), new(4, 3), new(0, 3) };

        // A bed seen at an angle, facing the camera, its guessed back running through the far wall.
        var center = new Vector2(1.2f, 2.0f);
        var size = new Vector2(1.5f, 2.0f);
        var yaw = 20f;
        RoomBoxFit.Fit(room, true, ref center, ref size, ref yaw);
        Check(IsSquare(yaw, 0f), "bed seen at an angle is turned square to the walls");
        Check(Inside(room, center, size, yaw), "bed through the far wall ends up inside the room");
        Check(size.x >= 0.75f && size.y >= 1.0f, "bed keeps at least half its size");

        // A box too deep for the space in front of the wall is cut back there; its front stays put.
        var deep = new Vector2(2f, 2.2f);
        var deepSize = new Vector2(1.6f, 2.2f);
        var deepYaw = 0f;
        RoomBoxFit.Fit(room, true, ref deep, ref deepSize, ref deepYaw);
        Check(Mathf.Abs(deep.y - deepSize.y * 0.5f - 1.1f) < 0.01f, "front of a cut-back box stays where it was seen");
        Check(Mathf.Abs(deep.y + deepSize.y * 0.5f - (3f - RoomBoxFit.WallGap)) < 0.01f, "box is cut back to the wall");
        Check(Mathf.Abs(deepSize.x - 1.6f) < 1e-4f, "width along the wall is untouched");

        // Mostly outside: cut to half its size, the rest of the way it is moved in.
        var outside = new Vector2(2f, 3.4f);
        var outsideSize = new Vector2(1f, 1f);
        var outsideYaw = 0f;
        RoomBoxFit.Fit(room, true, ref outside, ref outsideSize, ref outsideYaw);
        Check(Inside(room, outside, outsideSize, outsideYaw), "box mostly outside is brought in");
        Check(Mathf.Abs(outsideSize.y - 0.5f) < 0.01f, "box is not cut below half its size");

        // Out through a room corner: cut back at both walls.
        var corner = new Vector2(3.8f, 2.8f);
        var cornerSize = new Vector2(0.8f, 0.8f);
        var cornerYaw = 0f;
        RoomBoxFit.Fit(room, true, ref corner, ref cornerSize, ref cornerYaw);
        Check(Inside(room, corner, cornerSize, cornerYaw), "box through a room corner ends up inside");

        // A box already inside and square to the walls is left alone.
        var fine = new Vector2(2f, 1.5f);
        var fineSize = new Vector2(1f, 0.6f);
        var fineYaw = 90f;
        RoomBoxFit.Fit(room, true, ref fine, ref fineSize, ref fineYaw);
        Check(fine == new Vector2(2f, 1.5f) && fineSize == new Vector2(1f, 0.6f) && Mathf.Abs(fineYaw - 90f) < 1e-3f,
            "box inside and square is unchanged");

        // A turned room: boxes follow its walls, not the world axes.
        var turned = Turn(room, 30f, new Vector2(-1f, 2f));
        var turnedCenter = Turn(new List<Vector2> { new(2f, 1.5f) }, 30f, new Vector2(-1f, 2f))[0];
        var turnedSize = new Vector2(1f, 0.6f);
        var turnedYaw = 0f;
        RoomBoxFit.Fit(turned, true, ref turnedCenter, ref turnedSize, ref turnedYaw);
        var wallYaw = RoomBoxFit.NearestWallYaw(turned, true, turnedCenter);
        Check(IsSquare(turnedYaw, wallYaw) && IsSquare(wallYaw, -30f), "box in a turned room is square to its walls");

        // During the walk (outline still open) the box is only turned, not moved.
        var walk = new Vector2(1.2f, 2.9f);
        var walkSize = new Vector2(1.5f, 2.0f);
        var walkYaw = 20f;
        RoomBoxFit.Fit(new List<Vector2> { room[0], room[1], room[2] }, false, ref walk, ref walkSize, ref walkYaw);
        Check(walk == new Vector2(1.2f, 2.9f) && walkSize == new Vector2(1.5f, 2.0f) && IsSquare(walkYaw, 0f),
            "open outline only turns the box");

        // No walls yet: nothing changes.
        Check(float.IsNaN(RoomBoxFit.NearestWallYaw(new List<Vector2> { room[0] }, false, Vector2.zero)), "no wall, no yaw");

        // The smallest box around a surface, measured along the wall.
        var surface = Turn(new List<Vector2> { new(0, 0), new(2, 0), new(2, 1), new(0, 1) }, 0f, new Vector2(0.5f, 0.5f));
        RoomBoxFit.BoundsAt(surface, 0f, out var boundsCenter, out var boundsSize);
        Check(Vector2.Distance(boundsCenter, new Vector2(1.5f, 1f)) < 1e-3f && Vector2.Distance(boundsSize, new Vector2(2f, 1f)) < 1e-3f,
            "bounds of a surface along the walls");

        Debug.Log("[RoomBoxFitChecks] Passed square-to-wall and keep-inside checks.");
    }

    static bool IsSquare(float yaw, float wallYaw)
    {
        var off = Mathf.Abs(Mathf.DeltaAngle(wallYaw, yaw)) % 90f;
        return Mathf.Min(off, 90f - off) < 0.1f;
    }

    static bool Inside(IReadOnlyList<Vector2> outline, Vector2 center, Vector2 size, float yaw)
    {
        var r = yaw * Mathf.Deg2Rad;
        var ax = new Vector2(Mathf.Cos(r), -Mathf.Sin(r));
        var az = new Vector2(Mathf.Sin(r), Mathf.Cos(r));
        for (var sx = -1; sx <= 1; sx += 2)
        {
            for (var sz = -1; sz <= 1; sz += 2)
            {
                var p = center + ax * (sx * size.x * 0.5f * 0.999f) + az * (sz * size.y * 0.5f * 0.999f);
                if (!RoomBoxFit.Contains(outline, p)) return false;
            }
        }

        return true;
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

    static void Check(bool condition, string scenario)
    {
        if (!condition) throw new InvalidOperationException($"Room box fit regression: {scenario}");
    }
}
#endif
