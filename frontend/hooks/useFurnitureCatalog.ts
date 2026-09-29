/**
 * Loads the remote furniture catalog from MongoDB + GCS.
 * Uses FurnitureCatalogService memory cache so reopen is instant.
 */

import { useCallback, useEffect, useState } from 'react';
import { FurnitureCatalogService } from '@/services/FurnitureCatalogService';
import type { FurnitureLibraryItem } from '@/types/ar-view';
import type { HomeProduct } from '@/types/home-product';
import {
  remoteItemToHomeProduct,
  remoteItemToLibraryItem,
} from '@/utils/furnitureCatalogHelpers';

interface UseFurnitureCatalogResult {
  items: FurnitureLibraryItem[];
  products: HomeProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function mapCatalog(remote: ReturnType<typeof FurnitureCatalogService.getCached>) {
  const list = remote ?? [];
  return {
    items: list.map(remoteItemToLibraryItem),
    products: list.map(remoteItemToHomeProduct),
  };
}

export function useFurnitureCatalog(): UseFurnitureCatalogResult {
  const cached = FurnitureCatalogService.getCached();
  const initial = mapCatalog(cached);

  const [items, setItems] = useState<FurnitureLibraryItem[]>(initial.items);
  const [products, setProducts] = useState<HomeProduct[]>(initial.products);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const applyRemote = useCallback((remote: NonNullable<ReturnType<typeof FurnitureCatalogService.getCached>>) => {
    setItems(remote.map(remoteItemToLibraryItem));
    setProducts(remote.map(remoteItemToHomeProduct));
  }, []);

  const refresh = useCallback(async (force = true) => {
    // Keep showing stale data while refreshing when we already have a cache.
    const hadCache = Boolean(FurnitureCatalogService.getCached());
    if (!hadCache) setLoading(true);
    setError(null);
    try {
      const remote = await FurnitureCatalogService.getAll(undefined, { force });
      applyRemote(remote);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not load furniture catalog';
      setError(message);
      if (!FurnitureCatalogService.getCached()) {
        setItems([]);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applyRemote]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const fresh = FurnitureCatalogService.isFresh();
      const peek = FurnitureCatalogService.getCached();
      if (peek) {
        if (!cancelled) {
          applyRemote(peek);
          setLoading(false);
        }
        if (fresh) return;
      } else if (!cancelled) {
        setLoading(true);
      }

      try {
        const remote = await FurnitureCatalogService.getAll(undefined, { force: !fresh });
        if (!cancelled) {
          applyRemote(remote);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Could not load furniture catalog';
        setError(message);
        if (!FurnitureCatalogService.getCached()) {
          setItems([]);
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyRemote]);

  return {
    items,
    products,
    loading,
    error,
    refresh: () => refresh(true),
  };
}
