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
