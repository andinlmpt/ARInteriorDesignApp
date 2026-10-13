/**
 * Furniture catalog model — metadata + GCS URLs for remote 3D models.
 */

import mongoose from 'mongoose';

/** Size of the 3D model itself in metres (AR shows the model at this size). */
const modelSizeSchema = new mongoose.Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  depth: { type: Number, required: true },
}, { _id: false });

const furnitureSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    default: 'other',
    trim: true,
    lowercase: true,
  },
  glbUrl: {
    type: String,
    required: true,
    trim: true,
  },
  thumbnailUrl: {
    type: String,
    trim: true,
    default: '',
  },
  width: { type: Number, default: 2.0 },
  height: { type: Number, default: 0.85 },
  depth: { type: Number, default: 0.9 },
  dimensionLabel: {
    type: String,
    trim: true,
    default: '',
  },
  lengthIn: { type: Number, default: 0 },
  widthIn: { type: Number, default: 0 },
  heightIn: { type: Number, default: 0 },
  /** Stock / piece count (integer). */
  quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Available finish/upholstery colors from the catalog. */
  availableColors: {
    type: [String],
    default: [],
  },
  /** Retail price in ₱. 0 = not set (API serves a mock price). */
  pricePhp: { type: Number, default: 0, min: 0 },
  /** Design styles (Minimalist, Modern, …). Empty = API serves mock styles. */
  styles: { type: [String], default: [] },
  /** Suitable room types. Empty = inferred from category. */
  rooms: { type: [String], default: [] },
  /** Alias used by admin + design API (same data as rooms when unset). */
  roomTypes: { type: [String], default: [] },
  /** Store-controlled visibility (the store can hide its own product). */
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  /** Furniture store that sells this product. Null for legacy products not yet assigned. */
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
  /** Admin moderation: taken-down products are hidden from the app regardless of `active`. */
  takenDown: { type: Boolean, default: false },
  takenDownReason: { type: String, trim: true, default: '' },
  /** Measured from the GLB when it is saved; compared with width/height/depth to warn the store. */
  modelSize: { type: modelSizeSchema, default: null },
}, {
  timestamps: true,
  collection: 'furniture',
});

furnitureSchema.index({ category: 1, sortOrder: 1 });
furnitureSchema.index({ active: 1 });
furnitureSchema.index({ store: 1 });

const Furniture = mongoose.models.Furniture || mongoose.model('Furniture', furnitureSchema);

export default Furniture;
