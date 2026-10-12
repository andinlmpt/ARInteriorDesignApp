/**
 * Which products the mobile app (and the AI layout planner) may show: not taken down by
 * an admin, and either sold by an approved store or a legacy product not yet assigned.
 */

import Store from '../models/Store.js';

/**
 * Adds the visibility conditions to a Furniture query filter. `store: { $nin }` also matches
 * products with no store, so legacy catalog items stay visible until an admin assigns them.
 */
export async function withPublicVisibility(filter = {}) {
  const hiddenStoreIds = await Store.find({ status: { $ne: 'approved' } }).distinct('_id');
  return {
    ...filter,
    takenDown: { $ne: true },
    store: { $nin: hiddenStoreIds },
  };
}
