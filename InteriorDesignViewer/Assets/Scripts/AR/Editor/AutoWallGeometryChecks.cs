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

        Debug.Log("[AutoWallGeometryChecks] Passed wall merge, corner, open-end, outline and steady-wall checks.");
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
