using System;
using UnityEngine;

/// <summary>
/// Enables real GLB furniture placement on ARRoomMeasurement without switching to
/// ARDesignScene (UaaL LoadScene is unreliable after a measurement session).
/// </summary>
[DefaultExecutionOrder(-90)]
public class ARMeasurementFurnitureBootstrap : MonoBehaviour
{
    FurniturePlacementController placement;
    FurnitureLayoutHistory history;
    bool wired;

    public static ARMeasurementFurnitureBootstrap EnsureOn(GameObject host)
    {
        if (host == null) return null;
        var existing = host.GetComponent<ARMeasurementFurnitureBootstrap>();
        if (existing != null) return existing;
        return host.AddComponent<ARMeasurementFurnitureBootstrap>();
    }

    public FurniturePlacementController Placement => placement;
    public FurnitureLayoutHistory History => history;

    /// <summary>
    /// Adds placement / GLB / catalog components if missing, forces planner view,
    /// and wires RN events. Call while still on ARRoomMeasurement with a confirmed room.
    /// </summary>
    public void ActivateForMeasuredPlacement()
    {
        var managers = gameObject;

        if (managers.GetComponent<FurnitureCatalog>() == null)
            managers.AddComponent<FurnitureCatalog>();

        if (managers.GetComponent<RuntimeGltfLoader>() == null)
            managers.AddComponent<RuntimeGltfLoader>();

        placement = managers.GetComponent<FurniturePlacementController>()
                    ?? managers.AddComponent<FurniturePlacementController>();

        if (managers.GetComponent<FurnitureManipulator>() == null)
            managers.AddComponent<FurnitureManipulator>();

        history = managers.GetComponent<FurnitureLayoutHistory>()
                  ?? managers.AddComponent<FurnitureLayoutHistory>();

        PlannerRnInputRouter.EnsureOn(managers)?.Rebind();

        var layout = FindFirstObjectByType<ARDesignLayoutModeController>();
        var scan = FindFirstObjectByType<RoomScanController>();
        if (scan != null && scan.IsConfirmed)
        {
            layout?.EnterLayoutMode();
            layout?.ApplyMeasurementViewPreset(topDown: false);
        }

        var exportManager = FindFirstObjectByType<RoomExportManager>(FindObjectsInactive.Include);
        if (exportManager == null)
            exportManager = managers.AddComponent<RoomExportManager>();
        exportManager.EnsurePlacementHooks();

        WireEvents();

        // Hide native Unity chrome — RN owns catalog + orbit.
        ARMainMenuBackButton.SetUiVisible(false);
        var planHud = FindFirstObjectByType<ARMeasurementPlanHUD>(FindObjectsInactive.Include);
        planHud?.HideForRnSession();

        Debug.Log("[ARMeasurementFurnitureBootstrap] Measured furniture placement armed on ARRoomMeasurement.");
    }

    void WireEvents()
    {
        if (wired || placement == null) return;
        wired = true;

        placement.FurniturePlaced += OnFurniturePlaced;
        placement.ModelReady += OnModelReady;
        placement.FurnitureRemoved += OnFurnitureRemoved;
        placement.SelectionChanged += OnSelectionChanged;
        placement.SpawnFailed += OnSpawnFailed;

        if (history != null)
            history.HistoryChanged += OnHistoryChanged;
    }

    void OnDestroy()
    {
        if (placement != null)
        {
            placement.FurniturePlaced -= OnFurniturePlaced;
            placement.ModelReady -= OnModelReady;
            placement.FurnitureRemoved -= OnFurnitureRemoved;
            placement.SelectionChanged -= OnSelectionChanged;
            placement.SpawnFailed -= OnSpawnFailed;
        }

        if (history != null)
            history.HistoryChanged -= OnHistoryChanged;
    }

    void OnFurniturePlaced(PlacedFurniture furniture)
    {
        if (furniture == null) return;
        UnityMessageBridge.SendToApp("furniturePlaced", JsonUtility.ToJson(furniture.ToPayload()));
        SendLayout();
    }

    void OnModelReady(string modelId)
    {
        UnityMessageBridge.SendToApp("furnitureReady", modelId ?? string.Empty);
    }

    void OnFurnitureRemoved(string instanceId)
    {
        UnityMessageBridge.SendToApp("furnitureRemoved", instanceId ?? string.Empty);
        SendLayout();
    }

    void OnSelectionChanged(PlacedFurniture furniture)
    {
        UnityMessageBridge.SendToApp(
            "furnitureSelected",
            JsonUtility.ToJson(new SelectionPayload
            {
                instanceId = furniture != null ? furniture.InstanceId : string.Empty,
                modelId = furniture != null ? furniture.ModelId : string.Empty,
                selected = furniture != null,
            }));
    }

    void OnSpawnFailed(string code, string message)
    {
        UnityMessageBridge.SendToApp(
            "error",
            JsonUtility.ToJson(new ARDesignErrorPayload
            {
                code = code ?? "spawnFailed",
                message = message ?? "Furniture spawn failed.",
            }));
    }

    void OnHistoryChanged()
    {
        if (history == null) return;
        UnityMessageBridge.SendToApp("historyChanged", JsonUtility.ToJson(history.BuildState()));
    }

    void SendLayout()
    {
        if (placement == null) return;
        UnityMessageBridge.SendToApp("layoutChanged", JsonUtility.ToJson(placement.BuildLayout()));
    }

    public void SpawnFurniture(string data)
    {
        if (placement == null)
        {
            OnSpawnFailed("notConfigured", "Furniture placement is not ready yet.");
            return;
        }

        SpawnFurnitureRequest request = null;
        if (!string.IsNullOrWhiteSpace(data))
        {
            try
            {
                request = JsonUtility.FromJson<SpawnFurnitureRequest>(data);
            }
            catch (Exception e)
            {
                OnSpawnFailed("badRequest", e.Message);
                return;
            }
        }

        placement.SpawnFurniture(request);
    }
}
