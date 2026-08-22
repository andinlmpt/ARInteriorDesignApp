using System;
using System.Collections.Generic;

/// <summary>
/// Serializable payloads exchanged between ARDesignScene and React Native.
///
/// The transport is the existing bridge convention:
///   RN → Unity   UnitySendMessage("Managers", "ReceiveMessage", "{\"method\":..,\"data\":..}")
///   Unity → RN   NativeAPI.SendMessageToRN("{\"event\":..,\"data\":..}")
///
/// "data" is always a STRING. Structured payloads are JSON-encoded into that
/// string, so RN must JSON.parse(msg.data) for the events that carry objects.
/// All types here are JsonUtility-compatible (no dictionaries, no nullables).
/// </summary>
[Serializable]
public class ARDesignInboundMessage
{
    public string method;
    public string data;
}

/// <summary>Vector payload — JsonUtility cannot serialize UnityEngine.Vector3 fields reliably across versions.</summary>
[Serializable]
public class ARDesignVec3
{
    public float x;
    public float y;
    public float z;

    public ARDesignVec3() { }

    public ARDesignVec3(UnityEngine.Vector3 v)
    {
        x = v.x;
        y = v.y;
        z = v.z;
    }
}

/// <summary>Payload for SpawnFurniture. Sent by RN as a JSON string in "data".</summary>
[Serializable]
public class SpawnFurnitureRequest
{
    /// <summary>Stable id from the RN catalog. Echoed back on every layout/export payload.</summary>
    public string modelId;

    /// <summary>Remote or local GLB/glTF to load at runtime. Requires glTFast (see RuntimeGltfLoader).</summary>
    public string glbUrl;

    /// <summary>Optional id into the built-in Unity FurnitureCatalog, used when glbUrl is empty.</summary>
    public string catalogId;

    /// <summary>Real-world size in metres. Zero means "keep the model's authored scale".</summary>
    public float width;
    public float height;
    public float depth;
}

/// <summary>Scan coverage/quality snapshot returned by GetScanStatus and pushed on scanProgress.</summary>
[Serializable]
public class ScanStatusPayload
{
    /// <summary>"idle" | "scanning" | "readyToConfirm" | "confirmed".</summary>
    public string phase;

    /// <summary>0..1 overall coverage estimate.</summary>
    public float progress;

    public bool readyToConfirm;
    public bool confirmed;

    public int planeCount;
    public int horizontalPlaneCount;
    public int verticalPlaneCount;
    public int meshChunkCount;
    public int pointCount;

    public float horizontalAreaSqm;
    public float verticalAreaSqm;

    /// <summary>0..1 fraction of the yaw circle the user has pointed the camera at.</summary>
    public float lookAroundCoverage;

    /// <summary>Short machine-readable hint for the RN copy, e.g. "moveAround", "findFloor", "scanWalls".</summary>
    public string hint;
}

/// <summary>One placed furniture instance.</summary>
[Serializable]
public class PlacedFurniturePayload
{
    public string instanceId;
    public string modelId;
    public ARDesignVec3 position;

    /// <summary>Y-axis rotation in degrees. Furniture never tilts.</summary>
    public float rotationY;

    /// <summary>Uniform scale multiplier relative to the model's real-world size (1 = true scale).</summary>
    public float scale;

    /// <summary>Real-world bounding size in metres at the current scale.</summary>
    public ARDesignVec3 dimensions;

    public bool selected;
}

/// <summary>Full in-session layout returned by GetCurrentLayout.</summary>
[Serializable]
public class LayoutPayload
{
    public string phase;
    public bool roomConfirmed;
    public int roomMeshCount;
    public int count;
    public List<PlacedFurniturePayload> furniture = new();
}

/// <summary>Result of ExportLayout. The GLB is written to disk; RN reads it by path.</summary>
[Serializable]
public class ExportResultPayload
{
    public bool success;

    /// <summary>Absolute path under Application.persistentDataPath. Empty on failure.</summary>
    public string path;

    public string fileName;
    public long byteLength;
    public int furnitureCount;
    public int roomMeshCount;
    public string error;
}

/// <summary>Emitted whenever the selection changes (instanceId empty means "nothing selected").</summary>
[Serializable]
public class SelectionPayload
{
    public string instanceId;
    public string modelId;
    public bool selected;
}

/// <summary>Emitted when a spawn request cannot be fulfilled.</summary>
[Serializable]
public class ARDesignErrorPayload
{
    public string code;
    public string message;
}

/// <summary>Undo / redo availability pushed after layout history changes.</summary>
[Serializable]
public class HistoryStatePayload
{
    public bool canUndo;
    public bool canRedo;
    public int undoCount;
    public int redoCount;
}
