/**
 * Helper functions for loading furniture 3D models in AR view
 * Provides integration between FurnitureModelLoader and AR view components
 */

import * as THREE from 'three';
import { furnitureModelLoader } from '@/services/FurnitureModelLoader';
import type { FurnitureLibraryItem } from '@/types/ar-view';

/**
 * Create a furniture mesh using 3D model or fallback to box
 */
export async function createFurnitureMeshWithModel(
  libraryItem: FurnitureLibraryItem,
  position: { x: number; y: number; z: number },
  rotation?: { x?: number; y?: number; z?: number }
): Promise<THREE.Object3D> {
  try {
    // Try to load 3D model
    const model = await furnitureModelLoader.loadModel(
      libraryItem.id,
      libraryItem.dimensions,
      libraryItem.color
    );

    // Position the model
    model.position.set(position.x, position.y, position.z);
    
    // Apply rotation
    if (rotation) {
      if (rotation.x !== undefined) model.rotation.x = rotation.x;
      if (rotation.y !== undefined) model.rotation.y = rotation.y;
      if (rotation.z !== undefined) model.rotation.z = rotation.z;
    }

    // Ensure model is at correct height (bottom of model at y position)
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.y = position.y + size.y / 2;

    return model;
  } catch (error) {
    console.warn(`[FurnitureModelHelper] Failed to load model for ${libraryItem.id}, using fallback:`, error);
    
    // Fallback to box geometry (same as current implementation)
    return createBoxFallback(libraryItem, position, rotation);
  }
}

/**
 * Create box geometry fallback (current implementation)
 */
export function createBoxFallback(
  libraryItem: FurnitureLibraryItem,
  position: { x: number; y: number; z: number },
  rotation?: { x?: number; y?: number; z?: number }
): THREE.Mesh {
  const { width, length, height } = libraryItem.dimensions;
  
  const widthSegs = Math.max(2, Math.floor(width * 2));
  const heightSegs = Math.max(2, Math.floor(height * 2));
  const depthSegs = Math.max(2, Math.floor(length * 2));

  const geometry = new THREE.BoxGeometry(
    width,
    height,
    length,
    widthSegs,
    heightSegs,
    depthSegs
  );

  const baseColor = new THREE.Color(libraryItem.color);
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.6,
    metalness: 0.2,
    envMapIntensity: 0.5,
    emissive: baseColor.clone().multiplyScalar(0.05),
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  mesh.position.set(
    position.x,
    position.y + height / 2,
    position.z
  );

  if (rotation) {
    if (rotation.x !== undefined) mesh.rotation.x = rotation.x;
    if (rotation.y !== undefined) mesh.rotation.y = rotation.y;
    if (rotation.z !== undefined) mesh.rotation.z = rotation.z;
  }

  return mesh;
}

/**
 * Preload furniture models for better performance
 */
export async function preloadFurnitureModels(furnitureIds: string[]): Promise<void> {
  try {
    await furnitureModelLoader.preloadModels(furnitureIds);
    console.log('[FurnitureModelHelper] Preloaded models:', furnitureIds);
  } catch (error) {
    console.warn('[FurnitureModelHelper] Failed to preload some models:', error);
  }
}











