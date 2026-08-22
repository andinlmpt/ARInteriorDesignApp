/**
 * Furniture 3D Model Loader — loads one bundled GLB into Three.js for React Native.
 */

import * as THREE from 'three';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getBundledModelMeta } from '@/config/furniture-models';
import { enhanceModelMaterials, fitModelToDimensions } from '@/utils/arModelEnhancer';
import {
  applyGltfNativePolyfills,
  ensureNavigatorUserAgent,
} from '@/utils/gltfNativePolyfills';

applyGltfNativePolyfills();

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    try {
      return await new File(uri).arrayBuffer();
    } catch (fileError) {
      console.warn('[FurnitureModelLoader] File.arrayBuffer failed, trying legacy base64:', fileError);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64ToArrayBuffer(base64);
    }
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${uri}`);
  }
  return response.arrayBuffer();
}

export class FurnitureModelLoader {
  private loader: GLTFLoader;

  constructor() {
    applyGltfNativePolyfills();
    this.loader = new GLTFLoader();
  }

  async loadGLBModel(
    modelUrl: string | number,
    scale = 1.0,
    enhanceOptions?: { preferTextures?: boolean }
  ): Promise<THREE.Group | null> {
    try {
      console.log('[FurnitureModelLoader] Loading GLB model from:', modelUrl);

      let modelUri: string | null = null;

      if (typeof modelUrl === 'number') {
        const asset = Asset.fromModule(modelUrl);
        await asset.downloadAsync();
        modelUri = asset.localUri ?? asset.uri ?? null;
        console.log('[FurnitureModelLoader] Resolved bundled asset to:', modelUri);
      } else if (modelUrl.startsWith('http://') || modelUrl.startsWith('https://')) {
        const fileName = `model_${Date.now()}.glb`;
        const localPath = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${fileName}`;
        const downloadResult = await FileSystem.downloadAsync(modelUrl, localPath);
        modelUri = downloadResult.uri;
      } else if (modelUrl.startsWith('file://')) {
        modelUri = modelUrl;
      }

      if (!modelUri) {
        throw new Error('Failed to resolve model URI');
      }

      const arrayBuffer = await uriToArrayBuffer(modelUri);
      console.log('[FurnitureModelLoader] Parsed buffer bytes:', arrayBuffer.byteLength);

      ensureNavigatorUserAgent();

      return new Promise((resolve, reject) => {
        this.loader.parse(
          arrayBuffer,
          '',
          (gltf) => {
            console.log('[FurnitureModelLoader] GLB model loaded successfully');
            const model = gltf.scene;
            enhanceModelMaterials(model, enhanceOptions);

            if (scale !== 1.0) {
              model.scale.set(scale, scale, scale);
            }

            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            resolve(model);
          },
          (error) => {
            console.error('[FurnitureModelLoader] Error parsing GLB model:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('[FurnitureModelLoader] Failed to load GLB model:', error);
      return null;
    }
  }

  /**
   * Load any bundled furniture GLB fitted to its measured catalog dimensions.
   */
  async loadBundledFurniture(
    furnitureId: string,
    dimensions?: { width: number; length: number; height: number }
  ): Promise<THREE.Object3D | null> {
    const meta = getBundledModelMeta(furnitureId);
    if (!meta) {
      console.warn(`[FurnitureModelLoader] No bundled GLB for "${furnitureId}"`);
      return null;
    }

    const model = await this.loadGLBModel(meta.asset, 1.0, {
      preferTextures: meta.preferTextures === true,
    });
    if (!model) return null;

    if (meta.unitScale != null && meta.unitScale !== 1) {
      model.scale.multiplyScalar(meta.unitScale);
      model.updateMatrixWorld(true);
    }

    const target = dimensions ?? meta.dimensions;
    fitModelToDimensions(model, target, 1.0);
    model.userData.usesGLB = true;
    model.userData.furnitureId = furnitureId;
    model.userData.dimensions = target;
    return model;
  }

  /**
   * @deprecated Prefer loadBundledFurniture('accent-chair')
   */
  async loadTestChair(
    dimensions: { width: number; length: number; height: number } = {
      width: 0.8266,
      length: 0.5703,
      height: 0.6862,
    }
  ): Promise<THREE.Object3D | null> {
    return this.loadBundledFurniture('accent-chair', dimensions);
  }
}

export const furnitureModelLoader = new FurnitureModelLoader();
