/**
 * Initialize Saved Items with Sample Data
 * This can be called on first app launch or for demo purposes
 */

import { savedItemsService } from '@/services/SavedItemsService';
import { FURNITURE_LIBRARY } from '@/constants/furniture-library';
import { furnitureToSavedItem } from './saveItemHelpers';

const INITIALIZATION_KEY = 'savedItemsInitialized';

/**
 * Check if saved items have been initialized
 */
export async function isInitialized(): Promise<boolean> {
  try {
    const { getJson } = await import('@/utils/storage');
    const initialized = await getJson<boolean>(INITIALIZATION_KEY, false);
    return initialized;
  } catch {
    return false;
  }
}

/**
 * Initialize saved items with sample furniture items
 * Only runs once per app installation
 */
export async function initializeSavedItems(): Promise<void> {
  try {
    // Check if already initialized
    const initialized = await isInitialized();
    if (initialized) {
      return;
    }

    // Get existing items to avoid duplicates
    const existingItems = await savedItemsService.getSavedItems();
    const existingIds = new Set(existingItems.map(item => item.id));

    // Add a few sample furniture items
    const sampleFurniture = [
      FURNITURE_LIBRARY.find(f => f.id === 'sofa-modern'),
      FURNITURE_LIBRARY.find(f => f.id === 'dining-chair'),
      FURNITURE_LIBRARY.find(f => f.id === 'floor-lamp'),
    ].filter(Boolean) as typeof FURNITURE_LIBRARY;

    for (const furniture of sampleFurniture) {
      if (!existingIds.has(furniture.id)) {
        const savedItem = furnitureToSavedItem(furniture);
        await savedItemsService.saveItem(savedItem);
      }
    }

    // Mark as initialized
    const { setJson } = await import('@/utils/storage');
    await setJson(INITIALIZATION_KEY, true);

    console.log('[initializeSavedItems] Sample items added successfully');
  } catch (error) {
    console.error('[initializeSavedItems] Failed to initialize:', error);
    // Don't throw - this is a non-critical initialization
  }
}

/**
 * Reset initialization (for testing/demo purposes)
 */
export async function resetInitialization(): Promise<void> {
  const { removeKey } = await import('@/utils/storage');
  await removeKey(INITIALIZATION_KEY);
}
