import { FURNITURE_LIBRARY } from '@/constants/furniture-library';
import type { FurnitureLibraryItem } from '@/types/ar-view';

export function buildFurnitureLibraryById(
  library: FurnitureLibraryItem[] = FURNITURE_LIBRARY
): Record<string, FurnitureLibraryItem> {
  return library.reduce<Record<string, FurnitureLibraryItem>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

export function getFilteredFurnitureLibrary(
  selectedCategory: FurnitureLibraryItem['category'] | 'all'
): FurnitureLibraryItem[] {
  if (selectedCategory === 'all') {
    return FURNITURE_LIBRARY;
  }
  return FURNITURE_LIBRARY.filter((item) => item.category === selectedCategory);
}

export function getFurnitureCategories(): FurnitureLibraryItem['category'][] {
  const categories = new Set<FurnitureLibraryItem['category']>();
  FURNITURE_LIBRARY.forEach((item) => categories.add(item.category));
  return Array.from(categories);
}
