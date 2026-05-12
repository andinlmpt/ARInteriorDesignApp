/**
 * AR Positioning and Alignment Utilities
 * Functions for positioning, snapping, and aligning furniture in AR space
 */

import * as THREE from 'three';
import { RoomData } from '@/types/spatial-mapping';
import type { FurnitureMapEntry } from '@/types/ar-view';
import { AR_CONFIG } from '@/config/arView.config';
import { unitToMeters } from './arCollisionDetection';

/**
 * Smooth position updates to reduce jitter
 */
export function smoothPosition(
  current: THREE.Vector3,
  target: THREE.Vector3,
  factor: number = AR_CONFIG.POSITION_SMOOTHING_FACTOR
): THREE.Vector3 {
  return current.lerp(target, factor);
}

/**
 * Align position to floor with threshold checking
 */
export function alignToFloor(
  position: THREE.Vector3,
  threshold: number = AR_CONFIG.FLOOR_ALIGNMENT_THRESHOLD
): THREE.Vector3 {
  if (Math.abs(position.y) < threshold) {
    return new THREE.Vector3(position.x, 0, position.z);
  }
  return position;
}

/**
 * Snap position to grid
 */
export function snapToGrid(
  value: number,
  gridSize: number = AR_CONFIG.GRID_SNAP_SIZE
): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap position to grid (3D)
 */
export function snapToGridPosition(
  position: THREE.Vector3,
  gridSize: number = AR_CONFIG.GRID_SNAP_SIZE
): THREE.Vector3 {
  return new THREE.Vector3(
    snapToGrid(position.x, gridSize),
    position.y,
    snapToGrid(position.z, gridSize)
  );
}

/**
 * Snap rotation to increments
 */
export function snapRotation(
  rotation: number,
  snapAngle: number = AR_CONFIG.ROTATION_SNAP_ANGLE
): number {
  return Math.round(rotation / snapAngle) * snapAngle;
}

/**
 * Check for alignment with other furniture
 */
export function findAlignmentTargets(
  position: THREE.Vector3,
  furnitureMap: Map<string, FurnitureMapEntry>,
  excludeId: string,
  threshold: number = AR_CONFIG.ALIGNMENT_THRESHOLD
): { x?: number; z?: number } {
  const alignments: { x?: number; z?: number } = {};
  
  for (const [id, entry] of furnitureMap.entries()) {
    if (id === excludeId) continue;
    
    const furniturePos = entry.mesh.position;
    
    // Check X alignment
    if (Math.abs(position.x - furniturePos.x) < threshold) {
      alignments.x = furniturePos.x;
    }
    
    // Check Z alignment
    if (Math.abs(position.z - furniturePos.z) < threshold) {
      alignments.z = furniturePos.z;
    }
  }
  
  return alignments;
}

/**
 * Find wall snapping targets
 */
export function findWallSnapTargets(
  position: THREE.Vector3,
  roomData: RoomData | null,
  threshold: number = AR_CONFIG.WALL_SNAP_THRESHOLD
): { x?: number; z?: number } {
  if (!roomData) return {};
  
  const alignments: { x?: number; z?: number } = {};
  const widthMeters = unitToMeters(roomData.dimensions.width, roomData.dimensions.unit);
  const lengthMeters = unitToMeters(roomData.dimensions.length, roomData.dimensions.unit);
  
  const halfWidth = widthMeters / 2;
  const halfLength = lengthMeters / 2;
  
  // Check left wall (negative X)
  if (Math.abs(position.x + halfWidth) < threshold) {
    alignments.x = -halfWidth;
  }
  
  // Check right wall (positive X)
  if (Math.abs(position.x - halfWidth) < threshold) {
    alignments.x = halfWidth;
  }
  
  // Check front wall (negative Z)
  if (Math.abs(position.z + halfLength) < threshold) {
    alignments.z = -halfLength;
  }
  
  // Check back wall (positive Z)
  if (Math.abs(position.z - halfLength) < threshold) {
    alignments.z = halfLength;
  }
  
  return alignments;
}

/**
 * Find corner snapping targets
 */
export function findCornerSnapTargets(
  position: THREE.Vector3,
  roomData: RoomData | null,
  threshold: number = AR_CONFIG.CORNER_SNAP_THRESHOLD
): { x?: number; z?: number } | null {
  if (!roomData) return null;
  
  const widthMeters = unitToMeters(roomData.dimensions.width, roomData.dimensions.unit);
  const lengthMeters = unitToMeters(roomData.dimensions.length, roomData.dimensions.unit);
  
  const halfWidth = widthMeters / 2;
  const halfLength = lengthMeters / 2;
  
  const corners = [
    { x: -halfWidth, z: -halfLength }, // Front-left
    { x: halfWidth, z: -halfLength },  // Front-right
    { x: -halfWidth, z: halfLength },   // Back-left
    { x: halfWidth, z: halfLength },   // Back-right
  ];
  
  for (const corner of corners) {
    const distance = Math.sqrt(
      Math.pow(position.x - corner.x, 2) + Math.pow(position.z - corner.z, 2)
    );
    if (distance < threshold) {
      return { x: corner.x, z: corner.z };
    }
  }
  
  return null;
}

/**
 * Find edge alignment with room boundaries
 */
export function findEdgeAlignmentTargets(
  position: THREE.Vector3,
  furnitureDimensions: { width: number; length: number },
  roomData: RoomData | null,
  threshold: number = AR_CONFIG.EDGE_SNAP_THRESHOLD
): { x?: number; z?: number } {
  if (!roomData) return {};
  
  const alignments: { x?: number; z?: number } = {};
  const widthMeters = unitToMeters(roomData.dimensions.width, roomData.dimensions.unit);
  const lengthMeters = unitToMeters(roomData.dimensions.length, roomData.dimensions.unit);
  
  const halfWidth = widthMeters / 2;
  const halfLength = lengthMeters / 2;
  const halfFurnitureWidth = furnitureDimensions.width / 2;
  const halfFurnitureLength = furnitureDimensions.length / 2;
  
  // Check left edge alignment
  const leftEdge = -halfWidth + halfFurnitureWidth;
  if (Math.abs(position.x - leftEdge) < threshold) {
    alignments.x = leftEdge;
  }
  
  // Check right edge alignment
  const rightEdge = halfWidth - halfFurnitureWidth;
  if (Math.abs(position.x - rightEdge) < threshold) {
    alignments.x = rightEdge;
  }
  
  // Check front edge alignment
  const frontEdge = -halfLength + halfFurnitureLength;
  if (Math.abs(position.z - frontEdge) < threshold) {
    alignments.z = frontEdge;
  }
  
  // Check back edge alignment
  const backEdge = halfLength - halfFurnitureLength;
  if (Math.abs(position.z - backEdge) < threshold) {
    alignments.z = backEdge;
  }
  
  return alignments;
}

/**
 * Apply all snapping and alignment rules to a position
 */
export function applySnappingAndAlignment(
  position: THREE.Vector3,
  furnitureDimensions: { width: number; length: number },
  roomData: RoomData | null,
  furnitureMap: Map<string, FurnitureMapEntry>,
  excludeId: string,
  snapToGridEnabled: boolean = true
): THREE.Vector3 {
  let snappedPosition = position.clone();
  
  // First, snap to grid if enabled
  if (snapToGridEnabled) {
    snappedPosition = snapToGridPosition(snappedPosition);
  }
  
  // Check for furniture alignment
  const furnitureAlignments = findAlignmentTargets(
    snappedPosition,
    furnitureMap,
    excludeId
  );
  
  // Check for wall snapping
  const wallAlignments = findWallSnapTargets(snappedPosition, roomData);
  
  // Check for corner snapping
  const cornerAlignment = findCornerSnapTargets(snappedPosition, roomData);
  
  // Check for edge alignment
  const edgeAlignments = findEdgeAlignmentTargets(
    snappedPosition,
    furnitureDimensions,
    roomData
  );
  
  // Apply alignments (priority: corner > wall > edge > furniture)
  if (cornerAlignment) {
    snappedPosition.x = cornerAlignment.x ?? snappedPosition.x;
    snappedPosition.z = cornerAlignment.z ?? snappedPosition.z;
  } else if (wallAlignments.x !== undefined || wallAlignments.z !== undefined) {
    snappedPosition.x = wallAlignments.x ?? snappedPosition.x;
    snappedPosition.z = wallAlignments.z ?? snappedPosition.z;
  } else if (edgeAlignments.x !== undefined || edgeAlignments.z !== undefined) {
    snappedPosition.x = edgeAlignments.x ?? snappedPosition.x;
    snappedPosition.z = edgeAlignments.z ?? snappedPosition.z;
  } else if (furnitureAlignments.x !== undefined || furnitureAlignments.z !== undefined) {
    snappedPosition.x = furnitureAlignments.x ?? snappedPosition.x;
    snappedPosition.z = furnitureAlignments.z ?? snappedPosition.z;
  }
  
  return snappedPosition;
}


