/**
 * Maps remote MongoDB furniture catalog entries to RN library / home products.
 */

import type { RemoteFurnitureItem } from '@/services/FurnitureCatalogService';
import { resolveMediaUrl } from '@/services/apiClient';
import type { HomeProduct, HomeProductCategoryFilter } from '@/types/home-product';
import type { FurnitureCategory, FurnitureLibraryItem } from '@/types/ar-view';

/** True when quantity is known and <= 0. Unknown/undefined stock stays available. */
export function isOutOfStock(quantity?: number | null): boolean {
  return typeof quantity === 'number' && Number.isFinite(quantity) && quantity <= 0;
}

/**
 * How many more copies can still be placed in AR.
 * Returns `null` when stock is unknown (no limit).
 */
export function getRemainingPlacements(
  quantity?: number | null,
  placedCount = 0
): number | null {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return null;
  return Math.max(0, Math.floor(quantity) - Math.max(0, placedCount));
}

/** False when stock is known and every available unit is already placed. */
export function canPlaceMore(quantity?: number | null, placedCount = 0): boolean {
  const remaining = getRemainingPlacements(quantity, placedCount);
  if (remaining === null) return true;
  return remaining > 0;
}

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
  chair: 'seating',
  sofa: 'seating',
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
  if (key === 'chair') return 'chair';
  if (key === 'sofa') return 'sofa';
  if (key === 'beds' || key === 'bedroom') return 'beds';
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
    quantity: (() => {
      const q = Number(item.quantity);
      return Number.isFinite(q) ? q : undefined;
    })(),
  };
}

export function remoteItemToLibraryItem(item: RemoteFurnitureItem): FurnitureLibraryItem {
  const category = mapRemoteCategory(item.category);
  const quantity = (() => {
    const q = Number(item.quantity);
    return Number.isFinite(q) ? q : undefined;
  })();
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
    quantity,
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

/** Normalize catalog color labels / hex into a swatch fill. */
const NAMED_COLOR_HEX: Record<string, string> = {
  // Neutrals / grays
  white: '#F5F5F5',
  ivory: '#FFFFF0',
  cream: '#F5F0E1',
  beige: '#D8C3A5',
  'mocha beige': '#C4A484',
  mocha: '#A57855',
  taupe: '#B3A394',
  tan: '#D2B48C',
  sand: '#C2B280',
  khaki: '#C3B091',
  gray: '#9CA3AF',
  grey: '#9CA3AF',
  'light gray': '#D1D5DB',
  'light grey': '#D1D5DB',
  'dark gray': '#4B5563',
  'dark grey': '#4B5563',
  charcoal: '#36454F',
  black: '#1F2937',
  // Browns / wood tones
  brown: '#8B5E3C',
  'dark brown': '#5C4033',
  walnut: '#5D4037',
  oak: '#C4A35A',
  espresso: '#3C2415',
  cognac: '#9A463D',
  // Blues / greens
  navy: '#0C295F',
  blue: '#3B82F6',
  teal: '#14B8A6',
  green: '#22C55E',
  olive: '#6B8E23',
  // Warm accents
  red: '#EF4444',
  burgundy: '#7F1D1D',
  orange: '#E69868',
  peach: '#F0B088',
  yellow: '#EAB308',
  gold: '#D4AF37',
  pink: '#F9A8D4',
  purple: '#8B5CF6',
};

/**
 * Map an admin `availableColors` entry (name or #hex) to a display swatch hex.
 * Named finishes like "Taupe" previously fell back to brand navy and looked identical.
 */
export function resolveAvailableColorHex(raw: string, fallback = '#94A3B8'): string {
  const value = (raw || '').trim();
  if (!value) return fallback;

  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
    return value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value.slice(0, 7);
  }

  const key = value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (NAMED_COLOR_HEX[key]) return NAMED_COLOR_HEX[key];

  // Partial match: "Soft Light Gray Fabric" → light gray
  const partial = Object.keys(NAMED_COLOR_HEX)
    .sort((a, b) => b.length - a.length)
    .find((name) => key.includes(name));
  return partial ? NAMED_COLOR_HEX[partial] : fallback;
}
