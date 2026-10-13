/**
 * Records admin/store actions to the activity log. Logging never fails the request.
 */

import ActivityLog from '../models/ActivityLog.js';

/**
 * @param {{ id?: string, userId?: string, email?: string, role?: string } | null} actor
 * @param {string} action e.g. "store.approved"
 * @param {{ targetType: 'store'|'product'|'user'|'content', targetId?: string, store?: unknown, summary?: string }} details
 */
export async function logActivity(actor, action, { targetType, targetId = '', store = null, summary = '' }) {
  try {
    await ActivityLog.create({
      actor: actor?.id || actor?.userId || null,
      actorEmail: actor?.email || '',
      actorRole: actor?.role || '',
      action,
      targetType,
      targetId: String(targetId || ''),
      store: store || null,
      summary,
    });
  } catch (error) {
    console.warn(`[ActivityLog] Could not record ${action}:`, error.message);
  }
}

export const toActivityEntry = (doc) => ({
  id: doc._id.toString(),
  action: doc.action,
  targetType: doc.targetType,
  targetId: doc.targetId || '',
  summary: doc.summary || '',
  actorEmail: doc.actorEmail || '',
  actorRole: doc.actorRole || '',
  createdAt: doc.createdAt,
});
