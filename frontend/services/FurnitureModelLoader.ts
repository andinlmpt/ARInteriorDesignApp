/**
 * Furniture 3D Model Loader — loads one bundled GLB into Three.js for React Native.
 */

import * as THREE from 'three';
import { Platform } from 'react-native';
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

/** Short stable name for a URL, so each model is downloaded to the cache once. */
function cacheNameFor(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) >>> 0;
  }
  return `glb-${hash.toString(16)}-${url.length}.glb`;
}

/**
 * Downloads a remote model to the cache directory and returns its file URI. The native
 * downloader streams it to disk; RN fetch would hold the whole file in the Java heap as a blob
 * (and keep it there), which ran phones out of memory after a few multi‑MB models.
 */
async function downloadModelToCache(url: string): Promise<string> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory to download the model into');
  const target = `${dir}${cacheNameFor(url)}`;
  const cached = await FileSystem.getInfoAsync(target);
  if (cached.exists && typeof cached.size === 'number' && cached.size > 0) return target;

  const result = await FileSystem.downloadAsync(url, target);
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
    throw new Error(`HTTP ${result.status} for ${url}`);
  }
  return result.uri;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  // Local files are read by expo-file-system, not fetch: RN's fetch keeps every response in the
  // Java heap as a blob, so a few large models crash the app with OutOfMemoryError.
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
        // On a phone it is downloaded to disk below (the size check then runs before anything
        // is in memory).
        modelUri = modelUrl;
      } else if (modelUrl.startsWith('file://')) {
        modelUri = modelUrl;
      } else if (modelUrl.startsWith('/')) {
        modelUri = `file://${modelUrl}`;
      }

      if (!modelUri) {
        throw new Error('Failed to resolve model URI');
      }

      let arrayBuffer: ArrayBuffer;
      if (Platform.OS === 'web') {
        // The browser has no cache folder to download into, and no Java heap to run out of.
        const response = await fetch(modelUri);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${modelUri}`);
        arrayBuffer = await response.arrayBuffer();
      } else {
        // A bundled asset served by the dev server comes back as an http URL.
        if (modelUri.startsWith('http://') || modelUri.startsWith('https://')) {
          modelUri = await downloadModelToCache(modelUri);
        }

        const localSize = await getLocalFileSize(modelUri);
        if (localSize != null && localSize > MAX_RN_GLB_BYTES) {
          throw new Error(
            `GLB is ${Math.round(localSize / (1024 * 1024))} MB — too large for RN memory.`
          );
        }

        arrayBuffer = await uriToArrayBuffer(modelUri);
      }
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
