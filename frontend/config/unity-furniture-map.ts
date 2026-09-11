/**
 * Maps React Native furniture catalog IDs to Unity FurnitureCatalog entry IDs.
 * MongoDB catalog IDs pass through unchanged; legacy demo IDs keep their aliases.
 */

const UNITY_FURNITURE_ID_MAP: Record<string, string> = {
  sofa: 'sofa',
  'sofa-modern': 'sofa',
  'test-sofa': 'sofa',
  'simple-sofa': 'simple-sofa',
  'sofa-set': 'sofa-set',
  'sofa-2seat': 'sofa-2seat',
  'sofa-chair': 'sofa-chair',
  'accent-chair': 'modern-chair',
  'sofa-3230': 'sofa',
  'kids-armchair': 'modern-chair',
  'washing-machine': 'side-table',
  'unimat-mattress': 'bed',
  'modern-chair': 'modern-chair',
  'modern-chair-alt': 'modern-chair-alt',
  'dining-chair': 'dining-chair',
  'wood-chair': 'wood-chair',
  'wood-chair-2': 'wood-chair-2',
  'stone-chair': 'stone-chair',
  'coffee-table': 'coffee-table',
  'dining-table': 'dining-table',
  'dining-set': 'dining-table',
  'side-table': 'side-table',
  'console-table': 'console-table',
  'round-table': 'round-table',
  'bean-bag': 'bean-bag',
  'bean-bag-2': 'bean-bag-2',
  bed: 'bed',
  'bed-queen': 'bed',
  'floor-lamp': 'floor-lamp',
  'table-lamp': 'table-lamp',
  nightstand: 'side-table',
  bookshelf: 'console-table',
  'tv-stand': 'console-table',
  wardrobe: 'sofa-2seat',
  planter: 'side-table',
  rug: 'coffee-table',
};

export function mapFurnitureIdToUnity(catalogId: string): string {
  return UNITY_FURNITURE_ID_MAP[catalogId] ?? catalogId;
}
