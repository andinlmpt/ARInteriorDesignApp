using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// A copy of one ARCore depth image plus the camera pose it was taken with, so screen points
/// can be turned into world points after the phone has moved on (e.g. once object detection
/// on that frame finishes).
///
/// Screen → depth pixel uses the camera frame's display matrix, the same transform the ARCore
/// background shader applies to the camera and depth textures (row vector × matrix).
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

    public bool IsValid { get; private set; }
    public int Width => width;
    public int Height => height;

    /// <summary>
    /// Adds an AROcclusionManager to the AR camera if there isn't one, asking for environment
    /// depth only: occlusion stays off, so what the user sees doesn't change.
    /// </summary>
    public static AROcclusionManager EnsureDepth(GameObject arCamera)
    {
        var occlusion = arCamera.GetComponent<AROcclusionManager>();
        if (occlusion == null)
        {
            occlusion = arCamera.AddComponent<AROcclusionManager>();
            occlusion.requestedOcclusionPreferenceMode = OcclusionPreferenceMode.NoOcclusion;
            occlusion.requestedEnvironmentDepthMode = EnvironmentDepthMode.Medium;
            occlusion.environmentDepthTemporalSmoothingRequested = true;
        }
        return occlusion;
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
    public Vector2 ViewportToImage(Vector2 viewport)
    {
        var m = displayMatrix;
        return new Vector2(
            viewport.x * m[0, 0] + viewport.y * m[1, 0] + m[2, 0],
            viewport.x * m[0, 1] + viewport.y * m[1, 1] + m[2, 1]);
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
