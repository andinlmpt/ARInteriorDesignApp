import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  PanResponder,
  AccessibilityInfo,
  Dimensions,
  Modal,
  Animated,
} from 'react-native';
import { AnimatedButton, AnimatedCard, FadeInView, SlideInView, ScaleInView } from '@/components/interactive';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import * as FileSystem from 'expo-file-system';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomData, SpatialPoint } from '@/types/spatial-mapping';
import { arAnchorManager } from '@/services/ARAnchorManager';
import { enhancedSpatialMappingService } from '@/services/EnhancedSpatialMappingService';
import { furnitureModelLoader } from '@/services/FurnitureModelLoader';
import { roomLayoutService } from '@/services/RoomLayoutService';
import type { AnchorStatus } from '@/types/anchor';
import type {
  ARInitError,
  FurnitureMapEntry,
  FurnitureLibraryItem,
  PlacedFurnitureMeta,
  SavedLayout,
  FurniturePhysics,
} from '@/types/ar-view';
import type { DetectedPlane } from '@/types/spatial-mapping';
import { getJson, setJson } from '@/utils/storage';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { ARViewSkeleton } from '@/components/ui/SkeletonLoader';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/components/ui/theme';
import { CONFIG, MAX_CACHE_SIZE, MAX_POOL_SIZE } from '@/constants/ar-config';
import { FURNITURE_LIBRARY } from '@/constants/furniture-library';
import {
  disposeMesh,
  disposeObjectRecursive,
  unitToMeters,
  spatialToVector3,
  vector3ToSpatial,
} from '@/utils/three-utils';
import {
  parseSizeLabel,
  checkObstacleCollisions,
  checkFurnitureCollisions,
  getPlacementSafety,
  checkRoomBounds,
  distanceToLineSegment,
  createFurnitureBoundingBox,
} from '@/utils/arCollisionDetection';
import {
  suggestAlternativePositions,
  autoCorrectPosition,
} from '@/utils/arPlacementHelpers';
import {
  alignToFloor,
  snapToGridPosition,
  snapRotation,
  findAlignmentTargets,
  findWallSnapTargets,
  findCornerSnapTargets,
  findEdgeAlignmentTargets,
} from '@/utils/arPositioningHelpers';
import { useARRenderer } from '@/hooks/useARRenderer';
import { useARFurnitureState } from '@/hooks/useARFurnitureState';
import { useARInteractionState } from '@/hooks/useARInteractionState';
import { useARUIState } from '@/hooks/useARUIState';
import { useARMeasurementState } from '@/hooks/useARMeasurementState';
import { useARMarkerTracking } from '@/hooks/useARMarkerTracking';
import { useARRefs } from '@/hooks/useARRefs';
import { useARCoreState } from '@/hooks/useARCoreState';
import { useARHistory } from '@/hooks/useARHistory';
import { useARViewBottomSheet } from '@/hooks/ar-view/useARViewBottomSheet';
import { useARViewFurniturePlacement } from '@/hooks/ar-view/useARViewFurniturePlacement';
import { useARViewMeasurementVisualization } from '@/hooks/ar-view/useARViewMeasurementVisualization';
import { useARViewSceneGestures } from '@/hooks/ar-view/useARViewSceneGestures';
import {
  AR_VIEW_ERROR_MESSAGES,
  AR_VIEW_STATUS_AUTO_HIDE_DELAY,
  AR_VIEW_LAYOUT_STORAGE_KEY,
  AR_VIEW_CURRENT_LAYOUT_KEY,
} from '@/config/arView.messages';
import { getFurnitureCategoryIcon } from '@/utils/arViewFurnitureIcons';
import {
  buildFurnitureLibraryById,
  getFilteredFurnitureLibrary,
  getFurnitureCategories,
} from '@/utils/arViewFurnitureLibrary';
import { styles } from '@/styles/arView.styles';
import { ARViewPermissionGate } from '@/components/ar-view/ARViewPermissionGate';
import { ARViewViewport } from '@/components/ar-view/ARViewViewport';


export function ARViewScreen() {
  if (typeof THREE === 'undefined' || !THREE.WebGLRenderer) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Three.js failed to load. Please refresh.</Text>
      </View>
    );
  }

  return <ARViewScreenInner />;
}

function ARViewScreenInner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomDataJson?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  // Use custom hooks for state management
  const furnitureState = useARFurnitureState();
  const interactionState = useARInteractionState();
  const uiState = useARUIState();
  const measurementState = useARMeasurementState();
  const markerTracking = useARMarkerTracking();
  const arRefs = useARRefs();
  const coreState = useARCoreState();

  // Destructure for easier access
  const {
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
  } = furnitureState;

  const {
    gestureState,
    setGestureState,
    isDraggingFurniture,
    setIsDraggingFurniture,
    draggedFurnitureId,
    setDraggedFurnitureId,
    dragStartPosition,
    setDragStartPosition,
    dragStartRotation,
    setDragStartRotation,
    dragRotation,
    setDragRotation,
    isRotatingFurniture,
    setIsRotatingFurniture,
    rotationStartAngle,
    setRotationStartAngle,
    rotationStartTouchAngle,
    setRotationStartTouchAngle,
    magneticSnapActive,
    setMagneticSnapActive,
    snapType,
    setSnapType,
    suggestedPositions,
    setSuggestedPositions,
    twoFingerStartRef,
    lockedScaleRef,
    lastDragUpdateRef,
    pendingDragPositionRef,
    latestDragPositionRef,
    dragGhostRef,
    alignmentLinesRef,
    constraintLinesRef,
    dimensionLabelRef,
    suggestedPositionsRef,
    suggestedPositionLabelsRef,
    dragStateUpdateTimeoutRef,
    dragStateUpdateQueue,
  } = interactionState;

  const {
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
  } = uiState;

  const {
    measurementMode,
    setMeasurementMode,
    measurementPoints,
    setMeasurementPoints,
    measurementResults,
    setMeasurementResults,
    measurementLinesRef,
    measurementLabelsRef,
    measurementPointsRef,
    measurementMarkerAnimationsRef,
  } = measurementState;

  const {
    markerTrackingEnabled,
    setMarkerTrackingEnabled,
    lastMarkerPayload,
    setLastMarkerPayload,
    markerLastSeenAt,
    setMarkerLastSeenAt,
    lastMarkerUpdateRef,
    markerAnchorOffsetRef,
    markerYawRef,
    markerScaleRef,
  } = markerTracking;

  const {
    furnitureMapRef,
    obstacleMapRef,
    roomGroupRef,
    raycasterRef,
    floorPlaneRef,
    geometryPoolRef,
    materialPoolRef,
    geometryCacheRef,
    materialCacheRef,
    lastPanRef,
    touchStartRef,
    isPanningRef,
    isZoomingRef,
    isRotatingRef,
    longPressTimerRef,
    tooltipRef,
    lastHistorySaveRef,
    lastCollisionCheckRef,
    demoIntervalRef,
    demoTimeoutRef,
  } = arRefs;

  const {
    isARActive,
    setIsARActive,
    roomData,
    setRoomData,
    anchorStatus,
    setAnchorStatus,
    isInitializing,
    setIsInitializing,
    componentError,
    setComponentError,
    retryAttempts,
    setRetryAttempts,
    retryCount,
    setRetryCount,
    arUnavailable,
    setArUnavailable,
    arLimitedDismissed,
    setArLimitedDismissed,
    detectedPlanes,
    setDetectedPlanes,
    collisionWarnings,
    setCollisionWarnings,
    demoMode,
    setDemoMode,
    interactiveStats,
    setInteractiveStats,
    placementSafety,
    setPlacementSafety,
  } = coreState;

  // Plane detection state (unused but kept for compatibility)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showPlaneVisualization, _setShowPlaneVisualization] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_planeVisualizationMeshes, _setPlaneVisualizationMeshes] = useState<Map<string, THREE.Mesh>>(new Map());

  // Unused state (kept for compatibility)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showWalkingSpace, _setShowWalkingSpace] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_firstTimeUser, _setFirstTimeUser] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_tutorialCompleted, _setTutorialCompleted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [snapToGrid, _setSnapToGrid] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showDragGuides, _setShowDragGuides] = useState(true);

  // Use the refactored renderer hook
  const {
    onContextCreate,
    handleCanvasLayout,
    rendererReady,
    error: rendererError,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    initError: _initError,
    sceneRef,
    cameraRef,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    rendererRef: _rendererRef,
    rootGroupRef,
    reticleRef,
    glLayoutRef,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recoveryInProgress: _recoveryInProgress,
    previewGhostRef,
    reticleWorldPositionRef,
    reticleSmoothedPositionRef,
    updateReticleFromScreen,
  } = useARRenderer({
    isARActive,
    furnitureMapRef,
    roomData,
    isDraggingFurniture,
    draggedFurnitureId,
    demoMode,
    onSceneReady: () => {
      // Re-enable placement hint if an item was selected
      if (selectedLibraryItem) setShowPlacementHint(true);
    },
    setCameraMode,
    setIsARActive,
    detectedPlanes,
    isPlacingFurniture,
    selectedLibraryItemId: selectedLibraryItem,
  });

  // Unused state (kept for compatibility)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showSaveLayoutModal, _setShowSaveLayoutModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_layoutName, _setLayoutName] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [voiceGuidanceEnabled, _setVoiceGuidanceEnabled] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_furnitureCustomizations, _setFurnitureCustomizations] = useState<Map<string, {
    color?: string;
    material?: 'leather' | 'fabric' | 'wood' | 'metal';
    scale?: { width: number; height: number; length: number };
  }>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_roomTemplates, _setRoomTemplates] = useState<{
    id: string;
    name: string;
    type: 'living-room' | 'bedroom' | 'office' | 'kitchen' | 'dining';
    squareFootage: number;
    budgetRange: { min: number; max: number };
    furniture: { libraryId: string; position: { x: number; y: number; z: number } }[];
  }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_multiPointAnchors, _setMultiPointAnchors] = useState<{ id: string; position: THREE.Vector3; type: 'visual' | 'spatial' }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_persistentAnchors, _setPersistentAnchors] = useState<Map<string, { position: THREE.Vector3; rotation: THREE.Euler; savedAt: number }>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showTutorial, _setShowTutorial] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_tutorialStep, _setTutorialStep] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showMeasurements, _setShowMeasurements] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedMeasurement, _setSelectedMeasurement] = useState<{ from: THREE.Vector3; to: THREE.Vector3 } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showInteractiveHelp, _setShowInteractiveHelp] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_demoStep, _setDemoStep] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_demoTourActive, _setDemoTourActive] = useState(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interactive tutorial steps
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _TUTORIAL_STEPS: { title: string; description: string; icon: string }[] = [
    { title: 'Welcome! 👋', description: 'Tap and drag furniture to move it around in AR space', icon: '👆' },
    { title: 'Place Furniture', description: 'Select furniture from library, then tap to place', icon: '🪑' },
    { title: 'Safety System', description: 'Watch the safety indicator - green is safe, red means collision', icon: '✅' },
    { title: 'Drag & Rotate', description: 'Tap furniture to drag, use rotate button for orientation', icon: '🔄' },
    { title: 'Measurements', description: 'Use measurement tools to check distances and areas', icon: '📏' },
  ];

  // History management
  const furnitureLibraryById = useMemo(() => buildFurnitureLibraryById(), []);

  const {
    canUndo,
    canRedo,
    historyIndex,
    saveToHistory,
    undo,
    redo,
    clearHistory,
    validateHistoryState: validateHistoryStateFromHook,
  } = useARHistory(furnitureLibraryById);

  // Enhanced validateHistoryState that includes scene presence check
  const validateHistoryState = useCallback((
    state: PlacedFurnitureMeta[],
    checkScenePresence: boolean = false
  ): PlacedFurnitureMeta[] => {
    const validated = validateHistoryStateFromHook(state);

    // Additional scene presence check if requested
    if (checkScenePresence && furnitureMapRef.current) {
      return validated.filter(item => {
        const entry = furnitureMapRef.current.get(item.id);
        if (!entry) {
          console.warn(`[ARView] Furniture ${item.id} missing from scene`);
          return false;
        }
        return true;
      });
    }

    return validated;
  }, [validateHistoryStateFromHook]);

  // Performance monitoring (development only)
  usePerformanceMonitor(30);

  // Enhanced saveToHistory that includes scene presence check
  const saveToHistoryWithSceneCheck = useCallback((newState: PlacedFurnitureMeta[]) => {
    // Validate with scene presence check since we're saving current state
    const validatedState = validateHistoryState(newState, true);
    saveToHistory(validatedState);

    // Warn if validation removed items
    if (validatedState.length !== newState.length) {
      console.warn(`[ARView] History validation removed ${newState.length - validatedState.length} invalid items from history state.`);
    }
  }, [validateHistoryState, saveToHistory]);

  // Alias for convenience - use saveToHistoryWithSceneCheck for most cases
  const saveToHistoryValidated = saveToHistoryWithSceneCheck;

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    setIsInitializing(true);
    setComponentError(null);

    try {
      if (params.roomDataJson && typeof params.roomDataJson === 'string') {
        try {
          const parsed = JSON.parse(params.roomDataJson) as RoomData;
          if (parsed && parsed.dimensions) {
            setRoomData(parsed);
            enhancedSpatialMappingService.setLatestRoomData(parsed);
          } else {
            throw new Error('Invalid room data structure');
          }
        } catch (parseError) {
          console.error('Failed to parse room data from params', parseError);
          setComponentError(AR_VIEW_ERROR_MESSAGES.ROOM_DATA_PARSE_ERROR);
          Alert.alert('Error', AR_VIEW_ERROR_MESSAGES.ROOM_DATA_PARSE_ERROR, [
            {
              text: 'OK',
              onPress: () => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }
            }
          ]);
        }
      } else {
        const latest = enhancedSpatialMappingService.getLatestRoomData();
        if (latest) {
          setRoomData(latest);
        }
      }
    } finally {
      setIsInitializing(false);
    }
  }, [params.roomDataJson, router]);

  useEffect(() => {
    setShowPlacementHint(Boolean(selectedLibraryItem));
    // Hide preview ghost when deselecting
    if (!selectedLibraryItem && previewGhostRef.current) {
      previewGhostRef.current.visible = false;
    }
    // Reset safety indicator when deselecting
    if (!selectedLibraryItem) {
      setPlacementSafety({
        isSafe: true,
        safetyLevel: 'safe',
        safetyScore: 100,
        reason: null,
        hasObstacleCollision: false,
        hasFurnitureCollision: false,
        hasWallCollision: false,
        isOutOfBounds: false,
        nearestObstacleDistance: null,
        nearestWallDistance: null,
        nearestFurnitureDistance: null,
        recommendations: [],
      });
    }

  }, [selectedLibraryItem, previewGhostRef]);

  // Initialize history on mount
  useEffect(() => {
    if (placedFurniture.length === 0) {
      // History is initialized by useARHistory hook
      // Just ensure we save initial empty state
      saveToHistoryWithSceneCheck([]);
    }
  }, []); // Only run once on mount

  useEffect(() => {
    if (roomData) {
      arAnchorManager.hydrateFromSpatialMapping(roomData);
      setAnchorStatus(arAnchorManager.getStatus());
    }
  }, [roomData]);

  // Initialize plane detection for furniture rendering
  useEffect(() => {
    if (!rendererReady || !isARActive) return;

    const derivePlanesFromRoomData = (data: RoomData): DetectedPlane[] => {
      const { width, length, height } = data.dimensions;
      const halfW = width / 2;
      const halfL = length / 2;
      const timestamp = data.timestamp ?? Date.now();
      const confidence = data.confidence ?? 0.6;

      const floorPoints: SpatialPoint[] =
        data.floorBoundary && data.floorBoundary.length >= 3
          ? data.floorBoundary
          : [
            { x: -halfW, y: 0, z: -halfL },
            { x: halfW, y: 0, z: -halfL },
            { x: halfW, y: 0, z: halfL },
            { x: -halfW, y: 0, z: halfL },
          ];

      const ceilingPoints: SpatialPoint[] =
        data.ceilingBoundary && data.ceilingBoundary.length >= 3
          ? data.ceilingBoundary
          : floorPoints.map((p) => ({ x: p.x, y: height, z: p.z }));

      const derived: DetectedPlane[] = [
        {
          id: 'derived-floor',
          type: 'horizontal',
          points: floorPoints,
          center: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 1, z: 0 },
          area: Math.max(0.01, data.area || width * length),
          confidence,
          timestamp,
        },
        {
          id: 'derived-ceiling',
          type: 'horizontal',
          points: ceilingPoints,
          center: { x: 0, y: height, z: 0 },
          normal: { x: 0, y: -1, z: 0 },
          area: Math.max(0.01, width * length),
          confidence: Math.max(0.3, confidence - 0.1),
          timestamp,
        },
      ];

      // Walls (rectangles)
      if (data.walls && data.walls.length > 0) {
        for (const wall of data.walls) {
          const bottomA = wall.startPoint;
          const bottomB = wall.endPoint;
          const topA = { x: bottomA.x, y: height, z: bottomA.z };
          const topB = { x: bottomB.x, y: height, z: bottomB.z };

          const center: SpatialPoint = {
            x: (bottomA.x + bottomB.x) / 2,
            y: height / 2,
            z: (bottomA.z + bottomB.z) / 2,
          };

          // Approximate normals from orientation
          const normal: SpatialPoint =
            wall.orientation === 'north'
              ? { x: 0, y: 0, z: 1 }
              : wall.orientation === 'south'
                ? { x: 0, y: 0, z: -1 }
                : wall.orientation === 'east'
                  ? { x: -1, y: 0, z: 0 }
                  : { x: 1, y: 0, z: 0 };

          derived.push({
            id: `derived-wall-${wall.id}`,
            type: 'vertical',
            points: [bottomA, bottomB, topB, topA],
            center,
            normal,
            area: Math.max(0.01, wall.length * height),
            confidence: Math.max(0.3, confidence - 0.05),
            timestamp,
          });
        }
      }

      return derived;
    };

    const getExtentFromPlane = (plane: DetectedPlane): { width: number; length: number } => {
      const fallback = Math.sqrt(Math.max(plane.area || 1, 1));
      const pts = plane.points ?? [];
      if (pts.length < 2) {
        return { width: fallback, length: fallback };
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;

      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }

      const spanX = Math.max(0.01, maxX - minX);
      const spanY = Math.max(0.01, maxY - minY);
      const spanZ = Math.max(0.01, maxZ - minZ);

      if (plane.type === 'horizontal') {
        return { width: spanX || fallback, length: spanZ || fallback };
      }

      // Vertical: width on horizontal axis, "length" treated as height for visualization/layout
      const horizontalSpan = Math.max(spanX, spanZ);
      return { width: horizontalSpan || fallback, length: spanY || fallback };
    };

    // Plane detection initialization disabled - planes work internally but are not visualized
    // This preserves the clean scanning experience without visual plane projections
    // Note: Plane detection still works for collision detection, just not visually displayed

    // Plane detection disabled - no visual plane projection to preserve clean scanning experience
    // Planes are still detected internally for collision detection but not visualized
    // This prevents plane projections from ruining the AR scanning experience

    // Keep planes empty to prevent any visualization
    setDetectedPlanes([]);

    return () => {
      // No interval to clear
    };
  }, [rendererReady, isARActive, roomData]);

  useEffect(() => {
    if (!isARActive) {
      if (reticleRef.current) {
        reticleRef.current.visible = false;
      }
      // Reset status message visibility when AR is deactivated
      setStatusMessageDismissed(false);
      setSurfaceDetectedTime(null);
      return;
    }

    const interval = setInterval(() => {
      try {
        const newStatus = arAnchorManager.getStatus();
        setAnchorStatus(newStatus);

        // Track when surface is first detected
        if (newStatus.hasLock && surfaceDetectedTime === null) {
          setSurfaceDetectedTime(Date.now());
        } else if (!newStatus.hasLock) {
          // Reset if surface is lost
          setSurfaceDetectedTime(null);
          setStatusMessageDismissed(false);
        }
      } catch (error) {
        console.error('[ARView] Error updating anchor status:', error);
        setComponentError(AR_VIEW_ERROR_MESSAGES.ANCHOR_ERROR);
      }
    }, CONFIG.ANCHOR_UPDATE_INTERVAL);

    return () => clearInterval(interval);

  }, [isARActive, surfaceDetectedTime, reticleRef]);

  // Auto-hide status message after surface is detected
  useEffect(() => {
    if (surfaceDetectedTime !== null && !statusMessageDismissed) {
      const timer = setTimeout(() => {
        setStatusMessageDismissed(true);
      }, AR_VIEW_STATUS_AUTO_HIDE_DELAY);

      return () => clearTimeout(timer);
    }
  }, [surfaceDetectedTime, statusMessageDismissed]);


  /**
   * Web Workers: Offload collision detection to worker thread
   * Structure for future implementation (React Native doesn't support Web Workers directly)
   * This would be implemented using a native module or background task
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _performCollisionDetectionInWorker = useCallback(async (
    furniturePositions: { id: string; position: THREE.Vector3; dimensions: { width: number; height: number; length: number } }[],
    obstacles: { position: THREE.Vector3; dimensions: { width: number; height: number; length: number } }[]
  ): Promise<Set<string>> => {
    // In a full implementation, this would offload to a Web Worker
    // For now, we perform collision detection on main thread but structure is ready
    const collisions = new Set<string>();

    // Perform collision detection (simplified - full implementation would use spatial partitioning)
    for (let i = 0; i < furniturePositions.length; i++) {
      const furniture1 = furniturePositions[i];
      const box1 = new THREE.Box3().setFromCenterAndSize(
        furniture1.position,
        new THREE.Vector3(furniture1.dimensions.width, furniture1.dimensions.height, furniture1.dimensions.length)
      );

      // Check against other furniture
      for (let j = i + 1; j < furniturePositions.length; j++) {
        const furniture2 = furniturePositions[j];
        const box2 = new THREE.Box3().setFromCenterAndSize(
          furniture2.position,
          new THREE.Vector3(furniture2.dimensions.width, furniture2.dimensions.height, furniture2.dimensions.length)
        );

        if (box1.intersectsBox(box2)) {
          collisions.add(furniture1.id);
          collisions.add(furniture2.id);
        }
      }

      // Check against obstacles
      for (const obstacle of obstacles) {
        const obstacleBox = new THREE.Box3().setFromCenterAndSize(
          obstacle.position,
          new THREE.Vector3(obstacle.dimensions.width, obstacle.dimensions.height, obstacle.dimensions.length)
        );

        if (box1.intersectsBox(obstacleBox)) {
          collisions.add(furniture1.id);
        }
      }
    }

    return collisions;
  }, []);


  /**
   * Batch state updates for drag operations using a queue to prevent race conditions
   * Uses requestAnimationFrame to process all pending updates atomically
   * This prevents lost updates when multiple state changes happen rapidly
   */
  const updateDragState = useCallback((updates: {
    safety?: typeof placementSafety;
    magneticSnap?: boolean;
    snapType?: typeof snapType;
  }) => {
    // Use a queue to prevent lost updates
    const pendingUpdates = dragStateUpdateQueue.current;
    pendingUpdates.push(updates);

    if (dragStateUpdateTimeoutRef.current !== null) {
      return; // Already scheduled
    }

    dragStateUpdateTimeoutRef.current = requestAnimationFrame(() => {
      try {
        // Process all pending updates atomically
        const allUpdates = pendingUpdates.reduce((acc, update) => ({
          ...acc,
          ...update
        }), {});

        // Use startTransition to mark these as non-urgent updates, reducing re-renders
        startTransition(() => {
          if (allUpdates.safety) setPlacementSafety(allUpdates.safety);
          if (allUpdates.magneticSnap !== undefined) setMagneticSnapActive(allUpdates.magneticSnap);
          if (allUpdates.snapType !== undefined) setSnapType(allUpdates.snapType);
        });
      } catch (error) {
        console.error('[ARView] Error processing drag state updates:', error);
      } finally {
        // Always clear the queue, even if there was an error
        pendingUpdates.length = 0;
        dragStateUpdateTimeoutRef.current = null;
      }
    });
  }, []);


  const {
    cleanupCaches,
    resetFurnitureMeshes,
    checkCollisions,
    addFurnitureToScene,
    removeFurniture,
    restoreFurnitureState,
  } = useARViewFurniturePlacement({
    furnitureMapRef,
    obstacleMapRef,
    rootGroupRef,
    sceneRef,
    cameraRef,
    previewGhostRef,
    reticleRef,
    reticleWorldPositionRef,
    reticleSmoothedPositionRef,
    geometryCacheRef,
    materialCacheRef,
    geometryPoolRef,
    materialPoolRef,
    lastCollisionCheckRef,
    highlightTimeoutRef,
    furnitureLibraryById,
    selectedLibraryItem,
    placedFurniture,
    roomData,
    placementSafety,
    voiceGuidanceEnabled,
    setPlacedFurniture,
    setSelectedPlacedId,
    setSelectedLibraryItem,
    setIsPlacingFurniture,
    setComponentError,
    setShowPlacementHint,
    setHighlightedFurniture,
    setInteractiveStats,
    setSuggestedPositions,
    setCollisionWarnings,
    selectedPlacedId,
    saveToHistoryWithSceneCheck,
    validateHistoryState,
    clearHistory,
  });

  const {
    calculateDistance,
    calculateArea,
    calculateVolume,
  } = useARViewMeasurementVisualization({
    rootGroupRef,
    sceneRef,
    measurementLinesRef,
    measurementLabelsRef,
    measurementPointsRef,
    measurementMarkerAnimationsRef,
    suggestedPositionsRef,
    suggestedPositionLabelsRef,
    cameraRef,
    measurementMode,
    measurementPoints,
    suggestedPositions,
    roomData,
    rendererReady,
    setMeasurementPoints,
    setMeasurementResults,
  });

  const {
    cleanupAlignmentLines,
    cleanupDimensionLabels,
    cleanupConstraintLines,
    handleSceneTap,
    handleScenePan,
    updateDimensionLabels,
    showRoomConstraints,
    updateAlignmentLines,
  } = useARViewSceneGestures({
    rendererReady,
    isARActive,
    roomData,
    snapToGrid,
    showDragGuides,
    multiSelectMode,
    measurementMode,
    measurementPoints,
    selectedLibraryItem,
    selectedPlacedId,
    isDraggingFurniture,
    draggedFurnitureId,
    dragStartPosition,
    dragStartRotation,
    dragRotation,
    isRotatingFurniture,
    rotationStartAngle,
    rotationStartTouchAngle,
    gestureState,
    magneticSnapActive,
    snapType,
    furnitureScale,
    placementSafety,
    placedFurniture,
    furnitureMapRef,
    obstacleMapRef,
    rootGroupRef,
    cameraRef,
    sceneRef,
    raycasterRef,
    floorPlaneRef,
    glLayoutRef,
    reticleRef,
    reticleWorldPositionRef,
    reticleSmoothedPositionRef,
    previewGhostRef,
    dragGhostRef,
    alignmentLinesRef,
    constraintLinesRef,
    dimensionLabelRef,
    longPressTimerRef,
    lastDragUpdateRef,
    lastCollisionCheckRef,
    lastHistorySaveRef,
    lockedScaleRef,
    latestDragPositionRef,
    pendingDragPositionRef,
    twoFingerStartRef,
    tooltipRef,
    setGestureState,
    setIsDraggingFurniture,
    setDraggedFurnitureId,
    setSelectedPlacedId,
    setSelectedLibraryItem,
    setDragStartPosition,
    setDragStartRotation,
    setDragRotation,
    setIsRotatingFurniture,
    setRotationStartAngle,
    setRotationStartTouchAngle,
    setMagneticSnapActive,
    setSnapType,
    setFurnitureScale,
    setMeasurementPoints,
    setMeasurementResults,
    setComponentError,
    setPlacementSafety,
    setSelectedFurnitureIds,
    updateDragState,
    updateReticleFromScreen,
    addFurnitureToScene,
    saveToHistoryWithSceneCheck,
    calculateDistance,
    calculateArea,
    calculateVolume,
  });

  // updatePreviewGhost and updateReticleFromScreen migrated to useARRenderer hook



  // Note: Obstacles are managed separately and persist across furniture resets

  const updateRoomLayout = useCallback((data: RoomData) => {
    if (!sceneRef.current || !rootGroupRef.current) {
      return;
    }

    // Dispose of existing room layout
    if (roomGroupRef.current) {
      rootGroupRef.current.remove(roomGroupRef.current);
      roomLayoutService.disposeRoomLayout(roomGroupRef.current);
      roomGroupRef.current = null;
    }

    // Clear existing obstacles
    obstacleMapRef.current.forEach((mesh) => {
      disposeMesh(mesh);
    });
    obstacleMapRef.current.clear();

    // Build room layout using service
    const result = roomLayoutService.buildRoomLayout(
      data,
      rootGroupRef.current,
      cameraRef,
      showFloor
    );

    roomGroupRef.current = result.roomGroup;

    // Update obstacle map
    result.obstacleMap.forEach((mesh, id) => {
      obstacleMapRef.current.set(id, mesh);
    });

    // Update camera position if provided
    if (result.cameraPosition && result.cameraLookAt && cameraRef.current) {
      cameraRef.current.position.copy(result.cameraPosition);
      cameraRef.current.lookAt(result.cameraLookAt);
    }
  }, [showFloor]);

  useEffect(() => {
    if (rendererReady && roomData) {
      updateRoomLayout(roomData);
    }
  }, [rendererReady, roomData, updateRoomLayout]);

  // Control floor visibility based on showFloor state
  useEffect(() => {
    if (!roomGroupRef.current) return;
    roomLayoutService.updateFloorVisibility(roomGroupRef.current, showFloor);
  }, [showFloor]);

  // Ensure floor stays hidden when furniture is placed
  useEffect(() => {
    if (placedFurniture.length > 0 && showFloor) {
      setShowFloor(false);
    }
  }, [placedFurniture.length, showFloor]);

  // Camera controls for preview mode (pan, zoom, orbit)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cameraPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => !isDraggingFurniture && cameraMode === 'preview',
      onMoveShouldSetPanResponder: () => !isDraggingFurniture && cameraMode === 'preview',
      onPanResponderGrant: (evt) => {
        if (cameraMode !== 'preview') return;
        const touches = evt.nativeEvent.touches;
        if (touches.length === 1) {
          isPanningRef.current = true;
          lastPanRef.current = { x: touches[0].pageX, y: touches[0].pageY };
        } else if (touches.length === 2) {
          isZoomingRef.current = true;
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          touchStartRef.current = {
            distance,
            angle,
            touches: [{ x: touches[0].pageX, y: touches[0].pageY }, { x: touches[1].pageX, y: touches[1].pageY }]
          };
        }
      },
      onPanResponderMove: (evt) => {
        if (cameraMode !== 'preview' || !cameraRef.current) return;
        const touches = evt.nativeEvent.touches;

        if (touches.length === 1 && isPanningRef.current && lastPanRef.current) {
          // Single finger - orbit camera
          const deltaX = (touches[0].pageX - lastPanRef.current.x) * 0.01;
          const deltaY = (touches[0].pageY - lastPanRef.current.y) * 0.01;

          setCameraRotation(prev => ({
            x: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev.x - deltaY)),
            y: prev.y + deltaX,
          }));

          lastPanRef.current = { x: touches[0].pageX, y: touches[0].pageY };
        } else if (touches.length === 2 && touchStartRef.current) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const angleDelta = angle - touchStartRef.current.angle;

          // Pinch to scale furniture (if furniture is selected) - ONLY in PINCH_OR_ROTATE_TWO_FINGERS state
          // NEVER scale during single-finger drag
          if (selectedPlacedId && isARActive && gestureState === 'PINCH_OR_ROTATE_TWO_FINGERS' && !isDraggingFurniture) {
            const scaleDelta = (distance - touchStartRef.current.distance) * 0.01;
            const currentScale = furnitureScale[selectedPlacedId] || 1.0;
            const newScale = Math.max(0.5, Math.min(2.0, currentScale + scaleDelta));
            setFurnitureScale(prev => ({ ...prev, [selectedPlacedId]: newScale }));
            const furnitureEntry = furnitureMapRef.current.get(selectedPlacedId);
            if (furnitureEntry?.mesh) {
              furnitureEntry.mesh.scale.setScalar(newScale);
              // Update locked scale ref when explicitly scaling
              lockedScaleRef.current.set(selectedPlacedId, newScale);
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
          } else if (cameraMode === 'preview' && isZoomingRef.current) {
            // Two fingers - pinch to zoom camera
            const zoomDelta = (touchStartRef.current.distance - distance) * 0.01;
            setCameraZoom(prev => Math.max(0.5, Math.min(3.0, prev + zoomDelta)));
          }

          // Two-finger rotate furniture
          if (selectedPlacedId && isARActive && Math.abs(angleDelta) > 0.1) {
            isRotatingRef.current = true;
            const furnitureEntry = furnitureMapRef.current.get(selectedPlacedId);
            if (furnitureEntry?.mesh) {
              furnitureEntry.mesh.rotation.y += angleDelta;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            }
          }

          touchStartRef.current = {
            distance,
            angle,
            touches: [{ x: touches[0].pageX, y: touches[0].pageY }, { x: touches[1].pageX, y: touches[1].pageY }]
          };
        }
      },
      onPanResponderRelease: (evt) => {
        // Swipe to delete: detect left swipe gesture
        if (selectedPlacedId && isARActive && !isDraggingFurniture) {
          const touches = evt.nativeEvent.changedTouches;
          if (touches.length === 1) {
            const touch = touches[0];
            const startTouch = touchStartRef.current?.touches?.[0];
            if (startTouch) {
              const swipeDistance = touch.pageX - startTouch.x;
              const swipeSpeed = Math.abs(swipeDistance) / (evt.nativeEvent.timestamp - (evt.nativeEvent.timestamp || Date.now()));

              // Detect left swipe (swipe to delete)
              if (swipeDistance < -100 && swipeSpeed > 0.5) {
                Alert.alert(
                  'Delete Furniture',
                  'Are you sure you want to delete this furniture?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        const entry = furnitureMapRef.current.get(selectedPlacedId);
                        if (entry && rootGroupRef.current) {
                          rootGroupRef.current.remove(entry.mesh);
                          if (entry.mesh instanceof THREE.Group) {
                            disposeObjectRecursive(entry.mesh);
                          } else {
                            disposeMesh(entry.mesh);
                          }
                          furnitureMapRef.current.delete(selectedPlacedId);
                          setPlacedFurniture(prev => prev.filter(f => f.id !== selectedPlacedId));
                          setSelectedPlacedId(null);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                        }
                      }
                    }
                  ]
                );
              }
            }
          }
        }

        isPanningRef.current = false;
        isZoomingRef.current = false;
        isRotatingRef.current = false;
        lastPanRef.current = null;
        touchStartRef.current = null;
      },
    }),
    [isDraggingFurniture, cameraMode, selectedPlacedId, furnitureScale, isARActive, gestureState]
  );

  // Update camera position/rotation in preview mode
  useEffect(() => {
    if (!cameraRef.current || cameraMode !== 'preview') return;

    const camera = cameraRef.current;
    const radius = 5 * cameraZoom;
    const x = Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x) * radius;
    const y = Math.sin(cameraRotation.x) * radius + 1.6;
    const z = Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x) * radius;

    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);

  }, [cameraMode, cameraZoom, cameraRotation, cameraRef]);

  // Visual highlight for selected furniture (multi-select)
  useEffect(() => {
    if (!rootGroupRef.current) return;

    furnitureMapRef.current.forEach((entry, id) => {
      const isSelected = selectedFurnitureIds.has(id);
      const updateMeshEmissive = (mesh: THREE.Mesh | THREE.Group, hex: number, intensity: number) => {
        if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.emissive.setHex(hex);
          mesh.material.emissiveIntensity = intensity;
        } else if (mesh instanceof THREE.Group) {
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive.setHex(hex);
              child.material.emissiveIntensity = intensity;
            }
          });
        }
      };

      if (entry.mesh instanceof THREE.Mesh && entry.mesh.material instanceof THREE.MeshStandardMaterial) {
        if (isSelected) {
          // Highlight selected furniture with blue glow
          entry.mesh.material.emissive.setHex(0x3b82f6);
          entry.mesh.material.emissiveIntensity = 0.4;
        } else if (id === highlightedFurniture) {
          // Keep highlight animation for newly placed furniture
          entry.mesh.material.emissive.setHex(0xffffff);
          entry.mesh.material.emissiveIntensity = 0.5;
        } else if (id === selectedPlacedId) {
          // CRITICAL: Individual object selection highlight
          // Only THIS specific furniture item is highlighted, not groups
          entry.mesh.material.emissive.setHex(0x5ac8fa);
          entry.mesh.material.emissiveIntensity = 0.3;
          // Update individual object's selection state
          if (entry.mesh.userData) {
            entry.mesh.userData.isSelected = true;
          }
        } else {
          // Reset to normal
          const colorValue = entry.item.color || '#808080';
          const baseColor = new THREE.Color(colorValue);
          entry.mesh.material.emissive.copy(baseColor.clone().multiplyScalar(0.05));
          entry.mesh.material.emissiveIntensity = 0.05;
        }
      } else if (entry.mesh instanceof THREE.Group) {
        // Handle Group meshes
        if (isSelected) {
          updateMeshEmissive(entry.mesh, 0x3b82f6, 0.4);
        } else if (id === highlightedFurniture) {
          updateMeshEmissive(entry.mesh, 0xffffff, 0.5);
        } else if (id === selectedPlacedId) {
          updateMeshEmissive(entry.mesh, 0x5ac8fa, 0.3);
          if (entry.mesh.userData) {
            entry.mesh.userData.isSelected = true;
          }
        } else {
          const colorValue = entry.item.color || '#808080';
          const baseColor = new THREE.Color(colorValue);
          updateMeshEmissive(entry.mesh, baseColor.getHex(), 0.05);
        }
      }
    });
  }, [selectedFurnitureIds, selectedPlacedId, highlightedFurniture]);


  // Error recovery helper functions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleErrorRecovery = useCallback((
    errorInfo: ARInitError,
    onRetry: () => void
  ): void => {
    switch (errorInfo.type) {
      case 'webgl_context':
        // WebGL context recovery - attempt to recreate context
        console.log('[ARView] Attempting WebGL context recovery...');
        // If fallback mode is available, use it after max retries
        if (errorInfo.fallbackMode === 'preview') {
          const errorKey = errorInfo.type;
          const currentRetries = retryAttempts.get(errorKey) || 0;
          if (currentRetries >= errorInfo.maxRetries) {
            // Fallback to preview mode
            setIsARActive(false);
            setCameraMode('preview');
            setComponentError('AR mode unavailable. Using 2D preview mode instead.');
            Alert.alert(
              'Switched to Preview Mode',
              'AR features are currently unavailable. You can still view and arrange furniture in 2D preview mode.',
              [{ text: 'OK', style: 'default' }]
            );
            return;
          }
        }
        onRetry();
        break;

      case 'renderer_init':
        // Renderer initialization recovery
        console.log('[ARView] Attempting renderer recovery...');
        if (errorInfo.fallbackMode === 'preview') {
          const errorKey = errorInfo.type;
          const currentRetries = retryAttempts.get(errorKey) || 0;
          if (currentRetries >= errorInfo.maxRetries) {
            // Fallback to preview mode
            setIsARActive(false);
            setCameraMode('preview');
            setComponentError('AR mode unavailable. Using 2D preview mode instead.');
            Alert.alert(
              'Switched to Preview Mode',
              'AR features are currently unavailable. You can still view and arrange furniture in 2D preview mode.',
              [{ text: 'OK', style: 'default' }]
            );
            return;
          }
        }
        onRetry();
        break;

      case 'invalid_context_dimensions':
        // Context dimension recovery - wait for valid dimensions
        console.log('[ARView] Waiting for valid context dimensions...');
        // Retry after a short delay
        setTimeout(() => onRetry(), 500);
        break;

      case 'lighting_init':
        // Lighting can fail gracefully - continue without full lighting
        console.log('[ARView] Using fallback lighting configuration...');
        onRetry();
        break;

      case 'memory_limit':
        // Memory recovery - reduce quality settings
        console.log('[ARView] Reducing quality settings due to memory constraints...');
        onRetry();
        break;

      default:
        // Generic retry
        onRetry();
    }
  }, [retryAttempts]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _showErrorRecoveryOptions = useCallback((
    errorInfo: ARInitError,
    maxRetriesReached: boolean = false
  ): void => {
    const buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [];

    // Add retry button if error is retryable and max retries not reached
    if (errorInfo.retryable && !maxRetriesReached) {
      buttons.push({
        text: 'Retry',
        onPress: () => {
          // Reset retry attempts for this error type
          setRetryAttempts(prev => {
            const newMap = new Map(prev);
            newMap.delete(errorInfo.type);
            return newMap;
          });
          // Note: rendererReady and recoveryInProgress are managed internally by useARRenderer
        },
      });
    }

    // Add fallback mode button if available
    if (errorInfo.fallbackMode) {
      const fallbackText = errorInfo.fallbackMode === 'preview' ? 'Use Preview Mode' : 'Use Minimal Mode';
      buttons.push({
        text: fallbackText,
        onPress: () => {
          if (errorInfo.fallbackMode === 'preview') {
            setCameraMode('preview');
            setIsARActive(false);
            AccessibilityInfo.announceForAccessibility('Switched to preview mode');
          }
          // Note: initError and recoveryInProgress are managed internally by useARRenderer
          setComponentError(null);
        },
      });
    }

    // Add cancel button
    buttons.push({
      text: 'OK',
      style: 'cancel',
    });

    Alert.alert(
      maxRetriesReached ? 'Initialization Failed' : 'Initialization Error',
      maxRetriesReached
        ? `${errorInfo.userMessage}\n\nMax retry attempts reached. ${errorInfo.recoveryHint}`
        : `${errorInfo.userMessage}\n\n${errorInfo.recoveryHint}`,
      buttons
    );
  }, []);





  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _rotateSelectedFurniture = useCallback(
    (direction: 'left' | 'right' | number) => {
      if (!selectedPlacedId) {
        return;
      }
      const entry = furnitureMapRef.current.get(selectedPlacedId);
      if (!entry) {
        return;
      }
      const delta = typeof direction === 'number'
        ? direction
        : direction === 'left' ? Math.PI / 12 : -Math.PI / 12;
      entry.mesh.rotation.y += delta;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    },
    [selectedPlacedId],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _duplicateFurniture = useCallback(() => {
    if (!selectedPlacedId) {
      return;
    }
    const entry = furnitureMapRef.current.get(selectedPlacedId);
    if (!entry || !rootGroupRef.current) {
      return;
    }

    // Get current position and offset slightly
    if (!entry.mesh.position) return;
    const currentPos = entry.mesh.position.clone();
    const offset = new THREE.Vector3(0.3, 0, 0.3); // Offset by 30cm diagonally
    const newPosition = currentPos.clone().add(offset);
    const alignedPosition = alignToFloor(newPosition);

    const libraryItem = entry.item;
    if (!libraryItem) return;

    // Create new furniture mesh
    const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
    const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
    const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));
    const geometry = new THREE.BoxGeometry(
      libraryItem.dimensions.width,
      libraryItem.dimensions.height,
      libraryItem.dimensions.length,
      widthSegs,
      heightSegs,
      depthSegs,
    );
    const colorValue = libraryItem.color || '#808080';
    const baseColor = new THREE.Color(colorValue);
    // Validate color was created successfully
    if (!baseColor || !baseColor.isColor) {
      baseColor.setHex(0x808080);
    }
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.6,
      metalness: 0.2,
    });
    const newMesh = new THREE.Mesh(geometry, material);
    newMesh.castShadow = true;
    newMesh.receiveShadow = true;
    newMesh.position.copy(alignedPosition);
    newMesh.rotation.y = entry.mesh.rotation.y;

    const meshId = `furniture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    newMesh.userData = {
      type: 'furniture',
      id: meshId,
      libraryId: libraryItem.id,
    };

    rootGroupRef.current.add(newMesh);
    furnitureMapRef.current.set(meshId, {
      mesh: newMesh,
      item: libraryItem,
      libraryId: libraryItem.id,
    });

    const newFurniture = {
      id: meshId,
      libraryId: libraryItem.id,
      name: libraryItem.name,
      emoji: libraryItem.emoji || '',
      price: libraryItem.price,
    };

    const updatedFurniture = [...placedFurniture, newFurniture];
    saveToHistoryWithSceneCheck(updatedFurniture);
    setPlacedFurniture(updatedFurniture);
    setSelectedPlacedId(meshId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
  }, [selectedPlacedId, placedFurniture, saveToHistoryWithSceneCheck, alignToFloor]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _swapFurniture = useCallback((newLibraryId: string) => {
    if (!selectedPlacedId) {
      return;
    }
    const entry = furnitureMapRef.current.get(selectedPlacedId);
    if (!entry || !rootGroupRef.current) {
      return;
    }

    const libraryItem = furnitureLibraryById[newLibraryId];
    if (!libraryItem) {
      return;
    }

    // Store current position and rotation
    if (!entry.mesh.position) return;
    const currentPosition = entry.mesh.position.clone();
    const currentRotation = entry.mesh.rotation.y;

    // Remove old mesh
    rootGroupRef.current.remove(entry.mesh);
    if (entry.mesh instanceof THREE.Group) {
      disposeObjectRecursive(entry.mesh);
    } else {
      disposeMesh(entry.mesh);
    }

    // Create new mesh with same position/rotation
    const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
    const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
    const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));
    const geometry = new THREE.BoxGeometry(
      libraryItem.dimensions.width,
      libraryItem.dimensions.height,
      libraryItem.dimensions.length,
      widthSegs,
      heightSegs,
      depthSegs,
    );
    const colorValue = libraryItem.color || '#808080';
    const baseColor = new THREE.Color(colorValue);
    // Validate color was created successfully
    if (!baseColor || !baseColor.isColor) {
      baseColor.setHex(0x808080);
    }
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.6,
      metalness: 0.2,
    });
    const newMesh = new THREE.Mesh(geometry, material);
    newMesh.castShadow = true;
    newMesh.receiveShadow = true;
    newMesh.position.copy(currentPosition);
    newMesh.rotation.y = currentRotation;
    newMesh.userData = {
      type: 'furniture',
      id: selectedPlacedId,
      libraryId: newLibraryId,
    };

    rootGroupRef.current.add(newMesh);
    furnitureMapRef.current.set(selectedPlacedId, {
      mesh: newMesh,
      item: libraryItem,
      libraryId: newLibraryId,
    });

    // Update furniture list
    const updated = placedFurniture.map(item =>
      item.id === selectedPlacedId
        ? { ...item, libraryId: newLibraryId, name: libraryItem.name, emoji: libraryItem.emoji || '', price: libraryItem.price }
        : item
    );
    saveToHistoryWithSceneCheck(updated);
    setPlacedFurniture(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
  }, [selectedPlacedId, furnitureLibraryById, placedFurniture, saveToHistoryWithSceneCheck]);

  const nudgeSelectedFurniture = useCallback(
    (axis: 'x' | 'z', delta: number) => {
      if (!selectedPlacedId) {
        return;
      }
      const entry = furnitureMapRef.current.get(selectedPlacedId);
      if (!entry) {
        return;
      }
      entry.mesh.position[axis] += delta;
    },
    [selectedPlacedId],
  );

  // Demo Mode: Preset furniture arrangements
  const DEMO_PRESETS = [
    {
      name: 'Living Room Setup',
      description: 'Complete living room with sofa, coffee table, and accessories',
      furniture: [
        { id: 'sofa-modern', position: { x: 0, z: -1 }, rotation: 0 },
        { id: 'coffee-table', position: { x: 0, z: 0.5 }, rotation: 0 },
        { id: 'floor-lamp', position: { x: -1.5, z: -0.5 }, rotation: 0 },
        { id: 'accent-chair', position: { x: 1.2, z: -0.8 }, rotation: Math.PI / 4 },
      ],
    },
    {
      name: 'Office Setup',
      description: 'Productive workspace arrangement',
      furniture: [
        { id: 'bookshelf', position: { x: -1.5, z: -1.5 }, rotation: Math.PI / 2 },
        { id: 'accent-chair', position: { x: 0, z: 0 }, rotation: 0 },
        { id: 'planter', position: { x: 1.5, z: 1.5 }, rotation: 0 },
      ],
    },
    {
      name: 'Minimalist Setup',
      description: 'Clean and simple arrangement',
      furniture: [
        { id: 'sofa-modern', position: { x: 0, z: -1 }, rotation: 0 },
        { id: 'coffee-table', position: { x: 0, z: 0.3 }, rotation: 0 },
      ],
    },
  ];

  // Demo Mode: Guided tour steps
  const DEMO_TOUR_STEPS = [
    { title: 'Welcome to AR Interior Design', description: 'This demo will show you how to place and arrange furniture in AR space', duration: 3000 },
    { title: 'Select Furniture', description: 'Choose furniture from the library below', duration: 2000 },
    { title: 'Place in AR', description: 'Tap on the floor to place furniture in your room', duration: 2000 },
    { title: 'Drag & Rotate', description: 'Tap furniture to drag it, use rotate buttons to change orientation', duration: 2500 },
    { title: 'Safety System', description: 'Watch the safety indicator - green means safe placement', duration: 2000 },
    { title: 'Measurements', description: 'Use measurement tools to check distances and areas', duration: 2000 },
  ];

  // Start demo mode
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _startDemoMode = useCallback(() => {
    if (!roomData || !rendererReady) {
      Alert.alert('Demo Mode', 'Please wait for AR to initialize and room data to load.');
      return;
    }

    setDemoMode(true);
    _setDemoStep(0);
    _setDemoTourActive(true);

    // Clear existing furniture for clean demo
    placedFurniture.forEach(item => {
      const entry = furnitureMapRef.current.get(item.id);
      if (entry && rootGroupRef.current) {
        rootGroupRef.current.remove(entry.mesh);
        if (entry.mesh instanceof THREE.Group) {
          disposeObjectRecursive(entry.mesh);
        } else {
          disposeMesh(entry.mesh);
        }
      }
    });
    furnitureMapRef.current.clear();
    setPlacedFurniture([]);

    // Start guided tour
    let currentStep = 0;
    const showTourStep = () => {
      if (currentStep < DEMO_TOUR_STEPS.length) {
        const step = DEMO_TOUR_STEPS[currentStep];
        _setDemoStep(currentStep);
        setComponentError(null);

        // Show step message
        Alert.alert(
          step.title,
          step.description,
          [{
            text: 'Next', onPress: () => {
              currentStep++;
              if (currentStep < DEMO_TOUR_STEPS.length) {
                demoTimeoutRef.current = setTimeout(showTourStep, 500);
              } else {
                // After tour, load preset
                loadDemoPreset(0);
              }
            }
          }]
        );
      }
    };

    showTourStep();
  }, [roomData, rendererReady, placedFurniture]);

  // Load demo preset
  const loadDemoPreset = useCallback((presetIndex: number) => {
    if (presetIndex >= DEMO_PRESETS.length) {
      setDemoMode(false);
      _setDemoTourActive(false);
      return;
    }

    const preset = DEMO_PRESETS[presetIndex];
    setComponentError(null);

    // Place furniture from preset with delays for visual effect
    preset.furniture.forEach((item, index) => {
      setTimeout(() => {
        const libraryItem = furnitureLibraryById[item.id];
        if (!libraryItem || !roomData) return;

        const worldPosition = new THREE.Vector3(
          item.position.x,
          0,
          item.position.z
        );

        // Create furniture mesh
        const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
        const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
        const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));

        const geometry = new THREE.BoxGeometry(
          libraryItem.dimensions.width,
          libraryItem.dimensions.height,
          libraryItem.dimensions.length,
          widthSegs,
          heightSegs,
          depthSegs
        );

        const material = new THREE.MeshStandardMaterial({
          color: libraryItem.color,
          metalness: 0.3,
          roughness: 0.7,
          envMapIntensity: 0.5,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(
          worldPosition.x,
          worldPosition.y + libraryItem.dimensions.height / 2,
          worldPosition.z
        );
        mesh.rotation.y = item.rotation;

        if (rootGroupRef.current) {
          rootGroupRef.current.add(mesh);
        }

        const furnitureId = `demo-${item.id}-${Date.now()}-${index}`;
        furnitureMapRef.current.set(furnitureId, {
          mesh,
          item: libraryItem,
          libraryId: item.id,
        });

        const newFurniture: PlacedFurnitureMeta = {
          id: furnitureId,
          libraryId: item.id,
          name: libraryItem.name,
          emoji: libraryItem.emoji || '',
          price: libraryItem.price,
        };

        setPlacedFurniture(prev => [...prev, newFurniture]);

        // Highlight furniture with animation
        setHighlightedFurniture(furnitureId);
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedFurniture(null);
        }, CONFIG.INTERACTIVE_HIGHLIGHT_DURATION);

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      }, index * 800); // Stagger placement for visual effect
    });

    // Auto-advance to next preset after delay
    demoTimeoutRef.current = setTimeout(() => {
      if (presetIndex < DEMO_PRESETS.length - 1) {
        // Clear current preset
        placedFurniture.forEach(item => {
          const entry = furnitureMapRef.current.get(item.id);
          if (entry && rootGroupRef.current) {
            rootGroupRef.current.remove(entry.mesh);
            if (entry.mesh instanceof THREE.Group) {
              disposeObjectRecursive(entry.mesh);
            } else {
              disposeMesh(entry.mesh);
            }
          }
        });
        furnitureMapRef.current.clear();
        setPlacedFurniture([]);

        // Load next preset
        setTimeout(() => loadDemoPreset(presetIndex + 1), 1000);
      } else {
        setDemoMode(false);
        _setDemoTourActive(false);
        Alert.alert('Demo Complete', 'You can now interact with the furniture or start a new demo.');
      }
    }, preset.furniture.length * 800 + 3000);
  }, [roomData, furnitureLibraryById, placedFurniture]);

  // Stop demo mode
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _stopDemoMode = useCallback(() => {
    setDemoMode(false);
    _setDemoTourActive(false);
    _setDemoStep(0);

    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
      demoTimeoutRef.current = null;
    }
  }, []);

  // Cleanup demo on unmount
  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
      if (demoTimeoutRef.current) {
        clearTimeout(demoTimeoutRef.current);
      }
    };
  }, []);


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _undoFurniture = useCallback(() => {
    const previousState = undo();
    if (previousState) {
      // Validate and restore state to prevent corruption
      const validatedState = validateHistoryState(previousState);
      restoreFurnitureState(validatedState);
      setPlacedFurniture(validatedState);
      setSelectedPlacedId(null);
    }
  }, [undo, restoreFurnitureState, validateHistoryState]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _redoFurniture = useCallback(() => {
    const nextState = redo();
    if (nextState) {
      // Validate and restore state
      const validatedState = validateHistoryState(nextState);
      restoreFurnitureState(validatedState);
      setPlacedFurniture(validatedState);
      setSelectedPlacedId(null);
    }
  }, [redo, restoreFurnitureState, validateHistoryState]);

  // Calculate total cost of all placed furniture
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _calculateTotalCost = useCallback((): number => {
    return placedFurniture.reduce((total, item) => {
      const priceStr = item.price.replace(/[^0-9.]/g, '');
      const price = parseFloat(priceStr) || 0;
      return total + price;
    }, 0);
  }, [placedFurniture]);

  const filteredFurnitureLibrary = useMemo(
    () => getFilteredFurnitureLibrary(selectedCategory),
    [selectedCategory]
  );
  const furnitureCategories = useMemo(() => getFurnitureCategories(), []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _clearFurniture = useCallback(() => {
    resetFurnitureMeshes();
  }, [resetFurnitureMeshes]);

  // ============================================================================
  // PERSISTENCE: Save/Load/Export
  // ============================================================================

  // Save current layout
  const _saveCurrentLayout = useCallback(async (name?: string, silent: boolean = false) => {
    if (placedFurniture.length === 0 && !silent) {
      Alert.alert('No Furniture', 'Please place some furniture before saving.');
      return;
    }

    // For auto-save (silent), we still want to persist the empty state if it was cleared
    // but the layout definition expects furniture. So we allow empty furniture array.

    const layoutName = name || `Layout ${new Date().toLocaleString()}`;
    const layout: SavedLayout = {
      id: `layout-${Date.now()}`,
      name: layoutName,
      timestamp: Date.now(),
      roomData,
      furniture: Array.from(furnitureMapRef.current.entries()).map(([id, entry]) => ({
        id,
        libraryId: entry.libraryId,
        position: {
          x: entry.mesh.position.x,
          y: entry.mesh.position.y - entry.item.dimensions.height / 2,
          z: entry.mesh.position.z,
        },
        rotation: {
          x: entry.mesh.rotation.x,
          y: entry.mesh.rotation.y,
          z: entry.mesh.rotation.z,
        },
      })),
      metadata: {
        totalFurniture: interactiveStats.totalFurniture,
        totalArea: interactiveStats.totalArea,
        averageSafety: interactiveStats.averageSafety,
      },
    };

    try {
      if (!silent) {
        const savedLayouts = await getJson<SavedLayout[]>(AR_VIEW_LAYOUT_STORAGE_KEY, []);
        savedLayouts.push(layout);
        // Keep only last 20 layouts
        const recentLayouts = savedLayouts.slice(-20);
        await setJson(AR_VIEW_LAYOUT_STORAGE_KEY, recentLayouts);
      }

      await setJson(AR_VIEW_CURRENT_LAYOUT_KEY, layout);

      if (!silent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        Alert.alert('Saved', `Layout "${layoutName}" has been saved successfully.`);
      }
    } catch (error) {
      console.error('[ARView] Save error:', error);
      if (!silent) Alert.alert('Save Failed', 'Unable to save layout. Please try again.');
    }
  }, [placedFurniture, roomData, interactiveStats]);

  // Load saved layout
  const _loadSavedLayout = useCallback(async (layout: SavedLayout, silent: boolean = false) => {
    if (!rootGroupRef.current || !roomData) {
      if (!silent) Alert.alert('Error', 'AR must be initialized before loading a layout.');
      return;
    }

    // Clear existing furniture
    resetFurnitureMeshes();
    setPlacedFurniture([]);
    setSelectedPlacedId(null);
    setSelectedFurnitureIds(new Set());

    // Load furniture from layout
    const loadedFurniture: PlacedFurnitureMeta[] = [];

    for (const item of layout.furniture) {
      const libraryItem = furnitureLibraryById[item.libraryId];
      if (!libraryItem) continue;

      const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
      const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
      const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));

      const geometry = new THREE.BoxGeometry(
        libraryItem.dimensions.width,
        libraryItem.dimensions.height,
        libraryItem.dimensions.length,
        widthSegs,
        heightSegs,
        depthSegs
      );

      const colorValue = libraryItem.color || '#808080';
      const baseColor = new THREE.Color(colorValue);
      // Validate color was created successfully
      if (!baseColor || !baseColor.isColor) {
        baseColor.setHex(0x808080);
      }
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.6,
        metalness: 0.2,
        envMapIntensity: 0.5,
        emissive: baseColor.clone().multiplyScalar(0.05),
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(
        item.position.x,
        item.position.y + libraryItem.dimensions.height / 2,
        item.position.z
      );
      mesh.rotation.set(
        item.rotation.x || 0,
        item.rotation.y || 0,
        item.rotation.z || 0
      );
      mesh.userData = {
        type: 'furniture',
        id: item.id,
        libraryId: item.libraryId,
      };

      rootGroupRef.current.add(mesh);
      furnitureMapRef.current.set(item.id, {
        mesh,
        item: libraryItem,
        libraryId: item.libraryId,
      });

      loadedFurniture.push({
        id: item.id,
        libraryId: item.libraryId,
        name: libraryItem.name,
        emoji: libraryItem.emoji || '',
        price: libraryItem.price,
      });
    }

    setPlacedFurniture(loadedFurniture);
    if (layout.metadata) {
      setInteractiveStats({
        totalFurniture: layout.metadata.totalFurniture,
        totalArea: layout.metadata.totalArea,
        averageSafety: layout.metadata.averageSafety,
        placementCount: layout.metadata.totalFurniture,
      });
    }

    if (!silent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      Alert.alert('Loaded', `Layout "${layout.name}" has been loaded successfully.`);
    }
  }, [roomData, furnitureLibraryById, resetFurnitureMeshes]);

  // Export layout as JSON
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _exportLayout = useCallback(async () => {
    if (placedFurniture.length === 0) {
      Alert.alert('No Furniture', 'Please place some furniture before exporting.');
      return;
    }

    const exportData: SavedLayout = {
      id: `export-${Date.now()}`,
      name: `Exported Layout ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      roomData,
      furniture: Array.from(furnitureMapRef.current.entries()).map(([id, entry]) => ({
        id,
        libraryId: entry.libraryId,
        position: {
          x: entry.mesh.position.x,
          y: entry.mesh.position.y - entry.item.dimensions.height / 2,
          z: entry.mesh.position.z,
        },
        rotation: {
          x: entry.mesh.rotation.x,
          y: entry.mesh.rotation.y,
          z: entry.mesh.rotation.z,
        },
      })),
      metadata: {
        totalFurniture: interactiveStats.totalFurniture,
        totalArea: interactiveStats.totalArea,
        averageSafety: interactiveStats.averageSafety,
      },
    };

    try {
      const jsonString = JSON.stringify(exportData, null, 2);

      if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        // Web: Download as file (only if running in web environment)
        try {
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ar-layout-${Date.now()}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('[ARView] Web export failed, falling back to share:', error);
          // Fall through to Share API
        }
      }

      // Mobile or web fallback: Use Share API
      if (Platform.OS !== 'web' || (Platform.OS === 'web' && typeof Share !== 'undefined')) {
        await Share.share({
          message: jsonString,
          title: 'AR Layout Export',
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    } catch (error) {
      console.error('[ARView] Export error:', error);
      Alert.alert('Export Failed', 'Unable to export layout. Please try again.');
    }
  }, [placedFurniture, roomData, interactiveStats]);

  // ============================================================================
  // MULTI-SELECT FUNCTIONALITY
  // ============================================================================

  // Toggle furniture selection

  // Select all furniture
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _selectAllFurniture = useCallback(() => {
    const allIds = new Set(placedFurniture.map(f => f.id));
    setSelectedFurnitureIds(allIds);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
  }, [placedFurniture]);

  // Clear selection
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _clearSelection = useCallback(() => {
    setSelectedFurnitureIds(new Set());
    setSelectedPlacedId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  }, []);

  // Delete selected furniture
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _deleteSelectedFurniture = useCallback(() => {
    if (selectedFurnitureIds.size === 0) {
      Alert.alert('No Selection', 'Please select furniture to delete.');
      return;
    }

    Alert.alert(
      'Delete Furniture',
      `Delete ${selectedFurnitureIds.size} furniture item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedFurnitureIds.forEach(id => {
              removeFurniture(id);
            });
            setSelectedFurnitureIds(new Set());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
          },
        },
      ]
    );
  }, [selectedFurnitureIds, removeFurniture]);

  // ============================================================================
  // FURNITURE GROUPING FUNCTIONALITY
  // ============================================================================

  /**
   * Calculate the center position of multiple furniture items
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _calculateGroupCenter = useCallback((furnitureIds: string[]): THREE.Vector3 => {
    const positions: THREE.Vector3[] = [];
    furnitureIds.forEach(id => {
      const entry = furnitureMapRef.current.get(id);
      if (entry && entry.mesh && entry.mesh.position) {
        positions.push(entry.mesh.position.clone());
      }
    });

    if (positions.length === 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    const center = new THREE.Vector3();
    positions.forEach(pos => center.add(pos));
    center.divideScalar(positions.length);
    return center;
  }, []);

  /**
   * DISABLED: Create a group from selected furniture
   * All furniture is now treated as individual items - no grouping
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _createFurnitureGroup = useCallback(() => {
    // GROUP FUNCTIONALITY DISABLED - All furniture is individual
    Alert.alert(
      'Group Disabled',
      'All furniture items are now individual. Group selection has been removed.',
      [{ text: 'OK' }]
    );
    return;
    // ALL GROUP CODE BELOW IS DISABLED - Function returns early above
  }, [selectedFurnitureIds]);

  /**
   * DISABLED: Ungroup selected group
   * All furniture is now treated as individual items - no grouping
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ungroupFurniture = useCallback((groupId: string) => {
    // UNGROUP FUNCTIONALITY DISABLED - All furniture is already individual
    console.warn('[ARView] Ungroup functionality is disabled. All furniture is individual.');
    return;
    // DISABLED CODE - Group functionality removed
    /*
    const group = furnitureGroups.get(groupId);
    if (!group) {
      console.warn(`[ARView] Group ${groupId} not found for ungrouping`);
      return;
    }
    
    // Remove groupId from furniture metadata
    setPlacedFurniture(prev => prev.map(item => 
      group.furnitureIds.includes(item.id)
        ? { ...item, groupId: undefined }
        : item
    ));
    
    // Remove group
    setFurnitureGroups(prev => {
      const newMap = new Map(prev);
      newMap.delete(groupId);
      return newMap;
    });
    
    // Clear selected group
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
    
    // Save to history
    const updatedFurniture = placedFurniture.map(item => 
      group.furnitureIds.includes(item.id)
        ? { ...item, groupId: undefined }
        : item
    );
    saveToHistoryWithSceneCheck(updatedFurniture);
    
    // Screen reader announcement
    AccessibilityInfo.announceForAccessibility(
      `Ungrouped ${group.furnitureIds.length} furniture items`
    );
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    */
  }, []);

  /**
   * Get furniture items in a group
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _getGroupFurniture = useCallback((groupId: string): FurnitureMapEntry[] => {
    // GROUP FUNCTIONALITY DISABLED - All furniture is individual
    // Return empty array since there are no groups
    return [];
    // DISABLED CODE:
    /*
    const group = furnitureGroups.get(groupId);
    if (!group) return [];
    
    return group.furnitureIds
      .map(id => furnitureMapRef.current.get(id))
      .filter((entry): entry is FurnitureMapEntry => entry !== undefined);
    */
  }, []);

  /**
   * Move group as a unit
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _moveGroup = useCallback((groupId: string, deltaPosition: THREE.Vector3) => {
    // GROUP FUNCTIONALITY DISABLED - All furniture is individual
    console.warn('[ARView] Move group functionality is disabled. All furniture is individual.');
    return;
    // DISABLED CODE:
    /*
    const groupFurniture = getGroupFurniture(groupId);
    if (groupFurniture.length === 0) return;
    
    groupFurniture.forEach(entry => {
      entry.mesh.position.add(deltaPosition);
    });
    
    // DISABLED CODE - All group functionality removed
    /*
    // Update group center
    setFurnitureGroups(prev => {
      const group = prev.get(groupId);
      if (!group) return prev;
      
      const newMap = new Map(prev);
      newMap.set(groupId, {
        ...group,
        centerPosition: group.centerPosition.clone().add(deltaPosition),
      });
      return newMap;
    });
    */
  }, []);

  /**
   * Rotate group as a unit around its center
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _rotateGroup = useCallback((groupId: string, rotationAngle: number) => {
    // GROUP FUNCTIONALITY DISABLED - All furniture is individual
    console.warn('[ARView] Rotate group functionality is disabled. All furniture is individual.');
    return;
    // DISABLED CODE - All group functionality removed
    /*
    groupFurniture.forEach(entry => {
      // Calculate relative position to group center
      if (!entry.mesh.position || !group.centerPosition) continue;
      const relativePos = entry.mesh.position.clone().sub(group.centerPosition);
      
      // Rotate relative position
      const rotatedPos = new THREE.Vector3();
      rotatedPos.x = relativePos.x * Math.cos(rotationAngle) - relativePos.z * Math.sin(rotationAngle);
      rotatedPos.z = relativePos.x * Math.sin(rotationAngle) + relativePos.z * Math.cos(rotationAngle);
      rotatedPos.y = relativePos.y;
      
      // Update position
      entry.mesh.position.copy(group.centerPosition.clone().add(rotatedPos));
      
      // Also rotate the furniture itself
      entry.mesh.rotation.y += rotationAngle;
    });
    */
  }, []);

  // Move selected furniture group
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _moveSelectedFurniture = useCallback((delta: { x: number; z: number }) => {
    if (selectedFurnitureIds.size === 0) return;

    selectedFurnitureIds.forEach(id => {
      const entry = furnitureMapRef.current.get(id);
      if (entry) {
        entry.mesh.position.x += delta.x;
        entry.mesh.position.z += delta.z;
      }
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  }, [selectedFurnitureIds]);

  // Rotate selected furniture group
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _rotateSelectedFurnitureGroup = useCallback((delta: number) => {
    if (selectedFurnitureIds.size === 0) return;

    // Calculate center of selected group
    let centerX = 0;
    let centerZ = 0;
    let count = 0;

    selectedFurnitureIds.forEach(id => {
      const entry = furnitureMapRef.current.get(id);
      if (entry) {
        centerX += entry.mesh.position.x;
        centerZ += entry.mesh.position.z;
        count++;
      }
    });

    if (count === 0) return;

    centerX /= count;
    centerZ /= count;

    // Rotate each furniture around center
    selectedFurnitureIds.forEach(id => {
      const entry = furnitureMapRef.current.get(id);
      if (entry) {
        const dx = entry.mesh.position.x - centerX;
        const dz = entry.mesh.position.z - centerZ;
        const angle = Math.atan2(dz, dx) + delta;
        const distance = Math.sqrt(dx * dx + dz * dz);

        entry.mesh.position.x = centerX + Math.cos(angle) * distance;
        entry.mesh.position.z = centerZ + Math.sin(angle) * distance;
        entry.mesh.rotation.y += delta;
      }
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  }, [selectedFurnitureIds]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleAnchorRecentering = useCallback(() => {
    if (!reticleWorldPositionRef.current) {
      return;
    }
    const point = reticleWorldPositionRef.current;
    arAnchorManager.setManualAnchor(
      { x: point.x, y: point.y, z: point.z },
      [0, 0, 0, 1],
    );
    setAnchorStatus(arAnchorManager.getStatus());
  }, []);

  const handleMarkerScanned = useCallback((result: any) => {
    if (!markerTrackingEnabled) return;
    if (!rendererReady) return;
    if (!cameraRef.current) return;
    if (!raycasterRef.current || !floorPlaneRef.current) return;

    const now = Date.now();
    if (now - lastMarkerUpdateRef.current < 250) return; // throttle

    const { width, height } = glLayoutRef.current;
    if (width === 0 || height === 0) return;

    // Expo camera barcode scan shape varies by platform.
    // Try cornerPoints first, then bounds.
    let centerX: number | null = null;
    let centerY: number | null = null;

    const cornerPoints = result?.cornerPoints;
    if (Array.isArray(cornerPoints) && cornerPoints.length > 0) {
      const sum = cornerPoints.reduce(
        (acc: { x: number; y: number }, p: any) => ({
          x: acc.x + (p?.x ?? 0),
          y: acc.y + (p?.y ?? 0),
        }),
        { x: 0, y: 0 }
      );
      centerX = sum.x / cornerPoints.length;
      centerY = sum.y / cornerPoints.length;
    } else if (result?.bounds?.origin && result?.bounds?.size) {
      const { origin, size } = result.bounds;
      centerX = (origin?.x ?? 0) + (size?.width ?? 0) / 2;
      centerY = (origin?.y ?? 0) + (size?.height ?? 0) / 2;
    }

    if (centerX === null || centerY === null) return;

    // Only accept QR scans (defensive)
    if (result?.type && result.type !== 'qr') return;

    const screenPointToFloor = (x: number, y: number): THREE.Vector3 | null => {
      const ndc = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
      raycasterRef.current!.setFromCamera(ndc, cameraRef.current!);
      const p = new THREE.Vector3();
      const ok = raycasterRef.current!.ray.intersectPlane(floorPlaneRef.current!, p);
      return ok ? p : null;
    };

    const intersection = screenPointToFloor(centerX, centerY);
    if (!intersection) return;

    lastMarkerUpdateRef.current = now;
    const payload = typeof result?.data === 'string' ? result.data : null;
    setLastMarkerPayload(payload);
    setMarkerLastSeenAt(now);

    const alignedCenter = alignToFloor(intersection);

    // --- Pose estimation from corner points projected onto the floor ---
    // This is NOT full 6DOF, but gives usable yaw + scale calibration on a flat floor.
    let yaw = markerYawRef.current;
    let scale = markerScaleRef.current;

    type ScreenPt = { x: number; y: number };
    const cornerPointsForPose: { x: number; y: number }[] | null =
      Array.isArray(cornerPoints) && cornerPoints.length >= 4
        ? cornerPoints.map((p: any) => ({ x: p?.x ?? 0, y: p?.y ?? 0 }))
        : null;

    if (cornerPointsForPose) {
      // Normalize corners into TL, TR, BL, BR by screen-space sorting
      const pts: ScreenPt[] = cornerPointsForPose.slice(0, 4);
      pts.sort((a: ScreenPt, b: ScreenPt) => (a.y - b.y) || (a.x - b.x)); // top to bottom
      const top2 = pts.slice(0, 2).sort((a: ScreenPt, b: ScreenPt) => a.x - b.x);
      const bot2 = pts.slice(2, 4).sort((a: ScreenPt, b: ScreenPt) => a.x - b.x);
      const tl = top2[0];
      const tr = top2[1];
      const bl = bot2[0];
      const br = bot2[1];

      const wTL = screenPointToFloor(tl.x, tl.y);
      const wTR = screenPointToFloor(tr.x, tr.y);
      const wBL = screenPointToFloor(bl.x, bl.y);
      const wBR = screenPointToFloor(br.x, br.y);

      if (wTL && wTR && wBL && wBR) {
        const vTop = wTR.clone().sub(wTL);
        // yaw around Y axis from direction of top edge on the floor
        const rawYaw = Math.atan2(vTop.z, vTop.x);

        // marker size measured in "world meters" on our floor plane
        const wWidth = wTR.distanceTo(wTL);
        const wHeight = wBL.distanceTo(wTL);
        const measured = Math.max(0.0001, (wWidth + wHeight) / 2);

        // expected marker size in meters: default 0.20m, or allow QR payload like "size=0.15"
        let expected = 0.2;
        if (payload) {
          const m = payload.match(/size\s*=\s*(\d+(\.\d+)?)/i);
          if (m && m[1]) {
            const parsed = Number(m[1]);
            if (Number.isFinite(parsed) && parsed > 0.02 && parsed < 2) expected = parsed;
          }
        }

        const rawScale = Math.max(0.25, Math.min(4, expected / measured));

        // Smooth yaw (shortest angle) + scale
        const SMOOTH = 0.25;
        const delta = Math.atan2(Math.sin(rawYaw - yaw), Math.cos(rawYaw - yaw));
        yaw = yaw + delta * SMOOTH;
        scale = scale + (rawScale - scale) * SMOOTH;

        markerYawRef.current = yaw;
        markerScaleRef.current = scale;
      }
    }

    // Build anchor quaternion (yaw-only)
    const qy = Math.sin(yaw / 2);
    const qw = Math.cos(yaw / 2);
    const quat: [number, number, number, number] = [0, qy, 0, qw];

    // Anchor offset chosen so marker center maps to world origin after rotation+scale:
    // world = anchorPos + R * (local * scale), so anchorPos = -R*(center*scale)
    const rotatedScaledCenter = alignedCenter
      .clone()
      .multiplyScalar(scale)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const rawOffset = rotatedScaledCenter.multiplyScalar(-1);

    // Smooth offset updates to reduce jitter while the marker is in view
    const SMOOTHING = 0.25;
    if (!markerAnchorOffsetRef.current) {
      markerAnchorOffsetRef.current = rawOffset.clone();
    } else {
      markerAnchorOffsetRef.current.lerp(rawOffset, SMOOTHING);
    }

    arAnchorManager.setMarkerAnchor(vector3ToSpatial(markerAnchorOffsetRef.current), quat, scale);
    setAnchorStatus(arAnchorManager.getStatus());
  }, [markerTrackingEnabled, rendererReady]);

  const handleToggleAR = useCallback(() => {
    if (!permission?.granted) {
      requestPermission().catch((error) => {
        console.error('[ARView] Permission request error:', error);
        setComponentError(AR_VIEW_ERROR_MESSAGES.CAMERA_PERMISSION_DENIED);
        setArUnavailable(true);

        // Screen reader announcement
        AccessibilityInfo.announceForAccessibility(
          'Camera permission required for AR features. Please grant permission to continue.'
        );

        Alert.alert(
          'Camera Permission Required',
          AR_VIEW_ERROR_MESSAGES.CAMERA_PERMISSION_DENIED,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Retry',
              onPress: () => {
                requestPermission().then((result) => {
                  if (result.granted) {
                    setArUnavailable(false);
                    setIsARActive(true);
                    AccessibilityInfo.announceForAccessibility('AR mode activated');
                  }
                }).catch(() => { });
              },
            },
          ]
        );
      });
      return;
    }

    setIsARActive((prev) => {
      const next = !prev;
      if (!next) {
        // Reset states when turning AR off
        setArUnavailable(false);
        setRetryCount(0);
      }
      if (next) {
        try {
          const status = arAnchorManager.getStatus();
          setAnchorStatus(status);

          // Graceful degradation: Check if AR is actually available
          // Only show warning after multiple retries and if not dismissed
          if (status.quality === 'poor' && retryCount < 3) {
            const currentRetry = retryCount;
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              // Retry anchor initialization
              try {
                const newStatus = arAnchorManager.getStatus();
                // Only show alert after 2+ retries and if not dismissed
                if (newStatus.quality === 'poor' && currentRetry >= 1 && !arLimitedDismissed) {
                  setArUnavailable(true);
                  Alert.alert(
                    'AR Limited',
                    'AR tracking quality is poor. Some features may be limited. You can continue in preview mode.',
                    [
                      {
                        text: 'Use Preview Mode', onPress: () => {
                          setCameraMode('preview');
                          setArLimitedDismissed(true);
                        }
                      },
                      {
                        text: 'Continue Anyway', onPress: () => {
                          setArUnavailable(false);
                          setArLimitedDismissed(true);
                        }
                      },
                    ]
                  );
                  AccessibilityInfo.announceForAccessibility(
                    'AR tracking quality is limited. Preview mode available as alternative.'
                  );
                } else if (newStatus.quality !== 'poor') {
                  setArUnavailable(false);
                  setArLimitedDismissed(false); // Reset if quality improves
                }
              } catch (error) {
                console.error('[ARView] Retry error:', error);
                // Don't set arUnavailable on error, let it continue
              }
            }, 1000);
          } else if (status.quality !== 'poor') {
            // Reset dismissed state if quality improves
            setArUnavailable(false);
            setArLimitedDismissed(false);
          }

          // Screen reader announcement
          AccessibilityInfo.announceForAccessibility(
            next ? 'AR mode activated' : 'AR mode deactivated'
          );
        } catch (error) {
          console.error('[ARView] Error getting anchor status:', error);
          setComponentError(AR_VIEW_ERROR_MESSAGES.ANCHOR_ERROR);
          setArUnavailable(true);

          // Fallback to preview mode
          Alert.alert(
            'AR Unavailable',
            'AR features are not available. Would you like to use preview mode instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Use Preview Mode',
                onPress: () => {
                  setCameraMode('preview');
                  setIsARActive(false);
                  AccessibilityInfo.announceForAccessibility('Switched to preview mode');
                },
              },
            ]
          );
        }
      } else if (reticleRef.current) {
        reticleRef.current.visible = false;
        AccessibilityInfo.announceForAccessibility('AR mode deactivated');
      }
      return next;
    });
  }, [permission?.granted, requestPermission, retryCount]);

  /**
   * Graceful degradation: Fall back to 2D preview mode when AR fails
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _fallbackToPreviewMode = useCallback(() => {
    console.log('[ARView] Falling back to 2D preview mode...');
    setIsARActive(false);
    setCameraMode('preview');
    setComponentError('AR mode unavailable. Using 2D preview mode instead.');

    // Show user-friendly notification
    Alert.alert(
      'Switched to Preview Mode',
      'AR features are currently unavailable. You can still view and arrange furniture in 2D preview mode.',
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Try AR Again',
          onPress: () => {
            setComponentError(null);
            handleToggleAR();
          }
        }
      ]
    );
  }, [handleToggleAR]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _selectedFurnitureDetails = useMemo(() => {
    if (!selectedPlacedId) {
      return null;
    }
    const entry = furnitureMapRef.current.get(selectedPlacedId);
    if (!entry) {
      return null;
    }
    return entry.item;
  }, [selectedPlacedId]);


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _obstructionCount = roomData?.obstacles.length ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _canRecentre = Boolean(reticleWorldPositionRef.current);

  const {
    bottomSheetHeight,
    bottomSheetOpacity,
    bottomSheetPanResponder,
    collapsedHeight,
    maxPanelHeight,
    measuredContentHeight,
    setMeasuredContentHeight,
  } = useARViewBottomSheet({
    libraryPanelVisible,
    setLibraryPanelVisible,
  });

  // AUTO-PERSISTENCE: Auto-load last saved layout
  useEffect(() => {
    const autoLoad = async () => {
      if (rendererReady && rootGroupRef.current && roomData && !isInitializing) {
        try {
          const lastLayout = await getJson<SavedLayout | null>(AR_VIEW_CURRENT_LAYOUT_KEY, null);
          if (lastLayout && lastLayout.furniture && lastLayout.furniture.length > 0) {
            console.log('[ARView] Auto-loading last session furniture...');
            await _loadSavedLayout(lastLayout, true);
            AccessibilityInfo.announceForAccessibility(`Restored ${lastLayout.furniture.length} items from your previous session.`);
          }

          // Ensure interaction states are clean after load
          setIsDraggingFurniture(false);
          setDraggedFurnitureId(null);
          setIsRotatingFurniture(false);
          setGestureState('IDLE');
        } catch (error) {
          console.error('[ARView] Auto-load error:', error);
        }
      }
    };
    autoLoad();
  }, [rendererReady, rootGroupRef.current, roomData, isInitializing, _loadSavedLayout]);

  // AUTO-PERSISTENCE: Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      _saveCurrentLayout(undefined, true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [placedFurniture, _saveCurrentLayout]);

  return (
    <View
      style={styles.container}
      accessibilityLabel={isARActive ? "AR view with furniture placement" : "AR view inactive"}
    >
      <StatusBar style="light" />
      {permission && !permission.granted ? (
        <ARViewPermissionGate onRequestPermission={requestPermission} />
      ) : (
        <>
          <View style={styles.cameraWrapper}>
            <ARViewViewport
              isARActive={isARActive}
              markerTrackingEnabled={markerTrackingEnabled}
              onMarkerScanned={handleMarkerScanned}
              onCanvasLayout={handleCanvasLayout}
              onContextCreate={onContextCreate}
              onResponderGrant={handleScenePan}
              onResponderMove={handleScenePan}
              onResponderRelease={(event) => {
                setGestureState('IDLE');
                if (isRotatingFurniture) {
                  setIsRotatingFurniture(false);
                  setRotationStartAngle(null);
                  setRotationStartTouchAngle(null);
                  twoFingerStartRef.current = null;
                }
                handleSceneTap(event);
              }}
            />
            {!isARActive && (
              <>
                <View style={styles.placeholderView}>
                  <View style={styles.placeholderIconContainer}>
                    <Ionicons name="cube" size={80} color={colors.accent} />
                  </View>
                  <Text style={styles.placeholderTitle}>AR Studio</Text>
                  <Text style={styles.placeholderText}>
                    {cameraMode === 'preview'
                      ? 'Preview Mode: Use gestures to orbit, pan, and zoom'
                      : 'Activate AR to project your generated layouts into real space.'}
                  </Text>
                </View>
                {rendererReady && (
                  <View style={styles.previewModeControls}>
                    <TouchableOpacity
                      style={[styles.previewModeButton, cameraMode === 'preview' && styles.previewModeButtonActive]}
                      onPress={() => {
                        const newMode = cameraMode === 'preview' ? 'ar' : 'preview';
                        setCameraMode(newMode);
                        if (cameraMode === 'ar') {
                          // Reset camera for preview mode
                          setCameraZoom(1.0);
                          setCameraRotation({ x: 0.5, y: 0 });
                        }
                        AccessibilityInfo.announceForAccessibility(
                          `Switched to ${newMode === 'preview' ? 'preview' : 'AR'} mode`
                        );
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={cameraMode === 'preview' ? 'Switch to AR mode' : 'Switch to preview mode'}
                      accessibilityState={{ selected: cameraMode === 'preview' }}
                    >
                      <Ionicons
                        name={cameraMode === 'preview' ? 'phone-portrait' : 'cube'}
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.previewModeButtonText}>
                        {cameraMode === 'preview' ? 'Preview Mode' : 'AR Mode'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <View style={styles.topControls}>
              <AnimatedButton
                style={styles.backButton}
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    // Fallback to home/index if no previous screen
                    router.replace('/(tabs)');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hapticType="light"
              >
                <Ionicons name="arrow-back" size={20} color={colors.accent} />
                <Text style={styles.backButtonText}>Back</Text>
              </AnimatedButton>

              {/* Error Banner */}
              {(rendererError || componentError) && (
                <View style={styles.errorBanner}>
                  <View style={styles.errorBannerContent}>
                    <Ionicons name="warning" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.errorText}>{rendererError || componentError}</Text>
                  </View>
                  <View style={styles.errorActions}>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => {
                        setComponentError(null);
                        setRetryCount(prev => prev + 1);
                        // Retry last operation based on context
                        if (isPlacingFurniture && selectedLibraryItem) {
                          // Retry furniture placement
                          const retryPosition = reticleWorldPositionRef.current || new THREE.Vector3(0, 0, 0);
                          addFurnitureToScene(retryPosition);
                        } else if (isARActive) {
                          // Retry AR initialization
                          handleToggleAR();
                          setTimeout(() => handleToggleAR(), 500);
                        }
                        AccessibilityInfo.announceForAccessibility('Retrying operation');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Retry operation"
                    >
                      <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                    {arUnavailable && (
                      <TouchableOpacity
                        style={styles.fallbackButton}
                        onPress={() => {
                          setCameraMode('preview');
                          setIsARActive(false);
                          setComponentError(null);
                          AccessibilityInfo.announceForAccessibility('Switched to preview mode as fallback');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Use preview mode"
                      >
                        <Ionicons name="phone-portrait" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.fallbackButtonText}>Preview Mode</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* AR Unavailable Fallback - Only show if not dismissed */}
              {arUnavailable && !componentError && !arLimitedDismissed && (
                <View style={styles.fallbackBanner}>
                  <TouchableOpacity
                    style={styles.fallbackDismissButton}
                    onPress={() => {
                      setArLimitedDismissed(true);
                      setArUnavailable(false);
                    }}
                    accessibilityLabel="Dismiss warning"
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={styles.fallbackContent}>
                    <Ionicons name="information-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.fallbackText}>
                      AR features limited. Preview mode available.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.fallbackButton}
                    onPress={() => {
                      setCameraMode('preview');
                      setArUnavailable(false);
                      setArLimitedDismissed(true);
                      AccessibilityInfo.announceForAccessibility('Preview mode activated');
                    }}
                  >
                    <Ionicons name="phone-portrait" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.fallbackButtonText}>Switch to Preview</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Loading Indicator with Skeleton */}
              {isInitializing && !rendererReady ? (
                <ARViewSkeleton />
              ) : isInitializing ? (
                <View style={styles.loadingIndicator} accessibilityLabel="Initializing AR view">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.loadingTextPrimary} accessibilityLiveRegion="polite">
                    Initializing...
                  </Text>
                </View>
              ) : null}



            </View>

            {/* Anchor Status Badge - Auto-hides after surface detection, subtle when furniture is placed */}
            {isARActive && (!anchorStatus.hasLock || !statusMessageDismissed) && (
              <View
                style={[
                  styles.anchorStatusBadge,
                  anchorStatus.quality === 'good'
                    ? styles.anchorStatusGood
                    : anchorStatus.quality === 'medium'
                      ? styles.anchorStatusMedium
                      : styles.anchorStatusPoor,
                  // Reduce opacity and size when furniture is placed
                  placedFurniture.length > 0 && styles.anchorStatusSubtle,
                  // Move to corner when furniture is placed
                  placedFurniture.length > 0 && styles.anchorStatusCorner,
                ]}
              >
                <Text style={[
                  styles.anchorStatusTitle,
                  placedFurniture.length > 0 && styles.anchorStatusTitleSmall
                ]}>
                  {anchorStatus.hasLock
                    ? anchorStatus.quality === 'good'
                      ? 'Anchor locked'
                      : 'Anchor stabilizing'
                    : 'Searching for surface'}
                </Text>
                {(!placedFurniture.length || !statusMessageDismissed) && (
                  <Text style={[
                    styles.anchorStatusSubtitle,
                    placedFurniture.length > 0 && styles.anchorStatusSubtitleSmall
                  ]}>
                    {anchorStatus.anchor
                      ? `confidence ${(Math.min(1, anchorStatus.anchor.confidence) * 100).toFixed(0)}%`
                      : anchorStatus.hints[0] ?? 'Move device slowly'}
                  </Text>
                )}
              </View>
            )}

            {/* Subtle corner indicator when status is dismissed but surface is detected */}
            {isARActive && anchorStatus.hasLock && statusMessageDismissed && (
              <View style={styles.cornerStatusIndicator}>
                <View style={[
                  styles.cornerStatusDot,
                  anchorStatus.quality === 'good' && styles.cornerStatusDotGood,
                  anchorStatus.quality === 'medium' && styles.cornerStatusDotMedium,
                  anchorStatus.quality === 'poor' && styles.cornerStatusDotPoor,
                ]} />
              </View>
            )}

            {/* Simple Placement Safety Indicator */}
            {showPlacementHint && isARActive && selectedLibraryItem && !isPlacingFurniture && placementSafety.safetyLevel === 'danger' && (
              <View
                style={styles.safetyIndicatorUnsafe}
                accessibilityRole="alert"
              >
                <Ionicons name="close-circle" size={24} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={styles.safetyIndicatorTitle}>Cannot place here</Text>
              </View>
            )}

            {/* Gesture Instructions */}
            {isDraggingFurniture && draggedFurnitureId && (
              <View style={[styles.dragIndicator, styles.dragIndicatorSubtle]}>
                <Ionicons name="move" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.dragIndicatorText}>Move to reposition</Text>
              </View>
            )}
            {isRotatingFurniture && selectedPlacedId && (
              <View style={[styles.dragIndicator, styles.dragIndicatorSubtle]}>
                <Ionicons name="sync" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.dragIndicatorText}>Rotating object</Text>
              </View>
            )}
            {!isDraggingFurniture && !isRotatingFurniture && selectedPlacedId && isARActive && (
              <View style={[styles.dragIndicator, styles.dragIndicatorSubtle]}>
                <Ionicons name="hand-left" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.dragIndicatorText}>One finger to move, two fingers to rotate</Text>
              </View>
            )}




            {/* Simple Placement Hint */}
            {showPlacementHint && isARActive && selectedLibraryItem && (
              <View style={styles.placementHint}>
                {isPlacingFurniture ? (
                  <View style={styles.placingIndicator}>
                    <ActivityIndicator size="small" color="#6B4CE6" />
                    <Text style={styles.placingText}>Placing...</Text>
                  </View>
                ) : (
                  <View style={styles.hintContent}>
                    <Ionicons name="hand-left-outline" size={20} color="#4C1D95" style={{ marginRight: 8 }} />
                    <Text style={styles.hintTitle}>Tap to place furniture</Text>
                  </View>
                )}
              </View>
            )}


          </View>

          {/* Bottom Sheet Modal - Always visible with peek area */}
          <View
            style={styles.bottomSheetOverlay}
            pointerEvents="box-none"
          >
            {/* Backdrop - Only visible when expanded */}
            {libraryPanelVisible && (
              <Animated.View
                style={[
                  styles.bottomSheetBackdrop,
                  {
                    opacity: bottomSheetOpacity,
                  },
                ]}
              >
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setLibraryPanelVisible(false)}
                />
              </Animated.View>
            )}

            {/* Bottom Sheet Content */}
            <Animated.View
              style={[
                styles.bottomSheetContainer,
                {
                  height: bottomSheetHeight,
                  maxHeight: maxPanelHeight,
                  paddingTop: libraryPanelVisible ? 12 : 16,
                  paddingBottom: libraryPanelVisible ? 20 : 0,
                },
              ]}
              {...bottomSheetPanResponder.panHandlers}
            >
              {/* Draggable Handle - Only show when expanded */}
              {libraryPanelVisible && (
                <View style={styles.panelDragHandle}>
                  <View style={styles.dragHandleBar} />
                </View>
              )}

              {/* Title - Always visible, this is what peeks when collapsed */}
              <TouchableOpacity
                style={styles.panelTitleContainer}
                onPress={() => {
                  if (!libraryPanelVisible) {
                    setLibraryPanelVisible(true);
                  }
                }}
                activeOpacity={0.7}
                delayPressIn={100}
              >
                <Text style={styles.panelTitle}>AR Furniture Library</Text>
              </TouchableOpacity>

              {libraryPanelVisible && (
                <View
                  style={styles.panelScrollContent}
                  onLayout={(event) => {
                    const { height } = event.nativeEvent.layout;
                    if (height > 0 && Math.abs(height - measuredContentHeight) > 1) {
                      setMeasuredContentHeight(height);
                    }
                  }}
                >
                  <View style={styles.panelHeader}>
                    <View style={styles.panelHeaderButtons}>
                      <TouchableOpacity
                        style={[
                          styles.toggleButton,
                          isARActive ? styles.toggleActive : styles.toggleInactive,
                        ]}
                        onPress={handleToggleAR}
                        accessibilityRole="button"
                        accessibilityLabel={isARActive ? 'Exit AR mode' : 'Enter AR mode'}
                        accessibilityState={{ selected: isARActive }}
                      >
                        <Text
                          style={[
                            styles.toggleButtonText,
                            !isARActive && styles.toggleButtonTextInactive,
                          ]}
                        >
                          {isARActive ? 'Exit AR' : 'Enter AR'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.markerButton,
                          markerTrackingEnabled && styles.markerButtonActive,
                          !isARActive && styles.markerButtonDisabled,
                        ]}
                        onPress={() => {
                          if (!isARActive) return;
                          setMarkerTrackingEnabled((prev) => !prev);
                          setLastMarkerPayload(null);
                          setMarkerLastSeenAt(null);
                          markerAnchorOffsetRef.current = null;
                        }}
                        disabled={!isARActive}
                        accessibilityRole="button"
                        accessibilityLabel={markerTrackingEnabled ? 'Disable marker lock' : 'Enable marker lock'}
                        accessibilityState={{ selected: markerTrackingEnabled, disabled: !isARActive }}
                      >
                        <Text style={styles.markerButtonText}>
                          {markerTrackingEnabled ? 'Marker ON' : 'Marker OFF'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Category Filter */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryFilter}
                    contentContainerStyle={styles.categoryFilterContent}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryButton,
                        selectedCategory === 'all' && styles.categoryButtonActive
                      ]}
                      onPress={() => setSelectedCategory('all')}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        selectedCategory === 'all' && styles.categoryButtonTextActive
                      ]}>All</Text>
                    </TouchableOpacity>
                    {furnitureCategories.map(category => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryButton,
                          selectedCategory === category && styles.categoryButtonActive
                        ]}
                        onPress={() => setSelectedCategory(category)}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          selectedCategory === category && styles.categoryButtonTextActive
                        ]}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {isARActive && anchorStatus.hints.length > 0 && !anchorStatus.hasLock && (
                    <View style={styles.anchorHintCard}>
                      <Text style={styles.anchorHintText}>
                        {anchorStatus.hints[0]}
                      </Text>
                    </View>
                  )}

                  {isARActive && markerTrackingEnabled && (
                    <View style={styles.anchorHintCard}>
                      <Text style={styles.anchorHintText}>
                        {lastMarkerPayload
                          ? `Marker detected: ${lastMarkerPayload}${markerLastSeenAt ? ` • ${Math.round((Date.now() - markerLastSeenAt) / 1000)}s ago` : ''
                          }`
                          : 'Marker lock enabled. Point camera at a QR marker to lock the anchor.'}
                      </Text>
                    </View>
                  )}

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.libraryScroll}
                    snapToInterval={162}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    pagingEnabled={false}
                    scrollEventThrottle={16}
                    bounces={true}
                    alwaysBounceHorizontal={true}
                    directionalLockEnabled={true}
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                    removeClippedSubviews={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredFurnitureLibrary.length === 0 ? (
                      <View key="empty" style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No furniture found</Text>
                        <Text style={styles.emptySubtext}>Try selecting a different category</Text>
                      </View>
                    ) : (
                      filteredFurnitureLibrary.map((item, index) => {
                        const isSelected = selectedLibraryItem === item.id;
                        // Ensure unique key - use id if available and valid, otherwise use index
                        const uniqueKey = item?.id && item.id !== '' ? item.id : `furniture-item-${index}`;
                        return (
                          <AnimatedCard
                            key={uniqueKey}
                            style={[
                              styles.furnitureCard,
                              isSelected && styles.furnitureCardSelected,
                            ]}
                            onPress={() => {
                              if (!isARActive) {
                                handleToggleAR();
                                setSelectedLibraryItem(item.id);
                                setShowFloor(false); // Hide floor when selecting furniture
                                return;
                              }
                              setSelectedLibraryItem((prev) => {
                                const newSelection = prev === item.id ? null : item.id;
                                setShowFloor(newSelection === null); // Show floor when deselecting
                                return newSelection;
                              });
                            }}
                            hapticFeedback={true}
                          >
                            <View style={styles.furnitureThumbnail}>
                              <Ionicons
                                name={getFurnitureCategoryIcon(item.category)}
                                size={32}
                                color={isSelected ? '#6B4CE6' : '#7C3AED'}
                              />
                              {item.thumbnail && (
                                <View style={styles.thumbnailOverlay}>
                                  {/* Thumbnail image would go here if available */}
                                </View>
                              )}
                            </View>
                            <Text style={styles.furnitureName}>{item.name}</Text>
                            <Text style={styles.furniturePrice}>{item.price}</Text>
                            <Text style={styles.furnitureSizeLabel}>
                              {item.dimensions.width.toFixed(1)}m × {item.dimensions.length.toFixed(1)}m
                            </Text>
                            <Text style={styles.furnitureCategoryLabel}>
                              {item.category}
                            </Text>
                          </AnimatedCard>
                        );
                      }))}
                  </ScrollView>
                </View>
              )}
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}

export { ARViewScreenInner };
