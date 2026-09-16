/**
 * Saved items controller — persists Saved tab favorites to MongoDB.
 */

import mongoose from 'mongoose';
import SavedItem, { SAVED_ITEM_TYPES } from '../models/SavedItem.js';

const MAX_ITEMS = 500;

const toPublicItem = (doc) => ({
  id: doc.itemId,
  name: doc.name,
  type: doc.type,
  price: doc.price || undefined,
  iconName: doc.iconName || undefined,
  iconColor: doc.iconColor || undefined,
  imageUrl: doc.imageUrl || undefined,
  description: doc.description || undefined,
  metadata: doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {},
  savedAt: doc.savedAt ? new Date(doc.savedAt).getTime() : Date.now(),
  updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
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

const resolveUserId = (req) => req.user?.userId || req.user?.id || '';

const savedItemController = {
  async listItems(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const filter = { userId };
      if (req.query.type && SAVED_ITEM_TYPES.includes(String(req.query.type))) {
        filter.type = String(req.query.type);
      }

      if (req.query.q) {
        const q = String(req.query.q).trim();
        if (q) {
          filter.$or = [
            { name: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
            { type: { $regex: q, $options: 'i' } },
          ];
        }
      }

      const items = await SavedItem.find(filter)
        .sort({ updatedAt: -1 })
        .limit(Math.min(Number(req.query.limit) || MAX_ITEMS, MAX_ITEMS))
        .lean();

      res.json({
        success: true,
        count: items.length,
        items: items.map(toPublicItem),
      });
    } catch (error) {
      next(error);
    }
  },

  async getItemById(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const item = await SavedItem.findOne({
        userId,
        itemId: String(req.params.itemId),
      }).lean();

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Saved item not found.',
        });
      }

      res.json({
        success: true,
        item: toPublicItem(item),
      });
    } catch (error) {
      next(error);
    }
  },

  async upsertItem(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const {
        id,
        itemId,
        name,
        type,
        price,
        iconName,
        iconColor,
        imageUrl,
        description,
        metadata,
      } = req.body ?? {};

      const logicalId = String(itemId || id || '').trim();
      if (!logicalId) {
        return res.status(400).json({
          success: false,
          error: 'id (item id) is required.',
        });
      }

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          error: 'name is required.',
        });
      }

      if (!type || !SAVED_ITEM_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `type must be one of: ${SAVED_ITEM_TYPES.join(', ')}`,
        });
      }

      const count = await SavedItem.countDocuments({ userId });
      const existing = await SavedItem.findOne({ userId, itemId: logicalId }).lean();
      if (!existing && count >= MAX_ITEMS) {
        return res.status(400).json({
          success: false,
          error: `You can save at most ${MAX_ITEMS} items.`,
        });
      }

      const now = new Date();
      const doc = await SavedItem.findOneAndUpdate(
        { userId, itemId: logicalId },
        {
          $set: {
            name: String(name).trim(),
            type,
            price: price ? String(price).trim() : '',
            iconName: iconName ? String(iconName).trim() : '',
            iconColor: iconColor ? String(iconColor).trim() : '',
            imageUrl: imageUrl ? String(imageUrl).trim() : '',
            description: description ? String(description).trim() : '',
            metadata: metadata && typeof metadata === 'object' ? metadata : {},
          },
          $setOnInsert: {
            userId,
            itemId: logicalId,
            savedAt: now,
          },
        },
        { upsert: true, new: true, runValidators: true },
      );

      res.status(existing ? 200 : 201).json({
        success: true,
        item: toPublicItem(doc),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Saved item already exists.',
        });
      }
      next(error);
    }
  },

  async deleteItem(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const result = await SavedItem.deleteOne({
        userId,
        itemId: String(req.params.itemId),
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved item not found.',
        });
      }

      res.json({
        success: true,
        deleted: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async bulkDelete(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id) => String(id).trim()).filter(Boolean)
        : [];

      if (ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'ids array is required.',
        });
      }

      const result = await SavedItem.deleteMany({
        userId,
        itemId: { $in: ids },
      });

      res.json({
        success: true,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      next(error);
    }
  },

  async clearAll(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const result = await SavedItem.deleteMany({ userId });

      res.json({
        success: true,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req, res, next) {
    try {
      if (!requireMongo(res)) return;

      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const byType = {
        furniture: 0,
        design: 0,
        project: 0,
        theme: 0,
      };

      const rows = await SavedItem.aggregate([
        { $match: { userId } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]);

      let total = 0;
      for (const row of rows) {
        if (row._id && Object.prototype.hasOwnProperty.call(byType, row._id)) {
          byType[row._id] = row.count;
        }
        total += row.count;
      }

      res.json({
        success: true,
        stats: { total, byType },
      });
    } catch (error) {
      next(error);
    }
  },
};

export default savedItemController;
