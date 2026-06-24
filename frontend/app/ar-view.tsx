import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as THREE from 'three';

import { ARViewErrorBoundary } from '../components/ar-view/ARViewErrorBoundary';
import { ARViewUI } from '../components/ar-view/ARViewUI';

import { useARFurnitureState } from '../hooks/useARFurnitureState';
import { useARInteractionState } from '../hooks/useARInteractionState';
import { useARUIState } from '../hooks/useARUIState';
import { useARMeasurementState } from '../hooks/useARMeasurementState';
import { useARMarkerTracking } from '../hooks/useARMarkerTracking';
import { useARRefs } from '../hooks/useARRefs';
import { useARCoreState } from '../hooks/useARCoreState';
import { useARRenderer } from '../hooks/useARRenderer';
import { useARHistory } from '../hooks/useARHistory';

import { useARFurnitureManager } from '../hooks/useARFurnitureManager';
import { useARInteractionManager } from '../hooks/useARInteractionManager';
import { useARMeasurementManager } from '../hooks/useARMeasurementManager';
import { useARLayoutManager } from '../hooks/useARLayoutManager';
import { useARDemoManager } from '../hooks/useARDemoManager';
import { useARErrorRecovery } from '../hooks/useARErrorRecovery';

import { styles } from '../styles/arView.styles';
import { FURNITURE_LIBRARY } from '../constants/furniture-library';

function ARViewScreenInner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomDataJson?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  const furnitureState = useARFurnitureState();
  const interactionState = useARInteractionState();
  const uiState = useARUIState();
  const measurementState = useARMeasurementState();
  const markerTracking = useARMarkerTracking();
  const arRefs = useARRefs();
  const coreState = useARCoreState();

  const furnitureLibraryById = useMemo(() => {
    return FURNITURE_LIBRARY.reduce((acc: any, item: any) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, []);

  const history = useARHistory(furnitureLibraryById);

  // Set up AR Renderer
  const renderer = useARRenderer({
    isARActive: coreState.isARActive,
    furnitureMapRef: arRefs.furnitureMapRef,
    roomData: coreState.roomData,
    isDraggingFurniture: interactionState.isDraggingFurniture,
    draggedFurnitureId: interactionState.draggedFurnitureId,
    demoMode: coreState.demoMode,
    onSceneReady: () => {
      if (furnitureState.selectedLibraryItem) furnitureState.setShowPlacementHint(true);
    },
    setCameraMode: uiState.setCameraMode,
    setIsARActive: coreState.setIsARActive,
    detectedPlanes: coreState.detectedPlanes,
    isPlacingFurniture: furnitureState.isPlacingFurniture,
    selectedLibraryItemId: furnitureState.selectedLibraryItem,
  });

  const commonProps = {
    furnitureState, interactionState, uiState, coreState, arRefs, measurementState, markerTracking, history,
    cameraRef: renderer.cameraRef, sceneRef: renderer.sceneRef,
    reticleWorldPositionRef: renderer.reticleWorldPositionRef,
    furnitureLibraryById,
    saveToHistoryWithSceneCheck: history.saveToHistory,
    setComponentError: coreState.setComponentError,
    voiceGuidanceEnabled: true,
  };

  const furnitureManager = useARFurnitureManager(commonProps as any);
  const interactionManager = useARInteractionManager(commonProps as any);
  const measurementManager = useARMeasurementManager(commonProps as any);
  const layoutManager = useARLayoutManager(commonProps as any);
  const demoManager = useARDemoManager(commonProps as any);
  const errorRecovery = useARErrorRecovery(commonProps as any);

  // Group all props for the UI component
  const uiProps = {
    permission, requestPermission, router, params,
    ...furnitureState, ...interactionState, ...uiState, ...measurementState, ...markerTracking, ...coreState,
    ...renderer, ...furnitureManager, ...interactionManager, ...measurementManager, ...layoutManager, ...demoManager, ...errorRecovery,
    getFurnitureIcon: (cat: string) => "cube"
  };

  return <ARViewUI {...uiProps} />;
}

export default function ARViewScreenWithErrorBoundary() {
  return (
    <ARViewErrorBoundary>
      <ARViewScreenInner />
    </ARViewErrorBoundary>
  );
}
