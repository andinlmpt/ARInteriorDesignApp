/**
 * Store information — single document for Maharlika Furniture business details.
 */

import mongoose from 'mongoose';

const storeSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'default',
    unique: true,
  },
  storeName: {
    type: String,
    trim: true,
    default: 'Maharlika Furniture',
  },
  tagline: {
    type: String,
    trim: true,
    default: 'Your vision, Our craft',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  address: {
    type: String,
    trim: true,
    default: '',
  },
  city: {
    type: String,
    trim: true,
    default: '',
  },
  website: {
    type: String,
    trim: true,
    default: '',
  },
  facebook: {
    type: String,
    trim: true,
    default: '',
  },
  instagram: {
    type: String,
    trim: true,
    default: '',
  },
  businessHours: {
    type: String,
    trim: true,
    default: 'Mon–Sat, 9:00 AM – 6:00 PM',
  },
  logoUrl: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
  collection: 'store_settings',
});

const StoreSettings = mongoose.models.StoreSettings
  || mongoose.model('StoreSettings', storeSettingsSchema);

export default StoreSettings;
