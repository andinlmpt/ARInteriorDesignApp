#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Device-independent checks for the floor check on confirm: a floor point set on a bed is moved to
/// the floor AR found later; noise, small patches, other rooms and other levels are left alone.
/// </summary>
public static class ScanFloorCorrectionChecks
{
    public static void Run()
    {
        // The room from the phone test (2026-10-30): floor point on a raised surface at -0.88, the
        // floor AR found later at -1.15, height measured as 2.14 m.
        var corners = Outline(-0.88f);
        var bed = new ScanFloorCorrection.Surface(new Vector3(1.0f, -0.88f, 1.0f), 3.0f);
        var floor = new ScanFloorCorrection.Surface(new Vector3(2.0f, -1.15f, 1.2f), 4.0f);

        Check(ScanFloorCorrection.TryFindLowerFloor(corners, 2.14f, new[] { bed, floor }, out var y, out var height),
            "the floor found under the room replaces a floor point set on a bed");
        Check(Mathf.Abs(y + 1.15f) < 1e-4f, "the room stands on the floor AR found");
        Check(Mathf.Abs(height - 2.41f) < 1e-3f, "the ceiling stays: the height grows by the drop");
        var moved = ScanFloorCorrection.AtFloor(corners, y);
        Check(moved.Count == corners.Count && Mathf.Abs(moved[2].y + 1.15f) < 1e-4f
              && Mathf.Abs(moved[2].x - corners[2].x) < 1e-4f, "corners keep their place in plan, at the new floor");

        Check(!ScanFloorCorrection.TryFindLowerFloor(corners, 2.14f, new[] { bed }, out _, out _),
            "nothing lower: the floor point stands");
        Check(!ScanFloorCorrection.TryFindLowerFloor(corners, 2.14f,
                new[] { new ScanFloorCorrection.Surface(new Vector3(2f, -0.93f, 1.2f), 4f) }, out _, out _),
            "5 cm lower is the same floor (AR noise)");
        Check(!ScanFloorCorrection.TryFindLowerFloor(corners, 2.14f,
                new[] { new ScanFloorCorrection.Surface(new Vector3(2f, -1.15f, 1.2f), 0.3f) }, out _, out _),
            "a small low patch isn't the floor");
        Check(!ScanFloorCorrection.TryFindLowerFloor(corners, 2.14f,
                new[] { new ScanFloorCorrection.Surface(new Vector3(6f, -1.15f, 1.2f), 4f) }, out _, out _),
            "a lower floor outside the room (next room) is left alone");
        Check(!ScanFloorCorrection.TryFindLowerFloor(corners, 2.14f,
                new[] { new ScanFloorCorrection.Surface(new Vector3(2f, -2.0f, 1.2f), 4f) }, out _, out _),
            "more than 80 cm down is another level");
        Check(!ScanFloorCorrection.TryFindLowerFloor(corners, 3.4f, new[] { floor }, out _, out var unchanged)
              && Mathf.Abs(unchanged - 3.4f) < 1e-4f, "a correction above 3.6 m is refused and the height kept");

        // Two lower surfaces: the larger one is the floor (the smaller may be a rug or a low step).
        var rug = new ScanFloorCorrection.Surface(new Vector3(1.5f, -1.05f, 1.0f), 1.0f);
        Check(ScanFloorCorrection.TryFindLowerFloor(corners, 2.14f, new[] { rug, floor }, out var picked, out _)
              && Mathf.Abs(picked + 1.15f) < 1e-4f, "the largest lower surface is the floor");

        Debug.Log("[ScanFloorCorrectionChecks] Passed raised-floor-point and leave-alone checks.");
    }

    /// <summary>A 3.5 × 2.4 m room with five corners (one cut corner), all at <paramref name="y"/>.</summary>
    static List<Vector3> Outline(float y) => new()
    {
        new Vector3(0f, y, 0f), new Vector3(3.5f, y, 0f), new Vector3(3.5f, y, 2.0f),
        new Vector3(3.1f, y, 2.4f), new Vector3(0f, y, 2.4f),
    };

    static void Check(bool ok, string what)
    {
        if (!ok) throw new Exception("[ScanFloorCorrectionChecks] Failed: " + what);
    }
}
#endif
