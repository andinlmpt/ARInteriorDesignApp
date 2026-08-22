using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;

/// <summary>
/// Writes a self-contained binary glTF 2.0 (.glb) file from a set of Unity
/// meshes. Geometry, materials and textures are all packed into the single
/// binary chunk, so the result opens standalone in any glTF viewer with no
/// external file references.
///
/// WHY NOT glTFast / UnityGLTF?
/// Both are export-capable, but neither is currently in the project manifest and
/// glTFast's export module in particular pulls in extra dependencies. This scene
/// only ever exports plain triangle meshes with PBR-metallic-roughness materials,
/// which is a small enough subset to write directly and keeps ExportLayout()
/// working the day you build the APK. Swap in glTFast's exporter later if you
/// need skinning, animation or KHR extensions.
///
/// COORDINATE CONVERSION
/// Unity is left-handed (+X right, +Y up, +Z forward). glTF is right-handed with
/// +Z toward the viewer. Negating X converts between them; because mirroring one
/// axis reverses the handedness of the winding, triangle indices are also
/// reversed so front faces stay front faces.
/// </summary>
public static class GlbExporter
{
    /// <summary>One node in the exported file. The transform is baked into vertices.</summary>
    public struct Entry
    {
        public string name;
        public Mesh mesh;
        public Matrix4x4 localToWorld;

        /// <summary>Per-submesh materials. Missing entries fall back to <see cref="fallbackColor"/>.</summary>
        public Material[] materials;

        /// <summary>Room surfaces are exported double-sided — AR plane winding is not dependable.</summary>
        public bool doubleSided;

        public Color fallbackColor;
    }

    public sealed class Options
    {
        /// <summary>Subtracted from every vertex so the model sits near the origin instead of at AR world coordinates.</summary>
        public Vector3 originOffset = Vector3.zero;

        public bool embedTextures = true;
        public int maxTextureSize = 1024;
        public string generator = "ARInteriorDesignApp / GlbExporter";
    }

    public sealed class Result
    {
        public byte[] bytes;
        public int nodeCount;
        public int triangleCount;
        public readonly List<string> warnings = new();
    }

    const uint GlbMagic = 0x46546C67; // "glTF"
    const uint ChunkJson = 0x4E4F534A; // "JSON"
    const uint ChunkBin = 0x004E4942;  // "BIN"

    const int ComponentFloat = 5126;
    const int ComponentUnsignedInt = 5125;
    const int TargetArrayBuffer = 34962;
    const int TargetElementArrayBuffer = 34963;

    static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    public static Result Export(IReadOnlyList<Entry> entries, Options options = null)
    {
        options ??= new Options();

        var context = new Context(options);
        var result = new Result();

        foreach (var entry in entries)
        {
            if (entry.mesh == null)
                continue;

            if (!entry.mesh.isReadable)
            {
                result.warnings.Add(
                    $"'{entry.name}' skipped: mesh '{entry.mesh.name}' is not readable. " +
                    "Enable Read/Write in the model importer (AR Interior ▸ AR Design ▸ Enable Read-Write On Furniture Meshes).");
                continue;
            }

            var meshIndex = WriteMesh(context, entry, result);
            if (meshIndex < 0) continue;

            context.nodes.Add($"{{\"name\":{Quote(entry.name)},\"mesh\":{meshIndex}}}");
            result.nodeCount++;
        }

        if (result.nodeCount == 0)
        {
            result.warnings.Add("Nothing was exported — no readable meshes were supplied.");
            result.bytes = Array.Empty<byte>();
            return result;
        }

        result.triangleCount = context.triangleCount;
        result.bytes = Assemble(context, options);
        return result;
    }

    // ── Mesh ──────────────────────────────────────────────────────────────────

    static int WriteMesh(Context context, Entry entry, Result result)
    {
        var mesh = entry.mesh;
        var vertices = mesh.vertices;
        if (vertices.Length == 0) return -1;

        var normals = mesh.normals;
        var uvs = mesh.uv;
        var hasNormals = normals.Length == vertices.Length;
        var hasUvs = uvs.Length == vertices.Length;

        var matrix = entry.localToWorld;
        var normalMatrix = matrix.inverse.transpose;

        // A negative determinant already reverses winding, so the extra flip that
        // the handedness conversion needs cancels out.
        var reverseWinding = matrix.determinant >= 0f;

        var positionAccessor = WritePositions(context, vertices, matrix, context.options.originOffset);
        var normalAccessor = hasNormals
            ? WriteNormals(context, normals, normalMatrix)
            : -1;
        var uvAccessor = hasUvs ? WriteUvs(context, uvs) : -1;

        var primitives = new List<string>();

        for (var submesh = 0; submesh < mesh.subMeshCount; submesh++)
        {
            if (mesh.GetTopology(submesh) != MeshTopology.Triangles)
            {
                result.warnings.Add($"'{entry.name}' submesh {submesh} skipped: only triangle topology is supported.");
                continue;
            }

            var triangles = mesh.GetTriangles(submesh);
            if (triangles.Length < 3) continue;

            var indexAccessor = WriteIndices(context, triangles, reverseWinding, vertices.Length);
            context.triangleCount += triangles.Length / 3;

            var material = entry.materials != null && submesh < entry.materials.Length
                ? entry.materials[submesh]
                : null;

            var materialIndex = GetOrCreateMaterial(context, material, entry.fallbackColor, entry.doubleSided);

            var attributes = new StringBuilder();
            attributes.Append("\"POSITION\":").Append(positionAccessor);
            if (normalAccessor >= 0) attributes.Append(",\"NORMAL\":").Append(normalAccessor);
            if (uvAccessor >= 0) attributes.Append(",\"TEXCOORD_0\":").Append(uvAccessor);

            primitives.Add(
                $"{{\"attributes\":{{{attributes}}},\"indices\":{indexAccessor},\"material\":{materialIndex},\"mode\":4}}");
        }

        if (primitives.Count == 0) return -1;

        context.meshes.Add(
            $"{{\"name\":{Quote(entry.name)},\"primitives\":[{string.Join(",", primitives)}]}}");

        return context.meshes.Count - 1;
    }

    static int WritePositions(Context context, Vector3[] vertices, Matrix4x4 matrix, Vector3 originOffset)
    {
        var offset = context.BeginView();

        var min = new Vector3(float.MaxValue, float.MaxValue, float.MaxValue);
        var max = new Vector3(float.MinValue, float.MinValue, float.MinValue);

        foreach (var vertex in vertices)
        {
            var world = matrix.MultiplyPoint3x4(vertex) - originOffset;
            var p = new Vector3(-world.x, world.y, world.z);

            context.WriteFloat(p.x);
            context.WriteFloat(p.y);
            context.WriteFloat(p.z);

            min = Vector3.Min(min, p);
            max = Vector3.Max(max, p);
        }

        var view = context.EndView(offset, TargetArrayBuffer);

        return context.AddAccessor(
            view, ComponentFloat, vertices.Length, "VEC3",
            $",\"min\":[{F(min.x)},{F(min.y)},{F(min.z)}],\"max\":[{F(max.x)},{F(max.y)},{F(max.z)}]");
    }

    static int WriteNormals(Context context, Vector3[] normals, Matrix4x4 normalMatrix)
    {
        var offset = context.BeginView();

        foreach (var normal in normals)
        {
            var n = normalMatrix.MultiplyVector(normal);
            n = n.sqrMagnitude > 1e-8f ? n.normalized : Vector3.up;

            context.WriteFloat(-n.x);
            context.WriteFloat(n.y);
            context.WriteFloat(n.z);
        }

        var view = context.EndView(offset, TargetArrayBuffer);
        return context.AddAccessor(view, ComponentFloat, normals.Length, "VEC3");
    }

    static int WriteUvs(Context context, Vector2[] uvs)
    {
        var offset = context.BeginView();

        // glTF UV origin is top-left, Unity's is bottom-left.
        foreach (var uv in uvs)
        {
            context.WriteFloat(uv.x);
            context.WriteFloat(1f - uv.y);
        }

        var view = context.EndView(offset, TargetArrayBuffer);
        return context.AddAccessor(view, ComponentFloat, uvs.Length, "VEC2");
    }

    static int WriteIndices(Context context, int[] triangles, bool reverseWinding, int vertexCount)
    {
        var offset = context.BeginView();

        for (var i = 0; i + 2 < triangles.Length; i += 3)
        {
            var a = triangles[i];
            var b = triangles[i + 1];
            var c = triangles[i + 2];

            context.WriteUInt((uint)a);
            context.WriteUInt((uint)(reverseWinding ? c : b));
            context.WriteUInt((uint)(reverseWinding ? b : c));
        }

        var view = context.EndView(offset, TargetElementArrayBuffer);
        var count = triangles.Length / 3 * 3;

        return context.AddAccessor(view, ComponentUnsignedInt, count, "SCALAR");
    }

    // ── Materials ─────────────────────────────────────────────────────────────

    static int GetOrCreateMaterial(Context context, Material material, Color fallbackColor, bool doubleSided)
    {
        if (material == null)
            return GetOrCreateFallbackMaterial(context, fallbackColor, doubleSided);

        if (context.materialIndices.TryGetValue(material, out var existing))
            return existing;

        var baseColor = fallbackColor;
        if (material.HasProperty("_BaseColor")) baseColor = material.GetColor("_BaseColor");
        else if (material.HasProperty("_Color")) baseColor = material.GetColor("_Color");

        var metallic = material.HasProperty("_Metallic") ? material.GetFloat("_Metallic") : 0f;

        var smoothness = 0.15f;
        if (material.HasProperty("_Smoothness")) smoothness = material.GetFloat("_Smoothness");
        else if (material.HasProperty("_Glossiness")) smoothness = material.GetFloat("_Glossiness");

        var json = new StringBuilder();
        json.Append("{\"name\":").Append(Quote(string.IsNullOrEmpty(material.name) ? "Material" : material.name));
        json.Append(",\"doubleSided\":").Append(doubleSided ? "true" : "false");
        json.Append(",\"pbrMetallicRoughness\":{");
        json.Append("\"baseColorFactor\":[")
            .Append(F(baseColor.r)).Append(',')
            .Append(F(baseColor.g)).Append(',')
            .Append(F(baseColor.b)).Append(',')
            .Append(F(baseColor.a)).Append(']');
        json.Append(",\"metallicFactor\":").Append(F(Mathf.Clamp01(metallic)));
        json.Append(",\"roughnessFactor\":").Append(F(Mathf.Clamp01(1f - smoothness)));

        var textureIndex = context.options.embedTextures
            ? GetOrCreateTexture(context, ResolveBaseTexture(material))
            : -1;

        if (textureIndex >= 0)
            json.Append(",\"baseColorTexture\":{\"index\":").Append(textureIndex).Append(",\"texCoord\":0}");

        json.Append('}');

        if (baseColor.a < 0.999f)
            json.Append(",\"alphaMode\":\"BLEND\"");

        json.Append('}');

        context.materials.Add(json.ToString());
        var index = context.materials.Count - 1;
        context.materialIndices[material] = index;
        return index;
    }

    static int GetOrCreateFallbackMaterial(Context context, Color color, bool doubleSided)
    {
        var key = $"{ColorUtility.ToHtmlStringRGBA(color)}:{doubleSided}";
        if (context.fallbackMaterialIndices.TryGetValue(key, out var existing))
            return existing;

        context.materials.Add(
            $"{{\"name\":\"Surface_{ColorUtility.ToHtmlStringRGB(color)}\"," +
            $"\"doubleSided\":{(doubleSided ? "true" : "false")}," +
            $"\"pbrMetallicRoughness\":{{\"baseColorFactor\":[{F(color.r)},{F(color.g)},{F(color.b)},{F(color.a)}]," +
            "\"metallicFactor\":0,\"roughnessFactor\":0.9}}");

        var index = context.materials.Count - 1;
        context.fallbackMaterialIndices[key] = index;
        return index;
    }

    static Texture ResolveBaseTexture(Material material)
    {
        if (material.HasProperty("_BaseMap")) return material.GetTexture("_BaseMap");
        if (material.HasProperty("_MainTex")) return material.GetTexture("_MainTex");
        return null;
    }

    static int GetOrCreateTexture(Context context, Texture texture)
    {
        if (texture == null) return -1;
        if (context.textureIndices.TryGetValue(texture, out var existing)) return existing;

        var png = EncodeToPng(texture, context.options.maxTextureSize);
        if (png == null || png.Length == 0)
        {
            context.textureIndices[texture] = -1;
            return -1;
        }

        var offset = context.BeginView();
        context.bin.Write(png, 0, png.Length);
        var view = context.EndView(offset, null);

        context.images.Add($"{{\"mimeType\":\"image/png\",\"bufferView\":{view}}}");
        context.textures.Add($"{{\"sampler\":0,\"source\":{context.images.Count - 1}}}");

        var index = context.textures.Count - 1;
        context.textureIndices[texture] = index;
        return index;
    }

    /// <summary>
    /// Blits through a RenderTexture so this works for compressed and
    /// non-readable textures too — the common case for imported FBX materials.
    /// </summary>
    static byte[] EncodeToPng(Texture source, int maxSize)
    {
        var width = Mathf.Max(1, Mathf.Min(source.width, maxSize));
        var height = Mathf.Max(1, Mathf.Min(source.height, maxSize));

        RenderTexture renderTexture = null;
        Texture2D readback = null;
        var previous = RenderTexture.active;

        try
        {
            renderTexture = RenderTexture.GetTemporary(
                width, height, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);

            Graphics.Blit(source, renderTexture);
            RenderTexture.active = renderTexture;

            readback = new Texture2D(width, height, TextureFormat.RGBA32, false);
            readback.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            readback.Apply(false, false);

            return readback.EncodeToPNG();
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[GlbExporter] Could not encode texture '{source.name}': {e.Message}");
            return null;
        }
        finally
        {
            RenderTexture.active = previous;
            if (renderTexture != null) RenderTexture.ReleaseTemporary(renderTexture);
            if (readback != null) UnityEngine.Object.Destroy(readback);
        }
    }

    // ── File assembly ─────────────────────────────────────────────────────────

    static byte[] Assemble(Context context, Options options)
    {
        var binBytes = context.bin.ToArray();

        var json = new StringBuilder();
        json.Append("{\"asset\":{\"version\":\"2.0\",\"generator\":").Append(Quote(options.generator)).Append('}');
        json.Append(",\"scene\":0");

        var nodeIndices = new string[context.nodes.Count];
        for (var i = 0; i < nodeIndices.Length; i++)
            nodeIndices[i] = i.ToString(Invariant);

        json.Append(",\"scenes\":[{\"name\":\"RoomDesign\",\"nodes\":[").Append(string.Join(",", nodeIndices)).Append("]}]");
        json.Append(",\"nodes\":[").Append(string.Join(",", context.nodes)).Append(']');
        json.Append(",\"meshes\":[").Append(string.Join(",", context.meshes)).Append(']');
        json.Append(",\"materials\":[").Append(string.Join(",", context.materials)).Append(']');

        if (context.images.Count > 0)
        {
            json.Append(",\"samplers\":[{\"magFilter\":9729,\"minFilter\":9987,\"wrapS\":10497,\"wrapT\":10497}]");
            json.Append(",\"images\":[").Append(string.Join(",", context.images)).Append(']');
            json.Append(",\"textures\":[").Append(string.Join(",", context.textures)).Append(']');
        }

        json.Append(",\"accessors\":[").Append(string.Join(",", context.accessors)).Append(']');
        json.Append(",\"bufferViews\":[").Append(string.Join(",", context.bufferViews)).Append(']');
        json.Append(",\"buffers\":[{\"byteLength\":").Append(binBytes.Length).Append("}]");
        json.Append('}');

        var jsonBytes = Encoding.UTF8.GetBytes(json.ToString());
        var jsonPadding = (4 - jsonBytes.Length % 4) % 4;
        var binPadding = (4 - binBytes.Length % 4) % 4;

        var totalLength = 12
                          + 8 + jsonBytes.Length + jsonPadding
                          + 8 + binBytes.Length + binPadding;

        using var stream = new MemoryStream(totalLength);
        using var writer = new BinaryWriter(stream);

        writer.Write(GlbMagic);
        writer.Write(2u);
        writer.Write((uint)totalLength);

        writer.Write((uint)(jsonBytes.Length + jsonPadding));
        writer.Write(ChunkJson);
        writer.Write(jsonBytes);
        for (var i = 0; i < jsonPadding; i++) writer.Write((byte)0x20); // JSON pads with spaces

        writer.Write((uint)(binBytes.Length + binPadding));
        writer.Write(ChunkBin);
        writer.Write(binBytes);
        for (var i = 0; i < binPadding; i++) writer.Write((byte)0x00);

        writer.Flush();
        return stream.ToArray();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    static string F(float value)
    {
        if (float.IsNaN(value) || float.IsInfinity(value)) value = 0f;
        return value.ToString("R", Invariant);
    }

    static string Quote(string value)
    {
        if (string.IsNullOrEmpty(value)) return "\"\"";

        var builder = new StringBuilder(value.Length + 2);
        builder.Append('"');

        foreach (var c in value)
        {
            switch (c)
            {
                case '"': builder.Append("\\\""); break;
                case '\\': builder.Append("\\\\"); break;
                case '\b': builder.Append("\\b"); break;
                case '\f': builder.Append("\\f"); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                default:
                    if (c < 0x20 || c > 0x7E)
                        builder.Append("\\u").Append(((int)c).ToString("x4", Invariant));
                    else
                        builder.Append(c);
                    break;
            }
        }

        builder.Append('"');
        return builder.ToString();
    }

    sealed class Context
    {
        public readonly Options options;
        public readonly MemoryStream bin = new();

        public readonly List<string> bufferViews = new();
        public readonly List<string> accessors = new();
        public readonly List<string> meshes = new();
        public readonly List<string> nodes = new();
        public readonly List<string> materials = new();
        public readonly List<string> images = new();
        public readonly List<string> textures = new();

        public readonly Dictionary<Material, int> materialIndices = new();
        public readonly Dictionary<string, int> fallbackMaterialIndices = new();
        public readonly Dictionary<Texture, int> textureIndices = new();

        public int triangleCount;

        readonly BinaryWriter writer;

        public Context(Options options)
        {
            this.options = options;
            writer = new BinaryWriter(bin);
        }

        public int BeginView()
        {
            Align4();
            return (int)bin.Length;
        }

        public int EndView(int offset, int? target)
        {
            var length = (int)bin.Length - offset;
            var targetJson = target.HasValue ? $",\"target\":{target.Value}" : string.Empty;

            bufferViews.Add(
                $"{{\"buffer\":0,\"byteOffset\":{offset},\"byteLength\":{length}{targetJson}}}");

            return bufferViews.Count - 1;
        }

        public int AddAccessor(int bufferView, int componentType, int count, string type, string extra = "")
        {
            accessors.Add(
                $"{{\"bufferView\":{bufferView},\"componentType\":{componentType}," +
                $"\"count\":{count},\"type\":\"{type}\"{extra}}}");

            return accessors.Count - 1;
        }

        public void WriteFloat(float value) => writer.Write(value);

        public void WriteUInt(uint value) => writer.Write(value);

        void Align4()
        {
            while (bin.Length % 4 != 0)
                bin.WriteByte(0);
        }
    }
}
