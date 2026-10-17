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
        return checks;
    }

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
