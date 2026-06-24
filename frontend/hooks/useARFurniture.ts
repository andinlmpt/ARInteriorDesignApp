import { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { RoomData } from '@/types/spatial-mapping';
import type { FurnitureMapEntry } from '@/types/ar-view';

interface PlacedFurnitureMeta {
  id: string;
  libraryId: string;
  name: string;
  emoji: string;
  price: string;
}

interface UseARFurnitureParams {
  roomData: RoomData | null;
  obstacleMap: Map<string, THREE.Mesh>;
  rootGroupRef: React.MutableRefObject<THREE.Group | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  geometryPoolRef: React.MutableRefObject<Map<string, THREE.BoxGeometry[]>>;
  materialCacheRef: React.MutableRefObject<Map<string, THREE.MeshStandardMaterial>>;
  furnitureLibraryById: Record<string, any>;
}

interface UseARFurnitureReturn {
  furniture: PlacedFurnitureMeta[];
  furnitureMapRef: React.MutableRefObject<Map<string, FurnitureMapEntry>>;
  addFurniture: (worldPosition: THREE.Vector3, libraryItemId: string) => Promise<boolean>;
  removeFurniture: (id: string) => void;
  updateFurniture: (id: string, position: THREE.Vector3, rotation?: number) => void;
  clearFurniture: () => void;
}

/**
 * Custom hook for managing AR furniture placement and state
 * Separates furniture management logic from the main AR component
 */
export const useARFurniture = ({
  roomData,
  obstacleMap,
  rootGroupRef,
  cameraRef,
  geometryPoolRef,
  materialCacheRef,
  furnitureLibraryById,
}: UseARFurnitureParams): UseARFurnitureReturn => {
  const [furniture, setFurniture] = useState<PlacedFurnitureMeta[]>([]);
  const furnitureMapRef = useRef<Map<string, FurnitureMapEntry>>(new Map());

  const addFurniture = useCallback(
    async (worldPosition: THREE.Vector3, libraryItemId: string): Promise<boolean> => {
      if (!rootGroupRef.current) {
        return false;
      }

      const libraryItem = furnitureLibraryById[libraryItemId];
      if (!libraryItem) {
        return false;
      }

      try {
        // Align position to floor
        const alignedPosition = new THREE.Vector3(
          worldPosition.x,
          0,
          worldPosition.z
        );

        // Create geometry with object pooling
        const geometryKey = `${libraryItem.dimensions.width}-${libraryItem.dimensions.height}-${libraryItem.dimensions.length}`;
        let geometry: THREE.BoxGeometry;

        const pool = geometryPoolRef.current.get(geometryKey);
        if (pool && pool.length > 0) {
          geometry = pool.pop()!;
        } else {
          geometry = new THREE.BoxGeometry(
            libraryItem.dimensions.width,
            libraryItem.dimensions.height,
            libraryItem.dimensions.length
          );
          if (!geometryPoolRef.current.has(geometryKey)) {
            geometryPoolRef.current.set(geometryKey, []);
          }
        }

        // Get or create material
        const materialKey = libraryItem.color;
        let material = materialCacheRef.current.get(materialKey);
        if (!material) {
          const baseColor = new THREE.Color(libraryItem.color);
          material = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.6,
            metalness: 0.2,
          });
          materialCacheRef.current.set(materialKey, material);
        } else {
          material = material.clone();
        }

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(
          alignedPosition.x,
          alignedPosition.y + libraryItem.dimensions.height / 2,
          alignedPosition.z
        );
        mesh.userData = {
          type: 'furniture',
          id: `${libraryItem.id}-${Date.now()}`,
          libraryId: libraryItem.id,
        };

        rootGroupRef.current.add(mesh);

        const meshId = mesh.userData.id;
        furnitureMapRef.current.set(meshId, {
          mesh,
          item: libraryItem,
          libraryId: libraryItem.id,
        });

        const newFurniture: PlacedFurnitureMeta = {
          id: meshId,
          libraryId: libraryItem.id,
          name: libraryItem.name,
          emoji: libraryItem.emoji,
          price: libraryItem.price,
        };

        setFurniture((prev) => [...prev, newFurniture]);
        return true;
      } catch (error) {
        console.error('[useARFurniture] Error adding furniture:', error);
        return false;
      }
    },
    [rootGroupRef, furnitureLibraryById, geometryPoolRef, materialCacheRef]
  );

  const removeFurniture = useCallback(
    (id: string) => {
      const entry = furnitureMapRef.current.get(id);
      if (entry && rootGroupRef.current) {
        rootGroupRef.current.remove(entry.mesh);
        if (entry.mesh instanceof THREE.Mesh) {
          if (entry.mesh.geometry) {
            entry.mesh.geometry.dispose();
          }
          if (entry.mesh.material instanceof THREE.Material) {
            entry.mesh.material.dispose();
          }
        }
        furnitureMapRef.current.delete(id);
        setFurniture((prev) => prev.filter((item) => item.id !== id));
      }
    },
    [rootGroupRef]
  );

  const updateFurniture = useCallback(
    (id: string, position: THREE.Vector3, rotation?: number) => {
      const entry = furnitureMapRef.current.get(id);
      if (entry) {
        entry.mesh.position.set(
          position.x,
          position.y + entry.item.dimensions.height / 2,
          position.z
        );
        if (rotation !== undefined) {
          entry.mesh.rotation.y = rotation;
        }
      }
    },
    []
  );

  const clearFurniture = useCallback(() => {
    furnitureMapRef.current.forEach((entry) => {
      if (rootGroupRef.current) {
        rootGroupRef.current.remove(entry.mesh);
      }
      if (entry.mesh instanceof THREE.Mesh) {
        if (entry.mesh.geometry) {
          entry.mesh.geometry.dispose();
        }
        if (entry.mesh.material instanceof THREE.Material) {
          entry.mesh.material.dispose();
        }
      }
    });
    furnitureMapRef.current.clear();
    setFurniture([]);
  }, [rootGroupRef]);

  return {
    furniture,
    furnitureMapRef,
    addFurniture,
    removeFurniture,
    updateFurniture,
    clearFurniture,
  };
};

