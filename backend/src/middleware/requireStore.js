/**
 * Store-portal guards. Run after authenticateStrict.
 */

import Store from '../models/Store.js';

const STATUS_MESSAGES = {
  pending: 'Your store is waiting for admin approval. You can add products once it is approved.',
  rejected: 'Your store registration was not approved. Update your store profile and resubmit it for review.',
  suspended: 'Your store is suspended. Contact the platform admin for details.',
};

/** Requires a store account and loads its store into req.store. */
export async function requireStore(req, res, next) {
  try {
    if (req.user?.role !== 'store') {
      return res.status(403).json({ error: 'Forbidden', message: 'Store account required' });
    }

    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ error: 'Not found', message: 'No store is linked to this account' });
    }

    req.store = store;
    next();
  } catch (error) {
    next(error);
  }
}

/** Blocks product changes until an admin approves the store. */
export function requireApprovedStore(req, res, next) {
  const status = req.store?.status;
  if (status !== 'approved') {
    return res.status(403).json({
      error: 'Store not approved',
      message: STATUS_MESSAGES[status] || 'Your store cannot manage products right now.',
      storeStatus: status || '',
    });
  }
  next();
}

/** Suspended stores can sign in and read, but not change anything. */
export function rejectSuspendedStore(req, res, next) {
  if (req.store?.status === 'suspended') {
    return res.status(403).json({
      error: 'Store suspended',
      message: STATUS_MESSAGES.suspended,
      storeStatus: 'suspended',
    });
  }
  next();
}
