/**
 * AR Core Manager
 * Manages ARCore/ARKit initialization and tracking via the native bridge.
 */

import {
  getARPlatformName,
  hitTestAR,
  isARSessionAvailable,
  isARSessionSupported,
  startARSession,
  stopARSession,
} from '@/native/ARSessionNative';

class ARCoreManagerClass {
  private isInitialized = false;
  private isTracking = false;

  async initialize(): Promise<void> {
    if (!isARSessionAvailable()) {
      throw new Error('Native AR session is not available on this platform');
    }

    const supported = await isARSessionSupported();
    if (!supported) {
      throw new Error('AR is not supported on this device');
    }

    this.isInitialized = true;
    console.log(`[ARCoreManager] ${getARPlatformName() ?? 'AR'} ready`);
  }

  async startTracking(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('AR not initialized. Call initialize() first.');
    }

    const started = await startARSession();
    if (!started) {
      throw new Error('Failed to start native AR session');
    }

    this.isTracking = true;
    console.log(`[ARCoreManager] ${getARPlatformName() ?? 'AR'} tracking started`);
  }

  stopTracking(): void {
    stopARSession();
    this.isTracking = false;
    console.log(`[ARCoreManager] ${getARPlatformName() ?? 'AR'} tracking stopped`);
  }

  async hitTest(
    screenX: number,
    screenY: number
  ): Promise<{ position: { x: number; y: number; z: number } } | null> {
    if (!this.isTracking) {
      console.warn('[ARCoreManager] AR not tracking, hit test may fail');
      return null;
    }

    return hitTestAR(screenX, screenY);
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }

  getPlatform(): 'ARCore' | 'ARKit' | null {
    return getARPlatformName();
  }

  reset(): void {
    this.stopTracking();
    this.isInitialized = false;
  }
}

export const arCoreManager = new ARCoreManagerClass();
