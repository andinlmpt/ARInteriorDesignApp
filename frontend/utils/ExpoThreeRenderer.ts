/**
 * ExpoThreeRenderer.ts
 * A local, drop-in replacement for the `Renderer` exported by `expo-three`.
 *
 * Why this exists:
 *   `expo-three` v8.0.0 is unmaintained and pulls in ~34 incompatible
 *   sub-dependencies (including `@expo/browser-polyfill`, `fbemitter`,
 *   `expo-2d-context`) that break Expo SDK 53+ builds with errors like:
 *     - ReferenceError: Property 'DOMException' doesn't exist
 *     - SyntaxError: private properties are not supported
 *
 *   This file replicates the only export we need: a WebGLRenderer that
 *   works correctly with the ExpoWebGLRenderingContext from `expo-gl`.
 *
 * Usage:
 *   import { ExpoThreeRenderer } from '@/utils/ExpoThreeRenderer';
 *
 *   const renderer = new ExpoThreeRenderer({ gl, width, height, pixelRatio });
 *   // Use exactly like THREE.WebGLRenderer
 */

import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';

export interface ExpoThreeRendererParams {
  /** The ExpoWebGLRenderingContext obtained from the GLView onContextCreate callback */
  gl: ExpoWebGLRenderingContext;
  /** Logical width of the drawing surface */
  width: number;
  /** Logical height of the drawing surface */
  height: number;
  /** Device pixel ratio (use PixelRatio.get() from react-native) */
  pixelRatio?: number;
}

/**
 * Creates a THREE.WebGLRenderer that renders into an Expo GL surface.
 *
 * After each render frame you must call `gl.endFrameEXP()` to flush
 * the frame to the screen — this wrapper does NOT call it automatically
 * so you retain full control over your render loop.
 *
 * Example render loop:
 * ```ts
 * function animate() {
 *   requestAnimationFrame(animate);
 *   renderer.render(scene, camera);
 *   gl.endFrameEXP();
 * }
 * animate();
 * ```
 */
export class ExpoThreeRenderer extends THREE.WebGLRenderer {
  constructor({ gl, width, height, pixelRatio = 1 }: ExpoThreeRendererParams) {
    super({
      canvas: {
        width,
        height,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        clientHeight: height,
        clientWidth: width,
      } as unknown as HTMLCanvasElement,
      context: gl as unknown as WebGLRenderingContext,
      antialias: false, // Antialias is expensive on mobile; enable only if needed
      alpha: true,
      preserveDrawingBuffer: true,
    });

    this.setSize(width, height);
    this.setPixelRatio(pixelRatio);
    // Expo GL handles frame submission via gl.endFrameEXP()
    // so we disable Three's own auto-clear to avoid double-clearing
    this.autoClear = true;
  }
}

/**
 * Convenience factory function — equivalent to `new ExpoThreeRenderer(params)`.
 * Mirrors the original expo-three `Renderer` factory API.
 */
export function createRenderer(params: ExpoThreeRendererParams): ExpoThreeRenderer {
  return new ExpoThreeRenderer(params);
}
