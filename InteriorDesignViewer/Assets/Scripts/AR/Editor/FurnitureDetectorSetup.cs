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
            "Optional COCO model (better accuracy):\n" +
            "1. Export or download a MobileNet-SSD (COCO) ONNX model.\n" +
            "2. Copy it to:\n" +
            $"   {dest}\n" +
            "3. Select the .onnx in Unity — Inference settings should create a ModelAsset.\n" +
            "4. Ensure the imported asset name is FurnitureDetector (Resources/ML/FurnitureDetector).\n\n" +
            "See Unity Sentis object-detection samples for compatible ONNX layouts.",
            "OK");

        if (File.Exists(dest))
            Selection.activeObject = AssetDatabase.LoadAssetAtPath<Object>(dest);
        else
            EditorUtility.RevealInFinder(ResourceFolder);
    }
}
#endif
