using System;
using UnityEngine;

/// <summary>
/// Carries a confirmed floor outline from ARRoomMeasurement into ARDesignScene
/// so furniture can be placed on the measured shell after a scene load.
/// </summary>
public static class MeasuredRoomHandoff
{
    public static bool HasData { get; private set; }
    public static float WallHeight { get; private set; } = 2.5f;
    public static string RoomName { get; private set; } = string.Empty;
    /// <summary>RN roomScanConfirmed JSON kept as fallback after scene load.</summary>
    public static string PendingRnJson { get; set; } = string.Empty;

    static Vector3[] floorCorners;

    public static void CaptureFrom(RoomScanController scan, string roomName = null)
    {
        Clear();
        if (scan == null)
        {
            Debug.LogWarning("[MeasuredRoomHandoff] CaptureFrom — RoomScanController is null.");
            return;
        }

        RoomName = roomName ?? string.Empty;

        var poly = scan.FloorPolygon;
        if (poly != null && poly.Count >= 3)
        {
            floorCorners = new Vector3[poly.Count];
            for (var i = 0; i < poly.Count; i++)
                floorCorners[i] = poly[i];
        }
        else
        {
            var room = scan.ConfirmedRoom;
            if (room == null || !room.hasBounds)
            {
                Debug.LogWarning(
                    "[MeasuredRoomHandoff] CaptureFrom — no floor polygon and no confirmed bounds.");
                return;
            }

            ApplyBounds(room.bounds, room.floorY);
        }

        WallHeight = 2.5f;
        var cornerBuilder = scan.CornerBuilder != null
            ? scan.CornerBuilder
            : UnityEngine.Object.FindFirstObjectByType<ARDesignCornerRoomBuilder>();
        if (cornerBuilder != null && cornerBuilder.WallHeight >= 0.5f)
            WallHeight = cornerBuilder.WallHeight;
        else if (scan.ConfirmedRoom != null && scan.ConfirmedRoom.hasBounds)
            WallHeight = Mathf.Max(0.5f, scan.ConfirmedRoom.bounds.size.y);

        HasData = floorCorners != null && floorCorners.Length >= 3;
        LogCapture("scan");
    }

    /// <summary>
    /// Fallback when the live scan controller has already been torn down — use the
    /// dimensions RN received in <c>roomScanConfirmed</c>.
    /// </summary>
    public static void CaptureFromRnPayload(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return;

        MeasuredRoomRnPayload payload;
        try
        {
            payload = JsonUtility.FromJson<MeasuredRoomRnPayload>(json);
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[MeasuredRoomHandoff] Bad RN payload: {e.Message}");
            return;
        }

        if (payload == null) return;

        // Prefer explicit polygon when RN still has it.
        if (payload.floorPolygon != null && payload.floorPolygon.Length >= 3)
        {
            Clear();
            RoomName = payload.roomName ?? string.Empty;
            floorCorners = new Vector3[payload.floorPolygon.Length];
            for (var i = 0; i < payload.floorPolygon.Length; i++)
            {
                var p = payload.floorPolygon[i];
                floorCorners[i] = new Vector3(p.x, p.y, p.z);
            }

            WallHeight = payload.wallHeight >= 0.5f
                ? payload.wallHeight
                : (payload.height >= 0.5f ? payload.height : 2.5f);
            HasData = true;
            LogCapture("rn-polygon");
            return;
        }

        // Axis-aligned shell from width × depth × height (centred on origin).
        if (payload.width > 0.2f && payload.depth > 0.2f)
        {
            Clear();
            RoomName = payload.roomName ?? string.Empty;
            var halfW = payload.width * 0.5f;
            var halfD = payload.depth * 0.5f;
            var y = 0f;
            if (payload.boundsMin != null)
                y = payload.boundsMin.y;

            floorCorners = new[]
            {
                new Vector3(-halfW, y, -halfD),
                new Vector3(halfW, y, -halfD),
                new Vector3(halfW, y, halfD),
                new Vector3(-halfW, y, halfD),
            };
            WallHeight = payload.wallHeight >= 0.5f
                ? payload.wallHeight
                : (payload.height >= 0.5f ? payload.height : 2.5f);
            HasData = true;
            LogCapture("rn-dims");
            return;
        }

        if (payload.boundsMin != null && payload.boundsMax != null)
        {
            Clear();
            RoomName = payload.roomName ?? string.Empty;
            var min = new Vector3(payload.boundsMin.x, payload.boundsMin.y, payload.boundsMin.z);
            var max = new Vector3(payload.boundsMax.x, payload.boundsMax.y, payload.boundsMax.z);
            var bounds = new Bounds();
            bounds.SetMinMax(min, max);
            ApplyBounds(bounds, min.y);
            WallHeight = payload.wallHeight >= 0.5f
                ? payload.wallHeight
                : (payload.height >= 0.5f ? payload.height : Mathf.Max(0.5f, bounds.size.y));
            HasData = floorCorners != null && floorCorners.Length >= 3;
            LogCapture("rn-bounds");
        }
    }

    static void ApplyBounds(Bounds b, float floorY)
    {
        var y = float.IsFinite(floorY) ? floorY : b.min.y;
        floorCorners = new[]
        {
            new Vector3(b.min.x, y, b.min.z),
            new Vector3(b.max.x, y, b.min.z),
            new Vector3(b.max.x, y, b.max.z),
            new Vector3(b.min.x, y, b.max.z),
        };
    }

    public static bool TryConsume(out Vector3[] corners, out float wallHeight)
    {
        corners = floorCorners;
        wallHeight = WallHeight;
        var ok = HasData && corners != null && corners.Length >= 3;
        // Keep the array reference in `corners`; only clear static ownership.
        floorCorners = null;
        HasData = false;
        RoomName = string.Empty;
        WallHeight = 2.5f;
        return ok;
    }

    public static void Clear()
    {
        HasData = false;
        floorCorners = null;
        WallHeight = 2.5f;
        RoomName = string.Empty;
    }

    static void LogCapture(string source)
    {
        if (!HasData)
        {
            Debug.LogWarning($"[MeasuredRoomHandoff] Capture ({source}) failed.");
            return;
        }

        Debug.Log(
            $"[MeasuredRoomHandoff] Captured via {source}: {floorCorners.Length} corners, " +
            $"wallHeight={WallHeight:F2}m.");
    }

    [Serializable]
    public class MeasuredRoomRnPayload
    {
        public string roomName;
        public float width;
        public float depth;
        public float height;
        public float wallHeight;
        public ARDesignVec3 boundsMin;
        public ARDesignVec3 boundsMax;
        public ARDesignVec3[] floorPolygon;
    }
}
