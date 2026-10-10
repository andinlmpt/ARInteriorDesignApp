#if UNITY_EDITOR
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Runs the furniture detector on a room photo in the editor, so the model can be checked without an AR device.
/// Logs each detection and saves the photo with the boxes drawn as &lt;name&gt;_detections.png next to it.
/// </summary>
public static class FurnitureDetectorPhotoTest
{
    const int BoxThickness = 3;

    [MenuItem("AR Interior/Test Furniture Detector on Photo...")]
    static void Run()
    {
        var path = EditorUtility.OpenFilePanel("Room photo", "", "jpg,jpeg,png");
        if (!string.IsNullOrEmpty(path))
            RunOn(path);
    }

    public static void RunOn(string path)
    {
        var photo = new Texture2D(2, 2, TextureFormat.RGBA32, false);
        photo.LoadImage(File.ReadAllBytes(path));
        var host = new GameObject("FurnitureDetectorPhotoTest") { hideFlags = HideFlags.HideAndDontSave };
        try
        {
            var detector = host.AddComponent<ARFurnitureCocoDetector>();
            var detections = detector.DetectInImage(photo);
            var loaded = detector.IsAvailable;
            detector.ReleaseModel();
            if (!loaded)
            {
                Debug.LogError("[FurnitureDetectorPhotoTest] No model loaded. Is Assets/Resources/ML/FurnitureDetector.onnx there?");
                return;
            }

            var log = new StringBuilder($"[FurnitureDetectorPhotoTest] {detections.Count} detection(s) in {Path.GetFileName(path)}:");
            foreach (var (label, confidence, box) in detections)
            {
                var furniture = CocoFurnitureLabelMap.Map(label);
                log.Append($"\n  {label} {confidence:P0} -> {furniture ?? "(not furniture)"} ")
                    .Append($"at x {box.xMin:F2}-{box.xMax:F2}, y {box.yMin:F2}-{box.yMax:F2}");
                DrawBox(photo, box, furniture != null ? Color.green : Color.yellow);
            }

            var outPath = Path.Combine(
                Path.GetDirectoryName(path) ?? "",
                Path.GetFileNameWithoutExtension(path) + "_detections.png");
            File.WriteAllBytes(outPath, photo.EncodeToPNG());
            log.Append($"\n  Saved {outPath}");
            Debug.Log(log.ToString());
        }
        finally
        {
            Object.DestroyImmediate(host);
            Object.DestroyImmediate(photo);
        }
    }

    // Box is normalized with y down; texture rows run bottom-up.
    static void DrawBox(Texture2D tex, Rect box, Color color)
    {
        var x0 = Mathf.Clamp(Mathf.RoundToInt(box.xMin * tex.width), 0, tex.width - 1);
        var x1 = Mathf.Clamp(Mathf.RoundToInt(box.xMax * tex.width), 0, tex.width - 1);
        var y0 = Mathf.Clamp(Mathf.RoundToInt((1f - box.yMax) * tex.height), 0, tex.height - 1);
        var y1 = Mathf.Clamp(Mathf.RoundToInt((1f - box.yMin) * tex.height), 0, tex.height - 1);
        for (var t = 0; t < BoxThickness; t++)
        {
            for (var x = x0; x <= x1; x++)
            {
                tex.SetPixel(x, Mathf.Min(y0 + t, y1), color);
                tex.SetPixel(x, Mathf.Max(y1 - t, y0), color);
            }
            for (var y = y0; y <= y1; y++)
            {
                tex.SetPixel(Mathf.Min(x0 + t, x1), y, color);
                tex.SetPixel(Mathf.Max(x1 - t, x0), y, color);
            }
        }
        tex.Apply();
    }
}
#endif
