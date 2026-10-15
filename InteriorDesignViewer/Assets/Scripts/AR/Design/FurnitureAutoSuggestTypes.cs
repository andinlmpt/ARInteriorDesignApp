using System;
using UnityEngine;

/// <summary>Pending furniture detection — saved when the user taps it, or by itself once seen consistently.</summary>
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
    /// <summary>How many scans have seen it (0 or 1 = once). Seen twice, the furniture step adds it by itself.</summary>
    public int sightings;
}
