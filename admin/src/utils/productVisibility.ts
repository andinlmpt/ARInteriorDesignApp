import type { FurnitureItem } from '../api/client';

export interface ProductVisibility {
  label: string;
  /** Matches a `.badge-<tone>` class. */
  tone: 'live' | 'hidden' | 'taken-down' | 'pending' | 'rejected' | 'suspended';
  detail: string;
}

/**
 * Whether a product shows in the mobile app, mirroring the backend rule: not taken down,
 * active, and sold by an approved store (or not assigned to a store yet).
 */
export function productVisibility(item: FurnitureItem): ProductVisibility {
  if (item.takenDown) {
    return { label: 'Taken down', tone: 'taken-down', detail: item.takenDownReason || 'Removed by an admin' };
  }
  if (item.storeStatus && item.storeStatus !== 'approved') {
    return {
      label: `Store ${item.storeStatus}`,
      tone: item.storeStatus,
      detail: 'Hidden until the store is approved',
    };
  }
  if (!item.active) {
    return { label: 'Hidden', tone: 'hidden', detail: 'Hidden by the store' };
  }
  return { label: 'Live', tone: 'live', detail: 'Shown in the mobile app' };
}
