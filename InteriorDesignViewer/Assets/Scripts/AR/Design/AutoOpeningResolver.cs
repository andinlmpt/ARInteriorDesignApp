using System;
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

    /// <summary>A straight piece of wall on the floor, from <see cref="a"/> to <see cref="b"/>.</summary>
    public struct WallSegment
    {
        public Vector3 a;
        public Vector3 b;

        public WallSegment(Vector3 a, Vector3 b)
        {
            this.a = a;
            this.b = b;
        }

        public float Length => new Vector2(b.x - a.x, b.z - a.z).magnitude;

        /// <summary>The point <paramref name="along"/> metres from <see cref="a"/>, on the floor.</summary>
        public Vector3 PointAt(float along)
        {
            var length = Length;
            return length < 1e-4f ? a : Vector3.Lerp(a, b, along / length);
        }
    }

    /// <summary>The walls of a floor outline: wall i runs from corner i to corner i + 1 (the last closes it).</summary>
    public static List<WallSegment> OutlineWalls(IReadOnlyList<Vector3> corners)
    {
        var walls = new List<WallSegment>();
        if (corners == null) return walls;
        for (var i = 0; i < corners.Count; i++)
            walls.Add(new WallSegment(corners[i], corners[(i + 1) % corners.Count]));
        return walls;
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
        return TryPlace(s, OutlineWalls(corners), floorY, wallHeight, out placement);
    }

    /// <summary>
    /// The same on any set of wall segments (e.g. the walls found so far, before the room is
    /// closed); <see cref="Placement.wall"/> is then an index into <paramref name="walls"/>.
    /// </summary>
    public static bool TryPlace(
        Sighting s,
        IReadOnlyList<WallSegment> walls,
        float floorY,
        float wallHeight,
        out Placement placement)
    {
        placement = default;
        if (walls == null || walls.Count == 0) return false;

        if (!TryFirstWall(s.origin, s.bottomCenter, walls, floorY, wallHeight, out var wall)
            && !TryFirstWall(s.origin, s.topCenter, walls, floorY, wallHeight, out wall))
            return false;

        var segment = walls[wall];
        if (!TryHitWall(s.origin, s.bottomLeft, segment, out var left, out _, out _)
            || !TryHitWall(s.origin, s.bottomRight, segment, out var right, out _, out _))
            return false;

        var length = segment.Length;
        var start = Mathf.Clamp(Mathf.Min(left, right), 0f, length);
        var end = Mathf.Clamp(Mathf.Max(left, right), 0f, length);
        var width = end - start;

        var hasBottom = TryHitWall(s.origin, s.bottomCenter, segment, out _, out var bottomY, out _);
        var hasTop = TryHitWall(s.origin, s.topCenter, segment, out _, out var topY, out _);
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
        out int wall) => TryFirstWall(origin, direction, OutlineWalls(corners), floorY, wallHeight, out wall);

    public static bool TryFirstWall(
        Vector3 origin,
        Vector3 direction,
        IReadOnlyList<WallSegment> walls,
        float floorY,
        float wallHeight,
        out int wall)
    {
        wall = -1;
        var bestT = float.MaxValue;
        for (var i = 0; i < walls.Count; i++)
        {
            if (!TryHitWall(origin, direction, walls[i], out var along, out var y, out var t)) continue;
            if (along < -0.1f || along > walls[i].Length + 0.1f) continue;
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
        out float t) =>
        TryHitWall(origin, direction, new WallSegment(corners[wall], corners[(wall + 1) % corners.Count]), out along, out y, out t);

    /// <summary>Where a ray meets the (infinite, vertical) plane through a wall segment.</summary>
    public static bool TryHitWall(Vector3 origin, Vector3 direction, WallSegment wall, out float along, out float y, out float t)
    {
        along = y = t = 0f;
        var a = wall.a;
        var b = wall.b;
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

    public static float WallLength(IReadOnlyList<Vector3> corners, int wall) =>
        new WallSegment(corners[wall], corners[(wall + 1) % corners.Count]).Length;

    /// <summary>A door or window shown while the room is still being walked: where it is in the room.</summary>
    public struct LiveOpening
    {
        public string kind;
        /// <summary>Its two edges on the floor.</summary>
        public Vector3 a;
        public Vector3 b;
        public float sill;
        public float top;
        public int sightings;
        public float confidence;

        public Vector3 Center => (a + b) * 0.5f;
        public float Width => new Vector2(b.x - a.x, b.z - a.z).magnitude;
    }

    /// <summary>
    /// Every sighting placed on the walls found so far, with repeat sightings of the same door or
    /// window (same kind, centres within <paramref name="mergeDistance"/>) merged. Only the ones
    /// seen <paramref name="confirmAfter"/> times, or once with <paramref name="confirmConfidence"/>,
    /// are returned. <paramref name="skip"/> drops spots the user removed (kind, centre).
    /// </summary>
    public static List<LiveOpening> PlaceLive(
        IReadOnlyList<Sighting> sightings,
        IReadOnlyList<WallSegment> walls,
        float floorY,
        float wallHeight,
        Func<string, Vector3, bool> skip = null,
        int confirmAfter = 2,
        float confirmConfidence = 0.5f,
        float mergeDistance = 0.45f)
    {
        var merged = new List<LiveOpening>();
        if (sightings == null || walls == null || walls.Count == 0) return merged;

        foreach (var s in sightings)
        {
            if (!TryPlace(s, walls, floorY, wallHeight, out var p)) continue;
            var wall = walls[p.wall];
            var spot = new LiveOpening
            {
                kind = p.kind,
                a = wall.PointAt(p.start),
                b = wall.PointAt(p.end),
                sill = p.sill,
                top = p.top,
                sightings = 1,
                confidence = p.confidence,
            };
            if (skip != null && skip(spot.kind, spot.Center)) continue;

            var index = merged.FindIndex(o => o.kind == spot.kind && FlatDistance(o.Center, spot.Center) <= mergeDistance);
            if (index < 0)
            {
                merged.Add(spot);
                continue;
            }

            // Running average, pairing each edge with its nearest counterpart.
            var known = merged[index];
            var k = 1f / (known.sightings + 1);
            var sameOrder = FlatDistance(known.a, spot.a) <= FlatDistance(known.a, spot.b);
            known.a = Vector3.Lerp(known.a, sameOrder ? spot.a : spot.b, k);
            known.b = Vector3.Lerp(known.b, sameOrder ? spot.b : spot.a, k);
            known.sill = Mathf.Lerp(known.sill, spot.sill, k);
            known.top = Mathf.Lerp(known.top, spot.top, k);
            known.sightings++;
            known.confidence = Mathf.Max(known.confidence, spot.confidence);
            merged[index] = known;
        }

        merged.RemoveAll(o => o.sightings < confirmAfter && o.confidence < confirmConfidence);
        return merged;
    }

    static float FlatDistance(Vector3 p, Vector3 q) => new Vector2(p.x - q.x, p.z - q.z).magnitude;

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
