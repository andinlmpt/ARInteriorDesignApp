using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Device-independent checks for the scan's height reading (<see cref="ScanHeightFilter"/>) and
/// mini map framing (<see cref="ScanMapFrame"/>). <see cref="Run"/> uses no editor or native
/// calls, so it also runs outside Unity.
/// </summary>
public static class ScanUxChecks
{
#if UNITY_EDITOR
    [UnityEditor.MenuItem("AR Interior/Test Scan Height and Map")]
    public static void RunFromMenu()
    {
        var count = Run();
        Debug.Log($"[ScanUxChecks] Passed {count} height reading and mini map checks.");
    }
#endif

    static int checks;

    /// <summary>Throws on the first failed check; returns how many passed.</summary>
    public static int Run()
    {
        checks = 0;
        HeightFilter();
        WallCrossing();
        MapFrame();
        LiveOpenings();
        FloorAim();
        return checks;
    }

    /// <summary>The floor aim reaches past the recognized floor, stops at walls and snaps to corners.</summary>
    static void FloorAim()
    {
        var s = ScanFloorAim.Settings.Default;
        var camera = new Vector3(0f, 1.5f, 0f);
        Vector3 AimAt(float x, float z) => new Vector3(x, 0f, z) - camera;

        var kind = ScanFloorAim.Resolve(camera, AimAt(0f, 2f), 0f, null, null, s, out var p);
        Check(kind == ScanFloorAim.Kind.Floor && Near(p.x, 0f) && Near(p.z, 2f) && Near(p.y, 0f), "aim lands on the open floor");
        Check(ScanFloorAim.Resolve(camera, new Vector3(0f, -0.05f, 1f), 0f, null, null, s, out _) == ScanFloorAim.Kind.None,
            "a nearly level aim isn't on the floor");
        Check(ScanFloorAim.Resolve(camera, AimAt(0f, 7f), 0f, null, null, s, out _) == ScanFloorAim.Kind.None,
            "a floor point too far away doesn't count");
        Check(ScanFloorAim.Resolve(camera, new Vector3(0f, 1f, 1f), 0f, null, null, s, out _) == ScanFloorAim.Kind.None,
            "looking up isn't the floor");

        // A corner at (1, 2). ARCore saw both walls only up to 0.4 m short of it.
        var pieces = new List<AutoWallGeometry.WallPiece>
        {
            new() { a = new Vector2(-1f, 2f), b = new Vector2(0.6f, 2f), normal = new Vector2(0f, -1f), weight = 2f },
            new() { a = new Vector2(1f, 0f), b = new Vector2(1f, 1.6f), normal = new Vector2(-1f, 0f), weight = 2f },
        };
        var walls = AutoWallGeometry.MergeWalls(pieces, AutoWallGeometry.Settings.Default);
        var corners = new List<Vector2>();
        foreach (var c in AutoWallGeometry.FindCorners(walls, AutoWallGeometry.Settings.Default)) corners.Add(c.point);
        Check(corners.Count == 1 && Near(corners[0].x, 1f) && Near(corners[0].y, 2f), "the two walls give the corner");

        kind = ScanFloorAim.Resolve(camera, AimAt(-0.5f, 2.5f), 0f, walls, null, s, out p);
        Check(kind == ScanFloorAim.Kind.WallBase && Near(p.z, 1.99f, 0.005f) && Near(p.x, -0.398f, 0.005f),
            $"floor point behind a wall stops at its bottom ({p.x:F3}, {p.z:F3})");
        Check(ScanFloorAim.Resolve(camera, AimAt(0f, 4f), 0f, walls, null, s, out _) == ScanFloorAim.Kind.None,
            "aiming up the wall isn't the floor");

        // Slightly behind the detected corner: the detected walls may be a little off the real
        // ones, so a small overshoot stays where the user aims.
        kind = ScanFloorAim.Resolve(camera, AimAt(1.1f, 2.1f), 0f, walls, null, s, out p);
        Check(kind == ScanFloorAim.Kind.Floor && Near(p.x, 1.1f) && Near(p.z, 2.1f),
            $"a small overshoot past the walls stays where aimed ({p.x:F3}, {p.z:F3})");
        kind = ScanFloorAim.Resolve(camera, AimAt(-0.1f, 2.2f), 0f, walls, null, s, out p);
        Check(kind == ScanFloorAim.Kind.Floor && Near(p.z, 2.2f), "20 cm past a wall line is still the floor the user aims at");

        kind = ScanFloorAim.Resolve(camera, AimAt(1.1f, 2.1f), 0f, walls, corners, s, out p);
        Check(kind == ScanFloorAim.Kind.Corner && Near(p.x, 1f) && Near(p.z, 2f), "and snaps onto the corner");
        kind = ScanFloorAim.Resolve(camera, AimAt(0.92f, 1.93f), 0f, walls, corners, s, out p);
        Check(kind == ScanFloorAim.Kind.Corner && Near(p.x, 1f) && Near(p.z, 2f), "aim just in front of the corner snaps onto it");
        kind = ScanFloorAim.Resolve(camera, AimAt(0.8f, 1.85f), 0f, walls, corners, s, out p);
        Check(kind == ScanFloorAim.Kind.Floor && Near(p.x, 0.8f) && Near(p.z, 1.85f),
            "25 cm from a detected corner the aim isn't pulled onto it");
        kind = ScanFloorAim.Resolve(camera, AimAt(0.4f, 1.5f), 0f, walls, corners, s, out p);
        Check(kind == ScanFloorAim.Kind.Floor && Near(p.x, 0.4f) && Near(p.z, 1.5f), "aim away from the corner stays put");

        // A wall seen far along its line doesn't stop an aim that only crosses its line.
        var far = AutoWallGeometry.MergeWalls(new List<AutoWallGeometry.WallPiece>
        {
            new() { a = new Vector2(2f, 2f), b = new Vector2(3f, 2f), normal = new Vector2(0f, -1f), weight = 1f },
        }, AutoWallGeometry.Settings.Default);
        kind = ScanFloorAim.Resolve(camera, AimAt(-0.5f, 2.5f), 0f, far, null, s, out p);
        Check(kind == ScanFloorAim.Kind.Floor && Near(p.z, 2.5f), "a wall seen far away doesn't stop the aim");

        CeilingAim(s, camera, walls, corners);
    }

    /// <summary>A floor corner hidden by furniture, placed from the ceiling corner above it.</summary>
    static void CeilingAim(ScanFloorAim.Settings s, Vector3 camera, List<AutoWallGeometry.Wall> walls, List<Vector2> corners)
    {
        const float ceiling = 2.6f;
        Vector3 UpAt(float x, float z) => new Vector3(x, ceiling, z) - camera;

        var kind = ScanFloorAim.ResolveCeiling(camera, UpAt(0f, 1.5f), 0f, ceiling, null, null, s, out var p, out var top);
        Check(kind == ScanFloorAim.Kind.Floor && Near(p.x, 0f) && Near(p.z, 1.5f) && Near(p.y, 0f) && Near(top.y, ceiling),
            "a ceiling spot gives the floor point straight below it");
        Check(ScanFloorAim.ResolveCeiling(camera, UpAt(0f, 2f) - new Vector3(0f, 3f, 0f), 0f, ceiling, null, null, s, out _, out _)
              == ScanFloorAim.Kind.None, "aiming down isn't the ceiling");
        Check(ScanFloorAim.ResolveCeiling(camera, UpAt(0f, 1.5f), 0f, 0f, null, null, s, out _, out _) == ScanFloorAim.Kind.None,
            "no ceiling without a height");

        // The ceiling corner above the (1, 2) corner, a little off: snaps onto the floor corner.
        kind = ScanFloorAim.ResolveCeiling(camera, UpAt(1.08f, 2.06f), 0f, ceiling, walls, corners, s, out p, out top);
        Check(kind == ScanFloorAim.Kind.Corner && Near(p.x, 1f) && Near(p.z, 2f) && Near(p.y, 0f)
              && Near(top.x, 1f) && Near(top.z, 2f), "ceiling corner snaps onto the floor corner below");

        // Past a wall on the ceiling: stopped at the wall, like on the floor.
        kind = ScanFloorAim.ResolveCeiling(camera, UpAt(-0.5f, 2.5f), 0f, ceiling, walls, null, s, out p, out _);
        Check(kind == ScanFloorAim.Kind.WallBase && Near(p.z, 1.99f, 0.005f), $"ceiling aim stops at the wall ({p.x:F3}, {p.z:F3})");
    }

    /// <summary>Doors and windows shown during the walk, before the room is closed.</summary>
    static void LiveOpenings()
    {
        // Only two walls of a 4 x 3 room found so far: along x at z = 0, and along z at x = 4.
        var walls = new List<AutoOpeningResolver.WallSegment>
        {
            new(new Vector3(0, 0, 0), new Vector3(4, 0, 0)),
            new(new Vector3(4, 0, 0), new Vector3(4, 0, 3)),
        };
        var eye = new Vector3(2f, 1.4f, 2f);
        var eye2 = new Vector3(3f, 1.5f, 1.2f);
        var door1 = Sight("door", eye, new(1.0f, 0, 0), new(1.9f, 0, 0), new(1.45f, 0, 0), new(1.45f, 2.05f, 0), 0.3f);
        var door2 = Sight("door", eye2, new(1.05f, 0, 0), new(1.95f, 0, 0), new(1.5f, 0, 0), new(1.5f, 2.0f, 0), 0.3f);
        var window = Sight("window", eye, new(4, 0.9f, 1.0f), new(4, 0.9f, 2.2f), new(4, 0.9f, 1.6f), new(4, 2.1f, 1.6f), 0.62f);

        var once = AutoOpeningResolver.PlaceLive(new[] { door1 }, walls, 0f, 2.5f);
        Check(once.Count == 0, "one weak door sighting isn't shown yet");

        var live = AutoOpeningResolver.PlaceLive(new[] { door1, door2, window }, walls, 0f, 2.5f);
        var door = live.Find(o => o.kind == "door");
        Check(live.Count == 2, $"seen twice / seen confidently are shown ({live.Count})");
        Check(door.sightings == 2 && Near(door.Center.x, 1.475f, 0.03f) && Near(door.Center.z, 0f, 0.01f), "door merged where it is");
        Check(Near(door.Width, 0.9f, 0.05f) && Near(door.top, 2.025f, 0.05f), "door size");
        Check(live.Exists(o => o.kind == "window" && Near(o.Center.x, 4f, 0.01f) && Near(o.sill, 0.9f, 0.02f)), "window on its wall");

        // The same wall found twice (outline edge and a detected wall 4 cm off): still one door.
        var doubled = new List<AutoOpeningResolver.WallSegment>(walls) { new(new Vector3(-0.5f, 0, 0.04f), new Vector3(3.5f, 0, 0.04f)) };
        var once2 = AutoOpeningResolver.PlaceLive(new[] { door1, door2 }, doubled, 0f, 2.5f);
        Check(once2.Count == 1 && once2[0].sightings == 2, "one door on two overlapping wall pieces counts once");

        // Removed by the user: stays away.
        var kept = AutoOpeningResolver.PlaceLive(new[] { door1, door2, window }, walls, 0f, 2.5f,
            (kind, center) => kind == "door" && Mathf.Abs(center.x - 1.45f) < 0.4f && Mathf.Abs(center.z) < 0.4f);
        Check(kept.Count == 1 && kept[0].kind == "window", "removed door isn't shown again");

        // Closed outline still gives wall indices for the saved room.
        var room = new List<Vector3> { new(0, 0, 0), new(4, 0, 0), new(4, 0, 3), new(0, 0, 3) };
        Check(AutoOpeningResolver.TryPlace(door1, room, 0f, 2.5f, out var placed) && placed.wall == 0
              && Near(placed.start, 1.0f) && Near(placed.end, 1.9f), "closed outline placement unchanged");
    }

    static AutoOpeningResolver.Sighting Sight(string kind, Vector3 eye, Vector3 bl, Vector3 br, Vector3 bc, Vector3 tc, float confidence) => new()
    {
        kind = kind,
        confidence = confidence,
        origin = eye,
        bottomLeft = bl - eye,
        bottomRight = br - eye,
        bottomCenter = bc - eye,
        topCenter = tc - eye,
    };

    static void HeightFilter()
    {
        var f = new ScanHeightFilter();
        var t = 0f;

        // Aim past the ceiling, hold, come back to the real line and hold: the real line wins.
        t = Hold(f, t, 1.2f, 0.3f, true);
        t = Hold(f, t, 2.6f, 0.6f, true);
        t = Hold(f, t, 3.5f, 0.6f, true);
        t = Hold(f, t, 2.6f, 0.6f, true);
        Check(Near(f.Display, 2.6f), $"overshoot corrected (shows {f.Display:F2})");
        Check(Near(f.Resolve(1.8f, 2.5f), 2.6f), "Finish after an overshoot locks the real line");

        // Lowering the phone to tap Finish keeps the held reading on screen and for Finish.
        t = Hold(f, t, 1.1f, 0.5f, false);
        Check(Near(f.Display, 2.6f), "lowered phone still shows the held height");
        Check(Near(f.Resolve(1.8f, 2.5f), 2.6f), "lowered phone locks the held height");

        // Sweeping past the line without holding doesn't replace the held value.
        t = Hold(f, t, 2.62f, 0.6f, true);
        t = Hold(f, t, 3.3f, 0.1f, true);
        Check(Near(f.Resolve(1.8f, 2.5f), 2.62f), "a quick sweep doesn't replace the held height");

        // Hand shake of ±2 cm still counts as holding still, and the held value is its average.
        f.Reset();
        t = 0f;
        for (var i = 0; i < 20; i++, t += 0.033f)
            f.Feed(t, true, 2.5f + (i % 2 == 0 ? 0.02f : -0.02f), true);
        Check(f.IsHoldingSteady && f.SteadyFor > 0.6f && Near(f.Held, 2.5f, 0.015f), "small shake still holds");

        // A real move restarts the hold.
        f.Feed(t, true, 2.7f, true);
        Check(!f.IsHoldingSteady && f.SteadyFor == 0f && Near(f.Display, 2.7f), "moving the aim restarts the hold");

        // Only mid-wall readings: Finish falls back to the default height.
        f.Reset();
        Hold(f, 0f, 1.2f, 1f, true);
        Check(Near(f.Resolve(1.8f, 2.5f), 2.5f), "mid-wall only uses the default height");

        // Never held, but the reading passed the ceiling: the peak is the last resort.
        f.Reset();
        f.Feed(0f, true, 2.4f, true);
        f.Feed(0.05f, true, 1.0f, false);
        Check(Near(f.Resolve(1.8f, 2.5f), 2.4f), "unheld ceiling reading falls back to the peak");

        f.Reset();
        Check(!f.HasReading && f.Held == 0f && f.Peak == 0f, "reset clears the reading");
    }

    static void WallCrossing()
    {
        // Wall along x at z = 3, facing the room (−z); seen from x = −1 to 1.
        var origin = new Vector2(0f, 3f);
        var normal = new Vector2(0f, -1f);
        var camera = new Vector3(0f, 1.4f, 1f);
        const float floorY = 0f;

        var aim = (new Vector3(0.4f, 2.6f, 3f) - camera).normalized;
        Check(ScanHeightFilter.TryWallCrossingHeight(camera, aim, origin, normal, -1f, 1f, floorY, 1.5f, 10f, out var h)
              && Near(h, 2.6f, 0.005f), $"aim at the wall-ceiling line reads its height ({h:F3})");

        // Standing at an angle to the wall, 0.8 m past its seen end, still reads the same line.
        var side = new Vector3(-1.5f, 1.3f, 0.5f);
        var sideAim = (new Vector3(1.8f, 2.6f, 3f) - side).normalized;
        Check(ScanHeightFilter.TryWallCrossingHeight(side, sideAim, origin, normal, -1f, 1f, floorY, 1.5f, 10f, out var hs)
              && Near(hs, 2.6f, 0.005f), $"angled aim past the seen part reads the same height ({hs:F3})");

        Check(!ScanHeightFilter.TryWallCrossingHeight(camera, -aim, origin, normal, -1f, 1f, floorY, 1.5f, 10f, out _),
              "wall behind the camera doesn't count");

        var farAlong = (new Vector3(5f, 2.6f, 3f) - camera).normalized;
        Check(!ScanHeightFilter.TryWallCrossingHeight(camera, farAlong, origin, normal, -1f, 1f, floorY, 1.5f, 10f, out _),
              "crossing far past the seen part doesn't count");

        var alongWall = new Vector3(1f, 0.5f, 0f).normalized;
        Check(!ScanHeightFilter.TryWallCrossingHeight(camera, alongWall, origin, normal, -1f, 1f, floorY, 1.5f, 10f, out _),
              "ray running along the wall doesn't count");
    }

    static void MapFrame()
    {
        var frame = new ScanMapFrame();

        // Facing +x when the walls step began: +x is up on the map.
        frame.FaceUp(new Vector2(1f, 0f));
        var up = frame.ProjectDirection(new Vector2(1f, 0f));
        Check(Near(up.x, 0f) && Near(up.y, 1f), "the way the user faced is up");

        // A 4 × 3 m room fills a 200-unit map, 10 in from the edges.
        var room = new List<Vector2> { new(0f, 0f), new(4f, 0f), new(4f, 3f), new(0f, 3f) };
        frame.Reset();
        frame.Fit(room, 200f, 10f, 2f, 0.25f);
        Check(Near(frame.Scale, 45f), $"room fills the map (scale {frame.Scale:F1})");
        foreach (var p in room)
        {
            var m = frame.Project(p);
            Check(Mathf.Abs(m.x) <= 100.01f && Mathf.Abs(m.y) <= 100.01f, $"corner {p} is on the map");
        }

        // Something new far away: easing would leave it off the map, so the map zooms out at once.
        var bigger = new List<Vector2>(room) { new(12f, 0f) };
        frame.Fit(bigger, 200f, 10f, 2f, 0.25f);
        foreach (var p in bigger)
        {
            var m = frame.Project(p);
            Check(Mathf.Abs(m.x) <= 100.01f && Mathf.Abs(m.y) <= 100.01f, $"new point {p} is on the map at once");
        }

        // A small room still shows at least the minimum span.
        frame.Reset();
        frame.Fit(new List<Vector2> { new(0f, 0f), new(0.5f, 0.5f) }, 200f, 10f, 3f, 1f);
        Check(Near(frame.Scale, 60f), "tiny outline keeps the minimum span");

        // Squaring to a wall at 10° makes it level on the map, turning as little as possible.
        frame.Reset();
        var wall = new Vector2(Mathf.Cos(10f * Mathf.Deg2Rad), Mathf.Sin(10f * Mathf.Deg2Rad));
        frame.SquareTo(wall);
        var level = frame.ProjectDirection(wall);
        Check(Near(level.y, 0f) && level.x > 0.99f, "wall is level after squaring");
        Check(Near(frame.Angle, -10f * Mathf.Deg2Rad), "squaring takes the smallest turn");
    }

    /// <summary>Feeds the same reading for <paramref name="seconds"/> at 30 fps; returns the new time.</summary>
    static float Hold(ScanHeightFilter f, float t, float reading, float seconds, bool lookingUp)
    {
        var end = t + seconds;
        for (; t < end; t += 1f / 30f)
            f.Feed(t, true, reading, lookingUp);
        return t;
    }

    static bool Near(float a, float b, float tolerance = 0.01f) => Mathf.Abs(a - b) <= tolerance;

    static void Check(bool condition, string scenario)
    {
        if (!condition) throw new InvalidOperationException($"Scan height/map regression: {scenario}");
        checks++;
    }
}
