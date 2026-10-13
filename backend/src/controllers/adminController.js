/**
 * Admin console controller — runs the platform: reviews furniture stores, oversees and
 * moderates their products, manages user accounts, and reads the activity log.
 * Product create/edit/delete belongs to the stores (see storeController).
 */

import mongoose from 'mongoose';
import Furniture from '../models/Furniture.js';
import User from '../models/User.js';
import Store from '../models/Store.js';
import ActivityLog from '../models/ActivityLog.js';
import { logActivity, toActivityEntry } from '../services/activityLog.js';
import { toFurnitureDto } from '../services/furnitureFields.js';
import { escapeRegex, toStoreDto } from '../services/storeFields.js';

const toAdminUser = (doc) => ({
  id: doc._id.toString(),
  email: doc.email,
  name: doc.name || '',
  role: doc.role || 'user',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

/** Which status changes an admin can make, from each current status. */
const STATUS_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  approved: ['suspended'],
  suspended: ['approved'],
  rejected: ['approved'],
};

const adminActor = (req) => ({ id: req.user.id, email: req.user.email, role: 'admin' });

async function productCountsByStore(storeIds) {
  const rows = await Furniture.aggregate([
    { $match: { store: { $in: storeIds } } },
    { $group: { _id: '$store', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

const adminController = {
  async getStats(req, res, next) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const customers = { role: { $nin: ['admin', 'store'] } };
      const [users, newUsersThisWeek, stores, pendingStores, furniture, unassignedProducts] = await Promise.all([
        User.countDocuments(customers),
        User.countDocuments({ ...customers, createdAt: { $gte: weekAgo } }),
        Store.countDocuments(),
        Store.countDocuments({ status: 'pending' }),
        Furniture.countDocuments(),
        Furniture.countDocuments({ store: null }),
      ]);

      res.json({
        success: true,
        stats: {
          users,
          newUsersThisWeek,
          stores,
          pendingStores,
          furniture,
          unassignedProducts,
          mongoConnected: mongoose.connection.readyState === 1,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ── Stores ────────────────────────────────────────────────────────────────

  async listStores(req, res, next) {
    try {
      const { status, search } = req.query;
      const filter = {};
      if (status && status !== 'all') {
        filter.status = String(status);
      }
      if (search?.trim()) {
        const term = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ name: term }, { email: term }, { city: term }];
      }

      const stores = await Store.find(filter).populate('owner', 'email name').sort({ createdAt: -1 }).lean();
      const counts = await productCountsByStore(stores.map((s) => s._id));

      res.json({
        success: true,
        count: stores.length,
        stores: stores.map((s) => toStoreDto(s, { productCount: counts.get(String(s._id)) || 0 })),
      });
    } catch (error) {
      next(error);
    }
  },

  async updateStoreStatus(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'Invalid store id' });
      }

      const status = String(req.body?.status || '').trim();
      const note = String(req.body?.note || '').trim();
      const store = await Store.findById(id).populate('owner', 'email name');
      if (!store) {
        return res.status(404).json({ success: false, error: 'Store not found' });
      }

      const previous = store.status;
      if (!(STATUS_TRANSITIONS[previous] || []).includes(status)) {
        return res.status(400).json({ success: false, error: `A ${previous} store cannot be changed to ${status || 'that status'}` });
      }
      if ((status === 'rejected' || status === 'suspended') && !note) {
        return res.status(400).json({ success: false, error: 'Add a reason so the store knows what to fix' });
      }

      store.status = status;
      store.statusNote = status === 'approved' ? '' : note;
      store.reviewedAt = new Date();
      store.reviewedBy = req.user.id;
      await store.save();

      const action = previous === 'suspended' && status === 'approved' ? 'store.reinstated' : `store.${status}`;
      const verb = { 'store.approved': 'accepted', 'store.rejected': 'rejected', 'store.suspended': 'suspended', 'store.reinstated': 'reinstated' }[action];
      await logActivity(adminActor(req), action, {
        targetType: 'store',
        targetId: store._id,
        store: store._id,
        summary: `${req.user.email} ${verb} ${store.name}${note ? `: ${note}` : ''}`,
      });

      const counts = await productCountsByStore([store._id]);
      res.json({ success: true, store: toStoreDto(store, { productCount: counts.get(String(store._id)) || 0 }) });
    } catch (error) {
      next(error);
    }
  },

  // ── Products (oversight + moderation; stores own create/edit/delete) ──────

  async listFurniture(req, res, next) {
    try {
      const filter = {};
      const { store } = req.query;
      if (store === 'unassigned') {
        filter.store = null;
      } else if (store && mongoose.Types.ObjectId.isValid(store)) {
        filter.store = store;
      }

      const items = await Furniture.find(filter)
        .populate('store', 'name status')
        .sort({ displayName: 1 })
        .lean();

      res.json({ success: true, count: items.length, furniture: items.map(toFurnitureDto) });
    } catch (error) {
      next(error);
    }
  },

  /** Take a product down from the app (or restore it). The store keeps the product. */
  async moderateFurniture(req, res, next) {
    try {
      const id = String(req.params.id || '').trim().toLowerCase();
      const takenDown = req.body?.takenDown === true;
      const reason = String(req.body?.reason || '').trim();
      if (takenDown && !reason) {
        return res.status(400).json({ success: false, error: 'Add a reason so the store knows why it was taken down' });
      }

      const item = await Furniture.findOne({ id }).populate('store', 'name status');
      if (!item) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      item.takenDown = takenDown;
      item.takenDownReason = takenDown ? reason : '';
      await item.save();

      await logActivity(adminActor(req), takenDown ? 'product.taken_down' : 'product.restored', {
        targetType: 'product',
        targetId: item.id,
        store: item.store?._id || null,
        summary: takenDown
          ? `${req.user.email} took down “${item.displayName}”: ${reason}`
          : `${req.user.email} restored “${item.displayName}”`,
      });
      res.json({ success: true, furniture: toFurnitureDto(item) });
    } catch (error) {
      next(error);
    }
  },

  /** Assign one product to a store (used for legacy products that predate stores). */
  async assignFurnitureStore(req, res, next) {
    try {
      const id = String(req.params.id || '').trim().toLowerCase();
      const { storeId } = req.body || {};
      if (!mongoose.Types.ObjectId.isValid(storeId)) {
        return res.status(400).json({ success: false, error: 'Choose a store' });
      }

      const [item, store] = await Promise.all([Furniture.findOne({ id }), Store.findById(storeId)]);
      if (!item) return res.status(404).json({ success: false, error: 'Product not found' });
      if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

      item.store = store._id;
      await item.save();
      await item.populate('store', 'name status');

      await logActivity(adminActor(req), 'product.assigned', {
        targetType: 'product',
        targetId: item.id,
        store: store._id,
        summary: `${req.user.email} assigned “${item.displayName}” to ${store.name}`,
      });
      res.json({ success: true, furniture: toFurnitureDto(item) });
    } catch (error) {
      next(error);
    }
  },

  /** Assign every product without a store to one store. */
  async assignUnassignedFurniture(req, res, next) {
    try {
      const { storeId } = req.body || {};
      if (!mongoose.Types.ObjectId.isValid(storeId)) {
        return res.status(400).json({ success: false, error: 'Choose a store' });
      }
      const store = await Store.findById(storeId);
      if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

      const result = await Furniture.updateMany({ store: null }, { $set: { store: store._id } });
      if (result.modifiedCount > 0) {
        await logActivity(adminActor(req), 'product.assigned', {
          targetType: 'store',
          targetId: store._id,
          store: store._id,
          summary: `${req.user.email} assigned ${result.modifiedCount} unassigned products to ${store.name}`,
        });
      }
      res.json({ success: true, assigned: result.modifiedCount });
    } catch (error) {
      next(error);
    }
  },

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers(req, res, next) {
    try {
      const { search, role } = req.query;
      const filter = {};

      if (search?.trim()) {
        const term = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ email: term }, { name: term }];
      }
      if (role === 'user') {
        filter.role = { $nin: ['admin', 'store'] };
      } else if (role === 'non-admin') {
        filter.role = { $ne: 'admin' };
      } else if (role && role !== 'all') {
        filter.role = String(role);
      }

      const users = await User.find(filter)
        .select('-password -profilePicture')
        .sort({ createdAt: -1 })
        .lean();

      res.json({ success: true, count: users.length, users: users.map(toAdminUser) });
    } catch (error) {
      next(error);
    }
  },

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'Invalid user id' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (req.body.name !== undefined) {
        user.name = String(req.body.name).trim();
      }

      let roleChange = null;
      if (req.body.role !== undefined) {
        const role = String(req.body.role).trim().toLowerCase();
        if (!['user', 'admin'].includes(role)) {
          return res.status(400).json({ success: false, error: 'role must be user or admin' });
        }
        if (user.role === 'store') {
          return res.status(400).json({ success: false, error: 'Store accounts are managed from the Stores page' });
        }
        if (user._id.toString() === req.user.id && role !== 'admin') {
          return res.status(400).json({ success: false, error: 'You cannot remove your own admin role' });
        }
        if ((user.role || 'user') !== role) {
          roleChange = role;
          user.role = role;
        }
      }

      await user.save();

      if (roleChange) {
        await logActivity(adminActor(req), 'user.role_changed', {
          targetType: 'user',
          targetId: user._id,
          summary: `${req.user.email} made ${user.email} ${roleChange === 'admin' ? 'an admin' : 'a regular user'}`,
        });
      }
      res.json({ success: true, user: toAdminUser(user) });
    } catch (error) {
      next(error);
    }
  },

  // ── Activity log ──────────────────────────────────────────────────────────

  async listActivity(req, res, next) {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const filter = {};
      if (req.query.search?.trim()) {
        const term = new RegExp(escapeRegex(req.query.search.trim()), 'i');
        filter.$or = [{ summary: term }, { actorEmail: term }, { action: term }];
      }

      const entries = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      res.json({ success: true, count: entries.length, activity: entries.map(toActivityEntry) });
    } catch (error) {
      next(error);
    }
  },
};

export default adminController;
