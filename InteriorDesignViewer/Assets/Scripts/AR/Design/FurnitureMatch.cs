using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Whether two furniture boxes found by the scan are one object, and merging repeat sightings.
/// Any overlap used to count as the same object, so a chair pushed in under a table was dropped
/// and two chairs side by side became one (client, 2026-10-29: chairs and tables missed in a
/// classroom). Now two boxes are one object only when each one's centre lies inside the other's
/// box (with a little slack for the floor-ray noise): one piece seen twice, or seen once under
/// two labels ("Table" and "Desk"). A chair under a table's edge, or next to another chair, is
/// kept as its own piece. Pure maths, so it can be checked without a phone.
/// </summary>
public static class FurnitureMatch
{
    /// <summary>How far (m) outside a box another box's centre may sit and still be the same object.</summary>
    public const float SameObjectSlack = 0.12f;

    public static bool SameObject(Vector3 aCenter, Vector3 aSize, float aYaw, Vector3 bCenter, Vector3 bSize, float bYaw)
        => Contains(aCenter, aSize, aYaw, bCenter) && Contains(bCenter, bSize, bYaw, aCenter);

    public static bool SameObject(FurnitureAutoSuggestion a, FurnitureAutoSuggestion b)
        => SameObject(a.center, a.size, a.yaw, b.center, b.size, b.yaw);

    /// <summary>The point is over the box's footprint, grown by <see cref="SameObjectSlack"/> on each side.</summary>
    static bool Contains(Vector3 center, Vector3 size, float yaw, Vector3 point)
    {
        // Same axes as Quaternion.Euler(0, yaw, 0): right = (cos, -sin), forward = (sin, cos) in XZ.
        var r = yaw * Mathf.Deg2Rad;
        var cos = Mathf.Cos(r);
        var sin = Mathf.Sin(r);
        var dx = point.x - center.x;
        var dz = point.z - center.z;
        var along = dx * cos - dz * sin;
        var across = dx * sin + dz * cos;
        return Mathf.Abs(along) <= Mathf.Abs(size.x) * 0.5f + SameObjectSlack
            && Mathf.Abs(across) <= Mathf.Abs(size.z) * 0.5f + SameObjectSlack;
    }

    /// <summary>
    /// Adds a detected object, or refines the one already listed as the same object: it counts as
    /// seen again, and a more confident sighting also replaces its label, position and size (keeping
    /// its id, so the app sees the same object). Returns true when the list changed.
    /// </summary>
    public static bool AddOrRefine(List<FurnitureAutoSuggestion> list, FurnitureAutoSuggestion sighting, int max)
    {
        for (var i = 0; i < list.Count; i++)
        {
            var known = list[i];
            if (!SameObject(sighting, known)) continue;
            // A surface guess ("plane") and a recognised piece aren't merged here: recognised pieces
            // replace the guesses first (MergeIntoPending).
            if (known.source != sighting.source) return false;

            var seen = Mathf.Max(1, known.sightings) + 1;
            if (sighting.confidence > known.confidence)
            {
                sighting.id = known.id;
                known = sighting;
            }
            known.sightings = seen;
            list[i] = known;
            return true;
        }

        if (list.Count >= max) return false;
        sighting.sightings = Mathf.Max(1, sighting.sightings);
        list.Add(sighting);
        return true;
    }
}
