/**
 * Room Layout Service
 * Builds 3D room layouts from RoomData including floors, walls, and obstacles
 */

import * as THREE from 'three';
import { RoomData } from '@/types/spatial-mapping';
import { unitToMeters } from '@/utils/three-utils';
import { alignToFloor, disposeMesh, disposeObjectRecursive } from '@/utils/three-utils';
import { parseSizeLabel } from '@/utils/arCollisionDetection';
import { OBSTACLE_COLORS } from '@/config/arView.config';

export interface RoomLayoutResult {
  roomGroup: THREE.Group;
  obstacleMap: Map<string, THREE.Mesh>;
  cameraPosition?: THREE.Vector3;
  cameraLookAt?: THREE.Vector3;
}

export class RoomLayoutService {
  /**
   * Build a 3D room layout from RoomData
   */
  buildRoomLayout(
    data: RoomData,
    rootGroup: THREE.Group,
    cameraRef: { current: THREE.PerspectiveCamera | null },
    showFloor: boolean = false
  ): RoomLayoutResult {
    const group = new THREE.Group();
    group.name = 'room-layout-group';

    const unit = data.dimensions.unit;
    const widthMeters = unitToMeters(data.dimensions.width, unit);
    const lengthMeters = unitToMeters(data.dimensions.length, unit);
    const heightMeters = unitToMeters(data.dimensions.height, unit);

    // Enhanced floor with better geometry and materials
    const floorGeometry = new THREE.PlaneGeometry(widthMeters, lengthMeters, 20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1f2e,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide,
      envMapIntensity: 0.3,
    });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorMesh.userData.type = 'floor';
    floorMesh.visible = showFloor;
    group.add(floorMesh);

    // Enhanced grid with better visual quality
    const gridSize = Math.max(widthMeters, lengthMeters);
    const divisions = Math.max(8, Math.floor(gridSize * 2.5));
    const grid = new THREE.GridHelper(gridSize, divisions, 0x3b82f6, 0x1f2937);
    grid.position.y = 0.002;
    (grid as any).userData = { type: 'floor' };
    grid.visible = showFloor;
    if (Array.isArray((grid as any).material)) {
      (grid as any).material.forEach((mat: THREE.Material) => {
        mat.transparent = true;
        mat.opacity = 0.4;
      });
    } else {
      const gridMaterial = (grid as any).material as THREE.Material;
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.4;
    }
    group.add(grid);

    // Floor boundary outline
    if (data.floorBoundary && data.floorBoundary.length > 0) {
      const outlinePoints = data.floorBoundary.map(
        (point) => new THREE.Vector3(
          unitToMeters(point.x, unit),
          0.01,
          unitToMeters(point.z, unit)
        ),
      );
      if (outlinePoints.length >= 3) {
        const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        const outlineMaterial = new THREE.LineBasicMaterial({
          color: 0x60a5fa,
          linewidth: 2,
        });
        const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
        group.add(outline);
      }
    }

    // Build walls
    data.walls.forEach((wall) => {
      const start = new THREE.Vector3(
        unitToMeters(wall.startPoint.x, unit),
        0,
        unitToMeters(wall.startPoint.z, unit),
      );
      const end = new THREE.Vector3(
        unitToMeters(wall.endPoint.x, unit),
        0,
        unitToMeters(wall.endPoint.z, unit),
      );
      const wallLength = start.distanceTo(end);

      const wallGeometry = new THREE.PlaneGeometry(wallLength, heightMeters, 4, 4);
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a3441,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        roughness: 0.7,
        metalness: 0.05,
        envMapIntensity: 0.2,
      });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      const center = start.clone().lerp(end, 0.5);
      wallMesh.position.set(center.x, heightMeters / 2, center.z);

      const direction = end.clone().sub(start).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      wallMesh.rotation.y = angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
    });

    // Build obstacles
    const obstacleMap = new Map<string, THREE.Mesh>();
    data.obstacles.forEach((obstacle) => {
      const fallbackSize = {
        width: 0.7,
        length: 0.7,
        height: 1.0,
      };
      const obstacleSize = parseSizeLabel(obstacle.size, unit, fallbackSize);

      const geometry = new THREE.BoxGeometry(
        Math.max(0.3, obstacleSize.width),
        Math.max(0.4, obstacleSize.height),
        Math.max(0.3, obstacleSize.length),
        4, 4, 4
      );
      const obstacleColor = OBSTACLE_COLORS[obstacle.type] ?? OBSTACLE_COLORS.Other;
      const material = new THREE.MeshStandardMaterial({
        color: obstacleColor,
        roughness: 0.5,
        metalness: 0.3,
        transparent: true,
        opacity: 0.9,
        envMapIntensity: 0.4,
        emissive: new THREE.Color(obstacleColor).multiplyScalar(0.1),
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Wireframe outline
      const wireframeGeometry = new THREE.BoxGeometry(
        Math.max(0.3, obstacleSize.width) + 0.02,
        Math.max(0.4, obstacleSize.height) + 0.02,
        Math.max(0.3, obstacleSize.length) + 0.02,
        2, 2, 2
      );
      const wireframeColor = OBSTACLE_COLORS[obstacle.type] ?? OBSTACLE_COLORS.Other;
      const wireframeMaterial = new THREE.MeshStandardMaterial({
        color: wireframeColor,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
        emissive: new THREE.Color(wireframeColor).multiplyScalar(0.3),
        emissiveIntensity: 0.3,
      });
      const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);

      const obstacleX = unitToMeters(obstacle.coordinates?.x ?? 0, unit);
      const obstacleZ = unitToMeters(obstacle.coordinates?.z ?? 0, unit);
      const obstacleY = Math.max(obstacleSize.height / 2, 0.01);

      const obstaclePosition = alignToFloor(new THREE.Vector3(obstacleX, obstacleY, obstacleZ));
      mesh.position.set(obstaclePosition.x, obstaclePosition.y, obstaclePosition.z);
      wireframeMesh.position.set(obstaclePosition.x, obstaclePosition.y, obstaclePosition.z);

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        type: 'obstacle',
        id: obstacle.id,
        obstacleType: obstacle.type,
        dimensions: obstacleSize,
      };

      obstacleMap.set(obstacle.id, mesh);
      group.add(mesh);
      group.add(wireframeMesh);
    });

    rootGroup.add(group);

    // Calculate camera position
    let cameraPosition: THREE.Vector3 | undefined;
    let cameraLookAt: THREE.Vector3 | undefined;
    if (cameraRef.current) {
      const radius = Math.max(widthMeters, lengthMeters) * 0.75;
      cameraPosition = new THREE.Vector3(radius, heightMeters * 0.75 + 1.2, radius * 1.2);
      cameraLookAt = new THREE.Vector3(0, heightMeters * 0.4, 0);
    }

    return {
      roomGroup: group,
      obstacleMap,
      cameraPosition,
      cameraLookAt,
    };
  }

  /**
   * Update floor visibility in room group
   */
  updateFloorVisibility(roomGroup: THREE.Group, showFloor: boolean): void {
    roomGroup.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.GridHelper) {
        const userData = (child as any).userData;
        if (userData && userData.type === 'floor') {
          child.visible = showFloor;
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            if (!showFloor) {
              child.material.opacity = 0;
              child.material.transparent = true;
            }
          }
        }
      }
    });
  }

  /**
   * Dispose of room layout
   */
  disposeRoomLayout(roomGroup: THREE.Group | null): void {
    if (roomGroup) {
      disposeObjectRecursive(roomGroup);
    }
  }
}

// Singleton instance
export const roomLayoutService = new RoomLayoutService();
