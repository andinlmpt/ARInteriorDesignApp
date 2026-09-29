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

/** Base64 doubles memory — never use it for multi‑MB GLBs on mobile. */
const MAX_BASE64_FALLBACK_BYTES = 8 * 1024 * 1024;
/** Soft cap for parsing remote GLBs in RN JS heap (Unity handles the huge ones). */
export const MAX_RN_GLB_BYTES = 24 * 1024 * 1024;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getLocalFileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === 'number') return info.size;
  } catch {
    // ignore
  }
  return null;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  // Prefer fetch for both remote and file URIs — avoids base64 OOM on Android.
  try {
    const response = await fetch(uri);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (fetchError) {
    console.warn('[FurnitureModelLoader] fetch(arrayBuffer) failed:', fetchError);
  }

  if (uri.startsWith('file://') || uri.startsWith('/')) {
    try {
      return await new File(uri).arrayBuffer();
    } catch (fileError) {
      const size = await getLocalFileSize(uri);
      if (size != null && size > MAX_BASE64_FALLBACK_BYTES) {
        throw new Error(
          `GLB is too large for RN memory (${Math.round(size / (1024 * 1024))} MB). ` +
            'Use AR Furniture (Unity) for full models, or a smaller preview mesh.'
        );
      }
      console.warn(
        '[FurnitureModelLoader] File.arrayBuffer failed, trying legacy base64 (small files only):',
        fileError
      );
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64ToArrayBuffer(base64);
    }
  }

  throw new Error(`Could not read model bytes from ${uri}`);
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
        // Stream into an ArrayBuffer directly — download+base64 OOMs on 100–250 MB sofas.
        const response = await fetch(modelUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${modelUrl}`);
        }
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_RN_GLB_BYTES) {
          throw new Error(
            `Remote GLB is ${Math.round(contentLength / (1024 * 1024))} MB — too large for RN. ` +
              'Place this piece in AR Furniture instead.'
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_RN_GLB_BYTES) {
          throw new Error(
            `Remote GLB is ${Math.round(arrayBuffer.byteLength / (1024 * 1024))} MB — too large for RN.`
          );
        }
        console.log('[FurnitureModelLoader] Parsed buffer bytes:', arrayBuffer.byteLength);
        ensureNavigatorUserAgent();
        return await new Promise((resolve, reject) => {
          this.loader.parse(
            arrayBuffer,
            '',
            (gltf) => {
              const model = gltf.scene;
              enhanceModelMaterials(model, enhanceOptions);
              if (scale !== 1.0) model.scale.set(scale, scale, scale);
              model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });
              resolve(model);
            },
            (error) => reject(error)
          );
        });
      } else if (modelUrl.startsWith('file://')) {
        modelUri = modelUrl;
      } else if (modelUrl.startsWith('/')) {
        modelUri = `file://${modelUrl}`;
      }

      if (!modelUri) {
        throw new Error('Failed to resolve model URI');
      }

      const localSize = await getLocalFileSize(modelUri);
      if (localSize != null && localSize > MAX_RN_GLB_BYTES) {
        throw new Error(
          `GLB is ${Math.round(localSize / (1024 * 1024))} MB — too large for RN memory.`
        );
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
