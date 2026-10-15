#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Device-independent checks for placing detected doors and windows on the scanned walls, plus an
/// optional run of the detector on test photos (folder in ROOM_DETECTOR_TEST_PHOTOS).
/// </summary>
public static class AutoOpeningChecks
{
    static readonly List<Vector3> Room = new()
    {
        new Vector3(0, 0, 0), new Vector3(4, 0, 0), new Vector3(4, 0, 3), new Vector3(0, 0, 3),
    };

    [MenuItem("AR Interior/Test Auto Door & Window Placement")]
    public static void Run()
    {
        var eye = new Vector3(2f, 1.4f, 2f);
        const float wallHeight = 2.5f;

        // Door on wall 0 (z = 0) from x = 1.0 to 1.9, 2.05 m tall.
        var door = Sight("door", eye, new(1.0f, 0, 0), new(1.9f, 0, 0), new(1.45f, 0, 0), new(1.45f, 2.05f, 0));
        Check(AutoOpeningResolver.TryPlace(door, Room, 0f, wallHeight, out var p) && p.wall == 0, "door on its wall");
        Check(Mathf.Abs(p.start - 1.0f) < 0.01f && Mathf.Abs(p.end - 1.9f) < 0.01f, "door width");
        Check(p.sill == 0f && Mathf.Abs(p.top - 2.05f) < 0.01f, "door height");

        // Window on wall 1 (x = 4) from z = 1.0 to 2.2, sill 0.9, top 2.1; and with its top cut off.
        var window = Sight("window", eye, new(4, 0.9f, 1.0f), new(4, 0.9f, 2.2f), new(4, 0.9f, 1.6f), new(4, 2.1f, 1.6f));
        Check(AutoOpeningResolver.TryPlace(window, Room, 0f, wallHeight, out var w) && w.wall == 1, "window on its wall");
        Check(Mathf.Abs(w.start - 1.0f) < 0.01f && Mathf.Abs(w.end - 2.2f) < 0.01f, "window width");
        Check(Mathf.Abs(w.sill - 0.9f) < 0.01f && Mathf.Abs(w.top - 2.1f) < 0.01f, "window sill and top");
        var cut = window;
        cut.topCut = true;
        Check(AutoOpeningResolver.TryPlace(cut, Room, 0f, wallHeight, out var wc)
              && Mathf.Abs(wc.top - (0.9f + AutoOpeningResolver.DefaultWindowHeight)) < 0.01f, "cut-off window height");

        // Not doors: a picture 1 m up the wall, and a 3 m wide "door".
        Check(!AutoOpeningResolver.TryPlace(
            Sight("door", eye, new(2.5f, 1, 3), new(3.3f, 1, 3), new(2.9f, 1, 3), new(2.9f, 2.3f, 3)),
            Room, 0f, wallHeight, out _), "floating door rejected");
        Check(!AutoOpeningResolver.TryPlace(
            Sight("door", eye, new(0.5f, 0, 0), new(3.5f, 0, 0), new(2f, 0, 0), new(2f, 2f, 0)),
            Room, 0f, wallHeight, out _), "3 m door rejected");

        // Seen again from elsewhere: merged and confirmed; removed by the user: stays away.
        var eye2 = new Vector3(3f, 1.5f, 1.2f);
        AutoOpeningResolver.TryPlace(
            Sight("door", eye2, new(1.05f, 0, 0), new(1.95f, 0, 0), new(1.5f, 0, 0), new(1.5f, 2.0f, 0)),
            Room, 0f, wallHeight, out var p2);
        var tracker = new AutoOpeningResolver.Tracker();
        Check(tracker.Add(p) == null, "one weak sighting not confirmed");
        var confirmed = tracker.Add(p2);
        Check(confirmed != null && tracker.Candidates.Count == 1, "second sighting confirms");
        w.confidence = 0.62f;
        Check(tracker.Add(w) != null && tracker.Candidates.Count == 2, "confident window confirmed at once");
        tracker.Suppress(0, confirmed.Center, "door");
        Check(tracker.Add(p) == null && tracker.Add(p2) == null && tracker.Candidates.Count == 1, "removed door stays away");

        Debug.Log("[AutoOpeningChecks] Passed door/window placement, merging and removal checks.");
    }

    /// <summary>Runs the room detector on every .jpg in ROOM_DETECTOR_TEST_PHOTOS (skipped when unset).</summary>
    public static void RunDetectorOnTestPhotos()
    {
        var dir = Environment.GetEnvironmentVariable("ROOM_DETECTOR_TEST_PHOTOS");
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;
        foreach (var path in Directory.GetFiles(dir, "*.jpg"))
            FurnitureDetectorPhotoTest.RunOn(path);
    }

    static AutoOpeningResolver.Sighting Sight(string kind, Vector3 eye, Vector3 bl, Vector3 br, Vector3 bc, Vector3 tc) => new()
    {
        kind = kind,
        confidence = 0.3f,
        origin = eye,
        bottomLeft = bl - eye,
        bottomRight = br - eye,
        bottomCenter = bc - eye,
        topCenter = tc - eye,
    };

    static void Check(bool condition, string scenario)
    {
        if (!condition) throw new InvalidOperationException($"Auto door/window regression: {scenario}");
    }
}
#endif
