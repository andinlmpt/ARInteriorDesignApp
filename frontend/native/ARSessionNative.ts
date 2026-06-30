import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { ARNativePlane } from './ARPlane';
import type { SpatialPoint } from '@/types/spatial-mapping';

type HitTestResult = {
  position: SpatialPoint;
};

type RawNativePlane = {
  id: string;
  type: 'horizontal' | 'vertical';
  center: SpatialPoint | number[];
  normal?: SpatialPoint | number[];
  extent?: number[];
  area?: number;
  confidence?: number;
  timestamp?: number;
  points?: SpatialPoint[];
};

type ARSessionNativeModule = {
  isSupported: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPlanes: () => Promise<RawNativePlane[]>;
  getMesh: () => Promise<unknown>;
  getPointCloud: () => Promise<SpatialPoint[] | null>;
  hitTest: (screenX: number, screenY: number) => Promise<HitTestResult | null>;
};

const MODULE_NAME = 'ARSessionNative';

const Native: ARSessionNativeModule | undefined = (NativeModules as Record<string, ARSessionNativeModule | undefined>)?.[MODULE_NAME];

export const arSessionEvents = Native
  ? new NativeEventEmitter((NativeModules as Record<string, any>)[MODULE_NAME])
  : null;

function toSpatialPoint(value: SpatialPoint | number[] | undefined, fallback: SpatialPoint): SpatialPoint {
  if (!value) {
    return fallback;
  }
  if (Array.isArray(value)) {
    return { x: value[0] ?? 0, y: value[1] ?? 0, z: value[2] ?? 0 };
  }
  return value;
}

function parseNativePlane(raw: RawNativePlane): ARNativePlane {
  const center = toSpatialPoint(raw.center, { x: 0, y: 0, z: 0 });
  const extent = raw.extent ?? [1, 1];
  const normal = toSpatialPoint(
    raw.normal,
    raw.type === 'horizontal' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 }
  );

  return {
    id: raw.id,
    type: raw.type,
    center,
    normal,
    area: raw.area ?? extent[0] * extent[1],
    confidence: raw.confidence ?? 0.8,
    timestamp: raw.timestamp ?? Date.now(),
    points: raw.points,
  };
}

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
    const planes = await Native!.getPlanes();
    return planes.map(parseNativePlane);
  } catch {
    return [];
  }
}

export async function getARMesh(): Promise<unknown> {
  if (!isARSessionAvailable() || !Native?.getMesh) return null;
  try {
    return await Native!.getMesh();
  } catch {
    return null;
  }
}

export async function getARPointCloud(): Promise<SpatialPoint[] | null> {
  if (!isARSessionAvailable() || !Native?.getPointCloud) return null;
  try {
    return await Native!.getPointCloud();
  } catch {
    return null;
  }
}

export async function hitTestAR(
  screenX: number,
  screenY: number
): Promise<HitTestResult | null> {
  if (!isARSessionAvailable() || !Native?.hitTest) return null;
  try {
    return await Native.hitTest(screenX, screenY);
  } catch {
    return null;
  }
}

export function getARPlatformName(): 'ARCore' | 'ARKit' | null {
  if (!isARSessionAvailable()) return null;
  return Platform.OS === 'android' ? 'ARCore' : 'ARKit';
}
