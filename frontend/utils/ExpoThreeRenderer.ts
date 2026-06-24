/**
 * Local replacement for expo-three's Renderer.
 * expo-three@8.0.0 is unmaintained and incompatible with Expo SDK 54 / RN 0.81.
 * Its dependency chain (@expo/browser-polyfill → fbemitter, expo-2d-context, etc.)
 * crashes Hermes with "private properties not supported" and "DOMException doesn't exist".
 *
 * The original Renderer is just a thin wrapper around THREE.WebGLRenderer.
 * This local version does the same thing without the broken dependency chain.
 */

import * as THREE from 'three';

interface RendererProps {
  gl: WebGLRenderingContext;
  canvas?: any;
  pixelRatio?: number;
  clearColor?: string | number;
  width?: number;
  height?: number;
  [key: string]: any;
}

export default class Renderer extends THREE.WebGLRenderer {
  constructor({ gl: context, canvas, pixelRatio = 1, clearColor, width, height, ...props }: RendererProps) {
    const inputCanvas = canvas || {
      width: context.drawingBufferWidth,
      height: context.drawingBufferHeight,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      clientHeight: context.drawingBufferHeight,
    };

    super({
      canvas: inputCanvas,
      context,
      ...props,
    });

    this.setPixelRatio(pixelRatio);

    if (width && height) {
      this.setSize(width, height);
    }

    if (clearColor) {
      this.setClearColor(clearColor as any);
    }
  }
}
