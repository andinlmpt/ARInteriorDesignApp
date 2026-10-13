using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Unity.InferenceEngine;

/// <summary>
/// Optional COCO object detector (Inference Engine). Loads the model at
/// Resources/ML/FurnitureDetector: YOLO11n pretrained on COCO, taken from
/// huggingface.co/unity/inference-engine-yolo (GPL-3.0). See Editor ▸ AR Interior ▸ Setup Furniture Detector.
/// </summary>
[DisallowMultipleComponent]
public class ARFurnitureCocoDetector : MonoBehaviour
{
    static ARFurnitureCocoDetector instance;

    public static ARFurnitureCocoDetector EnsureOn(GameObject host)
    {
        if (instance != null && instance.isActiveAndEnabled) return instance;
        if (instance != null) instance.ReleaseModel();
        instance = null;
        var detector = FindAnyObjectByType<ARFurnitureCocoDetector>();
        if (detector != null && !detector.isActiveAndEnabled) detector = null;
        if (detector == null) detector = host.AddComponent<ARFurnitureCocoDetector>();
        instance = detector;
        return detector;
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    static void ResetSharedDetector()
    {
        if (instance != null) instance.ReleaseModel();
        instance = null;
    }
    const string ModelResourcePath = "ML/FurnitureDetector";
    const int InputSize = 640;
    const float IouThreshold = 0.5f;

    // Turns YOLO's (centre x, centre y, width, height) rows into (x1, y1, x2, y2) for NMS.
    static readonly float[] CentersToCorners =
    {
        1, 0, 1, 0,
        0, 1, 0, 1,
        -0.5f, 0, 0.5f, 0,
        0, -0.5f, 0, 0.5f,
    };

    [SerializeField] private Camera arCamera;
    [SerializeField] private ARCameraManager cameraManager;
    [SerializeField] private float minConfidence = 0.45f;
    [SerializeField] private float scanIntervalSeconds = 1.5f;

    // Padding colour around the letterboxed frame, as in YOLO training (114/255 grey).
    static readonly Color LetterboxGrey = new Color(0.447f, 0.447f, 0.447f, 1f);

    float nextScanTime;
    bool loggedMissingModel;
    int nextSuggestionId;

    ModelAsset modelAsset;
    Worker worker;
    Tensor<float> inputTensor;
    RenderTexture frameRt;
    RenderTexture contentRt;
    RenderTexture inputRt;
    // Where the frame sits inside the square model input (normalized): the whole frame,
    // scaled to fit, centred between grey bars.
    Vector2 contentScale = Vector2.one;
    Vector2 contentOffset = Vector2.zero;
    // Depth taken with the captured frame, to place detections at their real position and size.
    AROcclusionManager occlusion;
    Matrix4x4? latestDisplayMatrix;
    readonly ARDepthSnapshot captureDepth = new ARDepthSnapshot();
    bool ready;
    bool loadAttempted;
    IEnumerator schedule;
    Tensor<float> boxOutput;
    Tensor<int> classOutput;
    Tensor<float> scoreOutput;
    List<RawDet> completedDetections;
    float inferenceStarted;
    bool discardInFlight;
    Vector3 captureOrigin, captureBottomLeft, captureBottomRight, captureTopLeft;

    public bool IsAvailable => ready;
    public bool IsScanning => schedule != null || boxOutput != null;
    public bool HasResults => completedDetections != null;

    void Awake()
    {
        if (instance != null && instance != this)
        {
            enabled = false;
            Destroy(this);
            return;
        }
        instance = this;
        if (arCamera == null) arCamera = Camera.main;
        if (cameraManager == null) cameraManager = FindFirstObjectByType<ARCameraManager>();
        // Allocate the worker only when furniture scanning is requested.
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
    }

    // Explicit ADB opt-in for a bounded device smoke test, independent of room mapping.
    IEnumerator Start()
    {
#if UNITY_ANDROID && DEVELOPMENT_BUILD && !UNITY_EDITOR
        using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
        using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
        using var intent = activity.Call<AndroidJavaObject>("getIntent");
        if (!intent.Call<bool>("getBooleanExtra", "yoloSmokeTest", false)) yield break;
        TryLoadModel();
        for (var sample = 0; sample < 3 && ready; sample++)
        {
            yield return new WaitForSecondsRealtime(8f);
            if (!TryCaptureFrame()) continue;
            BeginInference();
            while (IsScanning) yield return null;
            Debug.Log($"[ARFurnitureCocoDetector] Device smoke test {sample + 1}/3: {completedDetections?.Count ?? 0} detections.");
            completedDetections = null;
        }
#else
        yield break;
#endif
    }

    void TryLoadModel()
    {
        if (ready || loadAttempted || (instance != null && instance != this)) return;
        loadAttempted = true;
        modelAsset = Resources.Load<ModelAsset>(ModelResourcePath);
        if (modelAsset == null)
            return;

        try
        {
            var model = ModelLoader.Load(modelAsset);

            // YOLO outputs (1, 84, 8400): box centre x, centre y, width, height in input pixels, then
            // 80 class scores. Pick the best class per box and run non-max suppression in the graph,
            // so the worker returns only the kept boxes, their class ids and their scores.
            var graph = new FunctionalGraph();
            var inputs = graph.AddInputs(model);
            var output = Functional.Forward(model, inputs)[0];
            var boxes = output[0, 0..4, ..].Transpose(0, 1);
            var classScores = output[0, 4.., ..];
            var scores = Functional.ReduceMax(classScores, 0);
            var classIds = Functional.ArgMax(classScores, 0);
            var boxCorners = Functional.MatMul(boxes, Functional.Constant(new TensorShape(4, 4), CentersToCorners));
            var keep = Functional.NMS(boxCorners, scores, IouThreshold, minConfidence);

            var backend = SystemInfo.supportsComputeShaders ? BackendType.GPUCompute : BackendType.CPU;
            worker = new Worker(
                graph.Compile(
                    Functional.IndexSelect(boxes, 0, keep),
                    Functional.IndexSelect(classIds, 0, keep),
                    Functional.IndexSelect(scores, 0, keep)),
                backend);
            inputTensor = new Tensor<float>(new TensorShape(1, 3, InputSize, InputSize));
            inputRt = new RenderTexture(InputSize, InputSize, 0, RenderTextureFormat.ARGB32);
            ready = true;
            Debug.Log($"[ARFurnitureCocoDetector] COCO detector ready ({backend}).");
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARFurnitureCocoDetector] Model load failed: {e.Message}");
            ReleaseModel();
            loadAttempted = true;
        }
    }

    void OnDestroy()
    {
        ReleaseModel();
        if (instance == this) instance = null;
    }

    /// <summary>Frees the model and its textures (called on destroy; call it yourself in edit mode).</summary>
    public void ReleaseModel()
    {
        (schedule as IDisposable)?.Dispose();
        schedule = null;
        boxOutput = null;
        classOutput = null;
        scoreOutput = null;
        completedDetections = null;
        worker?.Dispose();
        worker = null;
        inputTensor?.Dispose();
        inputTensor = null;
        ReleaseTexture(frameRt);
        frameRt = null;
        ReleaseTexture(contentRt);
        contentRt = null;
        ReleaseTexture(inputRt);
        inputRt = null;
        ready = false;
        loadAttempted = false;
    }

    static void ReleaseTexture(RenderTexture rt)
    {
        if (rt == null) return;
        rt.Release();
        if (Application.isPlaying) Destroy(rt);
        else DestroyImmediate(rt);
    }

    /// <summary>
    /// Detects COCO objects in an image framed like the screen, loading the model if needed.
    /// Boxes are normalized with y down. Used by the editor photo test.
    /// </summary>
    public List<(string label, float confidence, Rect normalizedBox)> DetectInImage(Texture image)
    {
        var results = new List<(string, float, Rect)>();
        if (!ready) TryLoadModel();
        if (!ready || IsScanning || image == null) return results;

        PrepareInput(image);
        foreach (var det in RunModel())
            results.Add((det.label, det.confidence, det.normalizedBox));
        return results;
    }

    /// <summary>
    /// Run detection if model is loaded and interval elapsed. With <paramref name="requireInsideRoom"/>
    /// false (while the outline is still open) detections are kept wherever they land on the floor.
    /// Objects already in <paramref name="existing"/> are skipped; merging repeat sightings of the
    /// same object is up to the caller.
    /// </summary>
    public List<FurnitureAutoSuggestion> TryDetect(
        IReadOnlyList<Vector3> corners,
        float floorY,
        ARRaycastManager raycast,
        IReadOnlyList<RoomObstaclePayload> existing,
        bool requireInsideRoom = true)
    {
        var empty = new List<FurnitureAutoSuggestion>();
        if (instance != null && instance != this) return empty;
        if (!ready) TryLoadModel();
        if (arCamera == null) arCamera = Camera.main;
        if (!ready || arCamera == null || (requireInsideRoom && (corners == null || corners.Count < 3)))
        {
            if (!ready && !loggedMissingModel)
            {
                loggedMissingModel = true;
                Debug.Log(
                    "[ARFurnitureCocoDetector] No model at Resources/ML/FurnitureDetector — " +
                    "using AR plane suggestions only. Run AR Interior ▸ Setup Furniture Detector.");
            }
            return empty;
        }

        if (completedDetections == null)
        {
            if (!IsScanning && Time.unscaledTime >= nextScanTime && TryCaptureFrame())
                BeginInference();
            return empty;
        }
        var detections = completedDetections;
        completedDetections = null;

        var results = new List<FurnitureAutoSuggestion>();
        // One note per detection saying what happened to it, so a scan log explains itself.
        var notes = new List<string>();
        foreach (var det in detections)
        {
            var what = $"{det.label} {det.confidence:F2}";
            var mapped = CocoFurnitureLabelMap.Map(det.label);
            if (mapped == null)
            {
                notes.Add($"{what} ignored (not furniture)");
                continue;
            }
            if (det.confidence < minConfidence)
            {
                notes.Add($"{what} ignored (low confidence)");
                continue;
            }

            var defaultSize = CocoFurnitureLabelMap.DefaultSize(mapped);
            Vector3 center, size;
            float yaw;
            string method;
            if (TryPlaceWithDepth(det.normalizedBox, floorY, defaultSize, out center, out size, out yaw))
            {
                method = "depth";
            }
            else if (TryPlaceOnFloor(det.normalizedBox, floorY, out center))
            {
                size = defaultSize;
                yaw = FacingYaw(CaptureFlatForward());
                method = "floor ray, default size";
            }
            else
            {
                notes.Add($"{what} dropped (couldn't find where it stands)");
                continue;
            }

            if (requireInsideRoom && !RoomPolygonUtil.PointInsidePolygonXZ(center, corners))
            {
                notes.Add($"{what} dropped (outside the room)");
                continue;
            }
            if (ARFurniturePlaneAutoScannerOverlapsHelper.Overlaps(center, size, existing, null, yaw))
            {
                notes.Add($"{what} dropped (already marked)");
                continue;
            }
            if (ARFurniturePlaneAutoScannerOverlapsHelper.Overlaps(center, size, null, results, yaw))
            {
                notes.Add($"{what} dropped (same object twice in this frame)");
                continue;
            }

            nextSuggestionId += 1;
            results.Add(new FurnitureAutoSuggestion
            {
                id = $"coco-{nextSuggestionId}-{det.label}",
                type = mapped,
                center = center,
                size = size,
                yaw = yaw,
                confidence = det.confidence,
                source = "coco",
            });
            notes.Add($"{what} kept as {mapped} at ({center.x:F2}, {center.z:F2}), " +
                $"{size.x:F2} x {size.z:F2} x {size.y:F2} m, via {method}");
        }

        Debug.Log($"[ARFurnitureCocoDetector] AR scan: {detections.Count} detections, {results.Count} furniture suggestions" +
            (notes.Count > 0 ? ": " + string.Join("; ", notes) : "."));
        return results;
    }

    /// <summary>
    /// Locates the object from the depth captured with its frame: samples points inside the box,
    /// keeps those at the object's distance (not the wall or floor around it), and measures its
    /// width and height. Only the front is visible, so depth front-to-back is at least the usual size.
    /// </summary>
    bool TryPlaceWithDepth(Rect box, float floorY, Vector3 defaultSize, out Vector3 center, out Vector3 size, out float yaw)
    {
        center = default;
        size = default;
        yaw = 0f;
        if (!captureDepth.IsValid) return false;

        const int Grid = 9;
        var points = new List<Vector3>(Grid * Grid);
        for (var gy = 0; gy < Grid; gy++)
        {
            for (var gx = 0; gx < Grid; gx++)
            {
                var nx = Mathf.Lerp(box.xMin, box.xMax, (gx + 0.5f) / Grid);
                var ny = Mathf.Lerp(box.yMin, box.yMax, (gy + 0.5f) / Grid);
                var viewport = new Vector2(Mathf.Clamp01(nx), 1f - Mathf.Clamp01(ny));
                if (captureDepth.TryWorldPoint(viewport, out var point) && point.y > floorY + 0.05f)
                    points.Add(point);
            }
        }
        if (points.Count < 15) return false;

        var origin = captureDepth.Origin;
        var forward = captureDepth.FlatForward;
        var right = Vector3.Cross(Vector3.up, forward);

        // Keep points near the median distance: the object itself, not what is behind it.
        var along = points.ConvertAll(p => Vector3.Dot(p - origin, forward));
        var medianAlong = Percentile(along, 0.5f);
        var tolerance = Mathf.Max(0.35f, 0.6f * defaultSize.z);
        var kept = points.FindAll(p => Mathf.Abs(Vector3.Dot(p - origin, forward) - medianAlong) <= tolerance);
        if (kept.Count < 10) return false;

        var across = kept.ConvertAll(p => Vector3.Dot(p - origin, right));
        var keptAlong = kept.ConvertAll(p => Vector3.Dot(p - origin, forward));
        var heights = kept.ConvertAll(p => p.y - floorY);

        var left = Percentile(across, 0.1f);
        var rightEdge = Percentile(across, 0.9f);
        var front = Percentile(keptAlong, 0.1f);
        var back = Percentile(keptAlong, 0.9f);
        var top = Percentile(heights, 0.9f);
        // A real piece of furniture rests on the floor and is a plausible height; anything else
        // means the depth didn't line up with the object, so let the floor ray place it instead.
        if (top < 0.2f || top > 2.5f) return false;

        var width = Mathf.Clamp(rightEdge - left, 0.5f * defaultSize.x, 1.8f * defaultSize.x);
        var depth = Mathf.Clamp(Mathf.Max(back - front, defaultSize.z), 0.5f * defaultSize.z, 1.8f * defaultSize.z);
        var height = Mathf.Clamp(top, 0.4f * defaultSize.y, 1.8f * defaultSize.y);

        center = origin + right * ((left + rightEdge) * 0.5f) + forward * (front + depth * 0.5f);
        center.y = floorY;
        size = new Vector3(width, height, depth);
        yaw = FacingYaw(forward);
        return true;
    }

    /// <summary>Where the bottom-centre of the box meets the floor, using the captured camera pose.</summary>
    bool TryPlaceOnFloor(Rect box, float floorY, out Vector3 center)
    {
        // A current screen ray would drift if the phone moved during inference.
        var viewportX = Mathf.Clamp01(box.center.x);
        var viewportY = 1f - Mathf.Clamp01(box.yMax);
        var contact = captureBottomLeft
            + (captureBottomRight - captureBottomLeft) * viewportX
            + (captureTopLeft - captureBottomLeft) * viewportY;
        if (!TryProjectToFloor(new Ray(captureOrigin, contact - captureOrigin), floorY, out center))
            return false;
        center.y = floorY;
        return true;
    }

    Vector3 CaptureFlatForward()
    {
        var middle = captureBottomLeft + (captureBottomRight - captureBottomLeft) * 0.5f
            + (captureTopLeft - captureBottomLeft) * 0.5f;
        var flat = middle - captureOrigin;
        flat.y = 0f;
        return flat.sqrMagnitude > 1e-6f ? flat.normalized : Vector3.forward;
    }

    /// <summary>Yaw that lines the footprint's width up across the view (front facing the camera).</summary>
    static float FacingYaw(Vector3 flatForward) => Mathf.Atan2(flatForward.x, flatForward.z) * Mathf.Rad2Deg;

    static float Percentile(List<float> values, float fraction)
    {
        var sorted = new List<float>(values);
        sorted.Sort();
        var index = Mathf.Clamp(Mathf.RoundToInt(fraction * (sorted.Count - 1)), 0, sorted.Count - 1);
        return sorted[index];
    }

    struct RawDet
    {
        public string label;
        public float confidence;
        public Rect normalizedBox;
    }

    bool TryCaptureFrame()
    {
        var previousTarget = arCamera.targetTexture;
        try
        {
            var w = arCamera.pixelWidth;
            var h = arCamera.pixelHeight;
            if (w <= 0 || h <= 0)
                return false;

            // AR Foundation sets the camera's projection from the screen, so render at the screen's
            // aspect (short side = model input) to keep the view undistorted.
            var shortSide = Mathf.Min(w, h);
            var frameW = Mathf.RoundToInt(w * (float)InputSize / shortSide);
            var frameH = Mathf.RoundToInt(h * (float)InputSize / shortSide);
            if (frameRt == null || frameRt.width != frameW || frameRt.height != frameH)
            {
                ReleaseTexture(frameRt);
                frameRt = new RenderTexture(frameW, frameH, 24, RenderTextureFormat.ARGB32);
            }

            captureOrigin = arCamera.transform.position;
            captureBottomLeft = arCamera.ViewportToWorldPoint(new Vector3(0, 0, arCamera.nearClipPlane));
            captureBottomRight = arCamera.ViewportToWorldPoint(new Vector3(1, 0, arCamera.nearClipPlane));
            captureTopLeft = arCamera.ViewportToWorldPoint(new Vector3(0, 1, arCamera.nearClipPlane));
            arCamera.targetTexture = frameRt;
            arCamera.Render();
            arCamera.targetTexture = previousTarget;

            // Depth for the same moment, so detections can be placed after the phone has moved on.
            if (occlusion == null && cameraManager != null)
                occlusion = ARDepthSnapshot.EnsureDepth(cameraManager.gameObject);
            captureDepth.TryCapture(occlusion, latestDisplayMatrix, arCamera);

            PrepareInput(frameRt);
            return true;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARFurnitureCocoDetector] Frame capture failed: {e.Message}");
            return false;
        }
        finally
        {
            arCamera.targetTexture = previousTarget;
        }
    }

    public static bool TryProjectToFloor(Ray ray, float floorY, out Vector3 point)
    {
        point = default;
        if (ray.direction.y >= -0.001f) return false;
        var distance = (floorY - ray.origin.y) / ray.direction.y;
        if (distance <= 0 || distance > 15f || !float.IsFinite(distance)) return false;
        point = ray.GetPoint(distance);
        return true;
    }

    void BeginInference()
    {
        try
        {
            TextureConverter.ToTensor(inputRt, inputTensor, default);
            inferenceStarted = Time.unscaledTime;
            discardInFlight = false;
            schedule = worker.ScheduleIterable(inputTensor);
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARFurnitureCocoDetector] Inference failed: {e.Message}");
            ReleaseModel();
            loadAttempted = true;
        }
    }

    void Update()
    {
        if (!IsScanning) return;
        try
        {
            if (Time.unscaledTime - inferenceStarted > 60f)
                throw new TimeoutException("Furniture detection timed out.");
            if (schedule != null)
            {
                // Spread scheduling across frames; never synchronously wait for GPU output.
                var budget = System.Diagnostics.Stopwatch.StartNew();
                while (budget.Elapsed.TotalMilliseconds < 4)
                {
                    if (schedule.MoveNext()) continue;
                    (schedule as IDisposable)?.Dispose();
                    schedule = null;
                    boxOutput = worker.PeekOutput(0) as Tensor<float>;
                    classOutput = worker.PeekOutput(1) as Tensor<int>;
                    scoreOutput = worker.PeekOutput(2) as Tensor<float>;
                    if (boxOutput == null || classOutput == null || scoreOutput == null)
                        throw new InvalidOperationException("Unexpected furniture model outputs.");
                    boxOutput.ReadbackRequest();
                    classOutput.ReadbackRequest();
                    scoreOutput.ReadbackRequest();
                    break;
                }
            }
            if (schedule != null || boxOutput == null) return;
            if (boxOutput.count > 0 && (!boxOutput.IsReadbackRequestDone()
                || !classOutput.IsReadbackRequestDone() || !scoreOutput.IsReadbackRequestDone())) return;
            completedDetections = ReadDetections(boxOutput, classOutput, scoreOutput);
            if (discardInFlight) completedDetections = null;
            boxOutput = null;
            classOutput = null;
            scoreOutput = null;
            nextScanTime = Time.unscaledTime + scanIntervalSeconds;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARFurnitureCocoDetector] Inference failed: {e.Message}");
            ReleaseModel();
            loadAttempted = true;
        }
    }

    public void DiscardResults()
    {
        completedDetections = null;
        discardInFlight = IsScanning;
    }

    // The model sees the whole frame, scaled to fit its square input with grey bars on the
    // short sides (letterboxing), so furniture near the screen edges is detected too.
    void PrepareInput(Texture frame)
    {
        if (SystemInfo.copyTextureSupport == UnityEngine.Rendering.CopyTextureSupport.None)
        {
            // No GPU texture copies: fall back to the centred square of the frame.
            var shortSide = (float)Mathf.Min(frame.width, frame.height);
            var cropScale = new Vector2(shortSide / frame.width, shortSide / frame.height);
            var cropOffset = (Vector2.one - cropScale) * 0.5f;
            Graphics.Blit(frame, inputRt, cropScale, cropOffset);
            // Input covers only part of the frame: input = (screen - offset) / scale.
            contentScale = new Vector2(1f / cropScale.x, 1f / cropScale.y);
            contentOffset = new Vector2(-cropOffset.x / cropScale.x, -cropOffset.y / cropScale.y);
            return;
        }

        var fit = Mathf.Min((float)InputSize / frame.width, (float)InputSize / frame.height);
        var contentW = Mathf.Clamp(Mathf.RoundToInt(frame.width * fit), 1, InputSize);
        var contentH = Mathf.Clamp(Mathf.RoundToInt(frame.height * fit), 1, InputSize);
        if (contentRt == null || contentRt.width != contentW || contentRt.height != contentH)
        {
            ReleaseTexture(contentRt);
            contentRt = new RenderTexture(contentW, contentH, 0, RenderTextureFormat.ARGB32);
        }
        Graphics.Blit(frame, contentRt);
        if (!inputRt.IsCreated()) inputRt.Create();

        var previous = RenderTexture.active;
        RenderTexture.active = inputRt;
        GL.Clear(false, true, LetterboxGrey);
        RenderTexture.active = previous;

        var padX = (InputSize - contentW) / 2;
        var padY = (InputSize - contentH) / 2;
        Graphics.CopyTexture(contentRt, 0, 0, 0, 0, contentW, contentH, inputRt, 0, 0, padX, padY);
        contentScale = new Vector2((float)contentW / InputSize, (float)contentH / InputSize);
        contentOffset = new Vector2((float)padX / InputSize, (float)padY / InputSize);
    }

    List<RawDet> RunModel()
    {
        TextureConverter.ToTensor(inputRt, inputTensor, default);
        worker.Schedule(inputTensor);

        if (worker.PeekOutput(0) is not Tensor<float> boxOutput
            || worker.PeekOutput(1) is not Tensor<int> classOutput
            || worker.PeekOutput(2) is not Tensor<float> scoreOutput)
            return new List<RawDet>();

        return ReadDetections(boxOutput, classOutput, scoreOutput);
    }

    List<RawDet> ReadDetections(Tensor<float> boxOutput, Tensor<int> classOutput, Tensor<float> scoreOutput)
    {
        var list = new List<RawDet>();

        using var boxes = boxOutput.ReadbackAndClone();
        using var classIds = classOutput.ReadbackAndClone();
        using var scores = scoreOutput.ReadbackAndClone();

        for (var n = 0; n < boxes.shape[0]; n++)
        {
            var score = scores[n];
            if (score < minConfidence) continue;
            var label = CocoFurnitureLabelMap.ClassName(classIds[n]);
            if (label == null) continue;

            // Boxes are in input pixels with y down; map them back to the whole screen (normalized, y down).
            // The padding is symmetric, so it doesn't matter which way up the input was stored.
            var width = boxes[n, 2] / InputSize / contentScale.x;
            var height = boxes[n, 3] / InputSize / contentScale.y;
            var centerX = (boxes[n, 0] / InputSize - contentOffset.x) / contentScale.x;
            var centerY = (boxes[n, 1] / InputSize - contentOffset.y) / contentScale.y;
            list.Add(new RawDet
            {
                label = label,
                confidence = score,
                normalizedBox = new Rect(centerX - width * 0.5f, centerY - height * 0.5f, width, height),
            });
            if (CocoFurnitureLabelMap.Map(label) != null)
                Debug.Log($"[ARFurnitureCocoDetector] Detected {label}, confidence {score:F2}.");
        }

        Debug.Log($"[ARFurnitureCocoDetector] Inference completed: {list.Count} labeled detections.");
        return list;
    }

}

/// <summary>Shared overlap check for plane + coco scanners.</summary>
public static class ARFurniturePlaneAutoScannerOverlapsHelper
{
    public static bool Overlaps(
        Vector3 center,
        Vector3 size,
        IReadOnlyList<RoomObstaclePayload> existing,
        IReadOnlyList<FurnitureAutoSuggestion> pending,
        float yaw = 0f)
    {
        if (existing != null)
        {
            foreach (var ob in existing)
            {
                if (ob != null && FootprintsOverlap(center, size, yaw,
                    new Vector3(ob.center.x, ob.center.y, ob.center.z),
                    new Vector3(ob.size.x, ob.size.y, ob.size.z), ob.yaw)) return true;
            }
        }

        if (pending == null) return false;
        foreach (var s in pending)
        {
            if (FootprintsOverlap(center, size, yaw, s.center, s.size, s.yaw)) return true;
        }

        return false;
    }

    public static bool FootprintsOverlap(Vector3 a, Vector3 aSize, float aYaw, Vector3 b, Vector3 bSize, float bYaw)
    {
        var aRotation = Quaternion.Euler(0, aYaw, 0);
        var bRotation = Quaternion.Euler(0, bYaw, 0);
        var ax = aRotation * Vector3.right;
        var az = aRotation * Vector3.forward;
        var bx = bRotation * Vector3.right;
        var bz = bRotation * Vector3.forward;
        var delta = b - a;
        delta.y = 0;
        // Separating-axis test includes each actual footprint and its rotation.
        foreach (var axis in new[] { ax, az, bx, bz })
        {
            var aRadius = Mathf.Abs(Vector3.Dot(ax, axis)) * Mathf.Abs(aSize.x) * 0.5f
                + Mathf.Abs(Vector3.Dot(az, axis)) * Mathf.Abs(aSize.z) * 0.5f;
            var bRadius = Mathf.Abs(Vector3.Dot(bx, axis)) * Mathf.Abs(bSize.x) * 0.5f
                + Mathf.Abs(Vector3.Dot(bz, axis)) * Mathf.Abs(bSize.z) * 0.5f;
            if (Mathf.Abs(Vector3.Dot(delta, axis)) >= aRadius + bRadius + 0.03f) return false;
        }
        return true;
    }
}

/// <summary>COCO class names relevant to interior furniture.</summary>
public static class CocoFurnitureLabelMap
{
    static readonly string[] CocoNames =
    {
        "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
        "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
        "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
        "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard",
        "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
        "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
        "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard",
        "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
        "scissors", "teddy bear", "hair drier", "toothbrush",
    };

    public static string ClassName(int classId)
    {
        if (classId < 0 || classId >= CocoNames.Length) return null;
        return CocoNames[classId];
    }

    public static string Map(string cocoLabel)
    {
        if (string.IsNullOrEmpty(cocoLabel)) return null;
        var lower = cocoLabel.ToLowerInvariant();
        return lower switch
        {
            "couch" => "sofa",
            "chair" => "chair",
            "bed" => "bed",
            "dining table" => "table",
            "potted plant" => "other",
            "tv" => "other",
            _ => null,
        };
    }

    public static Vector3 DefaultSize(string obstacleType) => obstacleType switch
    {
        "bed" => new Vector3(1.6f, 0.5f, 2.1f),
        "desk" => new Vector3(1.2f, 0.75f, 0.6f),
        "table" => new Vector3(1.1f, 0.75f, 0.75f),
        "chair" => new Vector3(0.5f, 0.9f, 0.5f),
        "wardrobe" => new Vector3(1.8f, 2f, 0.6f),
        "sofa" => new Vector3(2f, 0.85f, 0.95f),
        _ => new Vector3(1f, 0.8f, 1f),
    };
}
