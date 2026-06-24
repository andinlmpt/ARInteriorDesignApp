/**
 * Furniture Library Data
 * Catalog of available furniture items for AR placement
 */

import type { FurnitureLibraryItem } from '@/types/ar-view';

export const FURNITURE_LIBRARY: FurnitureLibraryItem[] = [
  // Seating
  {
    id: 'sofa-modern',
    name: 'Modern Sofa',
    icon: 'desktop-outline',
    price: '$1,299',
    color: '#2563EB',
    category: 'seating',
    dimensions: { width: 2.1, length: 0.95, height: 0.85 },
  },
  {
    id: 'accent-chair',
    name: 'Accent Chair',
    icon: 'desktop-outline',
    price: '$449',
    color: '#DB2777',
    category: 'seating',
    dimensions: { width: 0.8, length: 0.8, height: 0.95 },
  },
  {
    id: 'dining-chair',
    name: 'Dining Chair',
    icon: 'desktop-outline',
    price: '$199',
    color: '#8B5CF6',
    category: 'seating',
    dimensions: { width: 0.5, length: 0.5, height: 0.9 },
  },
  
  // Tables
  {
    id: 'coffee-table',
    name: 'Coffee Table',
    icon: 'grid-outline',
    price: '$399',
    color: '#14B8A6',
    category: 'tables',
    dimensions: { width: 1.0, length: 0.6, height: 0.42 },
  },
  {
    id: 'dining-table',
    name: 'Dining Table',
    icon: 'grid-outline',
    price: '$899',
    color: '#F59E0B',
    category: 'tables',
    dimensions: { width: 1.5, length: 0.9, height: 0.75 },
  },
  {
    id: 'side-table',
    name: 'Side Table',
    icon: 'grid-outline',
    price: '$249',
    color: '#EC4899',
    category: 'tables',
    dimensions: { width: 0.5, length: 0.5, height: 0.6 },
  },
  
  // Storage
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    icon: 'albums-outline',
    price: '$599',
    color: '#7C3AED',
    category: 'storage',
    dimensions: { width: 1.0, length: 0.4, height: 2.1 },
  },
  {
    id: 'tv-stand',
    name: 'TV Stand',
    icon: 'tv-outline',
    price: '$549',
    color: '#6366F1',
    category: 'storage',
    dimensions: { width: 1.8, length: 0.5, height: 0.6 },
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe',
    icon: 'shirt-outline',
    price: '$1,199',
    color: '#475569',
    category: 'storage',
    dimensions: { width: 1.2, length: 0.6, height: 2.0 },
  },
  
  // Lighting
  {
    id: 'floor-lamp',
    name: 'Floor Lamp',
    icon: 'bulb-outline',
    price: '$149',
    color: '#F97316',
    category: 'lighting',
    dimensions: { width: 0.3, length: 0.3, height: 1.8 },
  },
  {
    id: 'table-lamp',
    name: 'Table Lamp',
    icon: 'bulb-outline',
    price: '$89',
    color: '#FBBF24',
    category: 'lighting',
    dimensions: { width: 0.25, length: 0.25, height: 0.6 },
  },
  
  // Decor
  {
    id: 'planter',
    name: 'Tall Planter',
    icon: 'flower-outline',
    price: '$129',
    color: '#22C55E',
    category: 'decor',
    dimensions: { width: 0.5, length: 0.5, height: 1.4 },
  },
  {
    id: 'rug',
    name: 'Area Rug',
    icon: 'square-outline',
    price: '$299',
    color: '#A855F7',
    category: 'decor',
    dimensions: { width: 2.0, length: 1.5, height: 0.01 },
  },
  
  // Bedroom
  {
    id: 'bed-queen',
    name: 'Queen Bed',
    icon: 'bed-outline',
    price: '$1,499',
    color: '#3B82F6',
    category: 'bedroom',
    dimensions: { width: 1.6, length: 2.0, height: 0.5 },
  },
  {
    id: 'nightstand',
    name: 'Nightstand',
    icon: 'cube-outline',
    price: '$199',
    color: '#64748B',
    category: 'bedroom',
    dimensions: { width: 0.5, length: 0.4, height: 0.6 },
  },
  
  // Kitchen
  {
    id: 'dining-set',
    name: 'Dining Set',
    icon: 'restaurant-outline',
    price: '$1,299',
    color: '#059669',
    category: 'kitchen',
    dimensions: { width: 1.5, length: 0.9, height: 0.75 },
  },
];

/**
 * Get furniture item by ID
 */
export function getFurnitureById(id: string): FurnitureLibraryItem | undefined {
  return FURNITURE_LIBRARY.find(item => item.id === id);
}

/**
 * Get furniture items by category
 */
export function getFurnitureByCategory(category: string): FurnitureLibraryItem[] {
  return FURNITURE_LIBRARY.filter(item => item.category === category);
}

/**
 * Get all furniture categories
 */
export function getFurnitureCategories(): string[] {
  return [...new Set(FURNITURE_LIBRARY.map(item => item.category))];
}

