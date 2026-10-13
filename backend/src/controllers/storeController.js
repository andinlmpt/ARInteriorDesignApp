/**
 * Furniture store portal — registration, store profile, and CRUD for the store's own products.
 */

import { rm } from 'fs/promises';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Store from '../models/Store.js';
import Furniture from '../models/Furniture.js';
import { ensureMongoConnection } from '../db/mongodb.js';
import { uploadGlb, uploadThumbnail } from '../services/uploadService.js';
import { measureModelBuffer } from '../services/glbBounds.js';
import { measureModelAtUrl } from '../services/modelSize.js';
import { optimizeModelFile } from '../services/modelOptimization.js';
import { logActivity } from '../services/activityLog.js';
import { applyFurnitureFields, toFurnitureDto, uniqueFurnitureId } from '../services/furnitureFields.js';
import { applyStoreFields, toStoreDto } from '../services/storeFields.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const LOW_STOCK_MAX = 5;

const trim = (value) => String(value ?? '').trim();

const storeActor = (req) => ({ id: req.user.id, email: req.user.email, role: 'store' });

const productId = (req) => trim(req.params.id).toLowerCase();

const storeController = {
  /** POST /api/v1/stores/register — public. Creates a store account awaiting admin review. */
  async register(req, res, next) {
    try {
      const body = req.body || {};
      const storeName = trim(body.storeName);
      const email = trim(body.email).toLowerCase();
      const password = String(body.password ?? '');
      const phone = trim(body.phone);
      const address = trim(body.address);

      const missing = [
        !storeName && 'store name',
        !email && 'email',
        !password && 'password',
        !phone && 'phone number',
        !address && 'address',
      ].filter(Boolean);
      if (missing.length > 0) {
        return res.status(400).json({ error: 'Validation error', message: `Please enter your ${missing.join(', ')}.` });
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Validation error', message: 'Please enter a valid email address.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Validation error', message: 'Password must be at least 6 characters.' });
      }

      if (!(await ensureMongoConnection())) {
        return res.status(503).json({ error: 'Service unavailable', message: 'Could not reach the database. Try again in a moment.' });
      }

      if (await User.exists({ email })) {
        return res.status(409).json({ error: 'Already registered', message: 'An account with this email already exists.' });
      }

      const user = await User.create({
        email,
        password,
        name: trim(body.ownerName) || storeName,
        role: 'store',
      });

      let store;
      try {
        store = await Store.create({
          owner: user._id,
          name: storeName,
          email,
          phone,
          address,
          city: trim(body.city),
          businessPermit: trim(body.businessPermit),
          description: trim(body.description),
          status: 'pending',
        });
      } catch (error) {
        // Don't leave a store login with no store behind.
        await User.deleteOne({ _id: user._id });
        throw error;
      }

      const actor = { id: user._id.toString(), email, role: 'store' };
      await logActivity(actor, 'store.registered', {
        targetType: 'store',
        targetId: store._id,
        store: store._id,
        summary: `${store.name} registered and is waiting for review`,
      });

      const token = jwt.sign({ userId: actor.id, email, role: 'store' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      res.status(201).json({
        success: true,
        message: 'Registration received. An admin will review your store before your products go live.',
        token,
        user: { id: actor.id, email, name: user.name, role: 'store' },
        store: toStoreDto(store),
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Already registered', message: 'An account with this email already exists.' });
      }
      next(error);
    }
  },

  async getMe(req, res) {
    res.json({ success: true, store: toStoreDto(req.store) });
  },

  async updateProfile(req, res, next) {
    try {
      const store = applyStoreFields(req.store, req.body || {});
      if (!store.name) {
        return res.status(400).json({ success: false, error: 'Store name is required' });
      }
      await store.save();
      await logActivity(storeActor(req), 'store.profile_updated', {
        targetType: 'store',
        targetId: store._id,
        store: store._id,
        summary: `${store.name} updated its store profile`,
      });
      res.json({ success: true, store: toStoreDto(store) });
    } catch (error) {
      next(error);
    }
  },

  /** A rejected store fixes its profile and asks for another review. */
  async resubmit(req, res, next) {
    try {
      const store = req.store;
      if (store.status !== 'rejected') {
        return res.status(400).json({ success: false, error: 'Only a rejected store can be resubmitted for review' });
      }
      store.status = 'pending';
      store.statusNote = '';
      await store.save();
      await logActivity(storeActor(req), 'store.resubmitted', {
        targetType: 'store',
        targetId: store._id,
        store: store._id,
        summary: `${store.name} resubmitted its registration for review`,
      });
      res.json({ success: true, store: toStoreDto(store) });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req, res, next) {
    try {
      const items = await Furniture.find({ store: req.store._id }).select('active takenDown quantity').lean();
      const stats = {
        products: items.length,
        live: items.filter((i) => i.active !== false && !i.takenDown).length,
        hidden: items.filter((i) => i.active === false).length,
        takenDown: items.filter((i) => i.takenDown).length,
        lowStock: items.filter((i) => (Number(i.quantity) || 0) > 0 && Number(i.quantity) <= LOW_STOCK_MAX).length,
        outOfStock: items.filter((i) => !(Number(i.quantity) > 0)).length,
      };
      res.json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  },

  async listProducts(req, res, next) {
    try {
      const items = await Furniture.find({ store: req.store._id }).sort({ updatedAt: -1 }).lean();
      res.json({ success: true, count: items.length, furniture: items.map(toFurnitureDto) });
    } catch (error) {
      next(error);
    }
  },

  async getProduct(req, res, next) {
    try {
      const item = await Furniture.findOne({ id: productId(req), store: req.store._id }).lean();
      if (!item) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      res.json({ success: true, furniture: toFurnitureDto(item) });
    } catch (error) {
      next(error);
    }
  },

  async createProduct(req, res, next) {
    try {
      const body = req.body || {};
      if (!trim(body.displayName)) {
        return res.status(400).json({ success: false, error: 'Product name is required' });
      }
      if (!trim(body.glbUrl)) {
        return res.status(400).json({ success: false, error: 'Upload the product\'s 3D model (GLB) first' });
      }

      const id = await uniqueFurnitureId(trim(body.id) || body.displayName);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Could not generate a product id from that name' });
      }

      const item = new Furniture({ id, store: req.store._id });
      applyFurnitureFields(item, { category: 'other', ...body });
      item.modelSize = await measureModelAtUrl(item.glbUrl);
      await item.save();

      await logActivity(storeActor(req), 'product.created', {
        targetType: 'product',
        targetId: item.id,
        store: req.store._id,
        summary: `${req.store.name} added “${item.displayName}”`,
      });
      res.status(201).json({ success: true, furniture: toFurnitureDto(item) });
    } catch (error) {
      next(error);
    }
  },

  async updateProduct(req, res, next) {
    try {
      const item = await Furniture.findOne({ id: productId(req), store: req.store._id });
      if (!item) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const previousGlb = item.glbUrl;
      applyFurnitureFields(item, req.body || {});
      if (!item.displayName || !item.glbUrl) {
        return res.status(400).json({ success: false, error: 'Product name and 3D model are required' });
      }
      if (item.glbUrl !== previousGlb || !item.modelSize) {
        item.modelSize = await measureModelAtUrl(item.glbUrl);
      }
      await item.save();

      await logActivity(storeActor(req), 'product.updated', {
        targetType: 'product',
        targetId: item.id,
        store: req.store._id,
        summary: `${req.store.name} updated “${item.displayName}”`,
      });
      res.json({ success: true, furniture: toFurnitureDto(item) });
    } catch (error) {
      next(error);
    }
  },

  async deleteProduct(req, res, next) {
    try {
      const item = await Furniture.findOneAndDelete({ id: productId(req), store: req.store._id });
      if (!item) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      await logActivity(storeActor(req), 'product.deleted', {
        targetType: 'product',
        targetId: item.id,
        store: req.store._id,
        summary: `${req.store.name} deleted “${item.displayName}”`,
      });
      res.json({ success: true, message: `Deleted ${item.displayName}` });
    } catch (error) {
      next(error);
    }
  },

  /** Large models are optimized for phones (and the 10 MB storage limit) before they are stored. */
  async uploadGlb(req, res) {
    const tempPath = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const model = await optimizeModelFile(tempPath);
      const result = await uploadGlb({ buffer: Buffer.from(model.buffer), originalname: req.file.originalname });
      res.json({
        success: true,
        ...result,
        // AR shows the model at its own size, so the form compares this with the product size.
        modelSize: measureModelBuffer(Buffer.from(model.buffer)),
        optimized: model.optimized
          ? {
            fromBytes: model.before.bytes,
            toBytes: model.after.bytes,
            fromVertices: model.before.vertices,
            toVertices: model.after.vertices,
          }
          : null,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    } finally {
      if (tempPath) await rm(tempPath, { force: true });
    }
  },

  async uploadImage(req, res) {
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
};

export default storeController;
