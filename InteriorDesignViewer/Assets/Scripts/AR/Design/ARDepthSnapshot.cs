using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// A copy of one ARCore depth image plus the camera pose it was taken with, so screen points
/// can be turned into world points after the phone has moved on (e.g. once object detection
/// on that frame finishes).
///
/// Screen → depth pixel uses the camera frame's display matrix, the transform the ARCore
/// background shader applies to the camera and depth textures. Which entries of the 4×4 hold
/// that 2D transform isn't something to guess at: the layout is chosen as the one that keeps
/// the screen's corners inside the depth image (the screen always shows part of the image).
/// ARCore depth is distance along the camera's forward axis, in millimetres; 0 = no estimate.
/// </summary>
public sealed class ARDepthSnapshot
{
    /// <summary>Depth beyond this is too noisy to place furniture with.</summary>
    public const float MaxUsefulMetres = 6f;

    int width;
    int height;
    ushort[] millimetres = new ushort[0];
    readonly ushort[] patch = new ushort[9];
    Matrix4x4 displayMatrix;
    Vector3 origin, forward, nearBottomLeft, nearBottomRight, nearTopLeft;

    /// <summary>How the display matrix is read: (u, v) as a row or column vector, translation in the third or fourth slot.</summary>
    public enum MatrixLayout { None, RowVector, RowVectorW, ColumnVector, ColumnVectorW }

    static readonly MatrixLayout[] Layouts =
        { MatrixLayout.RowVector, MatrixLayout.ColumnVector, MatrixLayout.RowVectorW, MatrixLayout.ColumnVectorW };
    static readonly Vector2[] ViewportCorners = { new(0f, 0f), new(1f, 0f), new(0f, 1f), new(1f, 1f) };

    public bool IsValid { get; private set; }
    public MatrixLayout Layout { get; private set; }
    public Matrix4x4 DisplayMatrix => displayMatrix;
    public int Width => width;
    public int Height => height;

    /// <summary>
    /// ARCore depth is not started at all. Its own depth thread ("ms_depth") crashed the app when a
    /// room was confirmed (2026-10-22, and 2026-10-24 even with depth switched off first), always
    /// inside ARCore. Without it, found furniture is placed by the floor ray and fitted to the walls.
    /// The user chose this on 2026-10-24; set true to bring depth back.
    /// </summary>
    public static readonly bool DepthEnabled = false;

    /// <summary>
    /// Adds an AROcclusionManager to the AR camera if there isn't one, asking for environment
    /// depth only: occlusion stays off, so what the user sees doesn't change. Null when
    /// <see cref="DepthEnabled"/> is off (the component isn't added: it would start depth at once).
    /// </summary>
    public static AROcclusionManager EnsureDepth(GameObject arCamera)
    {
        var occlusion = arCamera.GetComponent<AROcclusionManager>();
        if (!DepthEnabled) return occlusion;
        if (occlusion == null)
        {
            occlusion = arCamera.AddComponent<AROcclusionManager>();
            occlusion.requestedOcclusionPreferenceMode = OcclusionPreferenceMode.NoOcclusion;
            // Depth runs on every frame once it's on; the fastest mode is plenty for placing a sofa
            // and costs the phone the least during the walk.
            occlusion.requestedEnvironmentDepthMode = EnvironmentDepthMode.Fastest;
            occlusion.environmentDepthTemporalSmoothingRequested = true;
        }
        return occlusion;
    }

    /// <summary>
    /// Depth is only read while scanning (placing found furniture). Once the room is confirmed it is
    /// switched off: ARCore's own depth thread crashed the app (null pointer inside ARCore) the moment
    /// the room plan turned plane detection off while depth was still running.
    /// </summary>
    public static void SetDepthRunning(bool on)
    {
        if (on && !DepthEnabled) return;
        var occlusion = Object.FindAnyObjectByType<AROcclusionManager>();
        if (occlusion == null || occlusion.enabled == on) return;
        occlusion.enabled = on;
        Debug.Log($"[ARDepthSnapshot] Depth {(on ? "on" : "off")}.");
    }

    /// <summary>Copies the latest depth image; false when depth isn't available this frame.</summary>
    public bool TryCapture(AROcclusionManager occlusion, Matrix4x4? frameDisplayMatrix, Camera camera)
    {
        IsValid = false;
        if (occlusion == null || camera == null || !frameDisplayMatrix.HasValue)
            return false;
        if (!occlusion.TryAcquireEnvironmentDepthCpuImage(out var image))
            return false;

        using (image)
        {
            if (image.format != XRCpuImage.Format.DepthUint16 || image.planeCount < 1)
                return false;

            var plane = image.GetPlane(0);
            var data = plane.data;
            width = image.width;
            height = image.height;
            if (millimetres.Length != width * height)
                millimetres = new ushort[width * height];
            for (var y = 0; y < height; y++)
            {
                var row = y * plane.rowStride;
                for (var x = 0; x < width; x++)
                {
                    var i = row + x * plane.pixelStride;
                    millimetres[y * width + x] = (ushort)(data[i] | (data[i + 1] << 8));
                }
            }
        }

        displayMatrix = frameDisplayMatrix.Value;
        Layout = PickLayout();
        if (Layout == MatrixLayout.None)
            return false;
        var pose = camera.transform;
        origin = pose.position;
        forward = pose.forward;
        nearBottomLeft = camera.ViewportToWorldPoint(new Vector3(0, 0, camera.nearClipPlane));
        nearBottomRight = camera.ViewportToWorldPoint(new Vector3(1, 0, camera.nearClipPlane));
        nearTopLeft = camera.ViewportToWorldPoint(new Vector3(0, 1, camera.nearClipPlane));
        IsValid = true;
        return true;
    }

    /// <summary>Depth image coordinates (0–1, row 0 first) for a viewport point (0–1, y up).</summary>
    public Vector2 ViewportToImage(Vector2 viewport) => Apply(Layout, viewport);

    Vector2 Apply(MatrixLayout layout, Vector2 p)
    {
        var m = displayMatrix;
        return layout switch
        {
            MatrixLayout.RowVector => new Vector2(p.x * m[0, 0] + p.y * m[1, 0] + m[2, 0], p.x * m[0, 1] + p.y * m[1, 1] + m[2, 1]),
            MatrixLayout.RowVectorW => new Vector2(p.x * m[0, 0] + p.y * m[1, 0] + m[3, 0], p.x * m[0, 1] + p.y * m[1, 1] + m[3, 1]),
            MatrixLayout.ColumnVector => new Vector2(m[0, 0] * p.x + m[0, 1] * p.y + m[0, 2], m[1, 0] * p.x + m[1, 1] * p.y + m[1, 2]),
            MatrixLayout.ColumnVectorW => new Vector2(m[0, 0] * p.x + m[0, 1] * p.y + m[0, 3], m[1, 0] * p.x + m[1, 1] * p.y + m[1, 3]),
            _ => new Vector2(-1f, -1f),
        };
    }

    MatrixLayout PickLayout()
    {
        foreach (var layout in Layouts)
        {
            var inside = true;
            foreach (var corner in ViewportCorners)
            {
                var uv = Apply(layout, corner);
                if (!(uv.x >= -0.02f && uv.x <= 1.02f && uv.y >= -0.02f && uv.y <= 1.02f)) inside = false;
            }
            if (inside) return layout;
        }
        return MatrixLayout.None;
    }

    /// <summary>Median of the valid depths in a 3×3 patch around a viewport point.</summary>
    public bool TrySampleMetres(Vector2 viewport, out float metres)
    {
        metres = 0f;
        return IsValid && TrySampleImage(ViewportToImage(viewport), out metres);
    }

    /// <summary>Median of the valid depths in a 3×3 patch around depth image coordinates (0–1).</summary>
    public bool TrySampleImage(Vector2 uv, out float metres)
    {
        metres = 0f;
        if (!IsValid) return false;
        var cx = Mathf.FloorToInt(uv.x * width);
        var cy = Mathf.FloorToInt(uv.y * height);

        var count = 0;
        for (var dy = -1; dy <= 1; dy++)
        {
            for (var dx = -1; dx <= 1; dx++)
            {
                int x = cx + dx, y = cy + dy;
                if (x < 0 || y < 0 || x >= width || y >= height) continue;
                var mm = millimetres[y * width + x];
                if (mm == 0) continue;
                // Insertion sort into the patch buffer (at most 9 values).
                var at = count++;
                while (at > 0 && patch[at - 1] > mm)
                {
                    patch[at] = patch[at - 1];
                    at--;
                }
                patch[at] = mm;
            }
        }
        if (count == 0) return false;

        metres = patch[count / 2] / 1000f;
        return metres > 0.1f && metres <= MaxUsefulMetres;
    }

    /// <summary>World point seen at a viewport point (0–1, y up) when the snapshot was taken.</summary>
    public bool TryWorldPoint(Vector2 viewport, out Vector3 world)
    {
        world = default;
        if (!TrySampleMetres(viewport, out var depth)) return false;
        var onNearPlane = nearBottomLeft
            + (nearBottomRight - nearBottomLeft) * viewport.x
            + (nearTopLeft - nearBottomLeft) * viewport.y;
        var direction = (onNearPlane - origin).normalized;
        var alongForward = Vector3.Dot(direction, forward);
        if (alongForward < 0.05f) return false;
        world = origin + direction * (depth / alongForward);
        return true;
    }

    /// <summary>Camera position and horizontal viewing direction when the snapshot was taken.</summary>
    public Vector3 Origin => origin;
    public Vector3 FlatForward
    {
        get
        {
            var flat = new Vector3(forward.x, 0f, forward.z);
            return flat.sqrMagnitude > 1e-6f ? flat.normalized : Vector3.forward;
        }
    }
}
