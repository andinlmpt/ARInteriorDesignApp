/**
 * Maps remote MongoDB furniture catalog entries to RN library / home products.
 */

import type { RemoteFurnitureItem } from '@/services/FurnitureCatalogService';
import { resolveMediaUrl } from '@/services/apiClient';
import type { HomeProduct, HomeProductCategoryFilter } from '@/types/home-product';
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

/** Map admin category into a home chip bucket. */
export function mapHomeCategoryFilter(category: string): HomeProductCategoryFilter {
  const key = category.trim().toLowerCase();
  if (key === 'seating') return 'seating';
  if (key === 'tables') return 'tables';
  if (key === 'beds' || key === 'bedroom') return 'beds';
  if (key === 'lighting') return 'lighting';
  return 'other';
}

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

function formatMetersLabel(width: number, depth: number, height: number): string {
  return `${width.toFixed(1)}m W × ${depth.toFixed(1)}m D × ${height.toFixed(1)}m H`;
}

export function remoteItemToHomeProduct(item: RemoteFurnitureItem): HomeProduct {
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  const depth = Number(item.depth) || 0;
  const label =
    (item.dimensionLabel && item.dimensionLabel.trim()) ||
    formatMetersLabel(width, depth, height);

  return {
    id: item.id,
    name: item.displayName,
    category: item.category || 'other',
    thumbnailUrl: resolveMediaUrl(item.thumbnailUrl),
    dimensionLabel: label,
    width,
    height,
    depth,
    lengthIn: item.lengthIn,
    widthIn: item.widthIn,
    heightIn: item.heightIn,
    availableColors: Array.isArray(item.availableColors) ? item.availableColors : [],
    quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
  };
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
    thumbnail: resolveMediaUrl(item.thumbnailUrl),
    model3D: item.glbUrl
      ? { url: resolveMediaUrl(item.glbUrl) || item.glbUrl, format: 'glb' as const }
      : undefined,
  };
}

export function formatDimensionSubtitle(item: FurnitureLibraryItem): string {
  if (item.description) return item.description;
  const { width, length, height } = item.dimensions;
  return `${width.toFixed(1)}m × ${length.toFixed(1)}m × ${height.toFixed(1)}m`;
}

export function formatHomeProductMeters(product: HomeProduct): string {
  return formatMetersLabel(product.width, product.depth, product.height);
}

export function formatHomeProductInches(product: HomeProduct): string | null {
  const w = product.widthIn;
  const d = product.lengthIn;
  const h = product.heightIn;
  if (
    typeof w !== 'number' ||
    typeof d !== 'number' ||
    typeof h !== 'number' ||
    (w <= 0 && d <= 0 && h <= 0)
  ) {
    return null;
  }
  return `${w}" W × ${d}" D × ${h}" H`;
}
