import { useCallback, useRef } from 'react';

interface PlacementSafety {
  isSafe: boolean;
  safetyLevel: 'safe' | 'warning' | 'danger';
  safetyScore: number;
  reason: string | null;
  hasObstacleCollision: boolean;
  hasFurnitureCollision: boolean;
  hasWallCollision: boolean;
  isOutOfBounds: boolean;
  nearestObstacleDistance: number | null;
  nearestWallDistance: number | null;
  nearestFurnitureDistance: number | null;
  recommendations: string[];
}

interface DragStateUpdates {
  safety?: PlacementSafety;
  magneticSnap?: boolean;
  snapType?: 'wall' | 'corner' | 'edge' | 'furniture' | null;
}

interface UseDragStateReturn {
  updateDragState: (updates: DragStateUpdates) => void;
  setPlacementSafety: (safety: PlacementSafety) => void;
  setMagneticSnapActive: (active: boolean) => void;
  setSnapType: (type: 'wall' | 'corner' | 'edge' | 'furniture' | null) => void;
}

/**
 * Custom hook for managing drag state with batched updates
 * Separates drag state management logic from the main component
 */
export function useDragState(
  setPlacementSafety: (safety: PlacementSafety) => void,
  setMagneticSnapActive: (active: boolean) => void,
  setSnapType: (type: 'wall' | 'corner' | 'edge' | 'furniture' | null) => void
): UseDragStateReturn {
  const dragStateUpdateRef = useRef<DragStateUpdates | null>(null);
  const dragStateUpdateTimeoutRef = useRef<number | null>(null);

  const updateDragState = useCallback((updates: DragStateUpdates) => {
    // Cancel pending update first to prevent race conditions
    if (dragStateUpdateTimeoutRef.current !== null) {
      cancelAnimationFrame(dragStateUpdateTimeoutRef.current);
      dragStateUpdateTimeoutRef.current = null;
    }
    
    // Merge updates atomically - combine existing pending updates with new updates
    const pendingUpdates = { ...dragStateUpdateRef.current, ...updates };
    dragStateUpdateRef.current = pendingUpdates;
    
    // Use requestAnimationFrame for better synchronization with render cycle
    // This ensures updates happen before the next render, preventing lost updates
    dragStateUpdateTimeoutRef.current = requestAnimationFrame(() => {
      if (dragStateUpdateRef.current) {
        const updatesToApply = dragStateUpdateRef.current;
        
        // Apply all pending updates atomically
        if (updatesToApply.safety !== undefined) {
          setPlacementSafety(updatesToApply.safety);
        }
        if (updatesToApply.magneticSnap !== undefined) {
          setMagneticSnapActive(updatesToApply.magneticSnap);
        }
        if (updatesToApply.snapType !== undefined) {
          setSnapType(updatesToApply.snapType);
        }
        
        // Clear after applying
        dragStateUpdateRef.current = null;
      }
      dragStateUpdateTimeoutRef.current = null;
    });
  }, [setPlacementSafety, setMagneticSnapActive, setSnapType]);

  return {
    updateDragState,
    setPlacementSafety,
    setMagneticSnapActive,
    setSnapType,
  };
}

