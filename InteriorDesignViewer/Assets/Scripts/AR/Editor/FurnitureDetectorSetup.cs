#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Documents optional COCO Sentis model setup for furniture auto-detect (Stage 1).
/// Plane-based suggestions work without any model.
/// </summary>
public static class FurnitureDetectorSetup
{
    const string ResourceFolder = "Assets/Resources/ML";
    const string ModelFileName = "FurnitureDetector.onnx";

    [MenuItem("AR Interior/Setup Furniture Detector (optional COCO model)")]
    static void ShowSetup()
    {
        if (!Directory.Exists(ResourceFolder))
            Directory.CreateDirectory(ResourceFolder);

        var dest = Path.Combine(ResourceFolder, ModelFileName);
        EditorUtility.DisplayDialog(
            "Furniture auto-detect (Stage 1)",
            "Without a model:\n" +
            "• During \"Mark existing furniture\", the app scans AR horizontal planes " +
            "and shows orange suggestion boxes. Tap an orange box to save it.\n\n" +
            "COCO model (better accuracy):\n" +
            "The project ships YOLO11n pretrained on COCO, from huggingface.co/unity/inference-engine-yolo " +
            "(models/yolo11n.onnx, GPL-3.0), at:\n" +
            $"   {dest}\n" +
            "To swap it, copy another YOLOv8/YOLO11 (COCO, 640x640) ONNX model to the same path. " +
            "Delete the file to fall back to plane suggestions only.",
            "OK");

        if (File.Exists(dest))
            Selection.activeObject = AssetDatabase.LoadAssetAtPath<Object>(dest);
        else
            EditorUtility.RevealInFinder(ResourceFolder);
    }
}
#endif
