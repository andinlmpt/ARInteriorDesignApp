/**
 * AR Placement Service
 * Business logic for furniture placement, safety checking, and position suggestions
 */

import * as THREE from 'three';
import { RoomData } from '@/types/spatial-mapping';
import type { FurnitureMapEntry, PlacementSafetyResult } from '@/types/ar-view';
import { AR_CONFIG } from '@/config/arView.config';
import { 
  getPlacementSafety, 
  checkObstacleCollisions, 
  checkFurnitureCollisions,
  createFurnitureBoundingBox,
  unitToMeters
} from '@/utils/arCollisionDetection';
import { 
  applySnappingAndAlignment,
  snapToGridPosition,
  alignToFloor 
} from '@/utils/arPositioningHelpers';

export class ARPlacementService {
  /**
   * Check if a position is safe for furniture placement
   */
  checkPlacementSafety(
    position: THREE.Vector3,
    furnitureDimensions: { width: number; length: number; height: number },
    roomData: RoomData | null,
    obstacleMap: Map<string, THREE.Mesh>,
    furnitureMap: Map<string, FurnitureMapEntry>,
    excludeId?: string
  ): PlacementSafetyResult {
    const box = createFurnitureBoundingBox(position, furnitureDimensions);
    return getPlacementSafety(
      box,
      obstacleMap,
      furnitureMap,
      roomData,
      excludeId
    );
  }

  /**
   * Suggest alternative positions when collision is detected
   */
  suggestAlternativePositions(
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
      const safety = this.checkPlacementSafety(
        candidate,
        furnitureDimensions,
        roomData,
        obstacleMap,
        furnitureMap,
        excludeId
      );
      
      if (safety.safetyLevel === 'safe' && safety.safetyScore >= 80) {
        suggestions.push(candidate);
        if (suggestions.length >= count) break;
      }
    }
    
    // If not enough safe positions, try room center
    if (suggestions.length < count) {
      const centerPos = new THREE.Vector3(0, 0, 0);
      const safety = this.checkPlacementSafety(
        centerPos,
        furnitureDimensions,
        roomData,
        obstacleMap,
        furnitureMap,
        excludeId
      );
      if (safety.safetyLevel === 'safe') {
        suggestions.push(centerPos);
      }
    }
    
    return suggestions;
  }

  /**
   * Automatically correct position to avoid collision
   */
  autoCorrectPosition(
    position: THREE.Vector3,
    furnitureDimensions: { width: number; length: number; height: number },
    roomData: RoomData | null,
    obstacleMap: Map<string, THREE.Mesh>,
    furnitureMap: Map<string, FurnitureMapEntry>,
    excludeId?: string
  ): THREE.Vector3 | null {
    const safety = this.checkPlacementSafety(
      position,
      furnitureDimensions,
      roomData,
      obstacleMap,
      furnitureMap,
      excludeId
    );
    
    if (safety.safetyLevel === 'safe') {
      return position; // Already safe
    }
    
    // Try to find a nearby safe position
    const suggestions = this.suggestAlternativePositions(
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

  /**
   * Prepare position for placement with all transformations applied
   */
  preparePlacementPosition(
    position: THREE.Vector3,
    furnitureDimensions: { width: number; length: number; height: number },
    roomData: RoomData | null,
    furnitureMap: Map<string, FurnitureMapEntry>,
    excludeId: string,
    snapToGridEnabled: boolean = true
  ): THREE.Vector3 {
    // Align to floor
    let finalPosition = alignToFloor(position);
    
    // Apply snapping and alignment
    finalPosition = applySnappingAndAlignment(
      finalPosition,
      furnitureDimensions,
      roomData,
      furnitureMap,
      excludeId,
      snapToGridEnabled
    );
    
    return finalPosition;
  }

  /**
   * Validate placement before committing
   */
  validatePlacement(
    position: THREE.Vector3,
    furnitureDimensions: { width: number; length: number; height: number },
    roomData: RoomData | null,
    obstacleMap: Map<string, THREE.Mesh>,
    furnitureMap: Map<string, FurnitureMapEntry>,
    excludeId?: string
  ): { isValid: boolean; safety: PlacementSafetyResult } {
    const safety = this.checkPlacementSafety(
      position,
      furnitureDimensions,
      roomData,
      obstacleMap,
      furnitureMap,
      excludeId
    );
    
    return {
      isValid: safety.isSafe && safety.safetyLevel === 'safe',
      safety,
    };
  }
}

export const arPlacementService = new ARPlacementService();

