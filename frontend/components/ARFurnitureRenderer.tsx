/**
 * AR Furniture Renderer Types and Utilities
 * Type definitions for AR furniture items
 */

import * as THREE from 'three';

export interface ARFurnitureItem {
  id: string;
  name: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  color: number;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  modelUrl?: string;
}
