using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Floor-plan geometry for the automatic room scan, on the XZ plane (x = world x, y = world z).
/// ARCore's vertical planes become wall lines, nearly collinear pieces merge into one wall,
/// and two walls that meet at a sensible angle near their ends give a room corner.
/// No AR types here, so it can be checked without a phone.
/// </summary>
public static class AutoWallGeometry
{
    /// <summary>One vertical plane seen from above: a straight piece of wall.</summary>
    public struct WallPiece
    {
        public Vector2 a;
        public Vector2 b;
        /// <summary>Unit normal on the floor plan, pointing the way the plane faces.</summary>
        public Vector2 normal;
        /// <summary>How much to trust it (plane area in m²).</summary>
        public float weight;
    }

    /// <summary>A merged wall: an infinite line through <see cref="origin"/> plus the part actually seen.</summary>
    public sealed class Wall
    {
        public Vector2 origin;
        public Vector2 dir;
        public Vector2 normal;
        public float tMin;
        public float tMax;
        public float weight;
        public int pieceCount;

        public float Length => tMax - tMin;
        public Vector2 PointAt(float t) => origin + dir * t;
        public Vector2 End(int end) => PointAt(end == 0 ? tMin : tMax);
        public float Project(Vector2 p) => Vector2.Dot(p - origin, dir);
        public float DistanceToLine(Vector2 p) => Mathf.Abs(Vector2.Dot(p - origin, normal));
    }

    /// <summary>Where two walls meet. <c>endA</c>/<c>endB</c> say which end of each wall it closes.</summary>
    public struct Corner
    {
        public Vector2 point;
        public int wallA;
        public int wallB;
        public int endA;
        public int endB;
        /// <summary>How far past the seen ends the walls had to be extended to meet (m).</summary>
        public float reach;
    }

    public struct Settings
    {
        public float mergeAngleDegrees;
        public float mergeOffset;
        public float minCornerAngleDegrees;
        /// <summary>How far past the seen part a wall may be extended to meet another (m).</summary>
        public float cornerReach;
        /// <summary>How far inside the seen part a corner may sit (planes overshoot a little).</summary>
        public float cornerInset;
        /// <summary>Walls shorter than this (door frames, furniture sides) never make corners.</summary>
        public float minCornerWallLength;
        /// <summary>A parallel wall at least this far behind another, covering it, makes the front one furniture.</summary>
        public float innerWallGap;

        public static Settings Default => new()
        {
            mergeAngleDegrees = 10f,
            mergeOffset = 0.15f,
            minCornerAngleDegrees = 60f,
            cornerReach = 2.0f,
            cornerInset = 0.3f,
            minCornerWallLength = 0.5f,
            innerWallGap = 0.25f,
        };
    }

    /// <summary>
    /// Greedy merge, heaviest pieces first: a piece joins a wall when it faces the same way,
    /// is nearly parallel and lies within <see cref="Settings.mergeOffset"/> of its line.
    /// </summary>
    public static List<Wall> MergeWalls(IReadOnlyList<WallPiece> pieces, Settings settings)
    {
        var order = new List<int>();
        for (var i = 0; i < pieces.Count; i++)
        {
            if ((pieces[i].b - pieces[i].a).sqrMagnitude > 1e-6f)
                order.Add(i);
        }
        order.Sort((x, y) => pieces[y].weight.CompareTo(pieces[x].weight));

        var cosTol = Mathf.Cos(settings.mergeAngleDegrees * Mathf.Deg2Rad);
        var walls = new List<Wall>();
        foreach (var index in order)
        {
            var piece = pieces[index];
            var pieceDir = (piece.b - piece.a).normalized;
            var mid = (piece.a + piece.b) * 0.5f;

            Wall target = null;
            foreach (var wall in walls)
            {
                if (Vector2.Dot(wall.normal, piece.normal) < cosTol) continue;
                if (Mathf.Abs(Vector2.Dot(wall.dir, pieceDir)) < cosTol) continue;
                if (wall.DistanceToLine(mid) > settings.mergeOffset) continue;
                target = wall;
                break;
            }

            if (target == null)
            {
                walls.Add(FromPiece(piece));
                continue;
            }

            Absorb(target, piece);
        }

        return walls;
    }

    static Wall FromPiece(WallPiece piece)
    {
        var normal = piece.normal.normalized;
        var dir = new Vector2(-normal.y, normal.x);
        var wall = new Wall
        {
            origin = (piece.a + piece.b) * 0.5f,
            dir = dir,
            normal = normal,
            weight = Mathf.Max(piece.weight, 1e-4f),
            pieceCount = 1,
        };
        var ta = wall.Project(piece.a);
        var tb = wall.Project(piece.b);
        wall.tMin = Mathf.Min(ta, tb);
        wall.tMax = Mathf.Max(ta, tb);
        return wall;
    }

    static void Absorb(Wall wall, WallPiece piece)
    {
        // Seen ends of both, in world space, before the line moves.
        var oldA = wall.End(0);
        var oldB = wall.End(1);

        var w = Mathf.Max(piece.weight, 1e-4f);
        var total = wall.weight + w;
        var normal = (wall.normal * wall.weight + piece.normal.normalized * w).normalized;
        var mid = (piece.a + piece.b) * 0.5f;
        // Pull the line toward the piece by its share of the weight (along the old normal).
        var offset = Vector2.Dot(mid - wall.origin, wall.normal) * (w / total);

        wall.origin += wall.normal * offset;
        wall.normal = normal;
        wall.dir = new Vector2(-normal.y, normal.x);
        wall.weight = total;
        wall.pieceCount++;

        var ts = new[] { wall.Project(oldA), wall.Project(oldB), wall.Project(piece.a), wall.Project(piece.b) };
        wall.tMin = Mathf.Min(ts);
        wall.tMax = Mathf.Max(ts);
    }

    /// <summary>
    /// True for a wall with a parallel wall facing the same way further out behind it that
    /// covers most of it: a wardrobe or cabinet front standing in front of the real wall.
    /// </summary>
    public static bool[] FindInnerWalls(IReadOnlyList<Wall> walls, Settings settings)
    {
        var inner = new bool[walls.Count];
        var cosTol = Mathf.Cos(settings.mergeAngleDegrees * Mathf.Deg2Rad);
        for (var i = 0; i < walls.Count; i++)
        {
            var front = walls[i];
            for (var j = 0; j < walls.Count; j++)
            {
                if (i == j) continue;
                var back = walls[j];
                if (Vector2.Dot(front.normal, back.normal) < cosTol) continue;
                // Behind = on the side the front wall faces away from.
                if (Vector2.Dot(back.origin - front.origin, front.normal) > -settings.innerWallGap) continue;

                var b0 = front.Project(back.End(0));
                var b1 = front.Project(back.End(1));
                var overlap = Mathf.Min(front.tMax, Mathf.Max(b0, b1)) - Mathf.Max(front.tMin, Mathf.Min(b0, b1));
                if (overlap >= front.Length * 0.5f)
                {
                    inner[i] = true;
                    break;
                }
            }
        }

        return inner;
    }

    /// <summary>
    /// Every pair of walls at a corner-like angle whose lines meet close to an end of both.
    /// A wall end keeps only its best corner (the one needing the least extension).
    /// Short walls and walls standing in front of another wall are left out.
    /// </summary>
    public static List<Corner> FindCorners(IReadOnlyList<Wall> walls, Settings settings)
    {
        var candidates = new List<Corner>();
        var maxDot = Mathf.Cos(settings.minCornerAngleDegrees * Mathf.Deg2Rad);
        var inner = FindInnerWalls(walls, settings);

        for (var i = 0; i < walls.Count; i++)
        {
            if (inner[i] || walls[i].Length < settings.minCornerWallLength) continue;
            for (var j = i + 1; j < walls.Count; j++)
            {
                if (inner[j] || walls[j].Length < settings.minCornerWallLength) continue;
                var a = walls[i];
                var b = walls[j];
                if (Mathf.Abs(Vector2.Dot(a.dir, b.dir)) > maxDot) continue;
                if (!TryIntersect(a, b, out var p)) continue;
                if (!TryEndFor(a, p, settings, out var endA, out var reachA)) continue;
                if (!TryEndFor(b, p, settings, out var endB, out var reachB)) continue;

                candidates.Add(new Corner
                {
                    point = p,
                    wallA = i,
                    wallB = j,
                    endA = endA,
                    endB = endB,
                    reach = reachA + reachB,
                });
            }
        }

        candidates.Sort((x, y) => x.reach.CompareTo(y.reach));
        var usedEnds = new HashSet<long>();
        var corners = new List<Corner>();
        foreach (var c in candidates)
        {
            var keyA = EndKey(c.wallA, c.endA);
            var keyB = EndKey(c.wallB, c.endB);
            if (usedEnds.Contains(keyA) || usedEnds.Contains(keyB)) continue;
            usedEnds.Add(keyA);
            usedEnds.Add(keyB);
            corners.Add(c);
        }

        return corners;
    }

    static long EndKey(int wall, int end) => wall * 2L + end;

    static bool TryIntersect(Wall a, Wall b, out Vector2 point)
    {
        point = default;
        var cross = a.dir.x * b.dir.y - a.dir.y * b.dir.x;
        if (Mathf.Abs(cross) < 1e-4f) return false;
        var diff = b.origin - a.origin;
        var t = (diff.x * b.dir.y - diff.y * b.dir.x) / cross;
        point = a.PointAt(t);
        return true;
    }

    /// <summary>
    /// The corner must sit near one end of the wall: at most <see cref="Settings.cornerReach"/>
    /// beyond it, or <see cref="Settings.cornerInset"/> inside it (ARCore planes overshoot a little).
    /// </summary>
    static bool TryEndFor(Wall wall, Vector2 p, Settings settings, out int end, out float reach)
    {
        var t = wall.Project(p);
        end = -1;
        reach = 0f;

        var nearMin = t <= wall.tMin + settings.cornerInset && t >= wall.tMin - settings.cornerReach;
        var nearMax = t >= wall.tMax - settings.cornerInset && t <= wall.tMax + settings.cornerReach;
        if (nearMin && nearMax)
        {
            // Short wall: pick the closer end.
            nearMin = Mathf.Abs(t - wall.tMin) <= Mathf.Abs(t - wall.tMax);
            nearMax = !nearMin;
        }

        if (nearMin)
        {
            end = 0;
            reach = Mathf.Max(0f, wall.tMin - t);
            return true;
        }

        if (nearMax)
        {
            end = 1;
            reach = Mathf.Max(0f, t - wall.tMax);
            return true;
        }

        return false;
    }

    /// <summary>An end of a wall that no corner closes yet: where the outline is still missing a corner.</summary>
    public struct OpenEnd
    {
        public int wall;
        public int end;
        public Vector2 point;
    }

    /// <summary>
    /// Ends of real walls (long enough, not furniture) that neither a found corner nor a
    /// hand-placed corner closes. A hand-placed corner closes an end when it sits on the
    /// wall's line, near or beyond that end.
    /// </summary>
    public static List<OpenEnd> FindOpenEnds(
        IReadOnlyList<Wall> walls,
        IReadOnlyList<Corner> corners,
        IReadOnlyList<Vector2> placedCorners,
        Settings settings,
        float minWallLength,
        float lineTolerance = 0.35f)
    {
        var closed = new HashSet<long>();
        foreach (var c in corners)
        {
            closed.Add(EndKey(c.wallA, c.endA));
            closed.Add(EndKey(c.wallB, c.endB));
        }

        var inner = FindInnerWalls(walls, settings);
        var open = new List<OpenEnd>();
        for (var w = 0; w < walls.Count; w++)
        {
            var wall = walls[w];
            if (inner[w] || wall.Length < minWallLength) continue;
            for (var end = 0; end < 2; end++)
            {
                if (closed.Contains(EndKey(w, end))) continue;
                if (IsClosedByPlaced(wall, end, placedCorners, settings, lineTolerance)) continue;
                open.Add(new OpenEnd { wall = w, end = end, point = wall.End(end) });
            }
        }

        return open;
    }

    static bool IsClosedByPlaced(Wall wall, int end, IReadOnlyList<Vector2> placed, Settings settings, float lineTolerance)
    {
        if (placed == null) return false;
        foreach (var p in placed)
        {
            if (wall.DistanceToLine(p) > lineTolerance) continue;
            var t = wall.Project(p);
            var near = end == 0
                ? t <= wall.tMin + settings.cornerInset && t >= wall.tMin - settings.cornerReach
                : t >= wall.tMax - settings.cornerInset && t <= wall.tMax + settings.cornerReach;
            if (near) return true;
        }

        return false;
    }

    /// <summary>
    /// Orders all corners into one outline. Corners joined by a wall follow each other
    /// (that keeps L-shaped rooms right); separate pieces and hand-placed corners are fitted in
    /// where they add the least perimeter. Falls back to angle order around
    /// <paramref name="center"/> if the result would cross itself.
    /// </summary>
    public static List<Vector2> OrderOutline(
        IReadOnlyList<Corner> corners,
        IReadOnlyList<Vector2> placed,
        Vector2 center)
    {
        var chains = BuildChains(corners);
        chains.Sort((x, y) => y.Count.CompareTo(x.Count));

        var outline = new List<Vector2>();
        if (chains.Count > 0)
        {
            outline.AddRange(chains[0]);
            for (var i = 1; i < chains.Count; i++)
                InsertBlock(outline, chains[i]);
        }

        if (placed != null)
        {
            foreach (var p in placed)
                InsertBlock(outline, new List<Vector2> { p });
        }

        if (outline.Count >= 4 && CrossesItself(outline))
        {
            var all = new List<Vector2>();
            foreach (var c in corners) all.Add(c.point);
            if (placed != null) all.AddRange(placed);
            var byAngle = OrderAround(all, center);
            if (!CrossesItself(byAngle)) return byAngle;
        }

        return outline;
    }

    /// <summary>Corners that share a wall are neighbours; each corner has at most two.</summary>
    static List<List<Vector2>> BuildChains(IReadOnlyList<Corner> corners)
    {
        var neighbours = new List<int>[corners.Count];
        for (var i = 0; i < corners.Count; i++) neighbours[i] = new List<int>();
        for (var i = 0; i < corners.Count; i++)
        {
            for (var j = i + 1; j < corners.Count; j++)
            {
                if (ShareWall(corners[i], corners[j]))
                {
                    neighbours[i].Add(j);
                    neighbours[j].Add(i);
                }
            }
        }

        var seen = new bool[corners.Count];
        var chains = new List<List<Vector2>>();
        // Start paths at their ends first so they come out in order; cycles are picked up after.
        for (var pass = 0; pass < 2; pass++)
        {
            for (var start = 0; start < corners.Count; start++)
            {
                if (seen[start]) continue;
                if (pass == 0 && neighbours[start].Count > 1) continue;

                var chain = new List<Vector2>();
                var prev = -1;
                var current = start;
                while (current >= 0 && !seen[current])
                {
                    seen[current] = true;
                    chain.Add(corners[current].point);
                    var next = -1;
                    foreach (var n in neighbours[current])
                    {
                        if (n != prev && !seen[n])
                        {
                            next = n;
                            break;
                        }
                    }

                    prev = current;
                    current = next;
                }

                chains.Add(chain);
            }
        }

        return chains;
    }

    static bool ShareWall(Corner a, Corner b) =>
        a.wallA == b.wallA || a.wallA == b.wallB || a.wallB == b.wallA || a.wallB == b.wallB;

    /// <summary>Inserts a run of points (either direction) at the edge where it adds the least perimeter.</summary>
    static void InsertBlock(List<Vector2> outline, List<Vector2> block)
    {
        if (block.Count == 0) return;
        if (outline.Count < 2)
        {
            outline.AddRange(block);
            return;
        }

        var bestCost = float.MaxValue;
        var bestIndex = 0;
        var bestReversed = false;
        for (var i = 0; i < outline.Count; i++)
        {
            var a = outline[i];
            var b = outline[(i + 1) % outline.Count];
            var removed = Vector2.Distance(a, b);
            for (var rev = 0; rev < 2; rev++)
            {
                var first = rev == 0 ? block[0] : block[block.Count - 1];
                var last = rev == 0 ? block[block.Count - 1] : block[0];
                var cost = Vector2.Distance(a, first) + Vector2.Distance(last, b) - removed;
                if (cost < bestCost)
                {
                    bestCost = cost;
                    bestIndex = i + 1;
                    bestReversed = rev == 1;
                }
            }
        }

        var run = new List<Vector2>(block);
        if (bestReversed) run.Reverse();
        outline.InsertRange(bestIndex, run);
    }

    /// <summary>True when two non-adjacent edges of the closed outline cross.</summary>
    public static bool CrossesItself(IReadOnlyList<Vector2> outline)
    {
        var n = outline.Count;
        if (n < 4) return false;
        for (var i = 0; i < n; i++)
        {
            var a = outline[i];
            var b = outline[(i + 1) % n];
            for (var j = i + 1; j < n; j++)
            {
                if (j == i + 1 || (i == 0 && j == n - 1)) continue;
                var c = outline[j];
                var d = outline[(j + 1) % n];
                if (Side(a, b, c) * Side(a, b, d) < 0f && Side(c, d, a) * Side(c, d, b) < 0f)
                    return true;
            }
        }

        return false;
    }

    static float Side(Vector2 o, Vector2 a, Vector2 b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    /// <summary>Orders points by angle around <paramref name="center"/> (counter-clockwise from +x).</summary>
    public static List<Vector2> OrderAround(IReadOnlyList<Vector2> points, Vector2 center)
    {
        var list = new List<Vector2>(points);
        list.Sort((p, q) =>
            Mathf.Atan2(p.y - center.y, p.x - center.x).CompareTo(Mathf.Atan2(q.y - center.y, q.x - center.x)));
        return list;
    }

    /// <summary>Moves a point onto the wall line, keeping it where it is along the wall.</summary>
    public static Vector2 SnapToLine(Wall wall, Vector2 p) => wall.PointAt(wall.Project(p));
}

/// <summary>
/// How a generated layout's room (the planner frame, centred) sits on the scanned room.
/// The backend's planner frame is the scan turned by <c>angle</c> radians (counter-clockwise from
/// x toward z, as its rotateXZ) and shifted so the outline's min corner is at 0,0; the AR shell is
/// that frame minus half the room. So world = turn(−angle)(shell + (w/2 + minX, d/2 + minZ)), and
/// turning by −angle on x/z is a Unity yaw of +angle. Pure math, checked without a phone.
/// </summary>
public static class ScanFrameMath
{
    public static bool TryBuild(float angle, float minX, float minZ, float width, float depth,
        IReadOnlyList<Vector3> scanCorners, IReadOnlyList<Vector3> shellCorners, float tolerance,
        out Matrix4x4 shellToWorld, out float yawDegrees)
    {
        yawDegrees = angle * Mathf.Rad2Deg;
        // A Unity yaw of θ turns (x, z) into (x cos θ + z sin θ, −x sin θ + z cos θ); written out so
        // the checks can run without the engine.
        var cos = Mathf.Cos(angle);
        var sin = Mathf.Sin(angle);
        var ox = width * 0.5f + minX;
        var oz = depth * 0.5f + minZ;

        var floorY = 0f;
        foreach (var p in scanCorners) floorY += p.y;
        floorY /= Mathf.Max(1, scanCorners.Count);
        var shellY = 0f;
        foreach (var p in shellCorners) shellY += p.y;
        shellY /= Mathf.Max(1, shellCorners.Count);

        shellToWorld = new Matrix4x4(
            new Vector4(cos, 0f, -sin, 0f),
            new Vector4(0f, 1f, 0f, 0f),
            new Vector4(sin, 0f, cos, 0f),
            new Vector4(ox * cos + oz * sin, floorY - shellY, -ox * sin + oz * cos, 1f));

        // Every shell corner must land on a scanned corner (any order): the same room, same place.
        foreach (var c in shellCorners)
        {
            var w = shellToWorld.MultiplyPoint3x4(c);
            var nearest = float.MaxValue;
            foreach (var s in scanCorners)
                nearest = Mathf.Min(nearest, new Vector2(w.x - s.x, w.z - s.z).magnitude);
            if (nearest > tolerance) return false;
        }

        return true;
    }
}

/// <summary>
/// Keeps the walls steady while ARCore keeps re-estimating its planes. The walls found from the
/// planes each round are matched to the walls already known: a match settles the known wall
/// gently toward it and can only make it longer, a new wall shows after it has been seen twice,
/// and a known wall stays when its plane drops out for a moment (a well-seen wall stays until
/// the scan starts over). Without this the blue lines jump, shrink and vanish as planes merge.
/// No AR types, so it is checked without a phone.
/// </summary>
public sealed class AutoWallTracker
{
    public struct Settings
    {
        public float matchAngleDegrees;
        /// <summary>Furthest a found wall's line may be from a known wall's line to match it (m).</summary>
        public float matchOffset;
        /// <summary>Furthest gap along the line between a found wall and a known wall that still matches (m).</summary>
        public float matchGap;
        /// <summary>How far a known wall moves toward a match each round (0–1).</summary>
        public float smoothing;
        /// <summary>Rounds a new wall must be seen in before it shows.</summary>
        public int confirmAfter;
        /// <summary>A wall that never showed goes after this many rounds unseen.</summary>
        public int dropUnconfirmedAfter;
        /// <summary>A wall seen at least this often stays until the scan starts over.</summary>
        public int keepAfterSeen;
        /// <summary>A shown wall seen less often goes after this many rounds unseen.</summary>
        public int dropWeakAfter;

        public static Settings Default => new()
        {
            matchAngleDegrees = 12f,
            matchOffset = 0.2f,
            matchGap = 0.6f,
            smoothing = 0.3f,
            confirmAfter = 2,
            dropUnconfirmedAfter = 2,
            keepAfterSeen = 8,
            dropWeakAfter = 40,
        };
    }

    sealed class Known
    {
        public AutoWallGeometry.Wall wall;
        public int seen;
        public int misses;
        public bool confirmed;
        public bool matched;
    }

    readonly Settings settings;
    readonly List<Known> known = new();

    public AutoWallTracker(Settings settings) => this.settings = settings;

    /// <summary>Walls known so far, shown or not.</summary>
    public int KnownCount => known.Count;

    public void Clear() => known.Clear();

    /// <summary>Takes this round's walls and returns the steady walls to use (copies).</summary>
    public List<AutoWallGeometry.Wall> Update(IReadOnlyList<AutoWallGeometry.Wall> found)
    {
        foreach (var k in known) k.matched = false;

        var order = new List<AutoWallGeometry.Wall>(found);
        order.Sort((x, y) => y.weight.CompareTo(x.weight));
        foreach (var wall in order)
        {
            if (wall == null || wall.Length <= 1e-4f) continue;
            var match = FindMatch(wall);
            if (match == null)
            {
                known.Add(new Known { wall = Copy(wall), seen = 1, matched = true });
                continue;
            }

            // A plane split into two walls this round still counts as one sighting.
            if (!match.matched)
            {
                match.seen++;
                match.misses = 0;
                match.matched = true;
            }

            Settle(match.wall, wall);
            if (match.seen >= settings.confirmAfter) match.confirmed = true;
        }

        for (var i = known.Count - 1; i >= 0; i--)
        {
            var k = known[i];
            if (k.matched) continue;
            k.misses++;
            var drop = k.confirmed
                ? k.seen < settings.keepAfterSeen && k.misses > settings.dropWeakAfter
                : k.misses > settings.dropUnconfirmedAfter;
            if (drop) known.RemoveAt(i);
        }

        MergeKnown();

        var result = new List<AutoWallGeometry.Wall>();
        foreach (var k in known)
        {
            if (k.confirmed) result.Add(Copy(k.wall));
        }

        return result;
    }

    Known FindMatch(AutoWallGeometry.Wall wall)
    {
        Known best = null;
        var bestOffset = float.MaxValue;
        foreach (var k in known)
        {
            if (!Matches(k.wall, wall, out var offset)) continue;
            // Prefer walls already shown, then the closest line.
            var score = offset - (k.confirmed ? 1f : 0f);
            if (score < bestOffset)
            {
                bestOffset = score;
                best = k;
            }
        }

        return best;
    }

    bool Matches(AutoWallGeometry.Wall a, AutoWallGeometry.Wall b, out float offset)
    {
        offset = float.MaxValue;
        var cosTol = Mathf.Cos(settings.matchAngleDegrees * Mathf.Deg2Rad);
        if (Vector2.Dot(a.normal, b.normal) < cosTol) return false;
        var mid = (b.End(0) + b.End(1)) * 0.5f;
        offset = a.DistanceToLine(mid);
        if (offset > settings.matchOffset) return false;
        var t0 = a.Project(b.End(0));
        var t1 = a.Project(b.End(1));
        return Mathf.Max(t0, t1) >= a.tMin - settings.matchGap && Mathf.Min(t0, t1) <= a.tMax + settings.matchGap;
    }

    /// <summary>Moves <paramref name="target"/> part way toward <paramref name="seen"/>; its seen part only grows.</summary>
    void Settle(AutoWallGeometry.Wall target, AutoWallGeometry.Wall seen)
    {
        var ends = new[] { target.End(0), target.End(1), seen.End(0), seen.End(1) };

        var normal = Vector2.Lerp(target.normal, seen.normal, settings.smoothing);
        if (normal.sqrMagnitude < 1e-6f) normal = target.normal;
        normal.Normalize();
        var offsetNow = Vector2.Dot(target.origin, target.normal);
        var offsetSeen = Vector2.Dot((seen.End(0) + seen.End(1)) * 0.5f, seen.normal);
        var offset = Mathf.Lerp(offsetNow, offsetSeen, settings.smoothing);

        var mid = (target.End(0) + target.End(1)) * 0.5f;
        target.normal = normal;
        target.dir = new Vector2(-normal.y, normal.x);
        target.origin = mid - normal * (Vector2.Dot(mid, normal) - offset);

        var tMin = float.MaxValue;
        var tMax = float.MinValue;
        foreach (var p in ends)
        {
            var t = target.Project(p);
            tMin = Mathf.Min(tMin, t);
            tMax = Mathf.Max(tMax, t);
        }

        target.tMin = tMin;
        target.tMax = tMax;
        target.weight = Mathf.Max(target.weight, seen.weight);
        target.pieceCount = Mathf.Max(target.pieceCount, seen.pieceCount);
    }

    /// <summary>Two known walls that have drifted onto the same line become one.</summary>
    void MergeKnown()
    {
        for (var i = 0; i < known.Count; i++)
        {
            for (var j = known.Count - 1; j > i; j--)
            {
                var a = known[i];
                var b = known[j];
                if (!Matches(a.wall, b.wall, out _)) continue;
                var keep = a.seen >= b.seen ? a : b;
                var gone = keep == a ? b : a;
                Settle(keep.wall, gone.wall);
                keep.seen = Mathf.Max(a.seen, b.seen);
                keep.confirmed |= gone.confirmed;
                keep.matched |= gone.matched;
                keep.misses = Mathf.Min(a.misses, b.misses);
                known[i] = keep;
                known.RemoveAt(j);
            }
        }
    }

    static AutoWallGeometry.Wall Copy(AutoWallGeometry.Wall w) => new()
    {
        origin = w.origin,
        dir = w.dir,
        normal = w.normal,
        tMin = w.tMin,
        tMax = w.tMax,
        weight = w.weight,
        pieceCount = w.pieceCount,
    };
}
