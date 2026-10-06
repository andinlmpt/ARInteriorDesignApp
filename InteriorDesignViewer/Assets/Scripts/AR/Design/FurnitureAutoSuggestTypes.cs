using System;
using UnityEngine;

/// <summary>Pending furniture detection — not saved until the user taps to accept.</summary>
[Serializable]
public struct FurnitureAutoSuggestion
{
    public string id;
    public string type;
    public Vector3 center;
    public Vector3 size;
    /// <summary>Degrees around Y, same convention as RoomObstaclePayload.yaw.</summary>
    public float yaw;
    public float confidence;
    /// <summary>"plane" | "coco"</summary>
    public string source;
}
