using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;

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

    Coroutine exportRoutine;
    Coroutine reloadRoutine;
    Coroutine armFurnitureRoutine;
    Coroutine wakePlannerRoutine;

    public static ARMeasurementRnBridge EnsureOn(GameObject host)
    {
        if (host == null) return null;
        var existing = host.GetComponent<ARMeasurementRnBridge>();
        if (existing != null) return existing;
        return host.AddComponent<ARMeasurementRnBridge>();
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void EnsureBridgeOnMeasurementScene()
    {
        if (SceneManager.GetActiveScene().name != MeasurementSceneName) return;
        var managers = GameObject.Find("Managers");
        EnsureOn(managers);
    }

    void Awake()
    {
        if (SceneManager.GetActiveScene().name == MeasurementSceneName)
            EnsureOn(gameObject);
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
                // RN save already confirmed the shell — arm furniture on this scene (empty handoff).
                OpenMeasuredFurnitureDesign(string.Empty);
                break;

            case "cancelRoomName":
                RoomMeasurementSaveModal.CommitRoomNameFromRn("Untitled room");
                OpenMeasuredFurnitureDesign(string.Empty);
                break;

            case "exportLayout":
                // Defer off the UnitySendMessage stack — exporting (and SendToApp)
                // synchronously inside ReceiveMessage can hang/deadlock UaaL bridges.
                if (exportRoutine != null)
                    StopCoroutine(exportRoutine);
                exportRoutine = StartCoroutine(ExportLayoutToRnRoutine());
                break;

            case "spawnFurniture":
            case "selectFurniture":
                EnsureFurnitureBootstrap()?.SpawnFurniture(message.data);
                break;

            case "removeSelectedFurniture":
                EnsureFurnitureBootstrap()?.Placement?.RemoveSelectedFurniture();
                break;

            case "clearScene":
            case "clearFurniture":
                EnsureFurnitureBootstrap()?.Placement?.ClearFurniture();
                break;

            case "undo":
                EnsureFurnitureBootstrap()?.History?.Undo();
                break;

            case "redo":
                EnsureFurnitureBootstrap()?.History?.Redo();
                break;

            case "openRoomMeasurement":
            case "reloadMeasurement":
                // Already on this scene (or reopening) — soft-reload instead of LoadScene thrash.
                ScheduleReload();
                break;

            case "pauseMeasurement":
                // RN is leaving — idle teardown only (do NOT restart scan here).
                SoftClose(notifyRn: false);
                break;

            case "pauseFurniture":
                // Wrong-scene no-op: furniture pause is owned by ARSceneBridge.
                Debug.Log("[ARMeasurementRnBridge] Ignoring pauseFurniture on measurement scene.");
                break;

            case "plannerOrbit":
                FindFirstObjectByType<ARDesignLayoutModeController>()?.ApplyOrbitFromRn(message.data);
                break;

            case "plannerPointer":
                EnsureFurnitureBootstrap();
                PlannerRnInputRouter.EnsureOn(gameObject)?.Apply(message.data);
                break;

            case "wakePlanner":
                if (wakePlannerRoutine != null)
                    StopCoroutine(wakePlannerRoutine);
                wakePlannerRoutine = StartCoroutine(WakePlannerRoutine());
                break;

            case "furnitureGesture":
                FindFirstObjectByType<FurnitureManipulator>()?.ApplyGestureFromRn(message.data);
                break;

            case "openFurnitureDesign":
            case "startFurniturePlacement":
            case "beginFurniturePlacementOnly":
                OpenFurnitureDesign();
                break;

            case "openMeasuredFurnitureDesign":
                OpenMeasuredFurnitureDesign(message.data);
                break;

            case "requestClose":
            case "closeUnity":
                SoftClose(notifyRn: true);
                break;

            default:
                Debug.Log($"[ARMeasurementRnBridge] Ignoring '{message.method}' on measurement scene.");
                break;
        }
    }

    public void OpenFurnitureDesign()
    {
        // Idle teardown only — next scene Start/PendingBootAction owns furniture unlock.
        SoftClose(notifyRn: false);
        ARSceneBridge.PendingBootAction = "furniture";
        if (SceneManager.GetActiveScene().name == FurnitureSceneName)
            return;
        SceneManager.LoadScene(FurnitureSceneName);
    }

    /// <summary>
    /// Keep the confirmed measured room on ARRoomMeasurement and unlock real GLB
    /// placement here (no LoadScene to ARDesignScene — UaaL handoff was unreliable).
    /// </summary>
    public void OpenMeasuredFurnitureDesign(string rnPayloadJson = null)
    {
        if (armFurnitureRoutine != null)
            StopCoroutine(armFurnitureRoutine);
        armFurnitureRoutine = StartCoroutine(ArmMeasuredFurnitureRoutine(rnPayloadJson));
    }

    IEnumerator ArmMeasuredFurnitureRoutine(string rnPayloadJson)
    {
        // Leave the UnitySendMessage stack — sync SendToApp inside ReceiveMessage
        // often drops / deadlocks the RN unlock event on UaaL.
        yield return null;

        var scan = UnityEngine.Object.FindFirstObjectByType<RoomScanController>();

        if (scan == null || !scan.IsConfirmed || scan.ConfirmedRoom == null || scan.ConfirmedRoom.IsEmpty)
        {
            MeasuredRoomHandoff.CaptureFrom(scan);
            if (!MeasuredRoomHandoff.HasData)
                MeasuredRoomHandoff.CaptureFromRnPayload(rnPayloadJson);

            if (MeasuredRoomHandoff.TryConsume(out var corners, out var wallHeight) && scan != null)
            {
                if (!scan.ApplyMeasuredRoom(corners, wallHeight))
                {
                    UnityMessageBridge.SendToApp(
                        "error",
                        "{\"code\":\"applyMeasuredRoomFailed\",\"message\":\"Could not rebuild the measured room shell.\"}");
                    armFurnitureRoutine = null;
                    yield break;
                }
            }
            else if (scan == null || !scan.IsConfirmed)
            {
                Debug.LogWarning("[ARMeasurementRnBridge] openMeasuredFurnitureDesign — no room to place on.");
                UnityMessageBridge.SendToApp(
                    "error",
                    "{\"code\":\"noMeasuredRoom\",\"message\":\"Measure and confirm a room before placing furniture.\"}");
                armFurnitureRoutine = null;
                yield break;
            }
        }

        var bootstrap = EnsureFurnitureBootstrap();
        bootstrap?.ActivateForMeasuredPlacement();
        PlannerRnInputRouter.EnsureOn(gameObject)?.Rebind();

        // Extra frames so UaaL leaves the ReceiveMessage stack before SendToApp.
        yield return null;
        yield return new WaitForEndOfFrame();

        UnityMessageBridge.SendToApp("measuredFurnitureReady", MeasurementSceneName);
        yield return null;
        UnityMessageBridge.SendToApp("reloadComplete", MeasurementSceneName);
        Debug.Log("[ARMeasurementRnBridge] Measured furniture unlocked on ARRoomMeasurement.");
        armFurnitureRoutine = null;
    }

    /// <summary>
    /// RN resumed the player after overlays/modals — re-arm planner + push plan-ready again.
    /// </summary>
    IEnumerator WakePlannerRoutine()
    {
        yield return null;

        var bootstrap = EnsureFurnitureBootstrap();
        bootstrap?.ActivateForMeasuredPlacement();
        PlannerRnInputRouter.EnsureOn(gameObject)?.Rebind();

        yield return null;
        UnityMessageBridge.SendToApp("measurementPlanReady", MeasurementSceneName);
        wakePlannerRoutine = null;
    }

    ARMeasurementFurnitureBootstrap EnsureFurnitureBootstrap()
    {
        return ARMeasurementFurnitureBootstrap.EnsureOn(gameObject);
    }

    /// <summary>
    /// Unity HUD back button. Ask RN to confirm exit — do not wipe the room until RN
    /// sends pauseMeasurement after the user confirms.
    /// </summary>
    public void RequestClose()
    {
        UnityMessageBridge.SendToApp("requestClose", MeasurementSceneName);
    }

    /// <summary>
    /// Idle teardown: clear session/HUD/shell without starting a new scan.
    /// Scan starts only from ReloadMeasurement / scene Start.
    /// </summary>
    void SoftClose(bool notifyRn)
    {
        if (exportRoutine != null)
        {
            StopCoroutine(exportRoutine);
            exportRoutine = null;
        }

        if (reloadRoutine != null)
        {
            StopCoroutine(reloadRoutine);
            reloadRoutine = null;
        }

        ARMeasurementSession.Reset();

        var furniture = GetComponent<ARMeasurementFurnitureBootstrap>();
        furniture?.Placement?.ClearFurniture();

        var planHud = UnityEngine.Object.FindFirstObjectByType<ARMeasurementPlanHUD>(FindObjectsInactive.Include);
        planHud?.HideForRnSession();

        var visualizer = UnityEngine.Object.FindFirstObjectByType<RoomMeshVisualizer>(FindObjectsInactive.Include);
        visualizer?.Clear();

        var edgeVisualizer = UnityEngine.Object.FindFirstObjectByType<ARDesignEdgeVisualizer>(FindObjectsInactive.Include);
        if (edgeVisualizer != null)
            edgeVisualizer.enabled = false;

        var layoutMode = UnityEngine.Object.FindFirstObjectByType<ARDesignLayoutModeController>(FindObjectsInactive.Include);
        layoutMode?.ForceLiveArCamera();

        var scan = UnityEngine.Object.FindFirstObjectByType<RoomScanController>();
        scan?.ResetToIdle();

        ARMainMenuBackButton.SetUiVisible(false);

        if (notifyRn)
            UnityMessageBridge.SendToApp("requestClose", MeasurementSceneName);
    }

    void ScheduleReload()
    {
        if (reloadRoutine != null)
            StopCoroutine(reloadRoutine);
        reloadRoutine = StartCoroutine(ReloadMeasurementRoutine());
    }

    IEnumerator ReloadMeasurementRoutine()
    {
        // Leave the UnitySendMessage stack before touching AR session / scan state.
        yield return null;

        if (SceneManager.GetActiveScene().name != MeasurementSceneName)
        {
            SceneManager.LoadScene(MeasurementSceneName);
            reloadRoutine = null;
            yield break;
        }

        SoftClose(notifyRn: false);

        var scan = UnityEngine.Object.FindFirstObjectByType<RoomScanController>();
        if (scan != null)
            scan.StartRoomScan();

        ARMainMenuBackButton.SetUiVisible(true);
        // Distinct from cold unityReady so RN does not double-boot open/reload.
        UnityMessageBridge.SendToApp("reloadComplete", MeasurementSceneName);
        reloadRoutine = null;
    }

    IEnumerator ExportLayoutToRnRoutine()
    {
        UnityMessageBridge.SendToApp("exportStarted", MeasurementSceneName);
        yield return null;
        yield return new WaitForEndOfFrame();

        ExportResultPayload result;
        try
        {
            result = BuildExportResult();
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[ARMeasurementRnBridge] Export failed: {e}");
            result = new ExportResultPayload
            {
                success = false,
                path = string.Empty,
                fileName = string.Empty,
                error = e.Message,
            };
        }

        result ??= new ExportResultPayload
        {
            success = false,
            path = string.Empty,
            fileName = string.Empty,
            error = "Export returned no result.",
        };
        result.path = result.path ?? string.Empty;
        result.fileName = result.fileName ?? string.Empty;
        result.error = result.error ?? string.Empty;

        yield return null;
        UnityMessageBridge.SendToApp("exportComplete", JsonUtility.ToJson(result));
        exportRoutine = null;
    }

    ExportResultPayload BuildExportResult()
    {
        var exportManager = UnityEngine.Object.FindFirstObjectByType<RoomExportManager>(FindObjectsInactive.Include);
        if (exportManager == null)
        {
            var managers = GameObject.Find("Managers");
            if (managers != null)
            {
                exportManager = managers.GetComponent<RoomExportManager>();
                if (exportManager == null)
                    exportManager = managers.AddComponent<RoomExportManager>();
            }
        }

        if (exportManager == null)
        {
            return new ExportResultPayload
            {
                success = false,
                path = string.Empty,
                fileName = string.Empty,
                error = "RoomExportManager is missing from the measurement scene.",
            };
        }

        exportManager.EnsurePlacementHooks();

        if (exportManager.IsExporting)
        {
            Debug.LogWarning("[ARMeasurementRnBridge] Export flag stuck — resetting and retrying.");
            exportManager.ResetExportState();
        }

        var placement = UnityEngine.Object.FindFirstObjectByType<FurniturePlacementController>();
        var hasPlaced = placement != null && placement.CountPlacedInCurrentSpace() > 0;
        return exportManager.ExportLayoutPayload(roomShellOnly: !hasPlaced);
    }
}
