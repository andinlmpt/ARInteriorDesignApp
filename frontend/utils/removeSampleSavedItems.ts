/**
 * Remove legacy sample wishlist items
 * Older builds seeded a few static furniture favorites into MongoDB on first
 * open of the wishlist. This deletes them once for installs that were seeded.
 */

import { savedItemsService } from '@/services/SavedItemsService';

const INITIALIZATION_KEY = 'savedItemsInitialized';
const SAMPLE_ITEM_IDS = new Set(['sofa-modern', 'dining-chair', 'floor-lamp']);

/**
 * Delete the static sample items seeded by older builds.
 * Only runs on installs that were seeded, and only once.
 */
export async function removeSampleSavedItems(): Promise<void> {
  try {
    const { getJson, removeKey } = await import('@/utils/storage');
    const seeded = await getJson<boolean>(INITIALIZATION_KEY, false);
    if (!seeded) {
      return;
    }

    // Catalog ids are slugs too, so skip anything the user hearted on Home;
    // those are tagged with a source, the seeded samples never were.
    const existingItems = await savedItemsService.getSavedItems();
    const sampleIds = existingItems
      .filter(item => SAMPLE_ITEM_IDS.has(item.id) && item.metadata?.source !== 'home-products')
      .map(item => item.id);

    if (sampleIds.length > 0) {
      await savedItemsService.removeSavedItems(sampleIds);
    }

    await removeKey(INITIALIZATION_KEY);
  } catch (error) {
    console.error('[removeSampleSavedItems] Failed to clean up:', error);
    // Don't throw - this is a non-critical cleanup
  }
}
