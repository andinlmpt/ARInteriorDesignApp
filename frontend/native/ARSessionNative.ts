import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { ARNativePlane } from './ARPlane';

type ARSessionNativeModule = {
  // Lifecycle
  isSupported: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<void>;

  // Data
  getPlanes: () => Promise<ARNativePlane[]>;
};

const MODULE_NAME = 'ARSessionNative';

const Native: ARSessionNativeModule | undefined = (NativeModules as any)?.[MODULE_NAME];

export const arSessionEvents = Native
  ? new NativeEventEmitter((NativeModules as any)[MODULE_NAME])
  : null;

export function isARSessionAvailable(): boolean {
  return Platform.OS !== 'web' && !!Native;
}

export async function isARSessionSupported(): Promise<boolean> {
  if (!isARSessionAvailable()) return false;
  try {
    return await Native!.isSupported();
  } catch {
    return false;
  }
}

export async function startARSession(): Promise<boolean> {
  if (!isARSessionAvailable()) return false;
  try {
    const supported = await Native!.isSupported();
    if (!supported) return false;
    await Native!.start();
    return true;
  } catch {
    return false;
  }
}

export async function stopARSession(): Promise<void> {
  if (!isARSessionAvailable()) return;
  try {
    await Native!.stop();
  } catch {
    // ignore
  }
}

export async function getARPlanes(): Promise<ARNativePlane[]> {
  if (!isARSessionAvailable()) return [];
  try {
    return await Native!.getPlanes();
  } catch {
    return [];
  }
}

