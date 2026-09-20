using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// RN bridge for ARRoomMeasurement (Managers GameObject).
/// ARDesignScene uses <see cref="ARSceneBridge"/>; this scene strips that component,
/// so measurement needs its own ReceiveMessage entry point for scene switches / close.
/// </summary>
[DefaultExecutionOrder(-100)]
public class ARMeasurementRnBridge : MonoBehaviour
{
    const string FurnitureSceneName = "ARDesignScene";
    const string MeasurementSceneName = "ARRoomMeasurement";

    public static ARMeasurementRnBridge EnsureOn(GameObject host)
    {
        if (host == null) return null;
        var existing = host.GetComponent<ARMeasurementRnBridge>();
        if (existing != null) return existing;
        return host.AddComponent<ARMeasurementRnBridge>();
    }

    void Start()
    {
        UnityMessageBridge.SendToApp("unityReady", MeasurementSceneName);
    }

    /// <summary>Called by the native Unity ↔ RN bridge on Managers.</summary>
    public void ReceiveMessage(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return;

        ARDesignInboundMessage message;
        try
        {
            message = JsonUtility.FromJson<ARDesignInboundMessage>(json);
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[ARMeasurementRnBridge] Bad message: {e.Message}");
            return;
        }

        if (message == null || string.IsNullOrEmpty(message.method)) return;

        Debug.Log($"[ARMeasurementRnBridge] ← {message.method}");

        switch (message.method)
        {
            case "ping":
                UnityMessageBridge.SendToApp("unityReady", MeasurementSceneName);
                break;

            case "commitRoomName":
                RoomMeasurementSaveModal.CommitRoomNameFromRn(message.data ?? string.Empty);
                break;

            case "cancelRoomName":
                RoomMeasurementSaveModal.CommitRoomNameFromRn("Untitled room");
                break;

            case "exportLayout":
                ExportLayoutToRn();
                break;

            case "openRoomMeasurement":
                // Already on this scene.
                break;

            case "openFurnitureDesign":
            case "startFurniturePlacement":
            case "beginFurniturePlacementOnly":
                OpenFurnitureDesign();
                break;

            case "requestClose":
            case "closeUnity":
                RequestClose();
                break;

            default:
                Debug.Log($"[ARMeasurementRnBridge] Ignoring '{message.method}' on measurement scene.");
                break;
        }
    }

    public void OpenFurnitureDesign()
    {
        ARSceneBridge.PendingBootAction = "furniture";
        if (SceneManager.GetActiveScene().name == FurnitureSceneName)
            return;
        SceneManager.LoadScene(FurnitureSceneName);
    }

    public void RequestClose()
    {
        UnityMessageBridge.SendToApp("requestClose", MeasurementSceneName);
        // Park on design scene so the next RN furniture session starts cleanly.
        if (SceneManager.GetActiveScene().name == MeasurementSceneName)
            SceneManager.LoadScene(FurnitureSceneName);
    }

    void ExportLayoutToRn()
    {
        try
        {
            var exportManager = UnityEngine.Object.FindFirstObjectByType<RoomExportManager>();
            if (exportManager == null)
            {
                UnityMessageBridge.SendToApp("exportComplete", JsonUtility.ToJson(new ExportResultPayload
                {
                    success = false,
                    path = string.Empty,
                    fileName = string.Empty,
                    error = "RoomExportManager is missing from the measurement scene.",
                }));
                return;
            }

            if (exportManager.IsExporting)
            {
                Debug.LogWarning("[ARMeasurementRnBridge] Export flag stuck — resetting and retrying.");
                exportManager.ResetExportState();
            }

            var result = exportManager.ExportLayoutPayload();
            if (result == null)
            {
                result = new ExportResultPayload
                {
                    success = false,
                    path = string.Empty,
                    fileName = string.Empty,
                    error = "Export returned no result.",
                };
            }

            result.path = result.path ?? string.Empty;
            result.fileName = result.fileName ?? string.Empty;
            result.error = result.error ?? string.Empty;

            UnityMessageBridge.SendToApp("exportComplete", JsonUtility.ToJson(result));
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[ARMeasurementRnBridge] Export failed: {e}");
            UnityMessageBridge.SendToApp("exportComplete", JsonUtility.ToJson(new ExportResultPayload
            {
                success = false,
                path = string.Empty,
                fileName = string.Empty,
                error = e.Message,
            }));
        }
    }
}
