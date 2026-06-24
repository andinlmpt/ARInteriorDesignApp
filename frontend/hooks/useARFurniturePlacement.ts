/**
 * AR Furniture Placement Hook
 * Manages furniture placement, selection, and manipulation in AR
 */

import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import type { 
  FurnitureLibraryItem, 
  FurnitureMapEntry, 
  PlacedFurnitureMeta,
  SavedLayout 
} from '@/types/ar-view';
import { RoomData } from '@/types/spatial-mapping';
import { AR_CONFIG } from '@/config/arView.config';
import { getPlacementSafety } from '@/utils/arCollisionDetection';
import { 
  createFurnitureMesh, 
  disposeMesh, 
  snapToGrid, 
  snapRotation 
} from '@/utils/threejsHelpers';
import { disposeObjectRecursive } from '@/utils/three-utils';
import { getJson, setJson } from '@/utils/storage';

interface UseARFurniturePlacementReturn {
  // State
  placedFurniture: PlacedFurnitureMeta[];
  selectedFurnitureId: string | null;
  isDragging: boolean;
  isPlacementValid: boolean;
  
  // Maps (for direct access)
  furnitureMapRef: React.MutableRefObject<Map<string, FurnitureMapEntry>>;
  
  // Actions
  placeFurniture: (item: FurnitureLibraryItem, position: THREE.Vector3, scene: THREE.Scene) => string | null;
  removeFurniture: (id: string, scene: THREE.Scene) => boolean;
  selectFurniture: (id: string | null) => void;
  moveFurniture: (id: string, newPosition: THREE.Vector3, roomData: RoomData | null, obstacleMap: Map<string, THREE.Mesh>) => boolean;
  rotateFurniture: (id: string, rotation: number) => void;
  clearAllFurniture: (scene: THREE.Scene) => void;
  
  // Layout management
  saveLayout: (name: string, roomData: RoomData | null) => Promise<SavedLayout>;
  loadLayout: (layout: SavedLayout, scene: THREE.Scene) => Promise<boolean>;
  getSavedLayouts: () => Promise<SavedLayout[]>;
  deleteLayout: (layoutId: string) => Promise<boolean>;
  
  // History
  undo: (scene: THREE.Scene) => void;
  redo: (scene: THREE.Scene) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const LAYOUTS_STORAGE_KEY = 'ar_saved_layouts';
const MAX_HISTORY = 20;

export function useARFurniturePlacement(): UseARFurniturePlacementReturn {
  // State
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurnitureMeta[]>([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlacementValid, setIsPlacementValid] = useState(true);
  
  // History for undo/redo
  const [history, setHistory] = useState<PlacedFurnitureMeta[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const furnitureMapRef = useRef<Map<string, FurnitureMapEntry>>(new Map());
  const furnitureIdCounter = useRef(0);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...placedFurniture]);
      return newHistory.slice(-MAX_HISTORY);
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [placedFurniture, historyIndex]);

  // Place furniture
  const placeFurniture = useCallback((
    item: FurnitureLibraryItem, 
    position: THREE.Vector3, 
    scene: THREE.Scene
  ): string | null => {
    try {
      // Generate unique ID
      const id = `furniture-${Date.now()}-${furnitureIdCounter.current++}`;
      
      // Snap to grid if enabled
      const snappedPosition = new THREE.Vector3(
        snapToGrid(position.x, AR_CONFIG.GRID_SNAP_SIZE),
        position.y,
        snapToGrid(position.z, AR_CONFIG.GRID_SNAP_SIZE)
      );
      
      // Create mesh
      const mesh = createFurnitureMesh(item.dimensions, item.color);
      mesh.position.copy(snappedPosition);
      mesh.position.y = item.dimensions.height / 2; // Place on ground
      mesh.name = id;
      mesh.userData = { libraryId: item.id, furnitureId: id };
      
      // Add to scene
      scene.add(mesh);
      
      // Store in map
      furnitureMapRef.current.set(id, { mesh, item, libraryId: item.id });
      
      // Update state
      const meta: PlacedFurnitureMeta = {
        id,
        libraryId: item.id,
        name: item.name,
        emoji: item.emoji || '🪑',
        price: item.price,
      };
      
      setPlacedFurniture(prev => [...prev, meta]);
      saveToHistory();
      
      console.log(`[ARFurniture] Placed ${item.name} at`, snappedPosition);
      return id;
      
    } catch (error) {
      console.error('[ARFurniture] Failed to place furniture:', error);
      return null;
    }
  }, [saveToHistory]);

  // Remove furniture
  const removeFurniture = useCallback((id: string, scene: THREE.Scene): boolean => {
    try {
      const entry = furnitureMapRef.current.get(id);
      if (!entry) {
        console.warn(`[ARFurniture] Furniture ${id} not found`);
        return false;
      }
      
      // Remove from scene
      scene.remove(entry.mesh);
      
      // Dispose mesh/group
      if (entry.mesh instanceof THREE.Mesh) {
        disposeMesh(entry.mesh);
      } else {
        disposeObjectRecursive(entry.mesh);
      }
      
      // Remove from map
      furnitureMapRef.current.delete(id);
      
      // Update state
      setPlacedFurniture(prev => prev.filter(f => f.id !== id));
      
      // Deselect if selected
      if (selectedFurnitureId === id) {
        setSelectedFurnitureId(null);
      }
      
      saveToHistory();
      
      console.log(`[ARFurniture] Removed furniture ${id}`);
      return true;
      
    } catch (error) {
      console.error('[ARFurniture] Failed to remove furniture:', error);
      return false;
    }
  }, [selectedFurnitureId, saveToHistory]);

  // Select furniture
  const selectFurniture = useCallback((id: string | null) => {
    setSelectedFurnitureId(id);
    
    // Visual feedback - highlight selected, unhighlight others
    furnitureMapRef.current.forEach((entry, entryId) => {
      if (entry.mesh instanceof THREE.Mesh) {
        const material = entry.mesh.material as THREE.MeshStandardMaterial;
        if (material) {
          material.emissive = new THREE.Color(entryId === id ? 0x333333 : 0x000000);
        }
      }
    });
  }, []);

  // Move furniture with collision detection
  const moveFurniture = useCallback((
    id: string, 
    newPosition: THREE.Vector3, 
    roomData: RoomData | null,
    obstacleMap: Map<string, THREE.Mesh>
  ): boolean => {
    const entry = furnitureMapRef.current.get(id);
    if (!entry) return false;
    
    // Snap to grid
    const snappedPosition = new THREE.Vector3(
      snapToGrid(newPosition.x, AR_CONFIG.GRID_SNAP_SIZE),
      entry.mesh.position.y, // Keep Y position
      snapToGrid(newPosition.z, AR_CONFIG.GRID_SNAP_SIZE)
    );
    
    // Check placement safety
    const tempBox = new THREE.Box3().setFromObject(entry.mesh);
    const offset = snappedPosition.clone().sub(entry.mesh.position);
    tempBox.translate(offset);
    
    const safety = getPlacementSafety(
      tempBox,
      obstacleMap,
      furnitureMapRef.current,
      roomData,
      id
    );
    
    setIsPlacementValid(safety.isSafe);
    
    // Update position (even if not safe, for preview)
    entry.mesh.position.copy(snappedPosition);
    
    // Update material color based on safety
    if (entry.mesh instanceof THREE.Mesh) {
      const material = entry.mesh.material as THREE.MeshStandardMaterial;
      if (material) {
        if (safety.safetyLevel === 'danger') {
          material.emissive = new THREE.Color(0x550000);
        } else if (safety.safetyLevel === 'warning') {
          material.emissive = new THREE.Color(0x555500);
        } else {
          material.emissive = new THREE.Color(0x003300);
        }
      }
    }
    
    return safety.isSafe;
  }, []);

  // Rotate furniture
  const rotateFurniture = useCallback((id: string, rotation: number) => {
    const entry = furnitureMapRef.current.get(id);
    if (!entry) return;
    
    const snappedRotation = snapRotation(rotation, AR_CONFIG.ROTATION_SNAP_ANGLE);
    entry.mesh.rotation.y = snappedRotation;
  }, []);

  // Clear all furniture
  const clearAllFurniture = useCallback((scene: THREE.Scene) => {
    furnitureMapRef.current.forEach((entry, id) => {
      scene.remove(entry.mesh);
      if (entry.mesh instanceof THREE.Mesh) {
        disposeMesh(entry.mesh);
      } else {
        disposeObjectRecursive(entry.mesh);
      }
    });
    
    furnitureMapRef.current.clear();
    setPlacedFurniture([]);
    setSelectedFurnitureId(null);
    saveToHistory();
    
    console.log('[ARFurniture] Cleared all furniture');
  }, [saveToHistory]);

  // Save layout
  const saveLayout = useCallback(async (
    name: string, 
    roomData: RoomData | null
  ): Promise<SavedLayout> => {
    const furniture = Array.from(furnitureMapRef.current.entries()).map(([id, entry]) => ({
      id,
      libraryId: entry.libraryId,
      position: {
        x: entry.mesh.position.x,
        y: entry.mesh.position.y,
        z: entry.mesh.position.z,
      },
      rotation: {
        y: entry.mesh.rotation.y,
      },
    }));
    
    const layout: SavedLayout = {
      id: `layout-${Date.now()}`,
      name,
      timestamp: Date.now(),
      roomData,
      furniture,
      metadata: {
        totalFurniture: furniture.length,
        totalArea: roomData 
          ? roomData.dimensions.width * roomData.dimensions.length 
          : 0,
        averageSafety: 100, // Could calculate actual safety
      },
    };
    
    // Save to storage
    const existingLayouts = await getJson<SavedLayout[]>(LAYOUTS_STORAGE_KEY, []);
    existingLayouts.push(layout);
    await setJson(LAYOUTS_STORAGE_KEY, existingLayouts);
    
    console.log(`[ARFurniture] Saved layout: ${name}`);
    return layout;
  }, []);

  // Load layout
  const loadLayout = useCallback(async (
    layout: SavedLayout, 
    scene: THREE.Scene
  ): Promise<boolean> => {
    try {
      // Clear existing furniture
      clearAllFurniture(scene);
      
      // Import furniture library for item lookup
      const { getFurnitureById } = await import('@/data/furnitureLibrary');
      
      // Place each furniture item
      for (const item of layout.furniture) {
        const libraryItem = getFurnitureById(item.libraryId);
        if (!libraryItem) {
          console.warn(`[ARFurniture] Library item ${item.libraryId} not found`);
          continue;
        }
        
        const position = new THREE.Vector3(
          item.position.x,
          item.position.y,
          item.position.z
        );
        
        const id = placeFurniture(libraryItem, position, scene);
        
        if (id && item.rotation?.y) {
          rotateFurniture(id, item.rotation.y);
        }
      }
      
      console.log(`[ARFurniture] Loaded layout: ${layout.name}`);
      return true;
      
    } catch (error) {
      console.error('[ARFurniture] Failed to load layout:', error);
      return false;
    }
  }, [clearAllFurniture, placeFurniture, rotateFurniture]);

  // Get saved layouts
  const getSavedLayouts = useCallback(async (): Promise<SavedLayout[]> => {
    return await getJson<SavedLayout[]>(LAYOUTS_STORAGE_KEY, []);
  }, []);

  // Delete layout
  const deleteLayout = useCallback(async (layoutId: string): Promise<boolean> => {
    try {
      const layouts = await getJson<SavedLayout[]>(LAYOUTS_STORAGE_KEY, []);
      const filtered = layouts.filter(l => l.id !== layoutId);
      await setJson(LAYOUTS_STORAGE_KEY, filtered);
      return true;
    } catch (error) {
      console.error('[ARFurniture] Failed to delete layout:', error);
      return false;
    }
  }, []);

  // Undo
  const undo = useCallback((scene: THREE.Scene) => {
    if (historyIndex <= 0) return;
    
    const prevState = history[historyIndex - 1];
    setHistoryIndex(prev => prev - 1);
    
    // Restore state (simplified - would need full implementation)
    console.log('[ARFurniture] Undo');
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback((scene: THREE.Scene) => {
    if (historyIndex >= history.length - 1) return;
    
    const nextState = history[historyIndex + 1];
    setHistoryIndex(prev => prev + 1);
    
    // Restore state (simplified - would need full implementation)
    console.log('[ARFurniture] Redo');
  }, [history, historyIndex]);

  return {
    placedFurniture,
    selectedFurnitureId,
    isDragging,
    isPlacementValid,
    furnitureMapRef,
    placeFurniture,
    removeFurniture,
    selectFurniture,
    moveFurniture,
    rotateFurniture,
    clearAllFurniture,
    saveLayout,
    loadLayout,
    getSavedLayouts,
    deleteLayout,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}

