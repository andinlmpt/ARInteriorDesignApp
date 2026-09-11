/**
 * Fetches the remote furniture catalog (MongoDB + GCS URLs).
 */

import { callApi } from './apiClient';

export interface RemoteFurnitureItem {
  id: string;
  displayName: string;
  category: string;
  glbUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  depth: number;
  dimensionLabel?: string;
}

export interface FurnitureCatalogResponse {
  success: boolean;
  count: number;
  furniture: RemoteFurnitureItem[];
}

export class FurnitureCatalogService {
  static async getAll(category?: string): Promise<RemoteFurnitureItem[]> {
    const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
    const response = await callApi<FurnitureCatalogResponse>(`/furniture${query}`);
    return response.furniture ?? [];
  }

  static async getById(id: string): Promise<RemoteFurnitureItem | null> {
    const response = await callApi<{ success: boolean; furniture: RemoteFurnitureItem }>(
      `/furniture/${encodeURIComponent(id)}`,
    );
    return response.furniture ?? null;
  }
}
