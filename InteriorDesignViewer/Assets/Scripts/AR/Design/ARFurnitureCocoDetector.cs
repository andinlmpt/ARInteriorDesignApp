using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Unity.InferenceEngine;

/// <summary>
/// Optional COCO-style object detector (Sentis). Assign a model at
/// Resources/ML/FurnitureDetector (see Editor ▸ AR Interior ▸ Setup Furniture Detector).
/// </summary>
public class ARFurnitureCocoDetector : MonoBehaviour
{
    const string ModelResourcePath = "ML/FurnitureDetector";
    const int InputSize = 320;

    [SerializeField] private Camera arCamera;
    [SerializeField] private ARCameraManager cameraManager;
    [SerializeField] private float minConfidence = 0.45f;
    [SerializeField] private float scanIntervalSeconds = 2.5f;

    float nextScanTime;
    bool loggedMissingModel;

    ModelAsset modelAsset;
    Worker worker;
    Tensor<float> inputTensor;
    RenderTexture captureRt;
    Texture2D readbackTex;
    bool ready;

    public bool IsAvailable => ready;

    void Awake()
    {
        if (arCamera == null) arCamera = Camera.main;
        if (cameraManager == null) cameraManager = FindFirstObjectByType<ARCameraManager>();
        TryLoadModel();
    }

    void TryLoadModel()
    {
        modelAsset = Resources.Load<ModelAsset>(ModelResourcePath);
        if (modelAsset == null)
            return;

        try
        {
            var model = ModelLoader.Load(modelAsset);
            worker = new Worker(model, BackendType.CPU);
            inputTensor = new Tensor<float>(new TensorShape(1, 3, InputSize, InputSize));
            captureRt = new RenderTexture(InputSize, InputSize, 0, RenderTextureFormat.ARGB32);
            readbackTex = new Texture2D(InputSize, InputSize, TextureFormat.RGBA32, false);
            ready = true;
            Debug.Log("[ARFurnitureCocoDetector] COCO detector ready.");
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARFurnitureCocoDetector] Model load failed: {e.Message}");
            ready = false;
        }
    }

    void OnDestroy()
    {
        worker?.Dispose();
        inputTensor?.Dispose();
        if (captureRt != null) captureRt.Release();
        if (readbackTex != null) Destroy(readbackTex);
    }

    /// <summary>Run detection if model is loaded and interval elapsed.</summary>
    public List<FurnitureAutoSuggestion> TryDetect(
        IReadOnlyList<Vector3> corners,
        float floorY,
        ARRaycastManager raycast,
        IReadOnlyList<RoomObstaclePayload> existing,
        IReadOnlyList<FurnitureAutoSuggestion> pending)
    {
        var empty = new List<FurnitureAutoSuggestion>();
        if (!ready || arCamera == null || raycast == null || corners == null || corners.Count < 3)
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

        if (Time.unscaledTime < nextScanTime)
            return empty;
        nextScanTime = Time.unscaledTime + scanIntervalSeconds;

        if (!TryCaptureFrame(out var tex))
            return empty;

        var detections = RunModel(tex);
        Destroy(tex);

        var results = new List<FurnitureAutoSuggestion>();
        var hits = new List<ARRaycastHit>();
        var id = 0;
        foreach (var det in detections)
        {
            if (det.confidence < minConfidence) continue;
            var mapped = CocoFurnitureLabelMap.Map(det.label);
            if (mapped == null) continue;

            var screen = DetBoxToScreen(det, arCamera.pixelWidth, arCamera.pixelHeight);
            hits.Clear();
            if (!raycast.Raycast(screen, hits, TrackableType.PlaneWithinPolygon))
                continue;

            Vector3 world = default;
            var foundFloor = false;
            foreach (var hit in hits)
            {
                if (hit.trackable is ARPlane plane && plane.alignment == PlaneAlignment.HorizontalUp)
                {
                    world = hit.pose.position;
                    foundFloor = true;
                    break;
                }
            }

            if (!foundFloor) continue;
            if (!RoomPolygonUtil.PointInsidePolygonXZ(world, corners)) continue;

            var size = CocoFurnitureLabelMap.DefaultSize(mapped);
            world.y = floorY;
            if (ARFurniturePlaneAutoScannerOverlapsHelper.Overlaps(world, size, existing, pending))
                continue;

            id += 1;
            results.Add(new FurnitureAutoSuggestion
            {
                id = $"coco-{id}-{det.label}",
                type = mapped,
                center = world,
                size = size,
                confidence = det.confidence,
                source = "coco",
            });
        }

        return results;
    }

    struct RawDet
    {
        public string label;
        public float confidence;
        public Rect normalizedBox;
    }

    bool TryCaptureFrame(out Texture2D tex)
    {
        tex = null;
        try
        {
            var prev = RenderTexture.active;
            arCamera.targetTexture = captureRt;
            arCamera.Render();
            arCamera.targetTexture = null;
            RenderTexture.active = captureRt;
            readbackTex.ReadPixels(new Rect(0, 0, InputSize, InputSize), 0, 0);
            readbackTex.Apply(false, false);
            RenderTexture.active = prev;
            tex = readbackTex;
            return true;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARFurnitureCocoDetector] Frame capture failed: {e.Message}");
            return false;
        }
    }

    List<RawDet> RunModel(Texture2D tex)
    {
        var list = new List<RawDet>();
        TextureConverter.ToTensor(tex, inputTensor, new TextureTransform());
        worker.Schedule(inputTensor);
        var output = worker.PeekOutput() as Tensor<float>;
        if (output == null)
            return list;

        // Generic output: many SSD exports use [1, N, 6] = x1,y1,x2,y2,score,class
        var data = output.DownloadToArray();
        output.Dispose();

        if (data == null || data.Length < 6)
            return list;

        var cols = 6;
        var rows = data.Length / cols;
        if (rows >= 1)
        {
            for (var r = 0; r < rows; r++)
            {
                var i = r * cols;
                var score = data[i + 4];
                if (score < minConfidence) continue;
                var classId = (int)data[i + 5];
                var label = CocoFurnitureLabelMap.ClassName(classId);
                if (label == null) continue;
                list.Add(new RawDet
                {
                    label = label,
                    confidence = score,
                    normalizedBox = new Rect(data[i], data[i + 1], data[i + 2] - data[i], data[i + 3] - data[i + 1]),
                });
            }
        }

        return list;
    }

    static Vector2 DetBoxToScreen(RawDet det, int pixelW, int pixelH)
    {
        var cx = (det.normalizedBox.xMin + det.normalizedBox.xMax) * 0.5f;
        var cy = (det.normalizedBox.yMin + det.normalizedBox.yMax) * 0.5f;
        return new Vector2(cx * pixelW, (1f - cy) * pixelH);
    }
}

/// <summary>Shared overlap check for plane + coco scanners.</summary>
public static class ARFurniturePlaneAutoScannerOverlapsHelper
{
    public static bool Overlaps(
        Vector3 center,
        Vector3 size,
        IReadOnlyList<RoomObstaclePayload> existing,
        IReadOnlyList<FurnitureAutoSuggestion> pending)
    {
        const float minSep = 0.55f;
        if (existing != null)
        {
            foreach (var ob in existing)
            {
                var d = Vector3.Distance(
                    new Vector3(center.x, 0f, center.z),
                    new Vector3(ob.center.x, 0f, ob.center.z));
                if (d < minSep) return true;
            }
        }

        if (pending == null) return false;
        foreach (var s in pending)
        {
            var d = Vector3.Distance(
                new Vector3(center.x, 0f, center.z),
                new Vector3(s.center.x, 0f, s.center.z));
            if (d < minSep) return true;
        }

        return false;
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
