/**
 * Furniture Library Data
 * Catalog of available furniture items for AR placement
 */

import type { FurnitureLibraryItem } from '@/types/ar-view';

export const FURNITURE_LIBRARY: FurnitureLibraryItem[] = [
  // Seating
  {
    id: 'sofa',
    name: 'Sofa',
    icon: 'desktop-outline',
    price: '$1,299',
    color: '#2563EB',
    category: 'seating',
    dimensions: { width: 2.0, length: 0.9, height: 0.85 },
  },
  {
    id: 'simple-sofa',
    name: 'Simple Sofa',
    icon: 'desktop-outline',
    price: '$899',
    color: '#3B82F6',
    category: 'seating',
    dimensions: { width: 1.8, length: 0.85, height: 0.85 },
  },
  {
    id: 'sofa-set',
    name: 'Sofa Set',
    icon: 'desktop-outline',
    price: '$2,199',
    color: '#1D4ED8',
    category: 'seating',
    dimensions: { width: 2.4, length: 1.6, height: 0.9 },
  },
  {
    id: 'sofa-2seat',
    name: '2-Seat Sofa',
    icon: 'desktop-outline',
    price: '$999',
    color: '#60A5FA',
    category: 'seating',
    dimensions: { width: 1.6, length: 0.85, height: 0.85 },
  },
  {
    id: 'sofa-chair',
    name: 'Sofa Chair',
    icon: 'desktop-outline',
    price: '$549',
    color: '#DB2777',
    category: 'seating',
    dimensions: { width: 0.85, length: 0.85, height: 0.9 },
  },
  {
    id: 'modern-chair',
    name: 'Modern Chair',
    icon: 'desktop-outline',
    price: '$449',
    color: '#EC4899',
    category: 'seating',
    dimensions: { width: 0.7, length: 0.75, height: 0.9 },
  },
  {
    id: 'modern-chair-alt',
    name: 'Lounge Chair',
    icon: 'desktop-outline',
    price: '$479',
    color: '#F472B6',
    category: 'seating',
    dimensions: { width: 0.65, length: 0.7, height: 0.9 },
  },
  {
    id: 'wood-chair',
    name: 'Wood Chair',
    icon: 'desktop-outline',
    price: '$229',
    color: '#92400E',
    category: 'seating',
    dimensions: { width: 0.5, length: 0.5, height: 0.9 },
  },
  {
    id: 'wood-chair-2',
    name: 'Wood Chair 2',
    icon: 'desktop-outline',
    price: '$249',
    color: '#A16207',
    category: 'seating',
    dimensions: { width: 0.5, length: 0.5, height: 0.9 },
  },
  {
    id: 'stone-chair',
    name: 'Stone Chair',
    icon: 'desktop-outline',
    price: '$399',
    color: '#78716C',
    category: 'seating',
    dimensions: { width: 0.7, length: 0.7, height: 0.85 },
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
  {
    id: 'bean-bag',
    name: 'Bean Bag',
    icon: 'ellipse-outline',
    price: '$179',
    color: '#F97316',
    category: 'seating',
    dimensions: { width: 0.9, length: 0.9, height: 0.7 },
  },
  {
    id: 'bean-bag-2',
    name: 'Bean Bag Alt',
    icon: 'ellipse-outline',
    price: '$189',
    color: '#FB923C',
    category: 'seating',
    dimensions: { width: 0.9, length: 0.9, height: 0.7 },
  },

  // Tables
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
    id: 'coffee-table',
    name: 'Coffee Table',
    icon: 'grid-outline',
    price: '$399',
    color: '#14B8A6',
    category: 'tables',
    dimensions: { width: 1.1, length: 0.6, height: 0.4 },
  },
  {
    id: 'console-table',
    name: 'Console Table',
    icon: 'grid-outline',
    price: '$349',
    color: '#0D9488',
    category: 'tables',
    dimensions: { width: 1.2, length: 0.4, height: 0.75 },
  },
  {
    id: 'round-table',
    name: 'Round Table',
    icon: 'grid-outline',
    price: '$429',
    color: '#2DD4BF',
    category: 'tables',
    dimensions: { width: 0.9, length: 0.9, height: 0.75 },
  },
  {
    id: 'side-table',
    name: 'Side Table',
    icon: 'grid-outline',
    price: '$249',
    color: '#EC4899',
    category: 'tables',
    dimensions: { width: 0.55, length: 0.55, height: 0.55 },
  },

  // Lighting
  {
    id: 'floor-lamp',
    name: 'Floor Lamp',
    icon: 'bulb-outline',
    price: '$149',
    color: '#F97316',
    category: 'lighting',
    dimensions: { width: 0.35, length: 0.35, height: 1.7 },
  },
  {
    id: 'table-lamp',
    name: 'Table Lamp',
    icon: 'bulb-outline',
    price: '$89',
    color: '#FBBF24',
    category: 'lighting',
    dimensions: { width: 0.3, length: 0.3, height: 0.55 },
  },

  // Bedroom
  {
    id: 'bed',
    name: 'Queen Bed',
    icon: 'bed-outline',
    price: '$1,499',
    color: '#3B82F6',
    category: 'bedroom',
    dimensions: { width: 1.6, length: 2.0, height: 0.55 },
  },

  // Keep older ids for backwards compatibility with deep links / saved projects
  {
    id: 'sofa-modern',
    name: 'Modern Sofa',
    icon: 'desktop-outline',
    price: '$1,299',
    color: '#2563EB',
    category: 'seating',
    dimensions: { width: 2.0, length: 0.9, height: 0.85 },
  },
  {
    id: 'accent-chair',
    name: 'Accent Chair',
    icon: 'desktop-outline',
    price: '$449',
    color: '#DB2777',
    category: 'seating',
    dimensions: { width: 0.8266, length: 0.5703, height: 0.6862 },
  },
  {
    id: 'sofa-3230',
    name: 'Sofa 3230',
    icon: 'desktop-outline',
    price: '$1,899',
    color: '#1E40AF',
    category: 'seating',
    dimensions: { width: 3.2347, length: 1.1739, height: 0.9163 },
  },
  {
    id: 'kids-armchair',
    name: 'Kids Armchair',
    icon: 'desktop-outline',
    price: '$189',
    color: '#F472B6',
    category: 'seating',
    dimensions: { width: 0.7155, length: 0.6167, height: 0.6396 },
  },
  {
    id: 'washing-machine',
    name: 'Washing Machine',
    icon: 'hardware-chip-outline',
    price: '$699',
    color: '#64748B',
    category: 'kitchen',
    dimensions: { width: 0.6369, length: 0.5944, height: 0.8578 },
  },
  {
    id: 'unimat-mattress',
    name: 'Unimat Mattress',
    icon: 'bed-outline',
    price: '$399',
    color: '#94A3B8',
    category: 'bedroom',
    dimensions: { width: 0.515, length: 0.8, height: 0.8793 },
  },
  {
    id: 'bed-queen',
    name: 'Queen Bed',
    icon: 'bed-outline',
    price: '$1,499',
    color: '#3B82F6',
    category: 'bedroom',
    dimensions: { width: 1.6, length: 2.0, height: 0.55 },
  },
];

export function getFurnitureById(id: string): FurnitureLibraryItem | undefined {
  return FURNITURE_LIBRARY.find(item => item.id === id);
}

export function getFurnitureByCategory(category: string): FurnitureLibraryItem[] {
  return FURNITURE_LIBRARY.filter(item => item.category === category);
}

export function getFurnitureCategories(): string[] {
  return [...new Set(FURNITURE_LIBRARY.map(item => item.category))];
}
