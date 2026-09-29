using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// Grid vertex-clustering decimation for layout exports. Catalog GLBs can carry millions of
/// triangles (100 MB+), which the React Native preview cannot load — this produces a
/// low-poly copy that keeps the silhouette. UVs are kept per cluster; normals are recomputed.
/// </summary>
public static class ExportMeshSimplifier
{
    const int MaxPasses = 4;
    const int AxisBits = 21;
    const int AxisMax = (1 << AxisBits) - 1;

    public static int CountTriangles(Mesh mesh)
    {
        if (mesh == null) return 0;
        long total = 0;
        for (var s = 0; s < mesh.subMeshCount; s++)
            total += mesh.GetIndexCount(s) / 3;
        return (int)Mathf.Min(total, int.MaxValue);
    }

    /// <summary>
    /// Returns a new mesh with roughly <paramref name="targetTriangles"/> triangles, or null when
    /// the source is already under budget / unreadable (caller should use the original).
    /// </summary>
    public static Mesh Simplify(Mesh source, int targetTriangles)
    {
        if (source == null || !source.isReadable) return null;
        targetTriangles = Mathf.Max(64, targetTriangles);

        var sourceTris = CountTriangles(source);
        if (sourceTris <= targetTriangles) return null;

        var vertices = source.vertices;
        if (vertices == null || vertices.Length == 0) return null;
        var uvs = source.uv;
        var hasUv = uvs != null && uvs.Length == vertices.Length;

        var submeshIndices = new int[source.subMeshCount][];
        for (var s = 0; s < submeshIndices.Length; s++)
            submeshIndices[s] = source.GetTriangles(s);

        var bounds = source.bounds;
        var area = SurfaceArea(vertices, submeshIndices);
        // Clustered surfaces yield ~2 triangles per occupied cell face.
        var cell = Mathf.Sqrt(2f * Mathf.Max(area, 1e-8f) / targetTriangles);
        var maxExtent = Mathf.Max(bounds.size.x, Mathf.Max(bounds.size.y, bounds.size.z));
        cell = Mathf.Max(cell, maxExtent / AxisMax + 1e-7f);

        Mesh result = null;
        for (var pass = 0; pass < MaxPasses; pass++)
        {
            if (result != null) Object.Destroy(result);
            result = Cluster(source.name, vertices, uvs, hasUv, submeshIndices, bounds.min, cell, out var tris);
            if (tris <= targetTriangles * 1.25f || tris == 0) break;
            cell *= Mathf.Sqrt((float)tris / targetTriangles) * 1.05f;
        }

        return result;
    }

    static Mesh Cluster(
        string name,
        Vector3[] vertices,
        Vector2[] uvs,
        bool hasUv,
        int[][] submeshIndices,
        Vector3 min,
        float cell,
        out int triangleCount)
    {
        var inv = 1f / cell;
        var clusterOf = new int[vertices.Length];
        var lookup = new Dictionary<long, int>(Mathf.Min(vertices.Length, 1 << 20));
        var sums = new List<Vector3>();
        var clusterUv = new List<Vector2>();
        var counts = new List<int>();

        for (var i = 0; i < vertices.Length; i++)
        {
            var v = vertices[i];
            long ix = Mathf.Clamp((int)((v.x - min.x) * inv), 0, AxisMax);
            long iy = Mathf.Clamp((int)((v.y - min.y) * inv), 0, AxisMax);
            long iz = Mathf.Clamp((int)((v.z - min.z) * inv), 0, AxisMax);
            var key = (ix << (AxisBits * 2)) | (iy << AxisBits) | iz;

            if (!lookup.TryGetValue(key, out var c))
            {
                c = sums.Count;
                lookup.Add(key, c);
                sums.Add(Vector3.zero);
                counts.Add(0);
                clusterUv.Add(hasUv ? uvs[i] : Vector2.zero);
            }

            sums[c] += v;
            counts[c]++;
            clusterOf[i] = c;
        }

        var outVertices = new Vector3[sums.Count];
        for (var c = 0; c < outVertices.Length; c++)
            outVertices[c] = sums[c] / counts[c];

        var mesh = new Mesh
        {
            name = $"{name}_lod",
            indexFormat = outVertices.Length > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16,
        };
        mesh.vertices = outVertices;
        if (hasUv) mesh.SetUVs(0, clusterUv);
        mesh.subMeshCount = submeshIndices.Length;

        triangleCount = 0;
        var seen = new HashSet<(int, int, int)>();
        var outIndices = new List<int>();
        for (var s = 0; s < submeshIndices.Length; s++)
        {
            outIndices.Clear();
            seen.Clear();
            var src = submeshIndices[s];
            for (var t = 0; t + 2 < src.Length; t += 3)
            {
                var a = clusterOf[src[t]];
                var b = clusterOf[src[t + 1]];
                var c = clusterOf[src[t + 2]];
                if (a == b || b == c || a == c) continue;
                if (!seen.Add(Canonical(a, b, c))) continue;
                outIndices.Add(a);
                outIndices.Add(b);
                outIndices.Add(c);
            }

            mesh.SetTriangles(outIndices, s, false);
            triangleCount += outIndices.Count / 3;
        }

        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return mesh;
    }

    static (int, int, int) Canonical(int a, int b, int c)
    {
        // Rotate so the smallest index leads — keeps winding, merges duplicate faces.
        if (a < b && a < c) return (a, b, c);
        if (b < c) return (b, c, a);
        return (c, a, b);
    }

    static float SurfaceArea(Vector3[] vertices, int[][] submeshIndices)
    {
        double area = 0;
        foreach (var indices in submeshIndices)
        {
            for (var t = 0; t + 2 < indices.Length; t += 3)
            {
                var a = vertices[indices[t]];
                var b = vertices[indices[t + 1]];
                var c = vertices[indices[t + 2]];
                area += Vector3.Cross(b - a, c - a).magnitude * 0.5;
            }
        }

        return (float)area;
    }
}
