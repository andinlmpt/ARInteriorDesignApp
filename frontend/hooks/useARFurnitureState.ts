/**
 * AR Furniture State Hook
 * Manages furniture selection, placement, and multi-select state
 */

import { useState, useCallback, useRef } from 'react';
import type { FurnitureLibraryItem, PlacedFurnitureMeta } from '@/types/ar-view';

interface UseARFurnitureStateReturn {
  // Selection state
  selectedLibraryItem: string | null;
  setSelectedLibraryItem: React.Dispatch<React.SetStateAction<string | null>>;
  selectedPlacedId: string | null;
  setSelectedPlacedId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedFurnitureIds: Set<string>;
  setSelectedFurnitureIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  multiSelectMode: boolean;
  setMultiSelectMode: (mode: boolean) => void;
  
  // Placement state
  placedFurniture: PlacedFurnitureMeta[];
  setPlacedFurniture: React.Dispatch<React.SetStateAction<PlacedFurnitureMeta[]>>;
  isPlacingFurniture: boolean;
  setIsPlacingFurniture: (placing: boolean) => void;
  showPlacementHint: boolean;
  setShowPlacementHint: (show: boolean) => void;
  
  // Furniture properties
  furnitureScale: Record<string, number>;
  setFurnitureScale: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  highlightedFurniture: string | null;
  setHighlightedFurniture: (id: string | null) => void;
  
  // Actions
  toggleFurnitureSelection: (id: string) => void;
  clearSelection: () => void;
  selectAllFurniture: () => void;
}

export function useARFurnitureState(): UseARFurnitureStateReturn {
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<string | null>(null);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);
  const [selectedFurnitureIds, setSelectedFurnitureIds] = useState<Set<string>>(new Set());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurnitureMeta[]>([]);
  const [isPlacingFurniture, setIsPlacingFurniture] = useState(false);
  const [showPlacementHint, setShowPlacementHint] = useState(false);
  const [furnitureScale, setFurnitureScale] = useState<Record<string, number>>({});
  const [highlightedFurniture, setHighlightedFurniture] = useState<string | null>(null);
  
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const toggleFurnitureSelection = useCallback((id: string) => {
    setSelectedFurnitureIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);
  
  const clearSelection = useCallback(() => {
    setSelectedFurnitureIds(new Set());
    setSelectedPlacedId(null);
    setMultiSelectMode(false);
  }, []);
  
  const selectAllFurniture = useCallback(() => {
    setSelectedFurnitureIds(new Set(placedFurniture.map(f => f.id)));
  }, [placedFurniture]);
  
  return {
    selectedLibraryItem,
    setSelectedLibraryItem,
    selectedPlacedId,
    setSelectedPlacedId,
    selectedFurnitureIds,
    setSelectedFurnitureIds,
    multiSelectMode,
    setMultiSelectMode,
    placedFurniture,
    setPlacedFurniture,
    isPlacingFurniture,
    setIsPlacingFurniture,
    showPlacementHint,
    setShowPlacementHint,
    furnitureScale,
    setFurnitureScale,
    highlightedFurniture,
    setHighlightedFurniture,
    toggleFurnitureSelection,
    clearSelection,
    selectAllFurniture,
  };
}
