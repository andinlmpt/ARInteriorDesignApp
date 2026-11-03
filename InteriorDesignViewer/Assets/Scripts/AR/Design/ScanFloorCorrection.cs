using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// The floor a confirmed room stands on. The floor point is the lowest surface AR has found when
/// it is set; 8 s into a fresh AR map that was a bed or table top, the real floor not found yet:
/// the room sat 27 cm too high, its height 27 cm too low, and furniture floated in View in AR
/// (phone logs, 2026-10-30). By the time the room is confirmed AR has usually found the floor: a
/// large surface clearly below the floor point and under the room is taken as the floor. Pure maths,
/// so it can be checked without a phone.
/// </summary>
public static class ScanFloorCorrection
{
    /// <summary>Closer than this below the floor point is the same floor (AR noise).</summary>
    public const float MinDrop = 0.10f;
    /// <summary>Further down than this is another level (stairs, a sunken room), not this room's floor.</summary>
    public const float MaxDrop = 0.80f;
    /// <summary>Smallest surface taken as the floor (m²); a bed top is larger, but it isn't lower.</summary>
    public const float MinFloorArea = 0.5f;
    /// <summary>A corrected height above this means the surface was wrong, not the floor point.</summary>
    public const float MaxWallHeight = 3.6f;

    /// <summary>A horizontal surface AR found, facing up: its centre (world) and its area.</summary>
    public struct Surface
    {
        public Vector3 center;
        public float area;

        public Surface(Vector3 center, float area)
        {
            this.center = center;
            this.area = area;
        }
    }

    /// <summary>
    /// The floor under the room when it lies clearly below the outline's floor: the largest surface
    /// between <see cref="MinDrop"/> and <see cref="MaxDrop"/> below it, at least
    /// <see cref="MinFloorArea"/>, centred inside the outline. The ceiling stays where it was
    /// measured, so the wall height grows by the drop (and it must stay under <see cref="MaxWallHeight"/>).
    /// </summary>
    public static bool TryFindLowerFloor(IReadOnlyList<Vector3> corners, float wallHeight,
        IEnumerable<Surface> surfaces, out float floorY, out float correctedHeight)
    {
        floorY = 0f;
        correctedHeight = wallHeight;
        if (corners == null || corners.Count < 3 || surfaces == null) return false;

        var scannedY = float.PositiveInfinity;
        foreach (var c in corners) scannedY = Mathf.Min(scannedY, c.y);

        var bestArea = 0f;
        var found = false;
        foreach (var s in surfaces)
        {
            var drop = scannedY - s.center.y;
            if (drop < MinDrop || drop > MaxDrop || s.area < MinFloorArea) continue;
            if (!RoomPolygonUtil.PointInsidePolygonXZ(s.center, corners)) continue;
            if (s.area <= bestArea) continue;
            bestArea = s.area;
            floorY = s.center.y;
            found = true;
        }

        if (!found) return false;
        correctedHeight = wallHeight + (scannedY - floorY);
        if (wallHeight > 0f && correctedHeight > MaxWallHeight)
        {
            correctedHeight = wallHeight;
            return false;
        }
        return true;
    }

    /// <summary>The outline moved to <paramref name="floorY"/> (same corners in plan).</summary>
    public static List<Vector3> AtFloor(IReadOnlyList<Vector3> corners, float floorY)
    {
        var moved = new List<Vector3>(corners.Count);
        foreach (var c in corners) moved.Add(new Vector3(c.x, floorY, c.z));
        return moved;
    }
}
