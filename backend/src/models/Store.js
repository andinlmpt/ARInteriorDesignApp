/**
 * Furniture store — a business that registers on the platform and sells products.
 * Each store is owned by one user account with role "store". Admins review new stores
 * before their products appear in the mobile app.
 */

import mongoose from 'mongoose';

export const STORE_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

const storeSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  tagline: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  /** DTI / SEC / business permit number, shown to admins during review. */
  businessPermit: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  website: { type: String, trim: true, default: '' },
  facebook: { type: String, trim: true, default: '' },
  instagram: { type: String, trim: true, default: '' },
  businessHours: { type: String, trim: true, default: '' },
  logoUrl: { type: String, trim: true, default: '' },
  /** Only approved stores can manage products, and only their products are shown in the app. */
  status: { type: String, enum: STORE_STATUSES, default: 'pending' },
  /** Admin's reason for rejecting or suspending, shown to the store. */
  statusNote: { type: String, trim: true, default: '' },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  collection: 'stores',
});

storeSchema.index({ status: 1, createdAt: -1 });

const Store = mongoose.models.Store || mongoose.model('Store', storeSchema);

export default Store;
