/**
 * Home-tab product card / detail sheet model (admin Products catalog).
 */

export interface HomeProduct {
  id: string;
  name: string;
  /** Raw admin category (chair, sofa, beds) */
  category: string;
  thumbnailUrl?: string;
  /** Prefer human label from admin; always set (falls back to meters). */
  dimensionLabel: string;
  width: number;
  height: number;
  depth: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  availableColors: string[];
  quantity?: number;
  pricePhp?: number;
  /** Design styles (Minimalist, Modern, …). */
  styles?: string[];
  /** Suitable room types (Bedroom, Living Room, …). */
  rooms?: string[];
  roomTypes?: string[];
}

export type HomeProductCategoryFilter = 'all' | 'chair' | 'sofa' | 'beds' | 'other';

export const HOME_PRODUCT_CATEGORY_CHIPS: {
  id: HomeProductCategoryFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'chair', label: 'Chairs' },
  { id: 'sofa', label: 'Sofas' },
  { id: 'beds', label: 'Beds' },
];

const CATEGORY_LABELS: Record<string, string> = {
  chair: 'Chair',
  sofa: 'Sofa',
  beds: 'Bed',
  other: 'Other',
};

/** Display label for admin category on Home product cards. */
export function formatHomeProductCategoryLabel(category: string): string {
  const key = String(category || '').trim().toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  if (!key) return 'Other';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
