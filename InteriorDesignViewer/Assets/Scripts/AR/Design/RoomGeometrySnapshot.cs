using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// An immutable copy of the room geometry captured at the moment the user
/// confirmed their scan. Everything is baked into world space so the snapshot
/// stays valid even if ARCore later re-fits, merges, or removes the planes it
/// was built from.
///
/// Geometry sources, in order of preference:
///   1. ARPlane boundary polygons — floor, walls and ceiling. This is the only
///      source that actually produces geometry on ARCore today (see below).
///   2. ARMeshManager chunks — richer reconstruction, but AR Foundation has no
///      meshing provider for ARCore. Included so the snapshot upgrades for free
///      on any platform whose provider does implement XRMeshSubsystem.
///
/// The meshes here are runtime-created, therefore always readable, which is
/// what GlbExporter needs.
/// </summary>
public sealed class RoomGeometrySnapshot
{
    public enum SurfaceKind
    {
        Floor,
        Wall,
        Ceiling,
        Other,
        ReconstructedMesh,
    }

    public sealed class Surface
    {
        public string name;
        public SurfaceKind kind;
        public Mesh mesh;
        public Color color;
        /// <summary>For walls: unit normal pointing outside the room (used by orbit cutaway).</summary>
        public Vector3 outwardNormal;
        /// <summary>For walls: midpoint of the wall segment.</summary>
        public Vector3 midpoint;
    }

    public readonly List<Surface> surfaces = new();

    public int planeCount;
    public int meshChunkCount;
    public int vertexCount;
    public int triangleCount;

    /// <summary>World-space bounds of everything captured. Invalid when surfaces is empty.</summary>
    public Bounds bounds;
    public bool hasBounds;

    /// <summary>Lowest floor Y seen during the scan — used to sit the export on Y=0.</summary>
    public float floorY;

    public bool IsEmpty => surfaces.Count == 0;

    /// <summary>Runtime meshes are not garbage collected — release them when re-scanning.</summary>
    public void Dispose()
    {
        foreach (var surface in surfaces)
        {
            if (surface.mesh != null)
                Object.Destroy(surface.mesh);
        }

        surfaces.Clear();
        planeCount = 0;
        meshChunkCount = 0;
        vertexCount = 0;
        triangleCount = 0;
        hasBounds = false;
    }
}

/// <summary>
/// Converts live AR trackables into a <see cref="RoomGeometrySnapshot"/>.
/// </summary>
public static class RoomGeometryBuilder
{
    // Planner-style palette: checkered floor + walls share the same light grid look.
    static readonly Color FloorColor = new(0.94f, 0.93f, 0.90f, 1f);
    static readonly Color WallColor = new(0.94f, 0.93f, 0.90f, 1f);
    static readonly Color CeilingColor = new(0.96f, 0.96f, 0.96f, 1f);
    static readonly Color MeshColor = new(0.70f, 0.72f, 0.75f, 1f);

    const float DefaultWallHeight = 2.4f;
    const float MinWallAreaForSkipExtrude = 1.5f;

    /// <summary>
    /// Builds a clean rectangular-ish room shell from ordered floor corner taps
    /// (ARPlan-style corner-to-corner outline).
    /// </summary>
    public static RoomGeometrySnapshot CaptureFromFloorCorners(
        IReadOnlyList<Vector3> floorCorners,
        float wallHeight = DefaultWallHeight)
    {
        var snapshot = new RoomGeometrySnapshot { floorY = float.PositiveInfinity };
        if (floorCorners == null || floorCorners.Count < 3)
            return snapshot;

        var ring = new Vector3[floorCorners.Count];
        for (var i = 0; i < floorCorners.Count; i++)
        {
            ring[i] = floorCorners[i];
            snapshot.floorY = Mathf.Min(snapshot.floorY, floorCorners[i].y);
        }

        // Flatten to a single floor height so walls stand vertical.
        var floorY = snapshot.floorY;
        for (var i = 0; i < ring.Length; i++)
            ring[i].y = floorY;

        var floor = new GeometryAccumulator();

        // Floor fan — force upward-facing triangles regardless of corner tap order.
        var floorBase = floor.vertices.Count;
        for (var i = 0; i < ring.Length; i++)
        {
            floor.vertices.Add(ring[i]);
            floor.normals.Add(Vector3.up);
            floor.uvs.Add(new Vector2(ring[i].x, ring[i].z));
        }

        // Shoelace in XZ: > 0 means counter-clockwise when viewed from above.
        var signedArea = 0f;
        for (var i = 0; i < ring.Length; i++)
        {
            var a = ring[i];
            var b = ring[(i + 1) % ring.Length];
            signedArea += a.x * b.z - b.x * a.z;
        }

        var ccw = signedArea > 0f;
        for (var i = 1; i < ring.Length - 1; i++)
        {
            if (ccw)
            {
                floor.triangles.Add(floorBase);
                floor.triangles.Add(floorBase + i);
                floor.triangles.Add(floorBase + i + 1);
            }
            else
            {
                floor.triangles.Add(floorBase);
                floor.triangles.Add(floorBase + i + 1);
                floor.triangles.Add(floorBase + i);
            }
        }

        // Double-sided floor so orbit from any angle still shows the grid.
        var dualBase = floor.vertices.Count;
        for (var i = 0; i < ring.Length; i++)
        {
            floor.vertices.Add(ring[i]);
            floor.normals.Add(Vector3.down);
            floor.uvs.Add(new Vector2(ring[i].x, ring[i].z));
        }

        for (var i = 1; i < ring.Length - 1; i++)
        {
            if (ccw)
            {
                floor.triangles.Add(dualBase);
                floor.triangles.Add(dualBase + i + 1);
                floor.triangles.Add(dualBase + i);
            }
            else
            {
                floor.triangles.Add(dualBase);
                floor.triangles.Add(dualBase + i);
                floor.triangles.Add(dualBase + i + 1);
            }
        }

        // Walls extruded from each edge — one surface per wall for orbit cutaway.
        var centroid = Vector3.zero;
        for (var i = 0; i < ring.Length; i++)
            centroid += ring[i];
        centroid /= ring.Length;

        AddSurface(snapshot, floor, "Room_Floor", RoomGeometrySnapshot.SurfaceKind.Floor, FloorColor);

        var wallIndex = 0;
        for (var i = 0; i < ring.Length; i++)
        {
            var a = ring[i];
            var b = ring[(i + 1) % ring.Length];
            var aTop = a + Vector3.up * wallHeight;
            var bTop = b + Vector3.up * wallHeight;

            var edge = b - a;
            edge.y = 0f;
            if (edge.sqrMagnitude < 1e-6f) continue;

            // Inward normal first (faces room center), then flip for outward.
            var inward = Vector3.Cross(Vector3.up, edge.normalized).normalized;
            var mid = (a + b) * 0.5f;
            var toCenter = centroid - mid;
            toCenter.y = 0f;
            if (Vector3.Dot(inward, toCenter) < 0f)
                inward = -inward;
            var outward = -inward;

            var wall = new GeometryAccumulator();
            wall.vertices.Add(a);
            wall.vertices.Add(b);
            wall.vertices.Add(bTop);
            wall.vertices.Add(aTop);

            for (var n = 0; n < 4; n++)
                wall.normals.Add(inward);

            wall.uvs.Add(new Vector2(0f, 0f));
            wall.uvs.Add(new Vector2(1f, 0f));
            wall.uvs.Add(new Vector2(1f, 1f));
            wall.uvs.Add(new Vector2(0f, 1f));

            // Both faces so cutaway still looks solid from either side when visible.
            wall.triangles.Add(0);
            wall.triangles.Add(1);
            wall.triangles.Add(2);
            wall.triangles.Add(0);
            wall.triangles.Add(2);
            wall.triangles.Add(3);
            wall.triangles.Add(0);
            wall.triangles.Add(2);
            wall.triangles.Add(1);
            wall.triangles.Add(0);
            wall.triangles.Add(3);
            wall.triangles.Add(2);

            var wallMid = mid + Vector3.up * (wallHeight * 0.5f);
            AddSurface(snapshot, wall, $"Room_Wall_{wallIndex++}", RoomGeometrySnapshot.SurfaceKind.Wall, WallColor,
                outward, wallMid);
        }

        // Ceiling — same footprint as the floor, raised to wall height.
        var ceiling = new GeometryAccumulator();
        var ceilingY = floorY + wallHeight;
        var ceilingBase = ceiling.vertices.Count;
        for (var i = 0; i < ring.Length; i++)
        {
            var p = ring[i];
            p.y = ceilingY;
            ceiling.vertices.Add(p);
            ceiling.normals.Add(Vector3.down); // interior face
            ceiling.uvs.Add(new Vector2(p.x, p.z));
        }

        // From below, downward normals need opposite winding to the floor's upward face.
        for (var i = 1; i < ring.Length - 1; i++)
        {
            if (ccw)
            {
                ceiling.triangles.Add(ceilingBase);
                ceiling.triangles.Add(ceilingBase + i + 1);
                ceiling.triangles.Add(ceilingBase + i);
            }
            else
            {
                ceiling.triangles.Add(ceilingBase);
                ceiling.triangles.Add(ceilingBase + i);
                ceiling.triangles.Add(ceilingBase + i + 1);
            }
        }

        // Double-sided so the roof reads from above when cutaway leaves it visible.
        var ceilingDual = ceiling.vertices.Count;
        for (var i = 0; i < ring.Length; i++)
        {
            var p = ring[i];
            p.y = ceilingY;
            ceiling.vertices.Add(p);
            ceiling.normals.Add(Vector3.up);
            ceiling.uvs.Add(new Vector2(p.x, p.z));
        }

        for (var i = 1; i < ring.Length - 1; i++)
        {
            if (ccw)
            {
                ceiling.triangles.Add(ceilingDual);
                ceiling.triangles.Add(ceilingDual + i);
                ceiling.triangles.Add(ceilingDual + i + 1);
            }
            else
            {
                ceiling.triangles.Add(ceilingDual);
                ceiling.triangles.Add(ceilingDual + i + 1);
                ceiling.triangles.Add(ceilingDual + i);
            }
        }

        var ceilingMid = new Vector3(centroid.x, ceilingY, centroid.z);
        AddSurface(snapshot, ceiling, "Room_Ceiling", RoomGeometrySnapshot.SurfaceKind.Ceiling, CeilingColor,
            Vector3.up, ceilingMid);

        snapshot.planeCount = 1;
        return snapshot;
    }

    /// <summary>
    /// Captures the current room geometry.
    /// </summary>
    public static RoomGeometrySnapshot Capture(
        ARPlaneManager planeManager,
        ARMeshManager meshManager,
        int maxMeshChunks = 96,
        float minPlaneArea = 0.08f)
    {
        var snapshot = new RoomGeometrySnapshot { floorY = float.PositiveInfinity };

        var floor = new GeometryAccumulator();
        var walls = new GeometryAccumulator();
        var ceiling = new GeometryAccumulator();
        var other = new GeometryAccumulator();

        ARPlane largestFloor = null;
        var largestFloorArea = 0f;
        var verticalArea = 0f;

        if (planeManager != null)
        {
            foreach (var plane in planeManager.trackables)
            {
                if (plane == null) continue;
                if (plane.trackingState == TrackingState.None) continue;
                if (plane.size.x * plane.size.y < minPlaneArea) continue;
                if (plane.subsumedBy != null) continue;

                var area = plane.size.x * plane.size.y;

                var target = plane.alignment switch
                {
                    PlaneAlignment.HorizontalUp => floor,
                    PlaneAlignment.HorizontalDown => ceiling,
                    PlaneAlignment.Vertical => walls,
                    _ => other,
                };

                if (!AppendPlane(plane, target)) continue;

                snapshot.planeCount++;

                if (plane.alignment == PlaneAlignment.HorizontalUp)
                {
                    snapshot.floorY = Mathf.Min(snapshot.floorY, plane.transform.position.y);
                    if (area > largestFloorArea)
                    {
                        largestFloorArea = area;
                        largestFloor = plane;
                    }
                }
                else if (plane.alignment == PlaneAlignment.Vertical)
                {
                    verticalArea += area;
                }
            }
        }

        // When ARCore has little vertical geometry, extrude walls from the main
        // floor outline so the confirmed layout still reads as a room shell.
        if (verticalArea < MinWallAreaForSkipExtrude && largestFloor != null)
            AppendExtrudedWalls(largestFloor, walls, DefaultWallHeight);

        AddSurface(snapshot, floor, "Room_Floor", RoomGeometrySnapshot.SurfaceKind.Floor, FloorColor);
        AddSurface(snapshot, walls, "Room_Walls", RoomGeometrySnapshot.SurfaceKind.Wall, WallColor);
        AddSurface(snapshot, ceiling, "Room_Ceiling", RoomGeometrySnapshot.SurfaceKind.Ceiling, CeilingColor);
        AddSurface(snapshot, other, "Room_Surfaces", RoomGeometrySnapshot.SurfaceKind.Other, WallColor);

        AppendReconstructedMesh(snapshot, meshManager, maxMeshChunks);

        if (float.IsPositiveInfinity(snapshot.floorY))
            snapshot.floorY = snapshot.hasBounds ? snapshot.bounds.min.y : 0f;

        return snapshot;
    }

    /// <summary>
    /// Builds vertical wall quads along the floor boundary polygon.
    /// </summary>
    static void AppendExtrudedWalls(ARPlane floorPlane, GeometryAccumulator walls, float wallHeight)
    {
        var boundary = floorPlane.boundary;
        if (!boundary.IsCreated || boundary.Length < 3) return;

        var localToWorld = floorPlane.transform.localToWorldMatrix;
        var count = boundary.Length;
        var ring = new Vector3[count];

        for (var i = 0; i < count; i++)
        {
            var b = boundary[i];
            ring[i] = localToWorld.MultiplyPoint3x4(new Vector3(b.x, 0f, b.y));
        }

        for (var i = 0; i < count; i++)
        {
            var a = ring[i];
            var b = ring[(i + 1) % count];
            var aTop = a + Vector3.up * wallHeight;
            var bTop = b + Vector3.up * wallHeight;

            var edge = b - a;
            edge.y = 0f;
            if (edge.sqrMagnitude < 1e-6f) continue;

            var normal = Vector3.Cross(Vector3.up, edge.normalized).normalized;
            // Face inward toward floor centroid roughly — flip if needed.
            var mid = (a + b) * 0.5f;
            var toCenter = floorPlane.transform.position - mid;
            toCenter.y = 0f;
            if (Vector3.Dot(normal, toCenter) < 0f)
                normal = -normal;

            var baseIndex = walls.vertices.Count;
            walls.vertices.Add(a);
            walls.vertices.Add(b);
            walls.vertices.Add(bTop);
            walls.vertices.Add(aTop);

            for (var n = 0; n < 4; n++)
                walls.normals.Add(normal);

            walls.uvs.Add(new Vector2(0f, 0f));
            walls.uvs.Add(new Vector2(1f, 0f));
            walls.uvs.Add(new Vector2(1f, 1f));
            walls.uvs.Add(new Vector2(0f, 1f));

            walls.triangles.Add(baseIndex);
            walls.triangles.Add(baseIndex + 1);
            walls.triangles.Add(baseIndex + 2);
            walls.triangles.Add(baseIndex);
            walls.triangles.Add(baseIndex + 2);
            walls.triangles.Add(baseIndex + 3);
        }
    }

    /// <summary>
    /// Fan-triangulates an ARPlane's boundary polygon into world space.
    /// ARCore boundaries are convex, so a triangle fan is exact.
    /// </summary>
    static bool AppendPlane(ARPlane plane, GeometryAccumulator target)
    {
        var boundary = plane.boundary;
        if (!boundary.IsCreated || boundary.Length < 3)
            return false;

        var localToWorld = plane.transform.localToWorldMatrix;
        var normal = plane.transform.up;
        var baseIndex = target.vertices.Count;

        for (var i = 0; i < boundary.Length; i++)
        {
            var b = boundary[i];
            target.vertices.Add(localToWorld.MultiplyPoint3x4(new Vector3(b.x, 0f, b.y)));
            target.normals.Add(normal);
            target.uvs.Add(new Vector2(b.x, b.y));
        }

        for (var i = 1; i < boundary.Length - 1; i++)
        {
            target.triangles.Add(baseIndex);
            target.triangles.Add(baseIndex + i);
            target.triangles.Add(baseIndex + i + 1);
        }

        return true;
    }

    /// <summary>
    /// Copies whatever the meshing subsystem produced. ARMeshManager parents its
    /// generated chunks under its own transform, so walking children avoids
    /// depending on provider-specific change events.
    /// </summary>
    static void AppendReconstructedMesh(RoomGeometrySnapshot snapshot, ARMeshManager meshManager, int maxMeshChunks)
    {
        if (meshManager == null) return;

        var accumulator = new GeometryAccumulator();
        var chunks = meshManager.GetComponentsInChildren<MeshFilter>();

        foreach (var filter in chunks)
        {
            if (snapshot.meshChunkCount >= maxMeshChunks) break;
            if (filter == null || filter.sharedMesh == null) continue;

            var mesh = filter.sharedMesh;
            if (!mesh.isReadable) continue;

            var localToWorld = filter.transform.localToWorldMatrix;
            var vertices = mesh.vertices;
            var normals = mesh.normals;
            var triangles = mesh.triangles;
            if (vertices.Length == 0 || triangles.Length == 0) continue;

            var baseIndex = accumulator.vertices.Count;
            var hasNormals = normals.Length == vertices.Length;

            for (var i = 0; i < vertices.Length; i++)
            {
                accumulator.vertices.Add(localToWorld.MultiplyPoint3x4(vertices[i]));
                accumulator.normals.Add(hasNormals
                    ? localToWorld.MultiplyVector(normals[i]).normalized
                    : Vector3.up);
                accumulator.uvs.Add(Vector2.zero);
            }

            for (var i = 0; i < triangles.Length; i++)
                accumulator.triangles.Add(baseIndex + triangles[i]);

            snapshot.meshChunkCount++;
        }

        AddSurface(snapshot, accumulator, "Room_ScanMesh",
            RoomGeometrySnapshot.SurfaceKind.ReconstructedMesh, MeshColor);
    }

    static void AddSurface(
        RoomGeometrySnapshot snapshot,
        GeometryAccumulator accumulator,
        string name,
        RoomGeometrySnapshot.SurfaceKind kind,
        Color color,
        Vector3 outwardNormal = default,
        Vector3 midpoint = default)
    {
        if (accumulator.triangles.Count == 0) return;

        var mesh = new Mesh { name = name };
        if (accumulator.vertices.Count > 65000)
            mesh.indexFormat = IndexFormat.UInt32;

        mesh.SetVertices(accumulator.vertices);
        mesh.SetNormals(accumulator.normals);
        mesh.SetUVs(0, accumulator.uvs);
        mesh.SetTriangles(accumulator.triangles, 0);
        mesh.RecalculateBounds();

        snapshot.surfaces.Add(new RoomGeometrySnapshot.Surface
        {
            name = name,
            kind = kind,
            mesh = mesh,
            color = color,
            outwardNormal = outwardNormal,
            midpoint = midpoint,
        });

        snapshot.vertexCount += accumulator.vertices.Count;
        snapshot.triangleCount += accumulator.triangles.Count / 3;

        if (!snapshot.hasBounds)
        {
            snapshot.bounds = mesh.bounds;
            snapshot.hasBounds = true;
        }
        else
        {
            var b = snapshot.bounds;
            b.Encapsulate(mesh.bounds);
            snapshot.bounds = b;
        }
    }

    sealed class GeometryAccumulator
    {
        public readonly List<Vector3> vertices = new();
        public readonly List<Vector3> normals = new();
        public readonly List<Vector2> uvs = new();
        public readonly List<int> triangles = new();
    }
}
