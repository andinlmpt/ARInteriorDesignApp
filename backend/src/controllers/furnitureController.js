/**
 * Furniture catalog controller — serves MongoDB furniture metadata (incl. glbUrl).
 */

import Furniture from '../models/Furniture.js';
import mongoose from 'mongoose';
import {
  resolveFurnitureGlbUrl,
  resolveFurnitureThumbnailUrl,
} from '../utils/publicAssetUrl.js';
import { inferFurnitureCategory } from '../utils/furnitureCategory.js';

const inferCategory = (doc) =>
  inferFurnitureCategory(doc.id, doc.displayName, doc.glbUrl) || 'other';

/** Accepts a number or legacy inventory text like "2 sofa pieces + 1 stool". */
const parseQuantity = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() !== '') {
    return Math.max(0, Math.floor(asNumber));
  }
  const matches = String(value || '').match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((sum, n) => sum + Number(n), 0);
};

const toPublicItem = (doc, req) => ({
  id: doc.id,
  displayName: doc.displayName,
  category: doc.category || inferCategory(doc),
  glbUrl: resolveFurnitureGlbUrl(doc, req),
  thumbnailUrl: resolveFurnitureThumbnailUrl(doc, req),
  width: doc.width,
  height: doc.height,
  depth: doc.depth,
  dimensionLabel: doc.dimensionLabel || '',
  lengthIn: doc.lengthIn || 0,
  widthIn: doc.widthIn || 0,
  heightIn: doc.heightIn || 0,
  quantity: parseQuantity(doc.quantity),
  availableColors: Array.isArray(doc.availableColors) ? doc.availableColors : [],
});

const furnitureController = {
  async getAllFurniture(req, res, next) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          error: 'MongoDB is not connected. Start the backend with a valid MONGODB_URI.',
        });
      }

      const { category } = req.query;
      const filter = { active: true };

      if (category && category !== 'all') {
        filter.category = String(category).trim().toLowerCase();
      }

      const items = await Furniture.find(filter)
        .sort({ sortOrder: 1, displayName: 1 })
        .lean();

      res.json({
        success: true,
        count: items.length,
        furniture: items.map((doc) => toPublicItem(doc, req)),
      });
    } catch (error) {
      next(error);
    }
  },

  async getFurnitureById(req, res, next) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          error: 'MongoDB is not connected.',
        });
      }

      const id = String(req.params.id || '').trim().toLowerCase();
      const item = await Furniture.findOne({ id, active: true }).lean();

      if (!item) {
        return res.status(404).json({
          success: false,
          error: `Furniture '${id}' not found.`,
        });
      }

      res.json({
        success: true,
        furniture: toPublicItem(item, req),
      });
    } catch (error) {
      next(error);
    }
  },
};

export default furnitureController;
