using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

/// <summary>
/// Scan diagnostics for judging automatic room scanning on a given phone. Every 2 seconds it
/// logs, tagged [ScanDiag] for adb logcat: tracking state, the "Move slowly" guidance with the
/// camera's speed, detected floor / wall / ceiling planes (walls with their facing direction and
/// size), feature points, and whether the ARCore Depth API delivers depth images.
///
/// It also checks the screen → depth image mapping that object placement relies on: at a few
/// screen points it compares the depth read through <see cref="ARDepthSnapshot"/> (and its
/// flipped variants) with ARCore's own depth raycast at the same point.
///
/// Attaches itself to the AR camera of any scene that has one. It only logs: depth is
/// requested with occlusion turned off, so nothing on screen changes. Remove before release.
/// </summary>
public class ARScanDiagnostics : MonoBehaviour
{
    const float LogInterval = 2f;
    const int MaxWallsListed = 6;
    /// <summary>The camera picture's brightness is the mean of this many × this many samples.</summary>
    const int BrightnessGrid = 16;
    static readonly Vector2[] MappingCheckPoints = { new(0.5f, 0.35f), new(0.3f, 0.6f), new(0.7f, 0.6f) };
    static readonly string[] VariantNames = { "as is", "flip v", "flip u", "flip both" };

    ARCameraManager cameraManager;
    ARPlaneManager planeManager;
    ARPointCloudManager pointCloudManager;
    ARRaycastManager raycastManager;
    AROcclusionManager occlusionManager;
    ARScanGuidance guidance;
    Camera arCamera;
    Matrix4x4? latestDisplayMatrix;
    readonly ARDepthSnapshot snapshot = new ARDepthSnapshot();
    readonly List<ARRaycastHit> hits = new List<ARRaycastHit>();
    float startTime;
    float nextLogTime;
    bool loggedMatrix;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void Install()
    {
        SceneManager.sceneLoaded += (scene, mode) => AttachToArCamera();
    }

    static void AttachToArCamera()
    {
        var cameraManager = FindAnyObjectByType<ARCameraManager>();
        if (cameraManager == null || cameraManager.GetComponent<ARScanDiagnostics>() != null)
            return;
        cameraManager.gameObject.AddComponent<ARScanDiagnostics>();
    }

    void Awake()
    {
        cameraManager = GetComponent<ARCameraManager>();
        arCamera = GetComponent<Camera>();
        occlusionManager = ARDepthSnapshot.EnsureDepth(gameObject);
        planeManager = FindAnyObjectByType<ARPlaneManager>();
        pointCloudManager = FindAnyObjectByType<ARPointCloudManager>();
        raycastManager = FindAnyObjectByType<ARRaycastManager>();
        startTime = Time.time;
        Debug.Log($"[ScanDiag] attached in scene '{gameObject.scene.name}' on {SystemInfo.deviceModel}");
    }

    void OnEnable()
    {
        if (cameraManager != null) cameraManager.frameReceived += OnCameraFrame;
    }

    void OnDisable()
    {
        if (cameraManager != null) cameraManager.frameReceived -= OnCameraFrame;
    }

    void OnCameraFrame(ARCameraFrameEventArgs args)
    {
        if (args.displayMatrix.HasValue) latestDisplayMatrix = args.displayMatrix;
        // Only filled in ARCore's ambient light mode; the camera picture is measured otherwise.
        latestBrightness = args.lightEstimation.averageBrightness;
    }

    float? latestBrightness;

    void Update()
    {
        if (Time.time < nextLogTime)
            return;
        nextLogTime = Time.time + LogInterval;

        var line = new StringBuilder("[ScanDiag] t=").Append(Mathf.RoundToInt(Time.time - startTime)).Append('s');
        line.Append(" tracking=").Append(ARSession.state).Append('/').Append(ARSession.notTrackingReason);
        AppendGuidance(line);
        AppendPlanes(line);
        AppendFeaturePoints(line);
        AppendDepth(line);
        AppendMappingCheck(line);
        Debug.Log(line.ToString());
    }

    void AppendGuidance(StringBuilder line)
    {
        if (guidance == null) guidance = FindAnyObjectByType<ARScanGuidance>();
        if (guidance == null) return;
        line.Append($" | guide={guidance.Current} turn={guidance.TurnSpeed:0}deg/s move={guidance.MoveSpeed:0.00}m/s");
        // For telling a lit room from a dim one (no threshold is trusted yet).
        float? brightness = TryCameraBrightness(out var picture) ? picture : latestBrightness;
        line.Append(brightness.HasValue ? $" light={brightness.Value:0.00}" : " light=?");
    }

    /// <summary>
    /// Average brightness of the camera picture, 0–1: the mean of its luma plane on a coarse grid.
    /// ARCore's own estimate (averageBrightness) is empty in the HDR light mode the scan asks for,
    /// so on the phone the log only ever said "light=?".
    /// </summary>
    bool TryCameraBrightness(out float brightness)
    {
        brightness = 0f;
        if (cameraManager == null || !cameraManager.TryAcquireLatestCpuImage(out var image)) return false;
        try
        {
            if (image.format != XRCpuImage.Format.AndroidYuv420_888) return false;
            var plane = image.GetPlane(0);
            var data = plane.data;
            long sum = 0;
            for (var gy = 0; gy < BrightnessGrid; gy++)
            {
                var y = (2 * gy + 1) * image.height / (2 * BrightnessGrid);
                for (var gx = 0; gx < BrightnessGrid; gx++)
                {
                    var x = (2 * gx + 1) * image.width / (2 * BrightnessGrid);
                    sum += data[y * plane.rowStride + x * plane.pixelStride];
                }
            }

            brightness = sum / (255f * BrightnessGrid * BrightnessGrid);
            return true;
        }
        finally
        {
            image.Dispose();
        }
    }

    void AppendPlanes(StringBuilder line)
    {
        if (planeManager == null)
        {
            line.Append(" | planes=n/a");
            return;
        }

        int floors = 0, walls = 0, ceilings = 0;
        float floorArea = 0f, wallArea = 0f, ceilingArea = 0f;
        var wallList = new StringBuilder();
        foreach (var plane in planeManager.trackables)
        {
            if (plane.subsumedBy != null)
                continue;
            float area = plane.size.x * plane.size.y;
            switch (plane.alignment)
            {
                case PlaneAlignment.HorizontalUp:
                    floors++;
                    floorArea += area;
                    break;
                case PlaneAlignment.HorizontalDown:
                    ceilings++;
                    ceilingArea += area;
                    break;
                case PlaneAlignment.Vertical:
                    walls++;
                    wallArea += area;
                    if (walls <= MaxWallsListed)
                    {
                        // Compass-style direction the wall faces, so separate walls are easy to tell apart.
                        var normal = plane.normal;
                        int facing = Mathf.RoundToInt(Mathf.Repeat(Mathf.Atan2(normal.x, normal.z) * Mathf.Rad2Deg, 360f) / 10f) * 10 % 360;
                        wallList.Append(wallList.Length > 0 ? ", " : string.Empty)
                            .Append(facing).Append("deg ")
                            .Append(plane.size.x.ToString("0.0")).Append('x').Append(plane.size.y.ToString("0.0"));
                    }
                    break;
            }
        }

        line.Append($" | floor={floors} ({floorArea:0.0} m2) ceiling={ceilings} ({ceilingArea:0.0} m2)");
        line.Append($" walls={walls} ({wallArea:0.0} m2) [{wallList}]");
    }

    void AppendFeaturePoints(StringBuilder line)
    {
        if (pointCloudManager == null)
        {
            line.Append(" | points=n/a");
            return;
        }

        int count = 0;
        foreach (var cloud in pointCloudManager.trackables)
        {
            if (cloud.positions.HasValue)
                count += cloud.positions.Value.Length;
        }
        line.Append(" | points=").Append(count);
    }

    void AppendDepth(StringBuilder line)
    {
        if (occlusionManager == null)
        {
            line.Append(" | depth=off");
            return;
        }

        var support = occlusionManager.descriptor != null
            ? occlusionManager.descriptor.environmentDepthImageSupported
            : Supported.Unknown;
        line.Append(" | depth=").Append(support).Append(" mode=").Append(occlusionManager.currentEnvironmentDepthMode);
        var captured = snapshot.TryCapture(occlusionManager, latestDisplayMatrix, arCamera);
        if (!loggedMatrix && latestDisplayMatrix.HasValue)
        {
            // Once per scene: the raw display matrix and the layout chosen for it.
            loggedMatrix = true;
            var m = latestDisplayMatrix.Value;
            Debug.Log($"[ScanDiag] display matrix rows: [{m[0, 0]:0.###} {m[0, 1]:0.###} {m[0, 2]:0.###} {m[0, 3]:0.###}] " +
                $"[{m[1, 0]:0.###} {m[1, 1]:0.###} {m[1, 2]:0.###} {m[1, 3]:0.###}] " +
                $"[{m[2, 0]:0.###} {m[2, 1]:0.###} {m[2, 2]:0.###} {m[2, 3]:0.###}] " +
                $"[{m[3, 0]:0.###} {m[3, 1]:0.###} {m[3, 2]:0.###} {m[3, 3]:0.###}] -> layout {snapshot.Layout}");
        }
        if (!captured)
        {
            line.Append(" image=none layout=").Append(snapshot.Layout);
            return;
        }
        line.Append($" image={snapshot.Width}x{snapshot.Height} layout={snapshot.Layout}");
        if (snapshot.TrySampleMetres(new Vector2(0.5f, 0.5f), out var centre))
            line.Append($" centre={centre:0.00}m");
    }

    /// <summary>
    /// Compares the snapshot's depth with ARCore's depth raycast (planes if depth hits aren't
    /// available) at a few screen points, for the mapping as written and its flipped variants.
    /// The variant with the smallest error is the right one.
    /// </summary>
    void AppendMappingCheck(StringBuilder line)
    {
        if (!snapshot.IsValid || raycastManager == null || arCamera == null) return;

        var errors = new float[VariantNames.Length];
        var samples = new int[VariantNames.Length];
        var source = "";
        var cameraPose = arCamera.transform;
        foreach (var viewport in MappingCheckPoints)
        {
            var screen = new Vector2(viewport.x * arCamera.pixelWidth, viewport.y * arCamera.pixelHeight);
            if (raycastManager.Raycast(screen, hits, TrackableType.Depth)) source = "depth";
            else if (raycastManager.Raycast(screen, hits, TrackableType.PlaneWithinPolygon)) source = "plane";
            else continue;

            var expected = Vector3.Dot(hits[0].pose.position - cameraPose.position, cameraPose.forward);
            var uv = snapshot.ViewportToImage(viewport);
            var variants = new[] { uv, new Vector2(uv.x, 1f - uv.y), new Vector2(1f - uv.x, uv.y), Vector2.one - uv };
            for (var v = 0; v < variants.Length; v++)
            {
                if (!snapshot.TrySampleImage(variants[v], out var metres)) continue;
                errors[v] += Mathf.Abs(metres - expected);
                samples[v]++;
            }
        }
        if (source.Length == 0) return;

        line.Append(" | map vs ").Append(source).Append(':');
        for (var v = 0; v < VariantNames.Length; v++)
        {
            if (samples[v] == 0) continue;
            line.Append($" {VariantNames[v]}={errors[v] / samples[v]:0.00}m");
        }
    }
}
