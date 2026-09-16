/**
 * Saved Items Service
 * Persists Saved-tab favorites to MongoDB via the backend API.
 */

import { callApi, ApiError } from './apiClient';

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

interface SavedItemsListResponse {
  success: boolean;
  count: number;
  items: SavedItem[];
}

interface SavedItemResponse {
  success: boolean;
  item: SavedItem;
}

interface SavedItemsStatsResponse {
  success: boolean;
  stats: {
    total: number;
    byType: Record<SavedItemType, number>;
  };
}

interface BulkDeleteResponse {
  success: boolean;
  deletedCount: number;
}

class SavedItemsService {
  /**
   * Get all saved items for the current user
   */
  async getSavedItems(): Promise<SavedItem[]> {
    const response = await callApi<SavedItemsListResponse>('/saved-items');
    return response.items ?? [];
  }

  /**
   * Get saved items by type
   */
  async getSavedItemsByType(type: SavedItemType): Promise<SavedItem[]> {
    const response = await callApi<SavedItemsListResponse>(
      `/saved-items?type=${encodeURIComponent(type)}`,
    );
    return response.items ?? [];
  }

  /**
   * Get a saved item by logical id
   */
  async getSavedItemById(id: string): Promise<SavedItem | null> {
    try {
      const response = await callApi<SavedItemResponse>(
        `/saved-items/${encodeURIComponent(id)}`,
      );
      return response.item ?? null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if an item is saved
   */
  async isItemSaved(id: string): Promise<boolean> {
    const item = await this.getSavedItemById(id);
    return item !== null;
  }

  /**
   * Save (create or update) an item
   */
  async saveItem(item: Omit<SavedItem, 'savedAt' | 'updatedAt'>): Promise<SavedItem> {
    const response = await callApi<SavedItemResponse>('/saved-items', {
      method: 'POST',
      body: {
        id: item.id,
        name: item.name,
        type: item.type,
        price: item.price,
        iconName: item.iconName,
        iconColor: item.iconColor,
        imageUrl: item.imageUrl,
        description: item.description,
        metadata: item.metadata ?? {},
      },
    });
    return response.item;
  }

  /**
   * Remove a saved item by logical id
   */
  async removeSavedItem(id: string): Promise<boolean> {
    try {
      await callApi<{ success: boolean }>(`/saved-items/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Remove multiple saved items
   */
  async removeSavedItems(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const response = await callApi<BulkDeleteResponse>('/saved-items/bulk-delete', {
      method: 'POST',
      body: { ids },
    });
    return response.deletedCount ?? 0;
  }

  /**
   * Clear all saved items for the current user
   */
  async clearAllSavedItems(): Promise<void> {
    await callApi('/saved-items', { method: 'DELETE' });
  }

  /**
   * Search saved items
   */
  async searchSavedItems(query: string): Promise<SavedItem[]> {
    const q = query.trim();
    if (!q) return [];
    const response = await callApi<SavedItemsListResponse>(
      `/saved-items?q=${encodeURIComponent(q)}`,
    );
    return response.items ?? [];
  }

  /**
   * Get saved items statistics
   */
  async getSavedItemsStats(): Promise<{
    total: number;
    byType: Record<SavedItemType, number>;
  }> {
    const response = await callApi<SavedItemsStatsResponse>('/saved-items/stats');
    return (
      response.stats ?? {
        total: 0,
        byType: { furniture: 0, design: 0, project: 0, theme: 0 },
      }
    );
  }
}

export const savedItemsService = new SavedItemsService();
