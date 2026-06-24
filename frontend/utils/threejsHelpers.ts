/**
 * THREE.js Helper Utilities
 * Common utilities for THREE.js operations
 */

import * as THREE from 'three';
import type { SpatialPoint } from '@/types/ar-view';

/**
 * Converts a SpatialPoint to a THREE.Vector3 for 3D operations
 */
export function spatialToVector3(point: SpatialPoint): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

/**
 * Converts a THREE.Vector3 to a SpatialPoint for AR operations
 */
export function vector3ToSpatial(vector: THREE.Vector3): SpatialPoint {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

/**
 * Safely disposes of Three.js mesh resources to prevent memory leaks
 */
export function disposeMesh(mesh: THREE.Mesh): void {
  try {
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat: THREE.Material) => {
        if (mat) mat.dispose();
      });
    } else if (mesh.material) {
      (mesh.material as THREE.Material).dispose();
    }
  } catch (error) {
    console.warn('[THREE] Error disposing mesh:', error);
  }
}

/**
 * Recursively disposes of all meshes in an object hierarchy
 */
export function disposeObjectRecursive(object: THREE.Object3D): void {
  try {
    object.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        disposeMesh(child);
      }
    });
  } catch (error) {
    console.warn('[THREE] Error disposing object recursively:', error);
  }
}

/**
 * Create a basic furniture mesh with given dimensions and color
 */
export function createFurnitureMesh(
  dimensions: { width: number; length: number; height: number },
  color: string
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(
    dimensions.width,
    dimensions.height,
    dimensions.length
  );
  
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.7,
    metalness: 0.1,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = dimensions.height / 2; // Place on ground
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return mesh;
}

/**
 * Create a reticle mesh for placement preview
 */
export function createReticleMesh(
  radius: number = 0.3,
  color: string = '#00ff00'
): THREE.Mesh {
  const geometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
  geometry.rotateX(-Math.PI / 2); // Lay flat on ground
  
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  
  return new THREE.Mesh(geometry, material);
}

/**
 * Create floor grid helper
 */
export function createFloorGrid(
  size: number = 10,
  divisions: number = 10,
  color: string = '#888888'
): THREE.GridHelper {
  return new THREE.GridHelper(size, divisions, color, color);
}

/**
 * Create ambient and directional lighting for scene
 */
export function createDefaultLighting(): THREE.Group {
  const group = new THREE.Group();
  
  // Ambient light for overall illumination
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  group.add(ambient);
  
  // Main directional light (sun-like)
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 10, 5);
  directional.castShadow = true;
  directional.shadow.mapSize.width = 2048;
  directional.shadow.mapSize.height = 2048;
  group.add(directional);
  
  // Fill light from opposite direction
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 5, -5);
  group.add(fillLight);
  
  return group;
}

/**
 * Animate reticle pulse effect
 */
export function animateReticle(
  mesh: THREE.Mesh,
  time: number,
  pulseSpeed: number = 0.05,
  pulseScale: number = 0.1,
  baseOpacity: number = 0.5,
  opacityVariation: number = 0.3
): void {
  const scale = 1 + Math.sin(time * pulseSpeed) * pulseScale;
  mesh.scale.set(scale, scale, scale);
  
  if (mesh.material && 'opacity' in mesh.material) {
    (mesh.material as THREE.MeshBasicMaterial).opacity = 
      baseOpacity + Math.sin(time * pulseSpeed * 2) * opacityVariation;
  }
}

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle function for rate-limiting operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Safely executes an async operation with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  defaultValue: T,
  errorContext: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[THREE] ${errorContext}:`, error);
    return defaultValue;
  }
}

/**
 * Smooth interpolation between two values
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Smooth interpolation for Vector3
 */
export function lerpVector3(
  start: THREE.Vector3,
  end: THREE.Vector3,
  factor: number
): THREE.Vector3 {
  return new THREE.Vector3(
    lerp(start.x, end.x, factor),
    lerp(start.y, end.y, factor),
    lerp(start.z, end.z, factor)
  );
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Snap value to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap rotation to increments
 */
export function snapRotation(radians: number, snapAngle: number): number {
  return Math.round(radians / snapAngle) * snapAngle;
}

