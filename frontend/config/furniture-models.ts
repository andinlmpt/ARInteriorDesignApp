/**
 * Bundled GLB assets for React Native furniture preview (Metro asset registry).
 * Dimensions are measured from each mesh bounding box (meters).
 * Models authored in millimeters set unitScale to 0.001.
 */

export type FurnitureModelAssetKey =
  | 'accent-chair'
  | 'sofa-3230'
  | 'kids-armchair'
  | 'washing-machine'
  | 'unimat-mattress';

export type FurnitureModelDimensions = {
  width: number;
  length: number;
  height: number;
};

export type FurnitureModelMeta = {
  /** Metro require() module id */
  asset: number;
  /** Exact mesh size in meters after unitScale is applied */
  dimensions: FurnitureModelDimensions;
  /** Multiply raw GLB units before fitting (mm → m = 0.001) */
  unitScale?: number;
  /**
   * Keep albedo textures on native. Only enable for models whose maps upload
   * correctly on expo-gl (broken maps render solid black).
   */
  preferTextures?: boolean;
};

/** Maps furniture IDs to bundled GLB modules + measured sizes. */
export const FURNITURE_MODEL_ASSETS: Record<FurnitureModelAssetKey, FurnitureModelMeta> = {
  'accent-chair': {
    asset: require('@/assets/models/furniture/accent-chair.glb'),
    dimensions: { width: 0.8266, length: 0.5703, height: 0.6862 },
    // Has strong authored colors (mango / wood); maps often go black on expo-gl.
    preferTextures: false,
  },
  'sofa-3230': {
    asset: require('@/assets/models/furniture/sofa-3230.glb'),
    dimensions: { width: 3.2347, length: 1.1739, height: 0.9163 },
    preferTextures: false,
  },
  'kids-armchair': {
    asset: require('@/assets/models/furniture/kids-armchair.glb'),
    dimensions: { width: 0.7155, length: 0.6167, height: 0.6396 },
    // Textures upload correctly and carry all color (base color is white).
    preferTextures: true,
  },
  'washing-machine': {
    asset: require('@/assets/models/furniture/washing-machine.glb'),
    dimensions: { width: 0.6369, length: 0.5944, height: 0.8578 },
    preferTextures: false,
  },
  'unimat-mattress': {
    asset: require('@/assets/models/furniture/unimat-mattress.glb'),
    unitScale: 0.001,
    dimensions: { width: 0.515, length: 0.8, height: 0.8793 },
    preferTextures: false,
  },
};

export function getBundledModelAsset(furnitureId: string): number | undefined {
  return FURNITURE_MODEL_ASSETS[furnitureId as FurnitureModelAssetKey]?.asset;
}

export function getBundledModelMeta(furnitureId: string): FurnitureModelMeta | undefined {
  return FURNITURE_MODEL_ASSETS[furnitureId as FurnitureModelAssetKey];
}

export function getBundledFurnitureIds(): FurnitureModelAssetKey[] {
  return Object.keys(FURNITURE_MODEL_ASSETS) as FurnitureModelAssetKey[];
}

export function hasBundledModel(furnitureId: string): boolean {
  return furnitureId in FURNITURE_MODEL_ASSETS;
}
