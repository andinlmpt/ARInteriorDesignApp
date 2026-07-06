/**
 * React Native polyfills for THREE.js GLTFLoader embedded textures.
 *
 * GLTFLoader creates Blob + URL.createObjectURL for inline GLB images, which
 * React Native does not support. TextureLoader also expects DOM <img>, which
 * expo-gl replaces with EXGLImageUtils localUri uploads.
 *
 * Adapted from @react-three/fiber/native polyfills (MIT).
 */

import { Platform, Image, NativeModules } from 'react-native';
import * as THREE from 'three';
import { Asset } from 'expo-asset';
import { fromByteArray } from 'base64-js';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';

let polyfillsApplied = false;

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** GLTFParser reads navigator.userAgent during construction; Hermes may leave it undefined. */
export function ensureNavigatorUserAgent(): void {
  if (typeof navigator !== 'undefined' && navigator.userAgent == null) {
    try {
      Object.defineProperty(navigator, 'userAgent', {
        value: '',
        writable: true,
        configurable: true,
      });
    } catch {
      (navigator as { userAgent?: string }).userAgent = '';
    }
  }
}

async function resolveAssetUri(input: string | number): Promise<string> {
  if (typeof input === 'string') {
    if (input.startsWith('file:')) {
      return input;
    }

    const blobScheme = NativeModules.BlobModule?.BLOB_URI_SCHEME as string | undefined;
    if (input.startsWith('blob:') || (blobScheme && input.startsWith(blobScheme))) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', input);
        xhr.responseType = 'blob';
        xhr.onload = () => resolve(xhr.response as Blob);
        xhr.onerror = reject;
        xhr.send();
      });

      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
      });

      input = `data:${blob.type};base64,${data}`;
    }

    if (input.startsWith('data:')) {
      const [header, data] = input.split(';base64,');
      const [, type] = header.split('/');
      const ext = type === 'jpeg' ? 'jpg' : type;
      const uri = `${FileSystem.cacheDirectory}${uuidv4()}.${ext}`;
      await FileSystem.writeAsStringAsync(uri, data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return uri;
    }

    return input;
  }

  const asset = Asset.fromModule(input);
  await asset.downloadAsync();
  let uri = asset.localUri ?? asset.uri ?? '';

  if (uri && !uri.includes(':')) {
    const file = `${FileSystem.cacheDirectory}ExponentAsset-${asset.hash}.${asset.type}`;
    await FileSystem.copyAsync({ from: uri, to: file });
    uri = file;
  }

  return uri;
}

function patchBlobAndUrl(): void {
  try {
    const blob = new Blob([new ArrayBuffer(4)]);
    const url = URL.createObjectURL(blob);
    URL.revokeObjectURL(url);
    return;
  } catch {
    // React Native lacks Blob(ArrayBuffer) — patch BlobManager + createObjectURL.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BlobManagerModule = require('react-native/Libraries/Blob/BlobManager.js');
    const BlobManager = BlobManagerModule.default ?? BlobManagerModule;

    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function createObjectURLPatched(blob: Blob): string {
      const blobData = (blob as Blob & { data?: { _base64?: string } }).data;
      if (blobData?._base64) {
        return `data:${blob.type};base64,${blobData._base64}`;
      }
      return createObjectURL(blob);
    };

    const createFromParts = BlobManager.createFromParts.bind(BlobManager);
    BlobManager.createFromParts = function createFromPartsPatched(
      parts: Array<Blob | BlobPart | string>,
      options: BlobPropertyBag
    ) {
      const normalizedParts = parts.map((part) => {
        if (part instanceof ArrayBuffer || ArrayBuffer.isView(part)) {
          return fromByteArray(new Uint8Array(part as ArrayBuffer));
        }
        return part;
      });

      const blob = createFromParts(normalizedParts, options);
      blob.data._base64 = '';
      for (const part of normalizedParts) {
        const partData = (part as { data?: { _base64?: string } }).data;
        blob.data._base64 += partData?._base64 ?? (part as string);
      }
      return blob;
    };
  } catch (error) {
    console.warn('[gltfNativePolyfills] BlobManager patch unavailable:', error);
  }
}

function patchTextureLoader(): void {
  const originalLoad = THREE.TextureLoader.prototype.load;

  THREE.TextureLoader.prototype.load = function loadPatched(
    url: string,
    onLoad?: (texture: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void
  ) {
    void onProgress;
    let resolvedUrl = url;
    if (this.path && typeof resolvedUrl === 'string') {
      resolvedUrl = this.path + resolvedUrl;
    }

    const texture = new THREE.Texture();

    resolveAssetUri(resolvedUrl)
      .then(async (uri) => {
        const { width, height } = await new Promise<{ width: number; height: number }>(
          (resolve, reject) => {
            Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
          }
        );

        texture.image = {
          data: { localUri: uri },
          width,
          height,
        };
        texture.flipY = true;
        texture.needsUpdate = true;
        (texture as THREE.Texture & { isDataTexture?: boolean }).isDataTexture = true;

        onLoad?.(texture);
      })
      .catch((error) => {
        if (originalLoad) {
          originalLoad.call(this, url, onLoad, onProgress, onError);
          return;
        }
        onError?.(error);
      });

    return texture;
  };
}

function patchFileLoader(): void {
  THREE.FileLoader.prototype.load = function loadPatched(
    url: string,
    onLoad?: (response: ArrayBuffer) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void
  ) {
    void onProgress;
    let resolvedUrl = url;
    if (this.path && typeof resolvedUrl === 'string') {
      resolvedUrl = this.path + resolvedUrl;
    }

    this.manager.itemStart(resolvedUrl);

    resolveAssetUri(resolvedUrl)
      .then(async (uri) => {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        onLoad?.(Buffer.from(base64, 'base64').buffer as ArrayBuffer);
      })
      .catch((error) => {
        onError?.(error);
        this.manager.itemError(resolvedUrl);
      })
      .finally(() => {
        this.manager.itemEnd(resolvedUrl);
      });
  };
}

function patchLoaderUtils(): void {
  const extractUrlBase = THREE.LoaderUtils.extractUrlBase.bind(THREE.LoaderUtils);
  THREE.LoaderUtils.extractUrlBase = (url: string) =>
    typeof url === 'string' ? extractUrlBase(url) : './';
}

/**
 * Apply THREE.js loader patches required for GLB embedded textures on native.
 * Safe to call multiple times; no-op on web.
 */
export function applyGltfNativePolyfills(): void {
  if (polyfillsApplied || Platform.OS === 'web') {
    return;
  }

  polyfillsApplied = true;
  ensureNavigatorUserAgent();
  patchBlobAndUrl();
  patchLoaderUtils();
  patchTextureLoader();
  patchFileLoader();
}

if (Platform.OS !== 'web') {
  applyGltfNativePolyfills();
}
