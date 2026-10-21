#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

/// <summary>Device-independent checks for the automatic room scan's walls, corners and outline order.</summary>
public static class AutoWallGeometryChecks
{
    [MenuItem("AR Interior/Test Auto Wall Geometry")]
    public static void Run()
    {
        var s = AutoWallGeometry.Settings.Default;
        var room = new[] { new Vector2(0, 0), new Vector2(4, 0), new Vector2(4, 3), new Vector2(0, 3) };

        // Rectangle, each wall seen only in its middle 20–80 %.
        var pieces = new List<AutoWallGeometry.WallPiece>();
        for (var i = 0; i < 4; i++) pieces.Add(Part(room[i], room[(i + 1) % 4], 0.2f, 0.8f));
        var walls = AutoWallGeometry.MergeWalls(pieces, s);
        var corners = AutoWallGeometry.FindCorners(walls, s);
        Check(walls.Count == 4 && corners.Count == 4, "rectangle walls and corners");
        foreach (var p in room) Check(Near(corners, p, 0.01f), $"rectangle corner {p}");
        Check(AutoWallGeometry.FindOpenEnds(walls, corners, null, s, 0.8f).Count == 0, "rectangle has no open ends");

        // Two pieces of one wall, slightly rotated and offset, merge.
        var split = AutoWallGeometry.MergeWalls(new List<AutoWallGeometry.WallPiece>
        {
            Part(room[0], room[1], 0.05f, 0.35f, 2f, 0.04f),
            Part(room[0], room[1], 0.6f, 0.95f, -2f, -0.03f),
        }, s);
        Check(split.Count == 1 && split[0].Length > 3.4f, "split wall merges");

        // Three walls: two open ends, closed by two hand-placed corners into a 12 m² room.
        var three = new List<AutoWallGeometry.WallPiece>();
        for (var i = 0; i < 3; i++) three.Add(Part(room[i], room[(i + 1) % 4], 0.2f, 0.8f));
        var threeWalls = AutoWallGeometry.MergeWalls(three, s);
        var threeCorners = AutoWallGeometry.FindCorners(threeWalls, s);
        Check(AutoWallGeometry.FindOpenEnds(threeWalls, threeCorners, null, s, 0.8f).Count == 2, "three walls leave two open ends");
        var placed = new List<Vector2> { new(0.08f, -0.05f), new(-0.06f, 3.07f) };
        Check(AutoWallGeometry.FindOpenEnds(threeWalls, threeCorners, placed, s, 0.8f).Count == 0, "placed corners close open ends");
        var outline = AutoWallGeometry.OrderOutline(threeCorners, placed, new Vector2(2f, 1.5f));
        Check(outline.Count == 4 && !AutoWallGeometry.CrossesItself(outline) && Mathf.Abs(Area(outline) - 12f) < 0.6f,
            "placed corners complete the outline");

        // A wardrobe front 0.6 m in front of the back wall is furniture, not a wall.
        var wardrobe = new List<AutoWallGeometry.WallPiece>(pieces) { Piece(new Vector2(2.6f, 2.4f), new Vector2(1.4f, 2.4f), 2.4f) };
        var wardrobeCorners = AutoWallGeometry.FindCorners(AutoWallGeometry.MergeWalls(wardrobe, s), s);
        Check(wardrobeCorners.Count == 4, "wardrobe adds no corner");
        foreach (var p in room) Check(Near(wardrobeCorners, p, 0.01f), $"wardrobe keeps corner {p}");

        // A door-frame sliver doesn't steal a corner.
        var sliver = new List<AutoWallGeometry.WallPiece>(pieces) { Piece(new Vector2(3f, 0f), new Vector2(3f, 0.3f), 0.5f) };
        var sliverCorners = AutoWallGeometry.FindCorners(AutoWallGeometry.MergeWalls(sliver, s), s);
        foreach (var p in room) Check(Near(sliverCorners, p, 0.01f), $"door frame keeps corner {p}");

        // L-shaped room, standing off-centre in the long arm: outline still doesn't cross itself.
        var l = new[]
        {
            new Vector2(0, 0), new Vector2(5, 0), new Vector2(5, 2),
            new Vector2(2.5f, 2), new Vector2(2.5f, 4), new Vector2(0, 4),
        };
        var lPieces = new List<AutoWallGeometry.WallPiece>();
        for (var i = 0; i < l.Length; i++) lPieces.Add(Part(l[i], l[(i + 1) % l.Length], 0.25f, 0.75f));
        var lCorners = AutoWallGeometry.FindCorners(AutoWallGeometry.MergeWalls(lPieces, s), s);
        Check(lCorners.Count == 6, "L room corners");
        var lOutline = AutoWallGeometry.OrderOutline(lCorners, null, new Vector2(3f, 1f));
        Check(lOutline.Count == 6 && !AutoWallGeometry.CrossesItself(lOutline), "L room outline order");

        RunTrackerChecks(s, room);
        RunScanFrameChecks();

        Debug.Log("[AutoWallGeometryChecks] Passed wall merge, corner, open-end, outline and steady-wall checks.");
    }

    /// <summary>
    /// A layout's room put back where it was scanned: the backend's planner frame (same math as
    /// roomFeatures.js / roomGeometry.js) and the AR shell (centred, as roomLocalToUnity) must map
    /// exactly onto the scan, with furniture turned the right way.
    /// </summary>
    static void RunScanFrameChecks()
    {
        // A 5 × 3.5 m room with one corner off square, scanned at 30° and away from the origin.
        var turn = 30f * Mathf.Deg2Rad;
        Vector3 Place(float x, float z) =>
            new(x * Mathf.Cos(turn) - z * Mathf.Sin(turn) + 7f, 0.04f, x * Mathf.Sin(turn) + z * Mathf.Cos(turn) - 2f);
        var scan = new[] { Place(0, 0), Place(5, 0), Place(5, 3.5f), Place(0.2f, 3.3f) };

        // Backend: angle = −atan2 of the longest wall; local = rotateXZ(world, angle) − min.
        var longest = 0f;
        var angle = 0f;
        for (var i = 0; i < scan.Length; i++)
        {
            var a = scan[i];
            var b = scan[(i + 1) % scan.Length];
            var len = new Vector2(b.x - a.x, b.z - a.z).magnitude;
            if (len > longest)
            {
                longest = len;
                angle = -Mathf.Atan2(b.z - a.z, b.x - a.x);
            }
        }

        Vector2 RotateXZ(Vector3 p, float r) =>
            new(p.x * Mathf.Cos(r) - p.z * Mathf.Sin(r), p.x * Mathf.Sin(r) + p.z * Mathf.Cos(r));
        var aligned = Array.ConvertAll(scan, p => RotateXZ(p, angle));
        var minX = float.MaxValue;
        var minZ = float.MaxValue;
        var maxX = float.MinValue;
        var maxZ = float.MinValue;
        foreach (var p in aligned)
        {
            minX = Mathf.Min(minX, p.x);
            minZ = Mathf.Min(minZ, p.y);
            maxX = Mathf.Max(maxX, p.x);
            maxZ = Mathf.Max(maxZ, p.y);
        }

        var width = maxX - minX;
        var depth = maxZ - minZ;
        // RN: shell corner = local − (w/2, d/2), y 0.
        var shell = Array.ConvertAll(aligned, p => new Vector3(p.x - minX - width / 2f, 0f, p.y - minZ - depth / 2f));

        Check(ScanFrameMath.TryBuild(angle, minX, minZ, width, depth, scan, shell, 0.02f, out var m, out var yaw),
            "shell lands on the scanned room");
        for (var i = 0; i < shell.Length; i++)
        {
            var w = m.MultiplyPoint3x4(shell[i]);
            Check(new Vector2(w.x - scan[i].x, w.z - scan[i].z).magnitude < 0.01f && Mathf.Abs(w.y - 0.04f) < 0.01f,
                $"shell corner {i} on scan corner");
        }

        // A sofa planned along the longest wall (local z ≈ 0, facing +z into the room) ends up along
        // that real wall, facing into the room. Planner rotation 0 + yaw is its Unity yaw.
        var sofaLocal = new Vector3(2.5f, 0f, 0.45f);
        var sofaWorld = m.MultiplyPoint3x4(sofaLocal - new Vector3(width / 2f, 0f, depth / 2f));
        var wallMid = (scan[0] + scan[1]) * 0.5f;
        Check(new Vector2(sofaWorld.x - wallMid.x, sofaWorld.z - wallMid.z).magnitude < 0.5f, "sofa sits by its real wall");
        var facing = new Vector3(Mathf.Sin(yaw * Mathf.Deg2Rad), 0f, Mathf.Cos(yaw * Mathf.Deg2Rad));
        var inward = Place(2.5f, 1f) - Place(2.5f, 0f);
        Check(Vector3.Dot(facing, inward.normalized) > 0.99f, "sofa faces into the room");

        // A different room (or the same one moved) is not placed blindly.
        var moved = Array.ConvertAll(scan, p => p + new Vector3(0.6f, 0f, 0f));
        Check(!ScanFrameMath.TryBuild(angle, minX, minZ, width, depth, moved, shell, 0.2f, out _, out _),
            "a moved room isn't matched");
    }

    /// <summary>Walls kept steady between rounds while the planes under them change.</summary>
    static void RunTrackerChecks(AutoWallGeometry.Settings s, Vector2[] room)
    {
        var ts = AutoWallTracker.Settings.Default;
        List<AutoWallGeometry.Wall> Round(AutoWallTracker t, params AutoWallGeometry.WallPiece[] seen) =>
            t.Update(AutoWallGeometry.MergeWalls(new List<AutoWallGeometry.WallPiece>(seen), s));
        var none = Array.Empty<AutoWallGeometry.WallPiece>();

        // A wall shows from its second sighting, not on a one-frame flash.
        var tracker = new AutoWallTracker(ts);
        var north = Part(room[0], room[1], 0.1f, 0.5f);
        Check(Round(tracker, north).Count == 0, "new wall waits for a second sighting");
        Check(Round(tracker, north).Count == 1, "wall shows on its second sighting");

        // Its plane drops out for a while: the wall stays.
        List<AutoWallGeometry.Wall> shown = null;
        for (var i = 0; i < 10; i++) shown = Round(tracker, none);
        Check(shown.Count == 1, "wall stays while its plane is gone for a moment");

        // Seen further along, it grows; seen shorter again, it doesn't shrink.
        shown = Round(tracker, Part(room[0], room[1], 0.4f, 0.9f));
        Check(shown.Count == 1 && shown[0].Length > 3.0f, "wall grows as more of it is seen");
        shown = Round(tracker, Part(room[0], room[1], 0.3f, 0.4f));
        Check(shown.Count == 1 && shown[0].Length > 3.0f, "wall doesn't shrink when its plane does");

        // A plane jumping ±5 cm moves the wall far less.
        var jitter = new AutoWallTracker(ts);
        for (var i = 0; i < 12; i++) shown = Round(jitter, Part(room[0], room[1], 0.2f, 0.8f, 0f, i % 2 == 0 ? 0.05f : -0.05f));
        Check(shown.Count == 1 && shown[0].DistanceToLine(new Vector2(2f, 0f)) < 0.03f, "jumpy plane gives a steady wall");

        // A one-round flash never shows and is forgotten.
        var flash = new AutoWallTracker(ts);
        Round(flash, Part(room[1], room[2], 0.2f, 0.8f));
        for (var i = 0; i < 4; i++) shown = Round(flash, none);
        Check(shown.Count == 0 && flash.KnownCount == 0, "one-round flash is dropped");

        // A wall seen only twice goes once it has been gone a long time; a well-seen one stays.
        var weak = new AutoWallTracker(ts);
        Round(weak, Part(room[1], room[2], 0.2f, 0.8f));
        Round(weak, Part(room[1], room[2], 0.2f, 0.8f));
        for (var i = 0; i <= ts.dropWeakAfter; i++) shown = Round(weak, none);
        Check(shown.Count == 0, "briefly seen wall goes after a long absence");
        var strong = new AutoWallTracker(ts);
        for (var i = 0; i < ts.keepAfterSeen; i++) Round(strong, Part(room[1], room[2], 0.2f, 0.8f));
        for (var i = 0; i <= ts.dropWeakAfter * 2; i++) shown = Round(strong, none);
        Check(shown.Count == 1, "well-seen wall stays until the scan starts over");

        // The four walls of a room stay four (perpendicular walls never match each other), with all corners.
        var rect = new AutoWallTracker(ts);
        var rectPieces = new AutoWallGeometry.WallPiece[4];
        for (var i = 0; i < 4; i++) rectPieces[i] = Part(room[i], room[(i + 1) % 4], 0.2f, 0.8f);
        Round(rect, rectPieces);
        shown = Round(rect, rectPieces);
        var rectCorners = AutoWallGeometry.FindCorners(shown, s);
        Check(shown.Count == 4 && rectCorners.Count == 4, "steady room walls keep their corners");
        foreach (var p in room) Check(Near(rectCorners, p, 0.02f), $"steady room corner {p}");
    }

    static AutoWallGeometry.WallPiece Piece(Vector2 a, Vector2 b, float weight, float rotateDegrees = 0f, float shift = 0f)
    {
        var d = (b - a).normalized;
        var n = new Vector2(-d.y, d.x);
        if (rotateDegrees != 0f)
        {
            var mid = (a + b) * 0.5f;
            a = mid + Rotate(a - mid, rotateDegrees);
            b = mid + Rotate(b - mid, rotateDegrees);
            n = Rotate(n, rotateDegrees);
        }

        return new AutoWallGeometry.WallPiece { a = a + n * shift, b = b + n * shift, normal = n, weight = weight };
    }

    static AutoWallGeometry.WallPiece Part(Vector2 p, Vector2 q, float from, float to, float rotateDegrees = 0f, float shift = 0f)
    {
        var a = Vector2.Lerp(p, q, from);
        var b = Vector2.Lerp(p, q, to);
        return Piece(a, b, (b - a).magnitude * 2.4f, rotateDegrees, shift);
    }

    static Vector2 Rotate(Vector2 v, float degrees)
    {
        var r = degrees * Mathf.Deg2Rad;
        return new Vector2(v.x * Mathf.Cos(r) - v.y * Mathf.Sin(r), v.x * Mathf.Sin(r) + v.y * Mathf.Cos(r));
    }

    static bool Near(List<AutoWallGeometry.Corner> corners, Vector2 p, float tolerance)
    {
        foreach (var c in corners)
        {
            if (Vector2.Distance(c.point, p) <= tolerance) return true;
        }

        return false;
    }

    static float Area(List<Vector2> outline)
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
        if (!condition) throw new InvalidOperationException($"Auto wall geometry regression: {scenario}");
    }
}
#endif
