/**
 * Fetches the remote furniture catalog (MongoDB + GCS URLs).
 * Keeps an in-memory cache so AR Furniture / Home reopen without waiting on /furniture.
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
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  availableColors?: string[];
  quantity?: number;
}

export interface FurnitureCatalogResponse {
  success: boolean;
  count: number;
  furniture: RemoteFurnitureItem[];
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CatalogCacheEntry = {
  items: RemoteFurnitureItem[];
  fetchedAt: number;
};

const catalogCache = new Map<string, CatalogCacheEntry>();
const inflight = new Map<string, Promise<RemoteFurnitureItem[]>>();

function cacheKey(category?: string): string {
  return category && category !== 'all' ? category : 'all';
}

export class FurnitureCatalogService {
  /** Synchronous peek — used to paint UI immediately on reopen. */
  static getCached(category?: string): RemoteFurnitureItem[] | null {
    const entry = catalogCache.get(cacheKey(category));
    if (!entry) return null;
    return entry.items;
  }

  static isFresh(category?: string): boolean {
    const entry = catalogCache.get(cacheKey(category));
    if (!entry) return false;
    return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
  }

  static invalidate(category?: string): void {
    if (category) {
      catalogCache.delete(cacheKey(category));
      inflight.delete(cacheKey(category));
      return;
    }
    catalogCache.clear();
    inflight.clear();
  }

  static async getAll(
    category?: string,
    options?: { force?: boolean }
  ): Promise<RemoteFurnitureItem[]> {
    const key = cacheKey(category);
    const cached = catalogCache.get(key);

    if (!options?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.items;
    }

    const existing = inflight.get(key);
    if (existing) return existing;

    const request = (async () => {
      const query = key !== 'all' ? `?category=${encodeURIComponent(key)}` : '';
      const response = await callApi<FurnitureCatalogResponse>(`/furniture${query}`);
      const items = response.furniture ?? [];
      catalogCache.set(key, { items, fetchedAt: Date.now() });
      return items;
    })();

    inflight.set(key, request);
    try {
      return await request;
    } finally {
      inflight.delete(key);
    }
  }

  static async getById(id: string): Promise<RemoteFurnitureItem | null> {
    const response = await callApi<{ success: boolean; furniture: RemoteFurnitureItem }>(
      `/furniture/${encodeURIComponent(id)}`
    );
    return response.furniture ?? null;
  }
}
