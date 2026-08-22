using UnityEngine;

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

    // Event names. Keep in sync with UnityToRNEvent in frontend/types/unity-bridge.ts.
    const string EventReady = "unityReady";
    const string EventScanStatus = "scanStatus";
    const string EventScanConfirmed = "roomScanConfirmed";
    const string EventFurniturePlaced = "furniturePlaced";
    const string EventFurnitureRemoved = "furnitureRemoved";
    const string EventFurnitureSelected = "furnitureSelected";
    const string EventLayoutChanged = "layoutChanged";
    const string EventExportComplete = "exportComplete";
    const string EventHistoryChanged = "historyChanged";
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
            placementController.FurnitureRemoved += OnFurnitureRemoved;
            placementController.SelectionChanged += OnSelectionChanged;
            placementController.SpawnFailed += OnSpawnFailed;
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
            placementController.FurnitureRemoved -= OnFurnitureRemoved;
            placementController.SelectionChanged -= OnSelectionChanged;
            placementController.SpawnFailed -= OnSpawnFailed;
        }

        if (layoutHistory != null)
            layoutHistory.HistoryChanged -= OnHistoryChanged;
    }

    void Start()
    {
        try
        {
            UnityMessageBridge.SendToApp(EventReady, "ARDesignScene");

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
            case "startRoomScan":
                StartRoomScan();
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
                ExportLayout();
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

    // ── Outbound ──────────────────────────────────────────────────────────────

    void OnScanStatusChanged(ScanStatusPayload status)
    {
        UnityMessageBridge.SendToApp(EventScanStatus, JsonUtility.ToJson(status));
    }

    void OnScanPhaseChanged(RoomScanController.ScanPhase phase)
    {
        if (phase != RoomScanController.ScanPhase.Confirmed) return;

        roomMeshVisualizer?.RebuildFromSnapshot(scanController.ConfirmedRoom);

        var room = scanController.ConfirmedRoom;
        var payload = new ScanStatusPayload
        {
            phase = "confirmed",
            progress = 1f,
            readyToConfirm = true,
            confirmed = true,
            planeCount = room?.planeCount ?? 0,
            meshChunkCount = room?.meshChunkCount ?? 0,
            hint = "confirmed",
        };

        UnityMessageBridge.SendToApp(EventScanConfirmed, JsonUtility.ToJson(payload));
    }

    void OnFurniturePlaced(PlacedFurniture furniture)
    {
        UnityMessageBridge.SendToApp(EventFurniturePlaced, JsonUtility.ToJson(furniture.ToPayload()));
        SendLayout();
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
