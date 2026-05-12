/**
 * AR Furniture Operations Hook
 * Handles furniture placement, removal, restoration, and state management
 */

import { useCallback } from 'react';
import * as THREE from 'three';
import type { FurnitureLibraryItem, PlacedFurnitureMeta, FurnitureMapEntry } from '@/types/ar-view';
import { RoomData } from '@/types/spatial-mapping';
import { furnitureModelLoader } from '@/services/FurnitureModelLoader';
import { disposeMesh, disposeObjectRecursive, alignToFloor } from '@/utils/three-utils';
import { getPlacementSafety, createFurnitureBoundingBox } from '@/utils/arCollisionDetection';
import { snapToGridPosition } from '@/utils/arPositioningHelpers';
import { CONFIG } from '@/constants/ar-config';
import { FURNITURE_LIBRARY } from '@/constants/furniture-library';

interface UseARFurnitureOperationsProps {
  furnitureMapRef: React.MutableRefObject<Map<string, FurnitureMapEntry>>;
  obstacleMapRef: React.MutableRefObject<Map<string, THREE.Mesh>>;
  roomGroupRef: React.MutableRefObject<THREE.Group | null>;
  rootGroupRef: React.MutableRefObject<THREE.Group | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  previewGhostRef: React.MutableRefObject<THREE.Group | null>;
  placedFurniture: PlacedFurnitureMeta[];
  selectedPlacedId: string | null;
  setPlacedFurniture: React.Dispatch<React.SetStateAction<PlacedFurnitureMeta[]>>;
  setSelectedPlacedId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsPlacingFurniture: React.Dispatch<React.SetStateAction<boolean>>;
  setPlacementSafety: React.Dispatch<React.SetStateAction<any>>;
  setComponentError: React.Dispatch<React.SetStateAction<string | null>>;
  roomData: RoomData | null;
  saveToHistory: (state: PlacedFurnitureMeta[]) => void;
}

export function useARFurnitureOperations({
  furnitureMapRef,
  obstacleMapRef,
  roomGroupRef,
  rootGroupRef,
  sceneRef,
  cameraRef,
  previewGhostRef,
  placedFurniture,
  selectedPlacedId,
  setPlacedFurniture,
  setSelectedPlacedId,
  setIsPlacingFurniture,
  setPlacementSafety,
  setComponentError,
  roomData,
  saveToHistory,
}: UseARFurnitureOperationsProps) {
  const restoreFurnitureState = useCallback((state: PlacedFurnitureMeta[]) => {
    if (!rootGroupRef.current || !sceneRef.current) {
      console.error('[ARFurnitureOperations] Cannot restore: scene not ready');
      return;
    }

    // Clear existing furniture
    furnitureMapRef.current.forEach(({ mesh }) => {
      rootGroupRef.current?.remove(mesh);
      disposeObjectRecursive(mesh);
    });
    furnitureMapRef.current.clear();

    // Restore furniture from state
    // Note: Position and rotation are stored in the mesh in furnitureMapRef, not in PlacedFurnitureMeta
    // This creates new furniture models - positions should be restored from the furniture map
    for (const meta of state) {
      const libraryItem = FURNITURE_LIBRARY.find(item => item.id === meta.libraryId);
      if (!libraryItem) {
        console.warn(`[ARFurnitureOperations] Library item not found: ${meta.libraryId}`);
        continue;
      }

      // Create furniture model - position/rotation should be set from furnitureMapRef if available
      furnitureModelLoader.createDetailedFurnitureModel(libraryItem).then((group) => {
        // Default position - in practice, position should come from the furniture map entry
        const finalY = libraryItem.dimensions.height / 2;
        group.position.set(0, finalY, 0);
        group.rotation.set(0, 0, 0);
        
        // Enable shadows
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        group.visible = true;
        group.matrixAutoUpdate = true;
        group.updateMatrixWorld(true);
        
        if (rootGroupRef.current) {
          rootGroupRef.current.add(group);
          furnitureMapRef.current.set(meta.id, {
            mesh: group,
            libraryId: meta.libraryId,
            item: libraryItem,
          });
        }
      }).catch((error) => {
        console.error(`[ARFurnitureOperations] Failed to restore furniture ${meta.id}:`, error);
      });
    }
  }, [furnitureMapRef, rootGroupRef, sceneRef]);

  const removeFurniture = useCallback((id: string) => {
    const entry = furnitureMapRef.current.get(id);
    if (!entry) {
      console.warn(`[ARFurnitureOperations] Furniture ${id} not found`);
      return;
    }

    const furnitureName = entry.item.name;
    rootGroupRef.current?.remove(entry.mesh);
    disposeObjectRecursive(entry.mesh);
    furnitureMapRef.current.delete(id);

    const updated = placedFurniture.filter(item => item.id !== id);
    saveToHistory(updated);
    setPlacedFurniture(updated);

    if (selectedPlacedId === id) {
      setSelectedPlacedId(null);
    }
  }, [furnitureMapRef, rootGroupRef, placedFurniture, selectedPlacedId, saveToHistory, setPlacedFurniture, setSelectedPlacedId]);

  return {
    restoreFurnitureState,
    removeFurniture,
  };
}
