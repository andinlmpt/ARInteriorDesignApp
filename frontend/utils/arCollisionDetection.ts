/**
 * AR Collision Detection Utilities
 * Physics and collision detection for furniture placement
 */

import * as THREE from 'three';
import { RoomData } from '@/types/spatial-mapping';
import type { 
  FurnitureMapEntry, 
  PlacementSafetyResult, 
  RoomBoundsResult,
  SafetyLevel 
} from '@/types/ar-view';
import { AR_CONFIG } from '@/config/arView.config';

// Reusable Vector3 objects to avoid allocations in collision detection loops
const tempBoxCenter = new THREE.Vector3();
const tempObstacleCenter = new THREE.Vector3();
const tempFurnitureCenter = new THREE.Vector3();

/**
 * Convert units to meters with high precision
 */
export function unitToMeters(value: number, unit: 'feet' | 'meters'): number {
  if (unit === 'feet') {
    return value * 0.3048; // Exact conversion: 1 foot = 0.3048 meters
  }
  return value;
}

/**
 * Convert meters to specified unit with high precision
 */
export function metersToUnit(value: number, unit: 'feet' | 'meters'): number {
  if (unit === 'feet') {
    return value / 0.3048;
  }
  return value;
}

/**
 * Parse size label string into dimensions
 */
export function parseSizeLabel(
  sizeLabel: string | undefined,
  unit: 'feet' | 'meters',
  fallback: { width: number; length: number; height: number }
): { width: number; length: number; height: number } {
  if (!sizeLabel) {
    return fallback;
  }

  const numeric = sizeLabel
    .split('x')
    .map((segment) => parseFloat(segment.replace(/[^\d.]/g, '')))
    .filter((value) => !Number.isNaN(value));

  if (numeric.length < 2) {
    return fallback;
  }

  const [width, length, height] = [
    unitToMeters(numeric[0], unit),
    unitToMeters(numeric[1], unit),
    unitToMeters(numeric[2] ?? fallback.height, unit),
  ];

  return {
    width: width || fallback.width,
    length: length || fallback.length,
    height: height || fallback.height,
  };
}

/**
 * Calculate distance from point to line segment (for wall distance)
 */
export function distanceToLineSegment(
  point: THREE.Vector3,
  lineStart: THREE.Vector3,
  lineEnd: THREE.Vector3
): number {
  const line = lineEnd.clone().sub(lineStart);
  const pointToStart = point.clone().sub(lineStart);
  const lineLength = line.length();
  
  if (lineLength === 0) {
    return point.distanceTo(lineStart);
  }
  
  const t = Math.max(0, Math.min(1, pointToStart.dot(line) / (lineLength * lineLength)));
  const projection = lineStart.clone().add(line.multiplyScalar(t));
  
  return point.distanceTo(projection);
}

/**
 * Check if a bounding box collides with any obstacles in the scene
 */
export function checkObstacleCollisions(
  box: THREE.Box3,
  obstacleMap: Map<string, THREE.Mesh>,
  margin: number = AR_CONFIG.COLLISION_MARGIN
): boolean {
  const expandedBox = box.clone();
  expandedBox.expandByScalar(margin);
  const boxCenter = expandedBox.getCenter(new THREE.Vector3());
  const boxSize = expandedBox.getSize(new THREE.Vector3());
  const maxBoxRadius = boxSize.length() / 2;
  
  for (const obstacleMesh of obstacleMap.values()) {
    obstacleMesh.getWorldPosition(tempObstacleCenter);
    const centerDistance = boxCenter.distanceTo(tempObstacleCenter);
    
    const estimatedSize = obstacleMesh.scale.length() * 2;
    if (centerDistance > maxBoxRadius + estimatedSize + margin * 2) {
      continue;
    }
    
    const obstacleBox = new THREE.Box3().setFromObject(obstacleMesh);
    const obstacleSize = obstacleBox.getSize(new THREE.Vector3());
    const maxObstacleRadius = obstacleSize.length() / 2;
    
    if (centerDistance > maxBoxRadius + maxObstacleRadius + margin * 2) {
      continue;
    }
    
    const expandedObstacleBox = obstacleBox.clone();
    expandedObstacleBox.expandByScalar(margin * 0.5);
    
    if (expandedBox.intersectsBox(expandedObstacleBox)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if position is within room boundaries
 */
export function checkRoomBounds(
  box: THREE.Box3,
  roomData: RoomData | null
): RoomBoundsResult {
  if (!roomData) {
    return { isOutOfBounds: false, nearestWallDistance: null };
  }
  
  const unit = roomData.dimensions.unit;
  const halfWidth = unitToMeters(roomData.dimensions.width, unit) / 2;
  const halfLength = unitToMeters(roomData.dimensions.length, unit) / 2;
  
  const boxMin = box.min;
  const boxMax = box.max;
  
  const isOutOfBounds = 
    boxMin.x < -halfWidth ||
    boxMax.x > halfWidth ||
    boxMin.z < -halfLength ||
    boxMax.z > halfLength;
  
  const boxCenter = box.getCenter(new THREE.Vector3());
  let nearestWallDistance: number | null = null;
  
  if (roomData.walls && roomData.walls.length > 0) {
    for (const wall of roomData.walls) {
      const start = new THREE.Vector3(
        unitToMeters(wall.startPoint.x, unit),
        0,
        unitToMeters(wall.startPoint.z, unit)
      );
      const end = new THREE.Vector3(
        unitToMeters(wall.endPoint.x, unit),
        0,
        unitToMeters(wall.endPoint.z, unit)
      );
      
      const distance = distanceToLineSegment(boxCenter, start, end);
      if (nearestWallDistance === null || distance < nearestWallDistance) {
        nearestWallDistance = distance;
      }
    }
  } else {
    const distToLeft = Math.abs(boxCenter.x + halfWidth);
    const distToRight = Math.abs(boxCenter.x - halfWidth);
    const distToFront = Math.abs(boxCenter.z + halfLength);
    const distToBack = Math.abs(boxCenter.z - halfLength);
    
    nearestWallDistance = Math.min(distToLeft, distToRight, distToFront, distToBack);
  }
  
  return { isOutOfBounds, nearestWallDistance };
}

/**
 * Get enhanced detailed safety information for placement
 */
export function getPlacementSafety(
  box: THREE.Box3,
  obstacleMap: Map<string, THREE.Mesh>,
  furnitureMap: Map<string, FurnitureMapEntry>,
  roomData: RoomData | null,
  excludeId?: string,
  margin: number = AR_CONFIG.COLLISION_MARGIN
): PlacementSafetyResult {
  const expandedBox = box.clone();
  expandedBox.expandByScalar(margin);
  const boxCenter = expandedBox.getCenter(new THREE.Vector3());
  const boxSize = expandedBox.getSize(new THREE.Vector3());
  const maxBoxRadius = boxSize.length() / 2;
  
  // Check obstacle collisions
  let hasObstacleCollision = false;
  let nearestObstacleDistance: number | null = null;
  
  for (const obstacleMesh of obstacleMap.values()) {
    obstacleMesh.getWorldPosition(tempObstacleCenter);
    const centerDistance = boxCenter.distanceTo(tempObstacleCenter);
    
    const estimatedSize = obstacleMesh.scale.length() * 2;
    if (centerDistance > maxBoxRadius + estimatedSize + margin * 2) {
      if (nearestObstacleDistance === null || centerDistance < nearestObstacleDistance) {
        nearestObstacleDistance = centerDistance;
      }
      continue;
    }
    
    const obstacleBox = new THREE.Box3().setFromObject(obstacleMesh);
    const expandedObstacleBox = obstacleBox.clone();
    expandedObstacleBox.expandByScalar(margin * 0.5);
    
    if (expandedBox.intersectsBox(expandedObstacleBox)) {
      hasObstacleCollision = true;
      nearestObstacleDistance = 0;
    } else {
      if (nearestObstacleDistance === null || centerDistance < nearestObstacleDistance) {
        nearestObstacleDistance = centerDistance;
      }
    }
  }
  
  // Check furniture collisions
  let hasFurnitureCollision = false;
  let nearestFurnitureDistance: number | null = null;
  
  for (const [id, entry] of furnitureMap.entries()) {
    if (id === excludeId) continue;
    
    entry.mesh.getWorldPosition(tempFurnitureCenter);
    const centerDistance = boxCenter.distanceTo(tempFurnitureCenter);
    
    const estimatedSize = Math.max(
      entry.item.dimensions.width,
      entry.item.dimensions.height,
      entry.item.dimensions.length
    ) * entry.mesh.scale.length();
    
    if (centerDistance > maxBoxRadius + estimatedSize + margin * 2) {
      if (nearestFurnitureDistance === null || centerDistance < nearestFurnitureDistance) {
        nearestFurnitureDistance = centerDistance;
      }
      continue;
    }
    
    const furnitureBox = new THREE.Box3().setFromObject(entry.mesh);
    const expandedFurnitureBox = furnitureBox.clone();
    expandedFurnitureBox.expandByScalar(margin * 0.5);
    
    if (expandedBox.intersectsBox(expandedFurnitureBox)) {
      hasFurnitureCollision = true;
      nearestFurnitureDistance = 0;
    } else {
      if (nearestFurnitureDistance === null || centerDistance < nearestFurnitureDistance) {
        nearestFurnitureDistance = centerDistance;
      }
    }
  }
  
  // Check room bounds
  const { isOutOfBounds, nearestWallDistance } = checkRoomBounds(box, roomData);
  const hasWallCollision = nearestWallDistance !== null && nearestWallDistance < AR_CONFIG.MIN_WALL_DISTANCE;
  
  // Calculate safety score and level
  const safetyScore = calculateSafetyScore(
    nearestObstacleDistance,
    nearestWallDistance,
    nearestFurnitureDistance,
    isOutOfBounds
  );
  
  const safetyLevel = getSafetyLevel(safetyScore, hasObstacleCollision, hasFurnitureCollision, hasWallCollision, isOutOfBounds);
  const isSafe = safetyLevel === 'safe' && !hasObstacleCollision && !hasFurnitureCollision && !hasWallCollision && !isOutOfBounds;
  
  // Generate reason and recommendations
  const { reason, recommendations } = generateSafetyFeedback(
    hasObstacleCollision,
    hasFurnitureCollision,
    hasWallCollision,
    isOutOfBounds,
    nearestObstacleDistance,
    nearestWallDistance,
    nearestFurnitureDistance
  );
  
  return {
    isSafe,
    safetyLevel,
    safetyScore,
    hasObstacleCollision,
    hasFurnitureCollision,
    hasWallCollision,
    isOutOfBounds,
    nearestObstacleDistance,
    nearestWallDistance,
    nearestFurnitureDistance,
    reason,
    recommendations,
  };
}

/**
 * Calculate safety score (0-100)
 */
function calculateSafetyScore(
  obstacleDistance: number | null,
  wallDistance: number | null,
  furnitureDistance: number | null,
  isOutOfBounds: boolean
): number {
  const weights = AR_CONFIG.SAFETY_SCORE_WEIGHTS;
  let score = 100;
  
  if (isOutOfBounds) {
    score -= weights.roomBoundary * 100;
  }
  
  if (obstacleDistance !== null) {
    if (obstacleDistance < AR_CONFIG.DANGER_DISTANCE) {
      score -= weights.obstacleDistance * 100;
    } else if (obstacleDistance < AR_CONFIG.WARNING_DISTANCE) {
      score -= weights.obstacleDistance * 50;
    } else if (obstacleDistance < AR_CONFIG.SAFE_DISTANCE) {
      score -= weights.obstacleDistance * 20;
    }
  }
  
  if (wallDistance !== null) {
    if (wallDistance < AR_CONFIG.MIN_WALL_DISTANCE) {
      score -= weights.wallDistance * 100;
    } else if (wallDistance < AR_CONFIG.WARNING_DISTANCE) {
      score -= weights.wallDistance * 50;
    }
  }
  
  if (furnitureDistance !== null) {
    if (furnitureDistance === 0) {
      score -= weights.furnitureDistance * 100;
    } else if (furnitureDistance < AR_CONFIG.WARNING_DISTANCE) {
      score -= weights.furnitureDistance * 50;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine safety level based on score and collisions
 */
function getSafetyLevel(
  score: number,
  hasObstacleCollision: boolean,
  hasFurnitureCollision: boolean,
  hasWallCollision: boolean,
  isOutOfBounds: boolean
): SafetyLevel {
  if (hasObstacleCollision || hasFurnitureCollision || hasWallCollision || isOutOfBounds) {
    return 'danger';
  }
  if (score >= 80) {
    return 'safe';
  }
  if (score >= 50) {
    return 'warning';
  }
  return 'danger';
}

/**
 * Generate safety feedback messages
 */
function generateSafetyFeedback(
  hasObstacleCollision: boolean,
  hasFurnitureCollision: boolean,
  hasWallCollision: boolean,
  isOutOfBounds: boolean,
  obstacleDistance: number | null,
  wallDistance: number | null,
  furnitureDistance: number | null
): { reason: string | null; recommendations: string[] } {
  const recommendations: string[] = [];
  let reason: string | null = null;
  
  if (hasObstacleCollision) {
    reason = 'Colliding with an obstacle';
    recommendations.push('Move away from the obstacle');
  }
  
  if (hasFurnitureCollision) {
    reason = reason || 'Colliding with another furniture item';
    recommendations.push('Move away from other furniture');
  }
  
  if (hasWallCollision) {
    reason = reason || 'Too close to wall';
    recommendations.push('Move at least 20cm from the wall');
  }
  
  if (isOutOfBounds) {
    reason = reason || 'Outside room boundaries';
    recommendations.push('Move the item inside the room');
  }
  
  // Add distance-based recommendations
  if (!hasObstacleCollision && obstacleDistance !== null && obstacleDistance < AR_CONFIG.WARNING_DISTANCE) {
    recommendations.push(`Consider moving further from nearby obstacles (${(obstacleDistance * 100).toFixed(0)}cm away)`);
  }
  
  if (!hasWallCollision && wallDistance !== null && wallDistance < AR_CONFIG.WARNING_DISTANCE) {
    recommendations.push(`Consider more space from walls (${(wallDistance * 100).toFixed(0)}cm away)`);
  }
  
  if (!hasFurnitureCollision && furnitureDistance !== null && furnitureDistance < AR_CONFIG.WARNING_DISTANCE) {
    recommendations.push(`Consider more space between furniture (${(furnitureDistance * 100).toFixed(0)}cm apart)`);
  }
  
  return { reason, recommendations };
}

/**
 * Check if a bounding box collides with furniture
 * Optimized with bounding box caching and early distance checks
 */
export function checkFurnitureCollisions(
  box: THREE.Box3,
  furnitureMap: Map<string, FurnitureMapEntry>,
  excludeId?: string,
  margin: number = AR_CONFIG.COLLISION_MARGIN
): boolean {
  const expandedBox = box.clone();
  expandedBox.expandByScalar(margin);
  const boxCenter = expandedBox.getCenter(tempBoxCenter);
  const boxSize = expandedBox.getSize(new THREE.Vector3());
  const maxBoxRadius = boxSize.length() / 2;
  
  for (const [id, entry] of furnitureMap.entries()) {
    if (id === excludeId) continue;
    
    entry.mesh.getWorldPosition(tempFurnitureCenter);
    const centerDistance = boxCenter.distanceTo(tempFurnitureCenter);
    
    const estimatedSize = Math.max(
      entry.item.dimensions.width,
      entry.item.dimensions.height,
      entry.item.dimensions.length
    ) * entry.mesh.scale.length();
    
    if (centerDistance > maxBoxRadius + estimatedSize + margin * 2) {
      continue;
    }
    
    const furnitureBox = new THREE.Box3().setFromObject(entry.mesh);
    const furnitureSize = furnitureBox.getSize(new THREE.Vector3());
    const maxFurnitureRadius = furnitureSize.length() / 2;
    
    if (centerDistance > maxBoxRadius + maxFurnitureRadius + margin * 2) {
      continue;
    }
    
    const expandedFurnitureBox = furnitureBox.clone();
    expandedFurnitureBox.expandByScalar(margin * 0.5);
    
    if (expandedBox.intersectsBox(expandedFurnitureBox)) {
      return true;
    }
  }
  return false;
}

/**
 * Create a bounding box for furniture at a given position
 */
export function createFurnitureBoundingBox(
  position: THREE.Vector3,
  dimensions: { width: number; height: number; length: number },
  rotation?: { x?: number; y?: number; z?: number }
): THREE.Box3 {
  const tempMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.length)
  );
  
  tempMesh.position.set(
    position.x,
    position.y + dimensions.height / 2,
    position.z,
  );
  
  if (rotation) {
    if (rotation.x !== undefined) tempMesh.rotation.x = rotation.x;
    if (rotation.y !== undefined) tempMesh.rotation.y = rotation.y;
    if (rotation.z !== undefined) tempMesh.rotation.z = rotation.z;
  }
  
  const box = new THREE.Box3().setFromObject(tempMesh);
  tempMesh.geometry.dispose();
  return box;
}

