/**
 * Room measurement controller — persists AR scan dimensions to MongoDB.
 */

import mongoose from 'mongoose';
import RoomMeasurement from '../models/RoomMeasurement.js';

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
  scanMetadata: doc.scanMetadata || {},
  confirmedAt: doc.confirmedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
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
        floorPolygon: Array.isArray(floorPolygon) ? floorPolygon : [],
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
      const filter = userId ? { userId } : {};

      if (req.query.projectId) {
        filter.projectId = String(req.query.projectId).trim();
      }

      const items = await RoomMeasurement.find(filter)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(req.query.limit) || 50, 100))
        .lean();

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
};

export default roomMeasurementController;
