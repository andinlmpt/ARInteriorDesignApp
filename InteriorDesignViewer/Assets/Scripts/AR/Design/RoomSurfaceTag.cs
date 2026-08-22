using UnityEngine;

/// <summary>Marks a confirmed-room mesh so placement can prefer floor hits.</summary>
public class RoomSurfaceTag : MonoBehaviour
{
    public RoomGeometrySnapshot.SurfaceKind kind;

    /// <summary>Unit normal pointing outside the room (orbit cutaway).</summary>
    public Vector3 outwardNormal;

    /// <summary>Midpoint used when deciding cutaway visibility.</summary>
    public Vector3 midpoint;

    public bool HasCutawayData =>
        (kind == RoomGeometrySnapshot.SurfaceKind.Wall
         || kind == RoomGeometrySnapshot.SurfaceKind.Ceiling)
        && outwardNormal.sqrMagnitude > 1e-6f;
}
