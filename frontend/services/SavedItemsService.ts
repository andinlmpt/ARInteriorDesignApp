/**
 * Saved Items Service
 * Handles saved furniture items, designs, and favorites with AsyncStorage persistence
 */

import { getJson, setJson, removeKey } from '@/utils/storage';

export type SavedItemType = 'furniture' | 'design' | 'project' | 'theme';

export interface SavedItem {
  id: string;
  name: string;
  type: SavedItemType;
  price?: string;
  iconName?: string;
  iconColor?: string;
  imageUrl?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  savedAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'savedItems';
const MAX_SAVED_ITEMS = 500;

class SavedItemsService {
  private items: SavedItem[] = [];
  private initialized: boolean = false;

  /**
   * Initialize items from storage
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await getJson<SavedItem[]>(STORAGE_KEY, []);
      if (Array.isArray(stored)) {
        this.items = stored;
      }
    } catch (error) {
      console.warn('[SavedItemsService] Failed to load items from storage:', error);
      this.items = [];
    } finally {
      this.initialized = true;
    }
  }

  /**
   * Persist items to storage
   */
  private async persist(): Promise<void> {
    try {
      // Keep only the most recent items to avoid storage bloat
      const itemsToSave = this.items
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_SAVED_ITEMS);
      await setJson(STORAGE_KEY, itemsToSave);
    } catch (error) {
      console.warn('[SavedItemsService] Failed to persist items:', error);
    }
  }

  /**
   * Get all saved items
   */
  async getSavedItems(): Promise<SavedItem[]> {
    await this.initialize();
    return [...this.items].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get saved items by type
   */
  async getSavedItemsByType(type: SavedItemType): Promise<SavedItem[]> {
    await this.initialize();
    return this.items
      .filter(item => item.type === type)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get a saved item by ID
   */
  async getSavedItemById(id: string): Promise<SavedItem | null> {
    await this.initialize();
    return this.items.find(item => item.id === id) || null;
  }

  /**
   * Check if an item is saved
   */
  async isItemSaved(id: string): Promise<boolean> {
    await this.initialize();
    return this.items.some(item => item.id === id);
  }

  /**
   * Save an item
   */
  async saveItem(item: Omit<SavedItem, 'savedAt' | 'updatedAt'>): Promise<SavedItem> {
    await this.initialize();

    // Check if item already exists
    const existingIndex = this.items.findIndex(i => i.id === item.id);
    const now = Date.now();

    if (existingIndex >= 0) {
      // Update existing item
      this.items[existingIndex] = {
        ...this.items[existingIndex],
        ...item,
        updatedAt: now,
      };
      await this.persist();
      return this.items[existingIndex];
    }

    // Create new item
    const newItem: SavedItem = {
      ...item,
      savedAt: now,
      updatedAt: now,
    };

    this.items.push(newItem);
    await this.persist();
    return newItem;
  }

  /**
   * Remove a saved item
   */
  async removeSavedItem(id: string): Promise<boolean> {
    await this.initialize();

    const index = this.items.findIndex(item => item.id === id);
    if (index === -1) return false;

    this.items.splice(index, 1);
    await this.persist();
    return true;
  }

  /**
   * Remove multiple saved items
   */
  async removeSavedItems(ids: string[]): Promise<number> {
    await this.initialize();

    const initialLength = this.items.length;
    this.items = this.items.filter(item => !ids.includes(item.id));
    const removedCount = initialLength - this.items.length;

    if (removedCount > 0) {
      await this.persist();
    }

    return removedCount;
  }

  /**
   * Clear all saved items
   */
  async clearAllSavedItems(): Promise<void> {
    this.items = [];
    this.initialized = true;
    await removeKey(STORAGE_KEY);
  }

  /**
   * Search saved items
   */
  async searchSavedItems(query: string): Promise<SavedItem[]> {
    await this.initialize();
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) return [];

    return this.items.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(lowerQuery);
      const descMatch = item.description?.toLowerCase().includes(lowerQuery);
      const typeMatch = item.type.toLowerCase().includes(lowerQuery);

      return nameMatch || descMatch || typeMatch;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get saved items statistics
   */
  async getSavedItemsStats(): Promise<{
    total: number;
    byType: Record<SavedItemType, number>;
  }> {
    await this.initialize();

    const byType: Record<SavedItemType, number> = {
      furniture: 0,
      design: 0,
      project: 0,
      theme: 0,
    };

    this.items.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
    });

    return {
      total: this.items.length,
      byType,
    };
  }
}

export const savedItemsService = new SavedItemsService();
