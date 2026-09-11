/**
 * Maps remote MongoDB furniture catalog entries to RN library items.
 */

import type { RemoteFurnitureItem } from '@/services/FurnitureCatalogService';
import type { FurnitureCategory, FurnitureLibraryItem } from '@/types/ar-view';

const CATEGORY_PALETTE: Record<string, string> = {
  seating: '#2563EB',
  tables: '#059669',
  beds: '#7C3AED',
  bedroom: '#7C3AED',
  lighting: '#D97706',
  appliances: '#DC2626',
  kitchen: '#DC2626',
  storage: '#0891B2',
  decor: '#6B7280',
  other: '#64748B',
};

const REMOTE_CATEGORY_MAP: Record<string, FurnitureCategory | 'all'> = {
  seating: 'seating',
  tables: 'tables',
  beds: 'bedroom',
  bedroom: 'bedroom',
  lighting: 'lighting',
  appliances: 'kitchen',
  kitchen: 'kitchen',
  storage: 'storage',
  decor: 'decor',
  other: 'decor',
};

export function mapRemoteCategory(category: string): FurnitureCategory {
  const key = category.trim().toLowerCase();
  return (REMOTE_CATEGORY_MAP[key] as FurnitureCategory | undefined) ?? 'decor';
}

export function colorForFurnitureId(id: string, category?: string): string {
  const mapped = category ? mapRemoteCategory(category) : null;
  if (mapped && CATEGORY_PALETTE[mapped]) return CATEGORY_PALETTE[mapped];

  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function remoteItemToLibraryItem(item: RemoteFurnitureItem): FurnitureLibraryItem {
  const category = mapRemoteCategory(item.category);
  return {
    id: item.id,
    name: item.displayName,
    category,
    price: '',
    color: colorForFurnitureId(item.id, item.category),
    dimensions: {
      width: item.width,
      length: item.depth,
      height: item.height,
    },
    description: item.dimensionLabel,
    thumbnail: item.thumbnailUrl || undefined,
    model3D: item.glbUrl
      ? { url: item.glbUrl, format: 'glb' as const }
      : undefined,
  };
}

export function formatDimensionSubtitle(item: FurnitureLibraryItem): string {
  if (item.description) return item.description;
  const { width, length, height } = item.dimensions;
  return `${width.toFixed(1)}m × ${length.toFixed(1)}m × ${height.toFixed(1)}m`;
}
