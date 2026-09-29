using System;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// The single React Native entry point for ARDesignScene.
///
/// Lives on the "Managers" GameObject so it matches the convention the RN side
/// already uses (UNITY_AR_GAME_OBJECT = "Managers",
/// UNITY_AR_RECEIVE_METHOD = "ReceiveMessage" in frontend/types/unity-bridge.ts).
/// Note that UnitySendMessage invokes the named method on EVERY component of the
/// target GameObject, so ARDesignScene must NOT also carry UnityMessageBridge —
/// otherwise both would handle the same inbound message. Outbound traffic still
/// goes through UnityMessageBridge.SendToApp, which is static.
///
/// INBOUND  {"method":"<name>","data":"<string>"}
/// OUTBOUND {"event":"<name>","data":"<string>"}
///
/// Structured payloads are JSON-encoded into the "data" string, so RN calls
/// JSON.parse(msg.data) for scanStatus / layout / exportComplete / errors.
/// </summary>
public class ARSceneBridge : MonoBehaviour
{
    [SerializeField] private RoomScanController scanController;
    [SerializeField] private FurniturePlacementController placementController;
    [SerializeField] private LayoutExportService exportService;
    [SerializeField] private FurnitureLayoutHistory layoutHistory;
    [SerializeField] private RoomMeshVisualizer roomMeshVisualizer;

    [Header("Startup")]
    [Tooltip("Begin the scan phase as soon as the scene loads, without waiting for RN to call StartRoomScan.")]
    [SerializeField] private bool autoStartScan = true;

    const string FurnitureSceneName = "ARDesignScene";
    const string MeasurementSceneName = "ARRoomMeasurement";

    /// <summary>
    /// Set before <see cref="SceneManager.LoadScene"/> so the destination scene
    /// can finish the RN boot action after Awake/Start (e.g. furniture unlock).
    /// </summary>
    public static string PendingBootAction;

    Coroutine exportRoutine;

    // Event names. Keep in sync with UnityToRNEvent in frontend/types/unity-bridge.ts.
    const string EventReady = "unityReady";
    const string EventScanStatus = "scanStatus";
    const string EventScanConfirmed = "roomScanConfirmed";
    const string EventFurniturePlaced = "furniturePlaced";
    const string EventFurnitureReady = "furnitureReady";
    const string EventFurnitureRemoved = "furnitureRemoved";
    const string EventFurnitureSelected = "furnitureSelected";
    const string EventLayoutChanged = "layoutChanged";
    const string EventExportComplete = "exportComplete";
    const string EventHistoryChanged = "historyChanged";
    const string EventPlacementSafety = "placementSafety";
    const string EventError = "error";

    void Awake()
    {
        if (scanController == null) scanController = FindFirstObjectByType<RoomScanController>();
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (exportService == null) exportService = FindFirstObjectByType<LayoutExportService>();
        if (layoutHistory == null) layoutHistory = FindFirstObjectByType<FurnitureLayoutHistory>();
        if (roomMeshVisualizer == null) roomMeshVisualizer = FindFirstObjectByType<RoomMeshVisualizer>();
    }

    void OnEnable()
    {
        if (scanController != null)
        {
            scanController.StatusChanged += OnScanStatusChanged;
            scanController.PhaseChanged += OnScanPhaseChanged;
        }

        if (placementController != null)
        {
            placementController.FurniturePlaced += OnFurniturePlaced;
            placementController.ModelReady += OnModelReady;
            placementController.FurnitureRemoved += OnFurnitureRemoved;
            placementController.SelectionChanged += OnSelectionChanged;
            placementController.SpawnFailed += OnSpawnFailed;
            placementController.PlacementSafetyChanged += OnPlacementSafetyChanged;
        }

        if (layoutHistory != null)
            layoutHistory.HistoryChanged += OnHistoryChanged;
    }

    void OnDisable()
    {
        if (scanController != null)
        {
            scanController.StatusChanged -= OnScanStatusChanged;
            scanController.PhaseChanged -= OnScanPhaseChanged;
        }

        if (placementController != null)
        {
            placementController.FurniturePlaced -= OnFurniturePlaced;
            placementController.ModelReady -= OnModelReady;
            placementController.FurnitureRemoved -= OnFurnitureRemoved;
            placementController.SelectionChanged -= OnSelectionChanged;
            placementController.SpawnFailed -= OnSpawnFailed;
            placementController.PlacementSafetyChanged -= OnPlacementSafetyChanged;
        }

        if (layoutHistory != null)
            layoutHistory.HistoryChanged -= OnHistoryChanged;
    }

    void Start()
    {
        try
        {
            UnityMessageBridge.SendToApp(EventReady, FurnitureSceneName);

            if (PendingBootAction == "furniture")
            {
                PendingBootAction = null;
                StartFurniturePlacement();
                return;
            }

            if (PendingBootAction == "measuredFurniture")
            {
                PendingBootAction = null;
                StartMeasuredFurniturePlacement();
                return;
            }

            if (PendingBootAction == "measure")
            {
                PendingBootAction = null;
                OpenRoomMeasurement();
                return;
            }

            // RN chooses furniture vs measurement — do not auto-scan when embedded.
            if (ARDesignHostDetect.IsEmbeddedInReactNative())
                return;

            if (autoStartScan)
                StartRoomScan();
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[ARSceneBridge] Startup failed: {e}");
            SendError("startupFailed", e.Message);
        }
    }

    // ── Inbound ───────────────────────────────────────────────────────────────

    /// <summary>Called by the native bridge. Never call this directly from Unity code.</summary>
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
            SendError("badMessage", $"Could not parse inbound message: {e.Message}");
            return;
        }

        if (message == null || string.IsNullOrEmpty(message.method))
        {
            SendError("badMessage", "Inbound message had no 'method'.");
            return;
        }

        Debug.Log($"[ARSceneBridge] ← {message.method}");

        switch (message.method)
        {
            case "openRoomMeasurement":
                OpenRoomMeasurement();
                break;

            case "openFurnitureDesign":
                OpenFurnitureDesign();
                break;

            case "openMeasuredFurnitureDesign":
                // Prefer RN dimensions when re-opening on an already-loaded design scene.
                if (!string.IsNullOrWhiteSpace(message.data))
                    MeasuredRoomHandoff.CaptureFromRnPayload(message.data);
                OpenMeasuredFurnitureDesign();
                break;

            case "ping":
                UnityMessageBridge.SendToApp(EventReady, SceneManager.GetActiveScene().name);
                break;

            case "requestClose":
            case "closeUnity":
                // Ask RN to confirm exit — wipe only after pauseFurniture.
                UnityMessageBridge.SendToApp("requestClose", FurnitureSceneName);
                break;

            case "pauseFurniture":
                SoftCloseFurniture(notifyRn: false);
                break;

            case "pauseMeasurement":
                // Wrong-scene no-op: measurement pause is owned by ARMeasurementRnBridge.
                Debug.Log("[ARSceneBridge] Ignoring pauseMeasurement on furniture scene.");
                break;

            case "reloadFurniture":
                ScheduleReloadFurniture();
                break;

            case "resumeFurniture":
                // Warm reopen — clear placed pieces only; keep GLB template cache.
                WarmResumeFurniture();
                break;

            case "prefetchFurniture":
                PrefetchFurnitureUrls(message.data);
                break;

            case "plannerOrbit":
                FindFirstObjectByType<ARDesignLayoutModeController>()?.ApplyOrbitFromRn(message.data);
                break;

            case "furnitureGesture":
                FindFirstObjectByType<FurnitureManipulator>()?.ApplyGestureFromRn(message.data);
                break;

            case "startRoomScan":
                StartRoomScan();
                break;

            case "startFurniturePlacement":
            case "beginFurniturePlacementOnly":
                StartFurniturePlacement();
                break;

            case "getScanStatus":
                GetScanStatus();
                break;

            case "confirmRoomScan":
                ConfirmRoomScan();
                break;

            case "spawnFurniture":
            case "selectFurniture": // legacy alias — RN used to send a bare catalog id
                SpawnFurniture(message.data);
                break;

            case "removeSelectedFurniture":
                RemoveSelectedFurniture();
                break;

            case "clearScene":
            case "clearFurniture": // legacy alias
                ClearScene();
                break;

            case "getCurrentLayout":
                GetCurrentLayout();
                break;

            case "exportLayout":
                // Defer off UnitySendMessage — sync export + SendToApp can deadlock UaaL.
                if (exportRoutine != null)
                    StopCoroutine(exportRoutine);
                exportRoutine = StartCoroutine(ExportLayoutRoutine());
                break;

            case "capturePhoto":
            case "savePhoto":
                CapturePhoto();
                break;

            case "undo":
                Undo();
                break;

            case "redo":
                Redo();
                break;

            default:
                SendError("unknownMethod", $"ARDesignScene does not handle '{message.method}'.");
                break;
        }
    }

    // ── RN-callable API ───────────────────────────────────────────────────────

    /// <summary>
    /// Loads the dedicated Unity AR Measurement scene (native HUDs).
    /// Used by RN "AR Measurement" instead of the RN Scanning-room overlay.
    /// </summary>
    public void OpenRoomMeasurement()
    {
        if (SceneManager.GetActiveScene().name == MeasurementSceneName)
            return;

        // Idle teardown before scene swap — do not restart furniture placement.
        SoftCloseFurniture(notifyRn: false);
        PendingBootAction = null;
        SceneManager.LoadScene(MeasurementSceneName);
    }

    /// <summary>
    /// Ensures ARDesignScene is active and unlocks furniture placement.
    /// Safe to call when returning from ARRoomMeasurement.
    /// </summary>
    public void OpenFurnitureDesign()
    {
        if (SceneManager.GetActiveScene().name == FurnitureSceneName)
        {
            StartFurniturePlacement();
            return;
        }

        PendingBootAction = "furniture";
        SceneManager.LoadScene(FurnitureSceneName);
    }

    /// <summary>
    /// Opens ARDesignScene with the measured room shell from <see cref="MeasuredRoomHandoff"/>
    /// so the user can place real GLB furniture on the generated layout.
    /// </summary>
    public void OpenMeasuredFurnitureDesign()
    {
        if (SceneManager.GetActiveScene().name == FurnitureSceneName)
        {
            StartMeasuredFurniturePlacement();
            return;
        }

        PendingBootAction = "measuredFurniture";
        SceneManager.LoadScene(FurnitureSceneName);
    }

    /// <summary>
    /// Applies a handed-off measured floor outline, rebuilds the planner shell, and
    /// unlocks furniture placement (does not use the synthetic open-floor furniture mode).
    /// </summary>
    public void StartMeasuredFurniturePlacement()
    {
        if (scanController == null)
        {
            SendError("notConfigured", "RoomScanController is missing from the scene.");
            return;
        }

        RuntimeGltfLoader.PurgeUnreadyTemplates();
        placementController?.ClearFurniture();
        layoutHistory?.Clear();

        if (!MeasuredRoomHandoff.TryConsume(out var corners, out var wallHeight))
        {
            // Fallback: re-parse RN payload after scene load.
            if (!string.IsNullOrWhiteSpace(MeasuredRoomHandoff.PendingRnJson))
                MeasuredRoomHandoff.CaptureFromRnPayload(MeasuredRoomHandoff.PendingRnJson);

            if (!MeasuredRoomHandoff.TryConsume(out corners, out wallHeight))
            {
                SendError(
                    "noMeasuredRoom",
                    "No measured room was handed off. Measure a room first, then place furniture.");
                return;
            }
        }

        MeasuredRoomHandoff.PendingRnJson = string.Empty;

        if (!scanController.ApplyMeasuredRoom(corners, wallHeight))
        {
            SendError("applyMeasuredRoomFailed", "Could not rebuild the measured room shell.");
            return;
        }

        // Ensure planner shell is visible even if phase listeners raced Start().
        // Force isometric Planner (not live RealRoom) so place-immediately + RN orbit work.
        roomMeshVisualizer?.RebuildFromSnapshot(scanController.ConfirmedRoom);
        var layoutMode = FindFirstObjectByType<ARDesignLayoutModeController>();
        layoutMode?.EnterLayoutMode();
        layoutMode?.ApplyMeasurementViewPreset(topDown: false);

        ARMainMenuBackButton.SetUiVisible(false);
        UnityMessageBridge.SendToApp("reloadComplete", FurnitureSceneName);
        Debug.Log("[ARSceneBridge] Measured furniture placement unlocked on handed-off room.");
    }

    /// <summary>Begins or restarts the room scan phase.</summary>
    public void StartRoomScan()
    {
        if (scanController == null)
        {
            SendError("notConfigured", "RoomScanController is missing from the scene.");
            return;
        }

        placementController?.ClearFurniture();
        layoutHistory?.Clear();
        scanController.StartRoomScan();
    }

    /// <summary>
    /// Skips height/corner measurement and unlocks live floor furniture placement
    /// (used by RN "AR Furniture").
    /// </summary>
    public void StartFurniturePlacement()
    {
        if (scanController == null)
        {
            SendError("notConfigured", "RoomScanController is missing from the scene.");
            return;
        }

        // Wipe any leftover measurement / planner shell before unlocking placement.
        roomMeshVisualizer?.Clear();
        FindFirstObjectByType<ARDesignLayoutModeController>()?.ForceLiveArCamera();
        RuntimeGltfLoader.PurgeUnreadyTemplates();

        placementController?.ClearFurniture();
        layoutHistory?.Clear();
        scanController.BeginFurniturePlacementOnly();

        // BeginFurniturePlacementOnly raises Confirmed — keep live AR, no shell.
        roomMeshVisualizer?.Clear();
        FindFirstObjectByType<ARDesignLayoutModeController>()?.ForceLiveArCamera();
    }

    /// <summary>
    /// Warm reopen: wipe placed furniture and re-arm live placement without
    /// destroying RuntimeGltfLoader templates (those survive for instant re-place).
    /// </summary>
    void WarmResumeFurniture()
    {
        if (exportRoutine != null)
        {
            StopCoroutine(exportRoutine);
            exportRoutine = null;
        }

        // Drop solid-gray templates so the next place reloads with textures.
        RuntimeGltfLoader.PurgeUnreadyTemplates();

        placementController?.ClearFurniture();
        layoutHistory?.Clear();
        roomMeshVisualizer?.Clear();
        FindFirstObjectByType<ARDesignLayoutModeController>()?.ForceLiveArCamera();

        if (scanController == null)
        {
            SendError("notConfigured", "RoomScanController is missing from the scene.");
            return;
        }

        if (!scanController.IsFurniturePlacementOnly || !scanController.IsConfirmed)
            scanController.BeginFurniturePlacementOnly();
        else
            FindFirstObjectByType<ARDesignLayoutModeController>()?.ForceLiveArCamera();

        roomMeshVisualizer?.Clear();
        ARMainMenuBackButton.SetUiVisible(true);
        UnityMessageBridge.SendToApp("reloadComplete", FurnitureSceneName);
    }

    [Serializable]
    class PrefetchFurniturePayload
    {
        public string[] urls;
    }

    void PrefetchFurnitureUrls(string json)
    {
        var loader = FindFirstObjectByType<RuntimeGltfLoader>();
        if (loader == null || !RuntimeGltfLoader.IsSupported) return;

        if (string.IsNullOrWhiteSpace(json)) return;

        try
        {
            var payload = JsonUtility.FromJson<PrefetchFurniturePayload>(json);
            if (payload?.urls == null) return;
            // Only warm the first URL — full catalog prefetch crashes low-RAM devices.
            for (var i = 0; i < payload.urls.Length && i < 1; i++)
            {
                var url = payload.urls[i];
                if (!string.IsNullOrWhiteSpace(url))
                    loader.Prefetch(url.Trim());
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[ARSceneBridge] Bad prefetchFurniture payload: {e.Message}");
        }
    }

    /// <summary>
    /// RN is leaving AR Furniture — idle teardown only (no BeginFurniturePlacementOnly).
    /// Placement unlock happens on open/reload / PendingBootAction.
    /// </summary>
    void SoftCloseFurniture(bool notifyRn)
    {
        if (exportRoutine != null)
        {
            StopCoroutine(exportRoutine);
            exportRoutine = null;
        }

        if (furnitureReloadRoutine != null)
        {
            StopCoroutine(furnitureReloadRoutine);
            furnitureReloadRoutine = null;
        }

        placementController?.ClearFurniture();
        layoutHistory?.Clear();
        roomMeshVisualizer?.Clear();

        var edgeVisualizer = FindFirstObjectByType<ARDesignEdgeVisualizer>(FindObjectsInactive.Include);
        if (edgeVisualizer != null)
            edgeVisualizer.enabled = false;

        FindFirstObjectByType<ARDesignLayoutModeController>()?.ForceLiveArCamera();
        scanController?.ResetToIdle();

        ARMainMenuBackButton.SetUiVisible(false);

        if (notifyRn)
            UnityMessageBridge.SendToApp("requestClose", FurnitureSceneName);
    }

    Coroutine furnitureReloadRoutine;

    void ScheduleReloadFurniture()
    {
        if (furnitureReloadRoutine != null)
            StopCoroutine(furnitureReloadRoutine);
        furnitureReloadRoutine = StartCoroutine(ReloadFurnitureRoutine());
    }

    System.Collections.IEnumerator ReloadFurnitureRoutine()
    {
        yield return null;

        if (SceneManager.GetActiveScene().name != FurnitureSceneName)
        {
            PendingBootAction = "furniture";
            SceneManager.LoadScene(FurnitureSceneName);
            furnitureReloadRoutine = null;
            yield break;
        }

        SoftCloseFurniture(notifyRn: false);
        StartFurniturePlacement();
        ARMainMenuBackButton.SetUiVisible(true);
        // Distinct from cold unityReady so RN does not double-boot open/reload.
        UnityMessageBridge.SendToApp("reloadComplete", FurnitureSceneName);
        furnitureReloadRoutine = null;
    }

    /// <summary>Pushes the current scan coverage to RN and returns it for in-editor use.</summary>
    public ScanStatusPayload GetScanStatus()
    {
        if (scanController == null)
        {
            SendError("notConfigured", "RoomScanController is missing from the scene.");
            return null;
        }

        var status = scanController.GetScanStatus();
        UnityMessageBridge.SendToApp(EventScanStatus, JsonUtility.ToJson(status));
        return status;
    }

    /// <summary>Locks the current geometry in as the room layout and unlocks placement.</summary>
    public void ConfirmRoomScan()
    {
        if (scanController == null)
        {
            SendError("notConfigured", "RoomScanController is missing from the scene.");
            return;
        }

        if (!scanController.ConfirmRoomScan())
            SendError("scanIncomplete", "Not enough of the room has been scanned to confirm yet.");
    }

    /// <summary>
    /// Spawns a furniture model. <paramref name="payload"/> is a
    /// <see cref="SpawnFurnitureRequest"/> JSON string; a bare id is also accepted
    /// so the existing RN selectFurniture call keeps working.
    /// </summary>
    public void SpawnFurniture(string payload)
    {
        if (placementController == null)
        {
            SendError("notConfigured", "FurniturePlacementController is missing from the scene.");
            return;
        }

        placementController.SpawnFurniture(ParseSpawnRequest(payload));
    }

    /// <summary>Direct entry point for native callers that prefer positional arguments.</summary>
    public void SpawnFurniture(string modelId, string glbUrl, float width, float height, float depth)
    {
        placementController?.SpawnFurniture(new SpawnFurnitureRequest
        {
            modelId = modelId,
            catalogId = modelId,
            glbUrl = glbUrl,
            width = width,
            height = height,
            depth = depth,
        });
    }

    /// <summary>Destroys the currently selected instance.</summary>
    public void RemoveSelectedFurniture()
    {
        if (placementController == null) return;

        if (placementController.RemoveSelectedFurniture() == null)
            SendError("nothingSelected", "No furniture is selected.");
    }

    /// <summary>
    /// Removes all placed furniture. The confirmed room scan is kept, so the user
    /// can start over on layout without re-scanning — call StartRoomScan for that.
    /// </summary>
    public void ClearScene()
    {
        placementController?.ClearFurniture();
        layoutHistory?.Clear();
        SendLayout();
        SendHistory();
    }

    public void Undo()
    {
        if (layoutHistory == null || !layoutHistory.Undo())
        {
            SendError("nothingToUndo", "Nothing to undo.");
            return;
        }

        SendLayout();
        SendHistory();
    }

    public void Redo()
    {
        if (layoutHistory == null || !layoutHistory.Redo())
        {
            SendError("nothingToRedo", "Nothing to redo.");
            return;
        }

        SendLayout();
        SendHistory();
    }

    /// <summary>Pushes the full in-session layout to RN and returns it for in-editor use.</summary>
    public LayoutPayload GetCurrentLayout()
    {
        if (placementController == null)
        {
            SendError("notConfigured", "FurniturePlacementController is missing from the scene.");
            return null;
        }

        var layout = placementController.BuildLayout();
        UnityMessageBridge.SendToApp(EventLayoutChanged, JsonUtility.ToJson(layout));
        return layout;
    }

    /// <summary>
    /// Writes the room + furniture to a single .glb and reports the path.
    /// RN reads the file by path — the bytes are never sent over the bridge.
    /// </summary>
    public ExportResultPayload ExportLayout()
    {
        if (exportService == null)
        {
            var failure = new ExportResultPayload
            {
                success = false,
                error = "LayoutExportService is missing from the scene.",
            };

            UnityMessageBridge.SendToApp(EventExportComplete, JsonUtility.ToJson(failure));
            return failure;
        }

        var result = exportService.ExportLayout();
        UnityMessageBridge.SendToApp(EventExportComplete, JsonUtility.ToJson(result));
        return result;
    }

    System.Collections.IEnumerator ExportLayoutRoutine()
    {
        UnityMessageBridge.SendToApp("exportStarted", FurnitureSceneName);
        yield return null;

        ExportResultPayload result;
        try
        {
            if (exportService == null)
            {
                result = new ExportResultPayload
                {
                    success = false,
                    error = "LayoutExportService is missing from the scene.",
                };
            }
            else
            {
                result = exportService.ExportLayout() ?? new ExportResultPayload
                {
                    success = false,
                    error = "Export returned no result.",
                };
            }
        }
        catch (System.Exception e)
        {
            result = new ExportResultPayload
            {
                success = false,
                error = e.Message,
            };
        }

        result.path = result.path ?? string.Empty;
        result.fileName = result.fileName ?? string.Empty;
        result.error = result.error ?? string.Empty;
        yield return null;
        UnityMessageBridge.SendToApp(EventExportComplete, JsonUtility.ToJson(result));
        exportRoutine = null;
    }

    /// <summary>
    /// Screenshots the live AR view and emits <c>photoCaptured</c> to RN
    /// (gallery + app path). Uses the catalog UI capture path so behavior matches
    /// the native Save Photo button.
    /// </summary>
    public void CapturePhoto()
    {
        var catalogUi = FindFirstObjectByType<ARDesignFurnitureCatalogUI>(FindObjectsInactive.Include);
        if (catalogUi == null)
        {
            SendError("notConfigured", "Photo capture is missing from the scene.");
            return;
        }

        catalogUi.CapturePhoto();
    }

    // ── Outbound ──────────────────────────────────────────────────────────────

    void OnScanStatusChanged(ScanStatusPayload status)
    {
        UnityMessageBridge.SendToApp(EventScanStatus, JsonUtility.ToJson(status));
    }

    void OnScanPhaseChanged(RoomScanController.ScanPhase phase)
    {
        if (phase != RoomScanController.ScanPhase.Confirmed) return;

        // Furniture-only uses a synthetic open floor for placement bounds — never
        // rebuild the planner room shell (that is what made the last measurement "stick").
        if (scanController != null && scanController.IsFurniturePlacementOnly)
        {
            roomMeshVisualizer?.Clear();
            FindFirstObjectByType<ARDesignLayoutModeController>()?.ForceLiveArCamera();
        }
        else
        {
            roomMeshVisualizer?.RebuildFromSnapshot(scanController.ConfirmedRoom);
        }

        var payload = RoomMeasurementPayloadBuilder.Build(scanController);

        UnityMessageBridge.SendToApp(EventScanConfirmed, JsonUtility.ToJson(payload));
    }

    void OnFurniturePlaced(PlacedFurniture furniture)
    {
        UnityMessageBridge.SendToApp(EventFurniturePlaced, JsonUtility.ToJson(furniture.ToPayload()));
        SendLayout();
    }

    /// <summary>
    /// GLB/prefab finished loading and is armed (or already placed in planner).
    /// RN uses this to clear the "Loading furniture…" status before floor tap.
    /// </summary>
    void OnModelReady(string modelId)
    {
        UnityMessageBridge.SendToApp(EventFurnitureReady, modelId ?? string.Empty);
    }

    void OnFurnitureRemoved(string instanceId)
    {
        UnityMessageBridge.SendToApp(EventFurnitureRemoved, instanceId);
        SendLayout();
    }

    void OnSelectionChanged(PlacedFurniture furniture)
    {
        var payload = new SelectionPayload
        {
            instanceId = furniture != null ? furniture.InstanceId : string.Empty,
            modelId = furniture != null ? furniture.ModelId : string.Empty,
            selected = furniture != null,
        };

        UnityMessageBridge.SendToApp(EventFurnitureSelected, JsonUtility.ToJson(payload));
    }

    void OnPlacementSafetyChanged(FurniturePlacementSafety.Result result, PlacedFurniture furniture)
    {
        var payload = new PlacementSafetyPayload
        {
            instanceId = furniture != null ? furniture.InstanceId : string.Empty,
            modelId = furniture != null ? furniture.ModelId : string.Empty,
            isSafe = result.isSafe,
            hasFurnitureCollision = result.hasFurnitureCollision,
            hasWallCollision = result.hasWallCollision,
            isTooCloseToWall = result.isTooCloseToWall,
            nearestFurnitureDistance = float.IsFinite(result.nearestFurnitureDistance)
                ? result.nearestFurnitureDistance
                : -1f,
            nearestWallDistance = float.IsFinite(result.nearestWallDistance)
                ? result.nearestWallDistance
                : -1f,
            reason = result.reason ?? string.Empty,
        };

        UnityMessageBridge.SendToApp(EventPlacementSafety, JsonUtility.ToJson(payload));
    }

    void OnSpawnFailed(string code, string message)
    {
        SendError(code, message);
    }

    void OnHistoryChanged()
    {
        SendHistory();
    }

    void SendLayout()
    {
        if (placementController == null) return;

        UnityMessageBridge.SendToApp(
            EventLayoutChanged,
            JsonUtility.ToJson(placementController.BuildLayout()));
    }

    void SendHistory()
    {
        if (layoutHistory == null) return;

        UnityMessageBridge.SendToApp(
            EventHistoryChanged,
            JsonUtility.ToJson(layoutHistory.BuildState()));
    }

    void SendError(string code, string message)
    {
        Debug.LogWarning($"[ARSceneBridge] {code}: {message}");

        UnityMessageBridge.SendToApp(EventError, JsonUtility.ToJson(new ARDesignErrorPayload
        {
            code = code,
            message = message,
        }));
    }

    // ── Parsing ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Accepts either a full SpawnFurnitureRequest JSON object or a bare catalog
    /// id string, so the pre-existing RN selectFurniture call still works.
    /// </summary>
    static SpawnFurnitureRequest ParseSpawnRequest(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return new SpawnFurnitureRequest();

        var trimmed = payload.Trim();

        if (trimmed.StartsWith("{"))
        {
            try
            {
                var request = JsonUtility.FromJson<SpawnFurnitureRequest>(trimmed);
                if (request != null) return request;
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"[ARSceneBridge] Falling back to id-only spawn — bad JSON: {e.Message}");
            }
        }

        return new SpawnFurnitureRequest
        {
            modelId = trimmed,
            catalogId = trimmed,
        };
    }
}
