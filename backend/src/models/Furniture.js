/**
 * Furniture catalog model — metadata + GCS URLs for remote 3D models.
 */

import mongoose from 'mongoose';

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
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'furniture',
});

furnitureSchema.index({ category: 1, sortOrder: 1 });
furnitureSchema.index({ active: 1 });

const Furniture = mongoose.models.Furniture || mongoose.model('Furniture', furnitureSchema);

export default Furniture;
