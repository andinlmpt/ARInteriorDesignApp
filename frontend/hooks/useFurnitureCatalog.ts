/**
 * Loads the remote furniture catalog from MongoDB + GCS.
 */

import { useCallback, useEffect, useState } from 'react';
import { FurnitureCatalogService } from '@/services/FurnitureCatalogService';
import type { FurnitureLibraryItem } from '@/types/ar-view';
import { remoteItemToLibraryItem } from '@/utils/furnitureCatalogHelpers';

interface UseFurnitureCatalogResult {
  items: FurnitureLibraryItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFurnitureCatalog(): UseFurnitureCatalogResult {
  const [items, setItems] = useState<FurnitureLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await FurnitureCatalogService.getAll();
      setItems(remote.map(remoteItemToLibraryItem));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not load furniture catalog';
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
