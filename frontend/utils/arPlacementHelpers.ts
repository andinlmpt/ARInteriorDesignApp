/**
 * AR Placement Helpers
 * Functions for suggesting alternative positions and auto-correcting placements
 */

import * as THREE from 'three';
import { RoomData } from '@/types/spatial-mapping';
import type { FurnitureMapEntry } from '@/types/ar-view';
import { unitToMeters } from './arCollisionDetection';
import { getPlacementSafety, createFurnitureBoundingBox } from './arCollisionDetection';

/**
 * Suggest alternative positions when collision is detected
 */
export function suggestAlternativePositions(
  originalPosition: THREE.Vector3,
  furnitureDimensions: { width: number; length: number; height: number },
  roomData: RoomData | null,
  obstacleMap: Map<string, THREE.Mesh>,
  furnitureMap: Map<string, FurnitureMapEntry>,
  excludeId?: string,
  count: number = 3
): THREE.Vector3[] {
  if (!roomData) return [];

  const suggestions: THREE.Vector3[] = [];
  const widthMeters = unitToMeters(roomData.dimensions.width, roomData.dimensions.unit);
  const lengthMeters = unitToMeters(roomData.dimensions.length, roomData.dimensions.unit);
  const halfWidth = widthMeters / 2;
  const halfLength = lengthMeters / 2;
  const margin = 0.3; // 30cm margin from walls

  // Try positions around the original position
  const offsets = [
    { x: 0.5, z: 0 },      // Right
    { x: -0.5, z: 0 },     // Left
    { x: 0, z: 0.5 },      // Forward
    { x: 0, z: -0.5 },     // Backward
    { x: 0.5, z: 0.5 },    // Right-Forward
    { x: -0.5, z: -0.5 },  // Left-Backward
  ];

  for (const offset of offsets) {
    const candidate = new THREE.Vector3(
      Math.max(-halfWidth + margin, Math.min(halfWidth - margin, originalPosition.x + offset.x)),
      0,
      Math.max(-halfLength + margin, Math.min(halfLength - margin, originalPosition.z + offset.z))
    );

    // Check if this position is safe
    const tempBox = createFurnitureBoundingBox(candidate, furnitureDimensions);
    const safety = getPlacementSafety(tempBox, obstacleMap, furnitureMap, roomData, excludeId);

    if (safety.safetyLevel === 'safe' && safety.safetyScore >= 80) {
      suggestions.push(candidate);
      if (suggestions.length >= count) break;
    }
  }

  // If not enough safe positions, try room center
  if (suggestions.length < count) {
    const centerPos = new THREE.Vector3(0, 0, 0);
    const tempBox = createFurnitureBoundingBox(centerPos, furnitureDimensions);
    const safety = getPlacementSafety(tempBox, obstacleMap, furnitureMap, roomData, excludeId);
    if (safety.safetyLevel === 'safe') {
      suggestions.push(centerPos);
    }
  }

  return suggestions;
}

/**
 * Automatically correct position to avoid collision
 */
export function autoCorrectPosition(
  position: THREE.Vector3,
  furnitureDimensions: { width: number; length: number; height: number },
  roomData: RoomData | null,
  obstacleMap: Map<string, THREE.Mesh>,
  furnitureMap: Map<string, FurnitureMapEntry>,
  excludeId?: string
): THREE.Vector3 | null {
  const tempBox = createFurnitureBoundingBox(position, furnitureDimensions);
  const safety = getPlacementSafety(tempBox, obstacleMap, furnitureMap, roomData, excludeId);

  if (safety.safetyLevel === 'safe') {
    return position; // Already safe
  }

  // Try to find a nearby safe position
  const suggestions = suggestAlternativePositions(
    position,
    furnitureDimensions,
    roomData,
    obstacleMap,
    furnitureMap,
    excludeId,
    1
  );

  return suggestions.length > 0 ? suggestions[0] : null;
}
