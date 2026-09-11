/**
 * Admin dashboard controller — furniture CRUD and user management.
 */

import Furniture from '../models/Furniture.js';
import User from '../models/User.js';
import StoreSettings from '../models/StoreSettings.js';
import mongoose from 'mongoose';
import { uploadGlb, uploadThumbnail, uploadAvatar } from '../services/uploadService.js';

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const parseAvailableColors = (value) => {
  if (Array.isArray(value)) {
    return value.map((color) => String(color).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean);
  }
  return [];
};

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

const toAdminFurniture = (doc) => ({
  id: doc.id,
  displayName: doc.displayName,
  category: doc.category,
  glbUrl: doc.glbUrl,
  thumbnailUrl: doc.thumbnailUrl || '',
  width: doc.width,
  height: doc.height,
  depth: doc.depth,
  dimensionLabel: doc.dimensionLabel || '',
  lengthIn: doc.lengthIn || 0,
  widthIn: doc.widthIn || 0,
  heightIn: doc.heightIn || 0,
  quantity: parseQuantity(doc.quantity),
  availableColors: Array.isArray(doc.availableColors) ? doc.availableColors : [],
  active: doc.active,
  sortOrder: doc.sortOrder,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const toAdminUser = (doc) => ({
  id: doc._id.toString(),
  email: doc.email,
  name: doc.name || '',
  role: doc.role || 'user',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const toAdminProfile = (doc) => ({
  id: doc._id.toString(),
  email: doc.email,
  name: doc.name || '',
  role: doc.role || 'user',
  avatar: doc.avatar || '',
  profilePicture: doc.profilePicture || null,
});

const toStoreInfo = (doc) => ({
  storeName: doc.storeName || '',
  tagline: doc.tagline || '',
  description: doc.description || '',
  email: doc.email || '',
  phone: doc.phone || '',
  address: doc.address || '',
  city: doc.city || '',
  website: doc.website || '',
  facebook: doc.facebook || '',
  instagram: doc.instagram || '',
  businessHours: doc.businessHours || '',
  logoUrl: doc.logoUrl || '',
  updatedAt: doc.updatedAt,
});

const DEFAULT_STORE = {
  key: 'default',
  storeName: 'Maharlika Furniture',
  tagline: 'Your vision, Our craft',
  description:
    'Maharlika Furniture and Home Furnishing creates high-quality, affordable furniture that reflects Filipino pride and craftsmanship.',
  email: 'admin@gmail.com',
  phone: '',
  address: '',
  city: '',
  website: '',
  facebook: '',
  instagram: '',
  businessHours: 'Mon–Sat, 9:00 AM – 6:00 PM',
  logoUrl: '',
};

async function getOrCreateStore() {
  let store = await StoreSettings.findOne({ key: 'default' });
  if (!store) {
    store = await StoreSettings.create(DEFAULT_STORE);
  }
  return store;
}

const adminController = {
  async getMe(req, res, next) {
    try {
      const dbUser = await User.findById(req.user.id).select('+profilePicture');
      if (!dbUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      res.json({
        success: true,
        user: toAdminProfile(dbUser),
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const dbUser = await User.findById(req.user.id).select('+profilePicture');
      if (!dbUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (req.body.name !== undefined) {
        dbUser.name = String(req.body.name).trim().slice(0, 100);
      }

      if (req.body.avatar !== undefined) {
        dbUser.avatar = String(req.body.avatar || '').trim();
      }

      if (req.body.profilePicture !== undefined) {
        dbUser.profilePicture = req.body.profilePicture || null;
      }

      await dbUser.save();

      res.json({
        success: true,
        user: toAdminProfile(dbUser),
      });
    } catch (error) {
      next(error);
    }
  },

  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const result = await uploadAvatar(req.file);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  async listFurniture(req, res, next) {
    try {
      const { category, includeInactive } = req.query;
      const filter = {};

      if (category && category !== 'all') {
        filter.category = String(category).trim().toLowerCase();
      }
      if (includeInactive !== 'true') {
        filter.active = true;
      }

      const items = await Furniture.find(filter)
        .sort({ displayName: 1 })
        .lean();

      res.json({
        success: true,
        count: items.length,
        furniture: items.map(toAdminFurniture),
      });
    } catch (error) {
      next(error);
    }
  },

  async getFurniture(req, res, next) {
    try {
      const id = String(req.params.id || '').trim().toLowerCase();
      const item = await Furniture.findOne({ id }).lean();

      if (!item) {
        return res.status(404).json({ success: false, error: 'Furniture not found' });
      }

      res.json({ success: true, furniture: toAdminFurniture(item) });
    } catch (error) {
      next(error);
    }
  },

  async createFurniture(req, res, next) {
    try {
      const {
        displayName,
        category = 'other',
        glbUrl,
        thumbnailUrl = '',
        width = 2.0,
        height = 0.85,
        depth = 0.9,
        dimensionLabel = '',
        lengthIn = 0,
        widthIn = 0,
        heightIn = 0,
        quantity = 0,
        availableColors = [],
        active = true,
        sortOrder = 0,
        id: customId,
      } = req.body;

      if (!displayName?.trim()) {
        return res.status(400).json({ success: false, error: 'displayName is required' });
      }
      if (!glbUrl?.trim()) {
        return res.status(400).json({ success: false, error: 'glbUrl is required (upload GLB first)' });
      }

      const id = customId?.trim() ? slugify(customId) : slugify(displayName);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Could not generate furniture id' });
      }

      const existing = await Furniture.findOne({ id });
      if (existing) {
        return res.status(409).json({ success: false, error: `Furniture id '${id}' already exists` });
      }

      const item = await Furniture.create({
        id,
        displayName: displayName.trim(),
        category: String(category).trim().toLowerCase(),
        glbUrl: glbUrl.trim(),
        thumbnailUrl: String(thumbnailUrl).trim(),
        width: Number(width) || 2.0,
        height: Number(height) || 0.85,
        depth: Number(depth) || 0.9,
        dimensionLabel: String(dimensionLabel).trim(),
        lengthIn: Number(lengthIn) || 0,
        widthIn: Number(widthIn) || 0,
        heightIn: Number(heightIn) || 0,
        quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
        availableColors: parseAvailableColors(availableColors),
        active: active !== false && active !== 'false',
        sortOrder: Number(sortOrder) || 0,
      });

      res.status(201).json({ success: true, furniture: toAdminFurniture(item) });
    } catch (error) {
      next(error);
    }
  },

  async updateFurniture(req, res, next) {
    try {
      const id = String(req.params.id || '').trim().toLowerCase();
      const item = await Furniture.findOne({ id });

      if (!item) {
        return res.status(404).json({ success: false, error: 'Furniture not found' });
      }

      const fields = [
        'displayName', 'category', 'glbUrl', 'thumbnailUrl',
        'width', 'height', 'depth', 'dimensionLabel',
        'lengthIn', 'widthIn', 'heightIn', 'quantity', 'availableColors',
        'active', 'sortOrder',
      ];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          if (field === 'active') {
            item.active = req.body.active !== false && req.body.active !== 'false';
          } else if (field === 'availableColors') {
            item.availableColors = parseAvailableColors(req.body.availableColors);
          } else if (['width', 'height', 'depth', 'lengthIn', 'widthIn', 'heightIn', 'sortOrder', 'quantity'].includes(field)) {
            item[field] = field === 'quantity'
              ? Math.max(0, Math.floor(Number(req.body[field]) || 0))
              : Number(req.body[field]) || 0;
          } else if (field === 'category') {
            item.category = String(req.body.category).trim().toLowerCase();
          } else {
            item[field] = String(req.body[field]).trim();
          }
        }
      }

      await item.save();
      res.json({ success: true, furniture: toAdminFurniture(item) });
    } catch (error) {
      next(error);
    }
  },

  async deleteFurniture(req, res, next) {
    try {
      const id = String(req.params.id || '').trim().toLowerCase();
      const hard = req.query.hard === 'true';

      if (hard) {
        const result = await Furniture.deleteOne({ id });
        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, error: 'Furniture not found' });
        }
        return res.json({ success: true, message: 'Furniture permanently deleted' });
      }

      const item = await Furniture.findOneAndUpdate(
        { id },
        { active: false },
        { new: true }
      );

      if (!item) {
        return res.status(404).json({ success: false, error: 'Furniture not found' });
      }

      res.json({ success: true, message: 'Furniture deactivated', furniture: toAdminFurniture(item) });
    } catch (error) {
      next(error);
    }
  },

  async uploadGlb(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const result = await uploadGlb(req.file);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  async uploadThumbnail(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const result = await uploadThumbnail(req.file);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  async listUsers(req, res, next) {
    try {
      const { search } = req.query;
      const filter = {};

      if (search?.trim()) {
        const term = search.trim();
        filter.$or = [
          { email: { $regex: term, $options: 'i' } },
          { name: { $regex: term, $options: 'i' } },
        ];
      }

      const users = await User.find(filter)
        .select('-password -profilePicture')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        count: users.length,
        users: users.map(toAdminUser),
      });
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

      if (req.body.role !== undefined) {
        const role = String(req.body.role).trim().toLowerCase();
        if (!['user', 'admin'].includes(role)) {
          return res.status(400).json({ success: false, error: 'role must be user or admin' });
        }

        if (user._id.toString() === req.user.id && role !== 'admin') {
          return res.status(400).json({
            success: false,
            error: 'You cannot remove your own admin role',
          });
        }

        user.role = role;
      }

      await user.save();
      res.json({ success: true, user: toAdminUser(user) });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req, res, next) {
    try {
      const [userCount, furnitureCount, activeFurniture] = await Promise.all([
        User.countDocuments(),
        Furniture.countDocuments(),
        Furniture.countDocuments({ active: true }),
      ]);

      res.json({
        success: true,
        stats: {
          users: userCount,
          furniture: furnitureCount,
          activeFurniture,
          mongoConnected: mongoose.connection.readyState === 1,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getStore(req, res, next) {
    try {
      const store = await getOrCreateStore();
      res.json({ success: true, store: toStoreInfo(store) });
    } catch (error) {
      next(error);
    }
  },

  async updateStore(req, res, next) {
    try {
      const store = await getOrCreateStore();
      const fields = [
        'storeName',
        'tagline',
        'description',
        'email',
        'phone',
        'address',
        'city',
        'website',
        'facebook',
        'instagram',
        'businessHours',
        'logoUrl',
      ];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          store[field] = String(req.body[field] ?? '').trim();
        }
      }

      await store.save();
      res.json({ success: true, store: toStoreInfo(store) });
    } catch (error) {
      next(error);
    }
  },
};

export default adminController;
