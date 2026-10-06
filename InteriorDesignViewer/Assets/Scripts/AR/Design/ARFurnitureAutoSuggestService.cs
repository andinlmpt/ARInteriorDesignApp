using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

/// <summary>
/// Merges AR plane + optional COCO detections into pending furniture suggestions.
/// </summary>
public class ARFurnitureAutoSuggestService : MonoBehaviour
{
    [SerializeField] private ARPlaneManager planeManager;
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private ARDesignCornerRoomBuilder cornerBuilder;
    [SerializeField] private ARFurnitureCocoDetector cocoDetector;
    [SerializeField] private float autoScanIntervalSeconds = 3f;
    [SerializeField] private int maxSuggestions = 8;

    float nextAutoScan;

    void Awake()
    {
        if (planeManager == null) planeManager = FindFirstObjectByType<ARPlaneManager>();
        if (raycastManager == null) raycastManager = FindFirstObjectByType<ARRaycastManager>();
        if (cornerBuilder == null) cornerBuilder = FindFirstObjectByType<ARDesignCornerRoomBuilder>();
        if (cocoDetector == null) cocoDetector = GetComponent<ARFurnitureCocoDetector>();
        if (cocoDetector == null)
            cocoDetector = gameObject.AddComponent<ARFurnitureCocoDetector>();
    }

    public void TickAutoScan(
        ARDesignSpatialMappingController.Phase phase,
        IReadOnlyList<RoomObstaclePayload> obstacles,
        List<FurnitureAutoSuggestion> pending)
    {
        if (phase != ARDesignSpatialMappingController.Phase.ExistingFurniture)
            return;
        if (Time.unscaledTime < nextAutoScan)
            return;
        nextAutoScan = Time.unscaledTime + autoScanIntervalSeconds;
        RunScan(obstacles, pending);
    }

    public void RunScan(IReadOnlyList<RoomObstaclePayload> obstacles, List<FurnitureAutoSuggestion> pending)
    {
        if (cornerBuilder == null || cornerBuilder.CornerCount < 3)
            return;

        var corners = cornerBuilder.Corners;
        var floorY = EstimateFloorY(corners);

        var found = new List<FurnitureAutoSuggestion>();
        found.AddRange(ARFurniturePlaneAutoScanner.Scan(planeManager, corners, floorY, obstacles, pending));

        if (cocoDetector != null)
            found.AddRange(cocoDetector.TryDetect(corners, floorY, raycastManager, obstacles, pending));

        MergeIntoPending(found, pending);
    }

    void MergeIntoPending(List<FurnitureAutoSuggestion> found, List<FurnitureAutoSuggestion> pending)
    {
        foreach (var suggestion in found)
        {
            if (pending.Count >= maxSuggestions)
                break;
            if (ARFurniturePlaneAutoScannerOverlapsHelper.Overlaps(
                    suggestion.center, suggestion.size, null, pending))
                continue;
            pending.Add(suggestion);
        }
    }

    static float EstimateFloorY(IReadOnlyList<Vector3> corners)
    {
        var y = corners[0].y;
        for (var i = 1; i < corners.Count; i++)
            y = Mathf.Min(y, corners[i].y);
        return y;
    }
}
