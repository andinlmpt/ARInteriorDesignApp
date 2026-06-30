/**
 * AR View Types
 * TypeScript definitions for AR functionality
 */

import * as THREE from 'three';
import { RoomData } from './spatial-mapping';

// Error types
export type ARInitErrorType =
  | 'camera_permission'
  | 'webgl_context'
  | 'webgl_unsupported'
  | 'renderer_init'
  | 'invalid_context_dimensions'
  | 'anchor_tracking'
  | 'anchor_poor_quality'
  | 'scene_init'
  | 'lighting_init'
  | 'texture_loading'
  | 'memory_limit'
  | 'device_incompatible'
  | 'unknown';

export interface ARInitError {
  type: ARInitErrorType;
  message: string;
  recoverable: boolean;
  retryable: boolean;
  maxRetries: number;
  fallbackMode?: 'preview' | 'minimal';
  userMessage: string;
  recoveryHint: string;
  technicalDetails?: string;
}

// Physics types
export interface FurniturePhysics {
  mass: number;
  friction: number;
  enableGravity: boolean;
}

// Furniture types
export type FurnitureCategory = 
  | 'seating' 
  | 'tables' 
  | 'storage' 
  | 'lighting' 
  | 'decor' 
  | 'bedroom' 
  | 'kitchen';

export interface FurnitureDimensions {
  width: number;
  length: number;
  height: number;
}

export interface FurnitureLibraryItem {
  id: string;
  name: string;
  emoji?: string;
  icon?: string;
  price: string;
  color: string;
  category: FurnitureCategory;
  thumbnail?: string;
  dimensions: FurnitureDimensions;
  description?: string;
  material?: string;
  styles?: string[];
  roomTypes?: string[];
  model3D?: {
    url: string | number;
    format: 'glb' | 'gltf';
    scale?: number;
  };
}

export interface FurnitureGroup {
  id: string;
  name: string;
  furnitureIds: string[];
  centerPosition: THREE.Vector3;
  createdAt: number;
}

export interface PlacedFurnitureMeta {
  id: string;
  libraryId: string;
  name: string;
  emoji: string;
  price: string;
  groupId?: string; // Optional - for legacy support, but all furniture is now individual
}

export interface FurnitureMapEntry {
  mesh: THREE.Mesh | THREE.Group;
  item: FurnitureLibraryItem;
  libraryId: string;
}

// Layout types
export interface SavedLayoutFurniture {
  id: string;
  libraryId: string;
  position: { x: number; y: number; z: number };
  rotation: { x?: number; y?: number; z?: number };
}

export interface SavedLayoutMetadata {
  totalFurniture: number;
  totalArea: number;
  averageSafety: number;
}

export interface SavedLayout {
  id: string;
  name: string;
  timestamp: number;
  roomData: RoomData | null;
  furniture: SavedLayoutFurniture[];
  metadata?: SavedLayoutMetadata;
}

// Safety types
export type SafetyLevel = 'safe' | 'warning' | 'danger';

export interface PlacementSafetyResult {
  isSafe: boolean;
  safetyLevel: SafetyLevel;
  safetyScore: number;
  hasObstacleCollision: boolean;
  hasFurnitureCollision: boolean;
  hasWallCollision: boolean;
  isOutOfBounds: boolean;
  nearestObstacleDistance: number | null;
  nearestWallDistance: number | null;
  nearestFurnitureDistance: number | null;
  reason: string | null;
  recommendations: string[];
}

export interface RoomBoundsResult {
  isOutOfBounds: boolean;
  nearestWallDistance: number | null;
}

// Spatial types
export interface SpatialPoint {
  x: number;
  y: number;
  z: number;
}

// AR Scene state
export interface ARSceneState {
  isInitialized: boolean;
  hasCamera: boolean;
  hasWebGL: boolean;
  hasAnchor: boolean;
  anchorQuality: 'good' | 'poor' | 'lost';
  errorState: ARInitError | null;
}

