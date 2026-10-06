using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Builds bridge + API payloads for confirmed room measurements.
/// </summary>
public static class RoomMeasurementPayloadBuilder
{
    public static RoomConfirmedPayload Build(RoomScanController scanController)
    {
        if (scanController == null)
            return new RoomConfirmedPayload { phase = "confirmed", confirmed = true };

        var status = scanController.GetScanStatus();
        var room = scanController.ConfirmedRoom;
        var wallHeight = scanController.CornerBuilder != null
            ? scanController.CornerBuilder.WallHeight
            : 0f;

        var dims = RoomMeasurementUtil.Compute(
            room,
            scanController.FloorPolygon,
            wallHeight,
            status.horizontalAreaSqm);

        var payload = new RoomConfirmedPayload
        {
            phase = "confirmed",
            progress = 1f,
            readyToConfirm = true,
            confirmed = true,
            planeCount = status.planeCount,
            horizontalPlaneCount = status.horizontalPlaneCount,
            verticalPlaneCount = status.verticalPlaneCount,
            meshChunkCount = status.meshChunkCount,
            pointCount = status.pointCount,
            horizontalAreaSqm = status.horizontalAreaSqm,
            verticalAreaSqm = status.verticalAreaSqm,
            lookAroundCoverage = status.lookAroundCoverage,
            hint = "confirmed",
            width = dims.width,
            depth = dims.depth,
            height = dims.height,
            floorAreaSqm = dims.floorAreaSqm,
            wallHeight = dims.wallHeight,
            dimensionLabel = dims.dimensionLabel,
            cornerCount = scanController.FloorPolygon?.Count ?? 0,
            furniturePlacementOnly = scanController.IsFurniturePlacementOnly,
        };

        if (dims.hasBounds)
        {
            payload.boundsMin = new ARDesignVec3(dims.boundsMin);
            payload.boundsMax = new ARDesignVec3(dims.boundsMax);
        }

        payload.floorPolygon = BuildPolygon(scanController.FloorPolygon);
        ApplyRoomModel(payload, scanController.FloorPolygon, dims.height);
        return payload;
    }

    static void ApplyRoomModel(RoomConfirmedPayload payload, IReadOnlyList<Vector3> polygon, float height)
    {
        var walls = RoomPolygonUtil.BuildWalls(polygon);
        payload.walls = new RoomWallPayload[walls.Count];
        for (var i = 0; i < walls.Count; i++)
        {
            payload.walls[i] = new RoomWallPayload
            {
                index = walls[i].index,
                start = new ARDesignVec3(walls[i].start),
                end = new ARDesignVec3(walls[i].end),
                length = walls[i].length,
            };
        }

        payload.floorY = RoomPolygonUtil.ComputeFloorY(polygon);
        payload.perimeterM = RoomPolygonUtil.ComputePerimeter(polygon);
        payload.volumeM3 = payload.floorAreaSqm * height;
        var spatial = Object.FindFirstObjectByType<ARDesignSpatialMappingController>();
        payload.openings = spatial != null
            ? spatial.ToOpeningPayloads()
            : System.Array.Empty<RoomOpeningPayload>();
        payload.obstacles = spatial != null
            ? spatial.ToObstaclePayloads()
            : System.Array.Empty<RoomObstaclePayload>();

        var errors = RoomPolygonUtil.Validate(polygon);
        payload.validation = new RoomValidationPayload
        {
            isValid = errors.Count == 0,
            errors = errors.ToArray(),
        };
    }

    static RoomPolygonPayload BuildPolygon(IReadOnlyList<Vector3> polygon)
    {
        if (polygon == null || polygon.Count == 0)
            return new RoomPolygonPayload();

        var points = new ARDesignVec3[polygon.Count];
        for (var i = 0; i < polygon.Count; i++)
            points[i] = new ARDesignVec3(polygon[i]);

        return new RoomPolygonPayload { points = points };
    }
}
