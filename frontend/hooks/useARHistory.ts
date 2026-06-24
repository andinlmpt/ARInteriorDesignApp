/**
 * AR History Hook
 * Manages undo/redo history for furniture placement
 */

import { useState, useCallback, useRef } from 'react';
import type { PlacedFurnitureMeta } from '@/types/ar-view';
import { AR_CONFIG } from '@/config/arView.config';

interface UseARHistoryReturn {
  // State
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  
  // Actions
  saveToHistory: (state: PlacedFurnitureMeta[]) => void;
  undo: () => PlacedFurnitureMeta[] | null;
  redo: () => PlacedFurnitureMeta[] | null;
  clearHistory: () => void;
  
  // Validation
  validateHistoryState: (state: PlacedFurnitureMeta[]) => PlacedFurnitureMeta[];
}

export function useARHistory(
  furnitureLibraryById: Record<string, any>
): UseARHistoryReturn {
  const [history, setHistory] = useState<PlacedFurnitureMeta[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const lastHistorySaveRef = useRef<number>(0);

  // Validate history state to prevent corruption
  const validateHistoryState = useCallback((
    state: PlacedFurnitureMeta[]
  ): PlacedFurnitureMeta[] => {
    return state.filter(item => {
      const libraryItem = furnitureLibraryById[item.libraryId];
      if (!libraryItem) {
        console.warn(`[ARHistory] Removing invalid library reference: ${item.libraryId}`);
        return false;
      }
      return true;
    });
  }, [furnitureLibraryById]);

  // Save to history with validation
  const saveToHistory = useCallback((newState: PlacedFurnitureMeta[]) => {
    const now = Date.now();
    
    // Throttle history saves during drag operations
    if (now - lastHistorySaveRef.current < AR_CONFIG.DRAG_HISTORY_THROTTLE) {
      return;
    }
    
    lastHistorySaveRef.current = now;
    
    // Validate state
    const validatedState = validateHistoryState(newState);
    
    const currentHistory = history.length > 0 ? history : [[]];
    const currentIndex = historyIndex >= 0 ? historyIndex : 0;
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(validatedState);
    
    if (newHistory.length > AR_CONFIG.MAX_HISTORY_ENTRIES) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, validateHistoryState]);

  // Undo
  const undo = useCallback((): PlacedFurnitureMeta[] | null => {
    if (historyIndex <= 0) {
      return null;
    }
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    return history[newIndex] || null;
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback((): PlacedFurnitureMeta[] | null => {
    if (historyIndex >= history.length - 1) {
      return null;
    }
    
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    return history[newIndex] || null;
  }, [history, historyIndex]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([[]]);
    setHistoryIndex(0);
    lastHistorySaveRef.current = 0;
  }, []);

  return {
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyIndex,
    saveToHistory,
    undo,
    redo,
    clearHistory,
    validateHistoryState,
  };
}


