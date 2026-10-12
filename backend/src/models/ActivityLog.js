/**
 * Audit trail of admin and store actions (registrations, approvals, product edits, …).
 */

import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorEmail: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  /** Dotted action name, e.g. "store.approved" or "product.created". */
  action: { type: String, required: true },
  targetType: { type: String, enum: ['store', 'product', 'user', 'content'], required: true },
  targetId: { type: String, default: '' },
  /** Store the action concerns, so a store's own history can be listed. */
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
  summary: { type: String, default: '' },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'activity_logs',
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ store: 1, createdAt: -1 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
