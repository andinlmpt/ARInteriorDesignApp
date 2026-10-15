using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Doors and windows from the object detector, placed on the scanned room's walls.
/// A sighting is the camera position plus rays through the detected box (bottom-left,
/// bottom-right, bottom-centre, top-centre). Once the floor outline exists, the rays are
/// intersected with the wall the box sits on, giving the opening's position along the wall,
/// its width, sill and top. <see cref="Tracker"/> merges repeat sightings and only keeps an
/// opening once it has been seen enough. No AR types, so it can be checked without a phone.
/// </summary>
public static class AutoOpeningResolver
{
    public const float DefaultDoorHeight = 2.1f;
    public const float DefaultWindowHeight = 1.2f;
    public const float DefaultWindowSill = 0.9f;

    public struct Sighting
    {
        /// <summary>"door" | "window".</summary>
        public string kind;
        public float confidence;
        public Vector3 origin;
        public Vector3 bottomLeft;
        public Vector3 bottomRight;
        public Vector3 bottomCenter;
        public Vector3 topCenter;
        /// <summary>The box touches the top / bottom of the camera frame, so that edge is not the opening's.</summary>
        public bool topCut;
        public bool bottomCut;
    }

    public struct Placement
    {
        public string kind;
        public int wall;
        public float start;
        public float end;
        public float sill;
        public float top;
        public float confidence;

        public float Width => end - start;
        public float Center => (start + end) * 0.5f;
    }

    /// <summary>
    /// Puts a sighting on the wall its bottom-centre (or, failing that, top-centre) ray hits first,
    /// and sizes it from where the other rays meet that wall. False when it doesn't look like a
    /// real door or window there (wrong size, not on the floor for a door, …).
    /// </summary>
    public static bool TryPlace(
        Sighting s,
        IReadOnlyList<Vector3> corners,
        float floorY,
        float wallHeight,
        out Placement placement)
    {
        placement = default;
        if (corners == null || corners.Count < 3) return false;

        if (!TryFirstWall(s.origin, s.bottomCenter, corners, floorY, wallHeight, out var wall)
            && !TryFirstWall(s.origin, s.topCenter, corners, floorY, wallHeight, out wall))
            return false;

        if (!TryHitWallPlane(s.origin, s.bottomLeft, corners, wall, out var left, out _)
            || !TryHitWallPlane(s.origin, s.bottomRight, corners, wall, out var right, out _))
            return false;

        var length = WallLength(corners, wall);
        var start = Mathf.Clamp(Mathf.Min(left, right), 0f, length);
        var end = Mathf.Clamp(Mathf.Max(left, right), 0f, length);
        var width = end - start;

        var hasBottom = TryHitWallPlane(s.origin, s.bottomCenter, corners, wall, out _, out var bottomY);
        var hasTop = TryHitWallPlane(s.origin, s.topCenter, corners, wall, out _, out var topY);
        var bottom = hasBottom && !s.bottomCut ? bottomY - floorY : float.NaN;
        var top = hasTop && !s.topCut ? topY - floorY : float.NaN;

        float sill;
        float topHeight;
        if (s.kind == "door")
        {
            // A door stands on the floor; a "door" whose bottom floats is a picture or a cabinet front.
            if (!float.IsNaN(bottom) && bottom > 0.4f) return false;
            if (width < 0.55f || width > 1.8f) return false;
            sill = 0f;
            topHeight = float.IsNaN(top) ? DefaultDoorHeight : Mathf.Max(top, 1.8f);
            topHeight = Mathf.Min(topHeight, wallHeight - 0.02f);
        }
        else
        {
            if (width < 0.3f || width > 3.5f) return false;
            sill = float.IsNaN(bottom) ? Mathf.Min(DefaultWindowSill, wallHeight * 0.5f) : Mathf.Clamp(bottom, 0f, wallHeight - 0.3f);
            topHeight = float.IsNaN(top) ? sill + DefaultWindowHeight : top;
            topHeight = Mathf.Clamp(topHeight, sill + 0.3f, wallHeight - 0.02f);
        }

        if (topHeight - sill < 0.3f) return false;

        placement = new Placement
        {
            kind = s.kind,
            wall = wall,
            start = start,
            end = end,
            sill = sill,
            top = topHeight,
            confidence = s.confidence,
        };
        return true;
    }

    /// <summary>The wall a ray from inside the room hits first (within its segment and height).</summary>
    public static bool TryFirstWall(
        Vector3 origin,
        Vector3 direction,
        IReadOnlyList<Vector3> corners,
        float floorY,
        float wallHeight,
        out int wall)
    {
        wall = -1;
        var bestT = float.MaxValue;
        for (var i = 0; i < corners.Count; i++)
        {
            if (!TryHitWallPlane(origin, direction, corners, i, out var along, out var y, out var t)) continue;
            if (along < -0.1f || along > WallLength(corners, i) + 0.1f) continue;
            if (y < floorY - 0.5f || y > floorY + wallHeight + 0.5f) continue;
            if (t < bestT)
            {
                bestT = t;
                wall = i;
            }
        }

        return wall >= 0;
    }

    public static bool TryHitWallPlane(
        Vector3 origin,
        Vector3 direction,
        IReadOnlyList<Vector3> corners,
        int wall,
        out float along,
        out float y) => TryHitWallPlane(origin, direction, corners, wall, out along, out y, out _);

    /// <summary>
    /// Where a ray meets the (infinite, vertical) plane of a wall: distance from the wall's first
    /// corner along it, and the height. False when the ray runs along the wall or points away.
    /// </summary>
    public static bool TryHitWallPlane(
        Vector3 origin,
        Vector3 direction,
        IReadOnlyList<Vector3> corners,
        int wall,
        out float along,
        out float y,
        out float t)
    {
        along = y = t = 0f;
        var a = corners[wall];
        var b = corners[(wall + 1) % corners.Count];
        var u = new Vector3(b.x - a.x, 0f, b.z - a.z);
        var length = u.magnitude;
        if (length < 1e-3f) return false;
        u /= length;
        var n = new Vector3(-u.z, 0f, u.x);

        var denominator = Vector3.Dot(direction, n);
        if (Mathf.Abs(denominator) < 1e-4f) return false;
        t = Vector3.Dot(a - origin, n) / denominator;
        if (t <= 0.05f) return false;

        var p = origin + direction * t;
        along = Vector3.Dot(new Vector3(p.x - a.x, 0f, p.z - a.z), u);
        y = p.y;
        return true;
    }

    public static float WallLength(IReadOnlyList<Vector3> corners, int wall)
    {
        var a = corners[wall];
        var b = corners[(wall + 1) % corners.Count];
        return new Vector2(b.x - a.x, b.z - a.z).magnitude;
    }

    /// <summary>
    /// Merges placements of the same door/window seen again (same wall, same kind, overlapping),
    /// averaging them, and confirms one after <see cref="ConfirmAfterSightings"/> sightings or a
    /// single confident one. Openings the user removed stay away.
    /// </summary>
    public sealed class Tracker
    {
        public sealed class Candidate
        {
            public string id;
            public string kind;
            public int wall;
            public float start;
            public float end;
            public float sill;
            public float top;
            public int sightings;
            public float bestConfidence;
            public bool confirmed;

            public float Center => (start + end) * 0.5f;
        }

        public int ConfirmAfterSightings = 2;
        public float ConfirmConfidence = 0.5f;
        public float MinOverlap = 0.4f;
        public float SuppressRadius = 0.4f;

        readonly List<Candidate> candidates = new();
        readonly List<(int wall, float center, string kind)> suppressed = new();
        int nextId = 1;

        public IReadOnlyList<Candidate> Candidates => candidates;

        /// <summary>Adds a placement. Returns the confirmed candidate it created or changed, or null.</summary>
        public Candidate Add(Placement p)
        {
            foreach (var s in suppressed)
            {
                if (s.wall == p.wall && s.kind == p.kind && Mathf.Abs(s.center - p.Center) <= SuppressRadius)
                    return null;
            }

            Candidate match = null;
            foreach (var c in candidates)
            {
                if (c.wall != p.wall || c.kind != p.kind) continue;
                var overlap = Mathf.Min(c.end, p.end) - Mathf.Max(c.start, p.start);
                var smaller = Mathf.Max(0.05f, Mathf.Min(c.end - c.start, p.Width));
                if (overlap / smaller >= MinOverlap || Mathf.Abs(c.Center - p.Center) <= 0.3f)
                {
                    match = c;
                    break;
                }
            }

            if (match == null)
            {
                match = new Candidate
                {
                    id = $"auto-{p.kind}-{nextId++}",
                    kind = p.kind,
                    wall = p.wall,
                    start = p.start,
                    end = p.end,
                    sill = p.sill,
                    top = p.top,
                    sightings = 1,
                    bestConfidence = p.confidence,
                };
                candidates.Add(match);
            }
            else
            {
                var k = 1f / (match.sightings + 1);
                match.start = Mathf.Lerp(match.start, p.start, k);
                match.end = Mathf.Lerp(match.end, p.end, k);
                match.sill = Mathf.Lerp(match.sill, p.sill, k);
                match.top = Mathf.Lerp(match.top, p.top, k);
                match.sightings++;
                match.bestConfidence = Mathf.Max(match.bestConfidence, p.confidence);
            }

            if (!match.confirmed
                && (match.sightings >= ConfirmAfterSightings || match.bestConfidence >= ConfirmConfidence))
                match.confirmed = true;

            return match.confirmed ? match : null;
        }

        /// <summary>The user removed this opening: forget it and don't add it again.</summary>
        public void Suppress(int wall, float center, string kind)
        {
            suppressed.Add((wall, center, kind));
            candidates.RemoveAll(c => c.wall == wall && c.kind == kind && Mathf.Abs(c.Center - center) <= SuppressRadius);
        }

        public Candidate Find(string id) => candidates.Find(c => c.id == id);

        public void Clear()
        {
            candidates.Clear();
            suppressed.Clear();
        }
    }
}
