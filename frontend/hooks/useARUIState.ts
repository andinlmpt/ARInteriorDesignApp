/**
 * AR UI State Hook
 * Manages UI panel visibility, categories, and library panel state
 */

import { useState } from 'react';
import type { FurnitureLibraryItem } from '@/types/ar-view';

interface UseARUIStateReturn {
  // Library panel state
  libraryPanelVisible: boolean;
  setLibraryPanelVisible: (visible: boolean) => void;
  libraryPanelDragY: number;
  setLibraryPanelDragY: (y: number) => void;
  selectedCategory: FurnitureLibraryItem['category'] | 'all';
  setSelectedCategory: (category: FurnitureLibraryItem['category'] | 'all') => void;
  
  // Floor visibility
  showFloor: boolean;
  setShowFloor: (show: boolean) => void;
  
  // Camera mode
  cameraMode: 'ar' | 'preview';
  setCameraMode: React.Dispatch<React.SetStateAction<'ar' | 'preview'>>;
  cameraZoom: number;
  setCameraZoom: React.Dispatch<React.SetStateAction<number>>;
  cameraRotation: { x: number; y: number };
  setCameraRotation: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  
  // Status messages
  statusMessageDismissed: boolean;
  setStatusMessageDismissed: (dismissed: boolean) => void;
  surfaceDetectedTime: number | null;
  setSurfaceDetectedTime: (time: number | null) => void;
}

export function useARUIState(): UseARUIStateReturn {
  const [libraryPanelVisible, setLibraryPanelVisible] = useState(false);
  const [libraryPanelDragY, setLibraryPanelDragY] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<FurnitureLibraryItem['category'] | 'all'>('all');
  const [showFloor, setShowFloor] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ar' | 'preview'>('ar');
  const [cameraZoom, setCameraZoom] = useState(1.0);
  const [cameraRotation, setCameraRotation] = useState<{ x: number; y: number }>({ x: 0.5, y: 0 });
  const [statusMessageDismissed, setStatusMessageDismissed] = useState(false);
  const [surfaceDetectedTime, setSurfaceDetectedTime] = useState<number | null>(null);
  
  return {
    libraryPanelVisible,
    setLibraryPanelVisible,
    libraryPanelDragY,
    setLibraryPanelDragY,
    selectedCategory,
    setSelectedCategory,
    showFloor,
    setShowFloor,
    cameraMode,
    setCameraMode,
    cameraZoom,
    setCameraZoom,
    cameraRotation,
    setCameraRotation,
    statusMessageDismissed,
    setStatusMessageDismissed,
    surfaceDetectedTime,
    setSurfaceDetectedTime,
  };
}
