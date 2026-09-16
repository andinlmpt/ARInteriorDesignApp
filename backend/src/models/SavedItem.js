/**
 * Saved items for the Saved tab (furniture, designs, projects, themes).
 */

import mongoose from 'mongoose';

const SAVED_ITEM_TYPES = ['furniture', 'design', 'project', 'theme'];

const savedItemSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    /** Client-facing logical id (furniture id, design id, ar-photo-*, etc.) */
    itemId: {
      type: String,
      trim: true,
      required: true,
    },
    name: {
      type: String,
      trim: true,
      required: true,
    },
    type: {
      type: String,
      enum: SAVED_ITEM_TYPES,
      required: true,
    },
    price: {
      type: String,
      trim: true,
      default: '',
    },
    iconName: {
      type: String,
      trim: true,
      default: '',
    },
    iconColor: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'saved_items',
  },
);

savedItemSchema.index({ userId: 1, itemId: 1 }, { unique: true });
savedItemSchema.index({ userId: 1, type: 1, updatedAt: -1 });
savedItemSchema.index({ userId: 1, updatedAt: -1 });

const SavedItem =
  mongoose.models.SavedItem || mongoose.model('SavedItem', savedItemSchema);

export { SAVED_ITEM_TYPES };
export default SavedItem;
