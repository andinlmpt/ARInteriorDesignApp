/**
 * Maps React Native furniture catalog IDs to Unity FurnitureCatalog entry IDs.
 * Add entries here as you register prefabs in ARFurniture.unity → Managers → Furniture Catalog.
 */
const UNITY_FURNITURE_ID_MAP: Record<string, string> = {
  'test-sofa': 'test-sofa',
  'sofa-modern': 'test-sofa',
  'accent-chair': 'test-sofa',
  'dining-chair': 'test-sofa',
  'coffee-table': 'test-sofa',
  'dining-table': 'test-sofa',
  'side-table': 'test-sofa',
  'bookshelf': 'test-sofa',
  'tv-stand': 'test-sofa',
  'wardrobe': 'test-sofa',
  'floor-lamp': 'test-sofa',
  'table-lamp': 'test-sofa',
  'planter': 'test-sofa',
  'rug': 'test-sofa',
  'bed-queen': 'test-sofa',
  'nightstand': 'test-sofa',
  'dining-set': 'test-sofa',
};

const DEFAULT_UNITY_FURNITURE_ID = 'test-sofa';

export function mapFurnitureIdToUnity(catalogId: string): string {
  return UNITY_FURNITURE_ID_MAP[catalogId] ?? DEFAULT_UNITY_FURNITURE_ID;
}
