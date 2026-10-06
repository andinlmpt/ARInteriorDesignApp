/**
 * Room measurement controller — persists AR scan dimensions to MongoDB.
 */

import mongoose from 'mongoose';
import RoomMeasurement from '../models/RoomMeasurement.js';
import {
  computeRoomGeometry,
  sanitizeObstacles,
  sanitizeOpenings,
} from '../utils/roomGeometry.js';

/** Fill room-model fields for rooms saved before walls/perimeter/volume existed. */
const withRoomModel = (doc) => {
  const hasModel = Array.isArray(doc.walls) && doc.walls.length > 0;
  if (hasModel) {
    return {
      floorY: doc.floorY ?? 0,
      perimeterM: doc.perimeterM ?? 0,
      volumeM3: doc.volumeM3 ?? 0,
      walls: doc.walls,
      validation: doc.validation || { isValid: true, errors: [] },
    };
  }
  const geometry = computeRoomGeometry(doc.floorPolygon || [], doc.wallHeight || doc.height);
  return {
    floorY: geometry.floorY,
    perimeterM: geometry.perimeterM,
    volumeM3: geometry.volumeM3 || (doc.floorAreaSqm || 0) * (doc.height || 0),
    walls: geometry.walls,
    validation: geometry.validation,
  };
};

const toPublicMeasurement = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId || '',
  projectId: doc.projectId || '',
  name: doc.name || 'Room scan',
  width: doc.width,
  depth: doc.depth,
  height: doc.height,
  floorAreaSqm: doc.floorAreaSqm ?? 0,
  wallHeight: doc.wallHeight ?? 0,
  dimensionLabel: doc.dimensionLabel || '',
  boundsMin: doc.boundsMin || null,
  boundsMax: doc.boundsMax || null,
  floorPolygon: doc.floorPolygon || [],
  ...withRoomModel(doc),
  openings: doc.openings || [],
  obstacles: doc.obstacles || [],
  scanMetadata: doc.scanMetadata || {},
  confirmedAt: doc.confirmedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  exportPath: doc.exportPath || '',
  exportFileName: doc.exportFileName || '',
  exportByteLength: doc.exportByteLength ?? 0,
  exportFurnitureCount: doc.exportFurnitureCount ?? 0,
  exportedAt: doc.exportedAt || null,
});

const requireMongo = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      error: 'MongoDB is not connected. Start the backend with a valid MONGODB_URI.',
    });
    return false;
  }
  return true;
};

const roomMeasurementController = {
  async createMeasurement(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const {
        projectId,
        name,
        width,
        depth,
        height,
        floorAreaSqm,
        wallHeight,
        dimensionLabel,
        boundsMin,
        boundsMax,
        floorPolygon,
        openings,
        obstacles,
        scanMetadata,
        confirmedAt,
      } = req.body ?? {};

      if (
        typeof width !== 'number' ||
        typeof depth !== 'number' ||
        typeof height !== 'number' ||
        width <= 0 ||
        depth <= 0 ||
        height <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'width, depth, and height (metres) are required and must be positive numbers.',
        });
      }

      const userId = req.user?.userId || req.user?.id || '';
      const polygon = Array.isArray(floorPolygon) ? floorPolygon : [];
      const geometry = computeRoomGeometry(polygon, typeof wallHeight === 'number' ? wallHeight : height);

      const doc = await RoomMeasurement.create({
        userId,
        projectId: projectId ? String(projectId).trim() : '',
        name: name ? String(name).trim() : 'Room scan',
        width,
        depth,
        height,
        floorAreaSqm: typeof floorAreaSqm === 'number' ? floorAreaSqm : 0,
        wallHeight: typeof wallHeight === 'number' ? wallHeight : height,
        dimensionLabel: dimensionLabel ? String(dimensionLabel).trim() : '',
        boundsMin: boundsMin || undefined,
        boundsMax: boundsMax || undefined,
        floorPolygon: polygon,
        floorY: geometry.floorY,
        perimeterM: geometry.perimeterM,
        volumeM3: geometry.volumeM3 || (typeof floorAreaSqm === 'number' ? floorAreaSqm * height : 0),
        walls: geometry.walls,
        openings: sanitizeOpenings(openings, geometry.walls.length),
        obstacles: sanitizeObstacles(obstacles),
        validation: geometry.validation,
        scanMetadata: scanMetadata && typeof scanMetadata === 'object' ? scanMetadata : {},
        confirmedAt: confirmedAt ? new Date(confirmedAt) : new Date(),
      });

      res.status(201).json({
        success: true,
        measurement: toPublicMeasurement(doc),
      });
    } catch (error) {
      next(error);
    }
  },

  async getMeasurements(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = req.user?.userId || req.user?.id;
      const isDev =
        process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';

      // Older AR saves used the unauthenticated "dev-user" id. Claim them for the
      // signed-in account so Room Measurements isn't empty after signup/login.
      if (userId && userId !== 'dev-user') {
        await RoomMeasurement.updateMany(
          { $or: [{ userId: 'dev-user' }, { userId: '' }, { userId: null }] },
          { $set: { userId: String(userId) } },
        );
      }

      const filter = {};
      if (userId) {
        filter.userId = String(userId);
      }

      if (req.query.projectId) {
        filter.projectId = String(req.query.projectId).trim();
      }

      const items = await RoomMeasurement.find(filter)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(req.query.limit) || 50, 100))
        .lean();

      if (isDev) {
        console.log(
          `[RoomMeasurements] list userId=${userId || '(none)'} count=${items.length}`,
        );
      }

      res.json({
        success: true,
        count: items.length,
        measurements: items.map((item) => toPublicMeasurement(item)),
      });
    } catch (error) {
      next(error);
    }
  },

  async getMeasurementById(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const item = await RoomMeasurement.findById(req.params.id).lean();
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Room measurement not found.',
        });
      }

      const userId = req.user?.userId || req.user?.id;
      if (userId && item.userId && item.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view this measurement.',
        });
      }

      res.json({
        success: true,
        measurement: toPublicMeasurement(item),
      });
    } catch (error) {
      next(error);
    }
  },

  async updateMeasurement(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const {
        name,
        projectId,
        exportPath,
        exportFileName,
        exportByteLength,
        exportFurnitureCount,
        exportedAt,
      } = req.body ?? {};

      const hasName = typeof name === 'string' && name.trim().length > 0;
      const hasExportLink =
        typeof exportPath === 'string' ||
        typeof projectId === 'string' ||
        typeof exportFileName === 'string' ||
        typeof exportByteLength === 'number' ||
        typeof exportFurnitureCount === 'number' ||
        exportedAt != null;

      if (!hasName && !hasExportLink) {
        return res.status(400).json({
          success: false,
          error: 'Provide a name and/or export link fields to update.',
        });
      }

      const item = await RoomMeasurement.findById(req.params.id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Room measurement not found.',
        });
      }

      const userId = req.user?.userId || req.user?.id;
      if (userId && item.userId && item.userId !== userId && item.userId !== 'dev-user') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this measurement.',
        });
      }

      if (hasName) {
        item.name = name.trim().slice(0, 100);
      }
      if (typeof projectId === 'string') {
        item.projectId = projectId.trim();
      }
      if (typeof exportPath === 'string') {
        item.exportPath = exportPath.trim();
      }
      if (typeof exportFileName === 'string') {
        item.exportFileName = exportFileName.trim().slice(0, 200);
      }
      if (typeof exportByteLength === 'number' && Number.isFinite(exportByteLength)) {
        item.exportByteLength = Math.max(0, exportByteLength);
      }
      if (typeof exportFurnitureCount === 'number' && Number.isFinite(exportFurnitureCount)) {
        item.exportFurnitureCount = Math.max(0, Math.floor(exportFurnitureCount));
      }
      if (exportedAt != null) {
        const parsed = new Date(exportedAt);
        item.exportedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      } else if (typeof exportPath === 'string' && exportPath.trim()) {
        item.exportedAt = new Date();
      }

      if (userId && (!item.userId || item.userId === 'dev-user')) {
        item.userId = String(userId);
      }
      await item.save();

      res.json({
        success: true,
        measurement: toPublicMeasurement(item),
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteMeasurement(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const item = await RoomMeasurement.findById(req.params.id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Room measurement not found.',
        });
      }

      const userId = req.user?.userId || req.user?.id;
      if (userId && item.userId && item.userId !== userId && item.userId !== 'dev-user') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this measurement.',
        });
      }

      await item.deleteOne();

      res.json({
        success: true,
        id: req.params.id,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default roomMeasurementController;
