/**
 * Bundled GLB assets for AR furniture (Expo Go compatible via Metro asset registry).
 * Run `npm run download:models` from repo root if files are missing.
 */

export type FurnitureModelAssetKey =
  | 'accent-chair'
  | 'dining-chair'
  | 'sofa-modern'
  | 'sofa-two-seater-scandinavian'
  | 'coffee-table'
  | 'floor-lamp'
  | 'bookshelf'
  | 'planter';

/** Maps furniture library IDs to bundled GLB modules (require resolves to a number). */
export const FURNITURE_MODEL_ASSETS: Partial<Record<FurnitureModelAssetKey, number>> = {
  'accent-chair': require('@/assets/models/furniture/accent-chair.glb'),
  'dining-chair': require('@/assets/models/furniture/dining-chair.glb'),
  'sofa-modern': require('@/assets/models/furniture/sofa-modern.glb'),
  'sofa-two-seater-scandinavian': require('@/assets/models/furniture/sofa-modern.glb'),
  'coffee-table': require('@/assets/models/furniture/coffee-table.glb'),
  'floor-lamp': require('@/assets/models/furniture/floor-lamp.glb'),
  'bookshelf': require('@/assets/models/furniture/bookshelf.glb'),
  'planter': require('@/assets/models/furniture/planter.glb'),
};

export function getBundledModelAsset(furnitureId: string): number | undefined {
  return FURNITURE_MODEL_ASSETS[furnitureId as FurnitureModelAssetKey];
}
