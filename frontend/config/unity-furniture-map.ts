/**

 * Maps React Native furniture catalog IDs to Unity FurnitureCatalog entry IDs.

 * Keep in sync with Managers → Furniture Catalog in ARFurniture.unity / ARFurnitureDev.unity.

 */

const UNITY_FURNITURE_ID_MAP: Record<string, string> = {

  'test-sofa': 'test-sofa',

  'sofa-modern': 'test-sofa',

  'simple-sofa': 'simple-sofa',

  'accent-chair': 'modern-chair',

  'modern-chair': 'modern-chair',

  'dining-chair': 'dining-chair',

  'wood-chair': 'wood-chair',

  'coffee-table': 'side-table',

  'dining-table': 'dining-table',

  'side-table': 'side-table',

  'bean-bag': 'bean-bag',

  'bookshelf': 'side-table',

  'tv-stand': 'side-table',

  'wardrobe': 'side-table',

  'floor-lamp': 'side-table',

  'table-lamp': 'side-table',

  'planter': 'side-table',

  'rug': 'side-table',

  'bed-queen': 'test-sofa',

  'nightstand': 'side-table',

  'dining-set': 'dining-table',

};



const DEFAULT_UNITY_FURNITURE_ID = 'test-sofa';



export function mapFurnitureIdToUnity(catalogId: string): string {

  return UNITY_FURNITURE_ID_MAP[catalogId] ?? DEFAULT_UNITY_FURNITURE_ID;

}

