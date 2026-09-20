/**
 * AR View — Unity ARDesignScene (scan → confirm → place → export).
 * Native Android/iOS only. Uses @azesmway/react-native-unity.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { UnityARViewer, type UnityARViewerHandle } from '@/components/UnityARViewer';
import {
  ARPlannerOverlay,
  type PlannerTool,
} from '@/components/ar-view/ARPlannerOverlay';
import { RoomMeasurementSaveModal } from '@/components/ar-view/RoomMeasurementSaveModal';
import { mapFurnitureIdToUnity } from '@/config/unity-furniture-map';
import { useFurnitureCatalog } from '@/hooks/useFurnitureCatalog';
import type { FurnitureCategory, FurnitureLibraryItem } from '@/types/ar-view';
import type {
  HistoryStatePayload,
  LayoutPayload,
  RoomConfirmedPayload,
  ScanStatusPayload,
  ARPhotoCapturedPayload,
  SelectionPayload,
  PlacementSafetyPayload,
} from '@/types/unity-bridge';
import { RoomMeasurementService } from '@/services/RoomMeasurementService';
import { projectService } from '@/services/ProjectService';
import { savedItemsService } from '@/services/SavedItemsService';
import { colors, spacing } from '@/components/ui/theme';
import { isUnityViewAvailable } from '@/utils/unityAvailability';
import { buildModelPreviewExportHref } from '@/utils/modelPreviewExport';
import { canPlaceMore, getRemainingPlacements } from '@/utils/furnitureCatalogHelpers';
import { isUnityPlayerWarm, markUnityPlayerWarm } from '@/utils/unitySession';
import { formatArPhotoDisplayName } from '@/utils/arPhotoNaming';
import { BRAND } from '@/constants/branding';

const UNITY_READY_TIMEOUT_MS = 15000;
/** First cold start waits for Unity/ARCore; warm remounts should be instant. */
const UNITY_MOUNT_DELAY_MS = 1200;

function isSyntheticFurnitureOnlyRoom(payload: RoomConfirmedPayload): boolean {
  if (payload.furniturePlacementOnly) return true;
  // BeginFurniturePlacementOnly uses a 24×24 m floor at 2.5 m height (576 m²).
  return (
    Math.abs(payload.width - 24) < 0.05 &&
    Math.abs(payload.depth - 24) < 0.05 &&
    Math.abs(payload.height - 2.5) < 0.05
  );
}

function scanHintMessage(status: ScanStatusPayload | null): string {
  if (!status) return 'Walk around the room slowly — scanning runs in the background';
  switch (status.hint) {
    case 'tapFloorHeight':
      return 'Tap the floor to start measuring height';
    case 'extrudeHeight':
      return 'Move aim up to extrude height, then tap Finish';
    case 'tapFirstCorner':
      return 'Height locked — tap the first floor corner';
    case 'tapNextCorner':
      return 'Tap the next floor corner';
    case 'tapThirdCorner':
      return 'Tap a third corner to outline the room';
    case 'tapMoreCorners':
      return 'Keep tapping corners to outline the room';
    case 'findFloor':
      return 'Keep walking and looking around the room';
    case 'moveAround':
      return 'Turn slowly to cover more of the space';
    case 'scanWalls':
      return 'Look toward the walls to improve the room shell';
    case 'readyToConfirm':
      return 'Ready — tap Confirm room to lock the layout';
    case 'confirmed':
      return 'Select your desired furniture';
    case 'keepScanning':
      return 'Keep scanning, or confirm when you are ready';
    default:
      return `Scanning… ${Math.round((status.progress || 0) * 100)}%`;
  }
}

export function ARViewUnityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ furniture?: string | string[]; mode?: string | string[] }>();
  const initialFurniture = Array.isArray(params.furniture)
    ? params.furniture[0]
    : params.furniture;
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const arMode: 'furniture' | 'measure' = modeParam === 'measure' ? 'measure' : 'furniture';
  const unityRef = useRef<UnityARViewerHandle>(null);
  const autoSelectedRef = useRef(false);
  const pendingSpawnRef = useRef<string | null>(null);
  const placementUnlockedRef = useRef(false);
  const measurementFlowCompleteRef = useRef(false);
  const unityAvailable = isUnityViewAvailable();
  const { items: catalogItems, loading: catalogLoading, error: catalogError } = useFurnitureCatalog();

  const [selectedCategory, setSelectedCategory] = useState<FurnitureCategory | 'all'>('all');
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<string | null>(
    initialFurniture ?? null
  );
  const [unityReady, setUnityReady] = useState(false);
  const [unityTimedOut, setUnityTimedOut] = useState(!unityAvailable);
  const [activeUnityScene, setActiveUnityScene] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    unityAvailable
      ? arMode === 'measure'
        ? 'Loading AR measurement…'
        : 'Loading Unity AR…'
      : 'Unity AR is not available in this build'
  );
  const [libraryOpen, setLibraryOpen] = useState(arMode === 'furniture');
  const [mountUnity, setMountUnity] = useState(false);
  const [roomConfirmed, setRoomConfirmed] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanReady, setScanReady] = useState(false);
  const [placedModelIds, setPlacedModelIds] = useState<string[]>([]);
  const [selectedPlacedModelId, setSelectedPlacedModelId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeTool, setActiveTool] = useState<PlannerTool>('place');
  const [measurementModalVisible, setMeasurementModalVisible] = useState(false);
  const [confirmedPayload, setConfirmedPayload] = useState<RoomConfirmedPayload | null>(null);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [measurementSaved, setMeasurementSaved] = useState(false);
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [measureRoomName, setMeasureRoomName] = useState('');
  const [measurePlanReady, setMeasurePlanReady] = useState(false);
  const [exportingMeasure, setExportingMeasure] = useState(false);
  const measureExportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [placementUnlocked, setPlacementUnlocked] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const photoCaptureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    placementUnlockedRef.current = placementUnlocked;
  }, [placementUnlocked]);

  useEffect(() => {
    if (!unityAvailable) return;
    if (isUnityPlayerWarm()) {
      setMountUnity(true);
      return;
    }
    const timer = setTimeout(() => setMountUnity(true), UNITY_MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [unityAvailable]);

  useEffect(() => {
    if (!unityAvailable) return;

    const timer = setTimeout(() => {
      if (!unityReady) {
        // Stop the loading spinner only — do not block the Unity view.
        setUnityTimedOut(true);
      }
    }, UNITY_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [unityAvailable, unityReady]);

  const countPlaced = useCallback(
    (itemId: string) => placedModelIds.filter((id) => id === itemId).length,
    [placedModelIds]
  );

  const spawnCatalogItem = useCallback(
    (itemId: string, items: FurnitureLibraryItem[]) => {
      const item = items.find((entry) => entry.id === itemId);
      if (!item) {
        pendingSpawnRef.current = itemId;
        setStatusMessage(`Furniture "${itemId}" is not in the catalog yet`);
        return;
      }

      const placedCount = placedModelIds.filter((id) => id === itemId).length;
      if (!canPlaceMore(item.quantity, placedCount)) {
        const remaining = getRemainingPlacements(item.quantity, placedCount);
        setStatusMessage(
          remaining === 0 && (item.quantity ?? 0) > 0
            ? `${item.name} — all ${item.quantity} available placed`
            : `${item.name} is out of stock`
        );
        return;
      }

      const glbUrl = typeof item.model3D?.url === 'string' ? item.model3D.url : undefined;
      unityRef.current?.spawnFurniture({
        modelId: itemId,
        catalogId: mapFurnitureIdToUnity(itemId),
        glbUrl,
        width: item.dimensions.width,
        height: item.dimensions.height,
        depth: item.dimensions.length,
      });
    },
    [placedModelIds]
  );

  useEffect(() => {
    if (!placementUnlocked || catalogLoading || catalogItems.length === 0) return;
    const pendingId = pendingSpawnRef.current;
    if (!pendingId) return;

    pendingSpawnRef.current = null;
    spawnCatalogItem(pendingId, catalogItems);
  }, [placementUnlocked, catalogLoading, catalogItems, spawnCatalogItem]);

  const handleSelectItem = useCallback(
    (itemId: string) => {
      const item = catalogItems.find((entry) => entry.id === itemId);
      const placedCount = countPlaced(itemId);
      if (item && !canPlaceMore(item.quantity, placedCount)) {
        const remaining = getRemainingPlacements(item.quantity, placedCount);
        setStatusMessage(
          remaining === 0 && (item.quantity ?? 0) > 0
            ? `${item.name} — all ${item.quantity} available placed`
            : `${item.name} is out of stock`
        );
        return;
      }
      setSelectedLibraryItem(itemId);
      setActiveTool('place');
      spawnCatalogItem(itemId, catalogItems);
      setStatusMessage('Aim at the floor — tap when the black reticle appears');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [catalogItems, spawnCatalogItem, countPlaced]
  );

  useEffect(() => {
    if (!mountUnity || !unityAvailable) return;
    // Re-ping in case Unity stayed warm without re-firing Start/unityReady.
    const timer = setTimeout(() => {
      unityRef.current?.sendToUnity('ping', '');
    }, 600);
    return () => clearTimeout(timer);
  }, [mountUnity, unityAvailable]);

  const handleUnityReady = useCallback((sceneName?: string) => {
    markUnityPlayerWarm();
    setUnityReady(true);
    setUnityTimedOut(false);

    const scene =
      sceneName === 'ARRoomMeasurement' || sceneName === 'ARDesignScene'
        ? sceneName
        : sceneName || 'ARDesignScene';
    setActiveUnityScene(scene);

    if (arMode === 'measure') {
      setLibraryOpen(false);
      setMeasurementModalVisible(false);
      setMeasurePlanReady(false);
      setStatusMessage('Opening AR Room Measurement…');
      if (scene !== 'ARRoomMeasurement') {
        unityRef.current?.openRoomMeasurement();
      }
      return;
    }

    // Furniture mode — wait until Unity is actually on ARDesignScene before showing RN chrome.
    if (scene === 'ARRoomMeasurement') {
      setLibraryOpen(false);
      setMeasurementModalVisible(false);
      setStatusMessage('Switching to AR Furniture…');
      unityRef.current?.openFurnitureDesign();
      return;
    }

    setStatusMessage('Select your desired furniture');
    setLibraryOpen(true);
    measurementFlowCompleteRef.current = true;
    setPlacementUnlocked(true);
    placementUnlockedRef.current = true;
    setRoomConfirmed(true);
    setScanProgress(1);
    setScanReady(true);
    setMeasurementModalVisible(false);
    unityRef.current?.openFurnitureDesign();

    if (initialFurniture && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      setSelectedLibraryItem(initialFurniture);
    }
  }, [arMode, initialFurniture]);

  const furnitureUiReady =
    arMode === 'furniture' && unityReady && activeUnityScene === 'ARDesignScene';

  const handleUnityUnavailable = useCallback(() => {
    setUnityTimedOut(true);
    setStatusMessage('Unity AR is not available in this build');
  }, []);

  const handleScanStatus = useCallback(
    (payload: ScanStatusPayload) => {
      // Furniture mode owns its own status copy — ignore scan HUD updates.
      if (arMode === 'furniture' || placementUnlockedRef.current) return;

      setScanProgress(payload.progress ?? 0);
      setScanReady(Boolean(payload.readyToConfirm));
      setRoomConfirmed(Boolean(payload.confirmed));
      setStatusMessage(scanHintMessage(payload));
    },
    [arMode]
  );

  const handleRoomConfirmed = useCallback(
    (payload: RoomConfirmedPayload) => {
      if (measurementFlowCompleteRef.current) {
        // Already in furniture mode — ignore late confirm events.
        if (arMode === 'furniture') return;
      }

      // Furniture-only / open-floor unlock from Unity.
      if (isSyntheticFurnitureOnlyRoom(payload) || arMode === 'furniture') {
        if (arMode === 'measure' && isSyntheticFurnitureOnlyRoom(payload)) {
          setConfirmedPayload(null);
          setMeasurementModalVisible(false);
          setPlacementUnlocked(false);
          placementUnlockedRef.current = false;
          setRoomConfirmed(false);
          setScanProgress(0.15);
          setScanReady(false);
          setStatusMessage(
            'Point the camera around the room — tap floor height, then corners to measure'
          );
          return;
        }

        measurementFlowCompleteRef.current = true;
        setConfirmedPayload(null);
        setMeasurementModalVisible(false);
        setMeasurementError(null);
        setPlacementUnlocked(true);
        placementUnlockedRef.current = true;
        setRoomConfirmed(true);
        setScanProgress(1);
        setScanReady(true);
        setLibraryOpen(true);
        setStatusMessage('Select your desired furniture');
        if (selectedLibraryItem) {
          pendingSpawnRef.current = selectedLibraryItem;
        }
        return;
      }

      setRoomConfirmed(true);
      setScanProgress(1);
      setScanReady(true);
      setPlacementUnlocked(false);
      setMeasurementSaved(false);
      setMeasurementError(null);
      setMeasureRoomName('');
      setMeasurePlanReady(false);
      setConfirmedPayload(payload);
      setMeasurementModalVisible(true);
      setStatusMessage(
        arMode === 'measure'
          ? 'Room measured — enter a name to save'
          : 'Room measured — save or continue to furniture'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (selectedLibraryItem) {
        pendingSpawnRef.current = selectedLibraryItem;
      }
    },
    [arMode, selectedLibraryItem]
  );

  const handleSaveMeasurement = useCallback(async () => {
    if (!confirmedPayload || savingMeasurement || measurementSaved) return;
    if (
      confirmedPayload.width <= 0 ||
      confirmedPayload.depth <= 0 ||
      confirmedPayload.height <= 0
    ) {
      setMeasurementError('Room dimensions are missing. Try scanning again.');
      return;
    }

    const trimmedName = measureRoomName.trim();
    if (arMode === 'measure' && !trimmedName) {
      setMeasurementError('Please enter a room name');
      return;
    }

    setSavingMeasurement(true);
    setMeasurementError(null);

    try {
      const saved = await RoomMeasurementService.save({
        width: confirmedPayload.width,
        depth: confirmedPayload.depth,
        height: confirmedPayload.height,
        floorAreaSqm: confirmedPayload.floorAreaSqm,
        wallHeight: confirmedPayload.wallHeight,
        dimensionLabel: confirmedPayload.dimensionLabel,
        boundsMin: confirmedPayload.boundsMin,
        boundsMax: confirmedPayload.boundsMax,
        floorPolygon: confirmedPayload.floorPolygon?.points,
        scanMetadata: {
          planeCount: confirmedPayload.planeCount,
          meshChunkCount: confirmedPayload.meshChunkCount,
          horizontalAreaSqm: confirmedPayload.horizontalAreaSqm,
          verticalAreaSqm: confirmedPayload.verticalAreaSqm,
          cornerCount: confirmedPayload.cornerCount,
          source: 'unity-ar',
        },
        name: arMode === 'measure' ? trimmedName : trimmedName || 'Room scan',
      });
      setMeasurementSaved(true);
      setStatusMessage(
        saved.dimensionLabel
          ? `Room saved — ${saved.name || saved.dimensionLabel}`
          : 'Room size saved to your account'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (arMode === 'measure') {
        unityRef.current?.commitRoomName(trimmedName);
        setMeasurementModalVisible(false);
        setMeasurePlanReady(true);
      }
    } catch {
      setMeasurementError('Could not save. Check Wi‑Fi and that the backend is running.');
    } finally {
      setSavingMeasurement(false);
    }
  }, [
    arMode,
    confirmedPayload,
    measureRoomName,
    measurementSaved,
    savingMeasurement,
  ]);

  const handleCancelMeasureName = useCallback(() => {
    if (savingMeasurement) return;
    setMeasurementModalVisible(false);
    setMeasurementError(null);
    unityRef.current?.cancelRoomName();
    setMeasurePlanReady(true);
    setStatusMessage('Measurement complete');
  }, [savingMeasurement]);

  const clearMeasureExportTimeout = useCallback(() => {
    if (measureExportTimeoutRef.current) {
      clearTimeout(measureExportTimeoutRef.current);
      measureExportTimeoutRef.current = null;
    }
  }, []);

  const handleExportMeasure = useCallback(() => {
    if (exportingMeasure) return;
    setExportingMeasure(true);
    setStatusMessage('Exporting 3D layout…');
    clearMeasureExportTimeout();
    measureExportTimeoutRef.current = setTimeout(() => {
      setExportingMeasure(false);
      setStatusMessage(
        'Export timed out — Unity did not finish. Rebuild the app with the latest Unity export, then try again.'
      );
      measureExportTimeoutRef.current = null;
    }, 45000);
    unityRef.current?.exportLayout();
  }, [clearMeasureExportTimeout, exportingMeasure]);

  useEffect(() => {
    return () => clearMeasureExportTimeout();
  }, [clearMeasureExportTimeout]);

  const handleContinueFromMeasurement = useCallback(() => {
    if (savingMeasurement) return;

    measurementFlowCompleteRef.current = true;
    setMeasurementModalVisible(false);
    if (arMode === 'measure') {
      setPlacementUnlocked(false);
      placementUnlockedRef.current = false;
      setStatusMessage('Measurement complete');
      router.replace('/room-measurements');
      return;
    }

    setPlacementUnlocked(true);
    placementUnlockedRef.current = true;
    setRoomConfirmed(true);
    setStatusMessage('Select your desired furniture');

    if (selectedLibraryItem) {
      if (catalogLoading || catalogItems.length === 0) {
        pendingSpawnRef.current = selectedLibraryItem;
      } else {
        spawnCatalogItem(selectedLibraryItem, catalogItems);
      }
    }
  }, [arMode, selectedLibraryItem, catalogItems, catalogLoading, savingMeasurement, spawnCatalogItem, router]);

  const handleLayoutChanged = useCallback((payload: LayoutPayload) => {
    const furniture = payload.furniture ?? [];
    setPlacedModelIds(furniture.map((item) => item.modelId));
    const selected = furniture.find((item) => item.selected);
    setSelectedPlacedModelId(selected?.modelId ?? null);
    if (!placementUnlockedRef.current) {
      setRoomConfirmed(Boolean(payload.roomConfirmed));
    }
  }, []);

  const handleFurnitureSelected = useCallback((payload: SelectionPayload) => {
    if (payload.selected && payload.modelId) {
      setSelectedPlacedModelId(payload.modelId);
    } else {
      setSelectedPlacedModelId(null);
    }
  }, []);

  const handlePlacementSafety = useCallback((payload: PlacementSafetyPayload) => {
    if (payload.isSafe) {
      setStatusMessage('Placed — drag to move, pinch to scale, twist to rotate');
      return;
    }
    if (payload.hasFurnitureCollision) {
      setStatusMessage('Unsafe — overlaps another furniture piece');
      return;
    }
    if (payload.hasWallCollision) {
      setStatusMessage('Unsafe — collides with the wall');
      return;
    }
    if (payload.isTooCloseToWall) {
      setStatusMessage('Unsafe — too close to the wall');
      return;
    }
    if (payload.reason) {
      setStatusMessage(`Unsafe — ${payload.reason}`);
    }
  }, []);

  const handleHistoryChanged = useCallback((payload: HistoryStatePayload) => {
    setCanUndo(Boolean(payload.canUndo));
    setCanRedo(Boolean(payload.canRedo));
  }, []);

  const handleConfirmScan = useCallback(() => {
    unityRef.current?.confirmRoomScan();
  }, []);

  const handleRescan = useCallback(() => {
    measurementFlowCompleteRef.current = false;
    setRoomConfirmed(false);
    setScanProgress(0);
    setScanReady(false);
    setPlacementUnlocked(false);
    placementUnlockedRef.current = false;
    setMeasurementModalVisible(false);
    setConfirmedPayload(null);
    setMeasurementSaved(false);
    setMeasurementError(null);
    setSavingMeasurement(false);
    setPlacedModelIds([]);
    setSelectedPlacedModelId(null);
    setCanUndo(false);
    setCanRedo(false);
    unityRef.current?.startRoomScan();
    setStatusMessage('Rescanning room…');
  }, []);

  const handleClear = useCallback(() => {
    unityRef.current?.clearScene();
    setPlacedModelIds([]);
    setSelectedPlacedModelId(null);
    setStatusMessage('Select your desired furniture');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const handleSavePhoto = useCallback(() => {
    if (savingPhoto) return;
    setLibraryOpen(false);
    setSavingPhoto(true);
    setStatusMessage('Capturing photo…');
    // Hide RN chrome for a beat so ScreenCapture doesn't include the toolbar.
    setTimeout(() => {
      unityRef.current?.capturePhoto();
    }, 180);
    if (photoCaptureTimeoutRef.current) clearTimeout(photoCaptureTimeoutRef.current);
    photoCaptureTimeoutRef.current = setTimeout(() => {
      setSavingPhoto((prev) => {
        if (prev) setStatusMessage('Photo capture timed out — try again');
        return false;
      });
    }, 12000);
  }, [savingPhoto]);

  const handleBack = useCallback(() => {
    // Park Unity on the furniture scene so the next open gets a live camera.
    if (arMode === 'measure') {
      unityRef.current?.sendToUnity('requestClose', '');
    } else {
      unityRef.current?.openFurnitureDesign();
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [arMode, router]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {unityAvailable && mountUnity ? (
        <UnityARViewer
          ref={unityRef}
          style={styles.unityLayer}
          onUnityReady={handleUnityReady}
          onUnityUnavailable={handleUnityUnavailable}
          onRequestClose={handleBack}
          onScanStatus={handleScanStatus}
          onRoomScanConfirmed={handleRoomConfirmed}
          onLayoutChanged={handleLayoutChanged}
          onFurnitureSelected={handleFurnitureSelected}
          onPlacementSafety={handlePlacementSafety}
          onHistoryChanged={handleHistoryChanged}
          onFurnitureInstancePlaced={() => {
            setStatusMessage('Placed — drag to move, pinch to scale, twist to rotate');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
          onExportComplete={(payload) => {
            clearMeasureExportTimeout();
            setExportingMeasure(false);
            setStatusMessage(
              payload.success
                ? `Exported ${payload.fileName} (${Math.round((payload.byteLength || 0) / 1024)} KB)`
                : `Export failed: ${payload.error || 'unknown error'}`
            );
            if (payload.success && payload.path) {
              void projectService
                .saveUnityLayoutExport(payload)
                .then((project) => {
                  setStatusMessage(
                    `Saved to Projects · ${payload.fileName} (${Math.round(payload.byteLength / 1024)} KB)`
                  );
                  router.push(
                    buildModelPreviewExportHref({
                      uri: payload.path,
                      title: payload.fileName || project.name,
                      furnitureCount: payload.furnitureCount,
                      projectId: project.id,
                    })
                  );
                })
                .catch((err) => {
                  console.warn('[ARViewUnity] Failed to save export to Projects:', err);
                  router.push(
                    buildModelPreviewExportHref({
                      uri: payload.path,
                      title: payload.fileName,
                      furnitureCount: payload.furnitureCount,
                    })
                  );
                });
            }
          }}
          onMeasurementPlanReady={() => {
            if (arMode !== 'measure') return;
            setMeasurePlanReady(true);
            setStatusMessage('Room plan ready — export 3D anytime');
          }}
          onMeasurementPlanClosed={() => {
            setMeasurePlanReady(false);
            setExportingMeasure(false);
          }}
          onPhotoCaptured={(payload: ARPhotoCapturedPayload) => {
            if (photoCaptureTimeoutRef.current) {
              clearTimeout(photoCaptureTimeoutRef.current);
              photoCaptureTimeoutRef.current = null;
            }
            setSavingPhoto(false);

            if (!payload?.success || !payload.path) {
              setStatusMessage(payload?.error || 'Photo capture failed');
              return;
            }

            const uri = payload.path.startsWith('file://')
              ? payload.path
              : `file://${payload.path}`;
            const kb = Math.round((payload.byteLength || 0) / 1024);
            setStatusMessage(
              payload.gallerySaved
                ? `Photo saved to Gallery + app (${kb} KB)`
                : `Photo saved to app (${kb} KB)`
            );

            void savedItemsService
              .saveItem({
                id: `ar-photo-${payload.fileName || Date.now()}`,
                name: formatArPhotoDisplayName(payload.fileName),
                type: 'design',
                imageUrl: uri,
                description: `Captured in ${BRAND.name}`,
                iconName: 'camera',
                iconColor: '#0C295F',
                metadata: {
                  source: 'unity-ar-photo',
                  path: payload.path,
                  fileName: payload.fileName,
                  gallerySaved: payload.gallerySaved,
                  mimeType: payload.mimeType || 'image/png',
                  byteLength: payload.byteLength,
                },
              })
              .then(() => {
                setStatusMessage(
                  payload.gallerySaved
                    ? `Saved to Gallery + Saved tab`
                    : `Saved to Saved tab`
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                  () => {}
                );
              })
              .catch((err) => {
                console.warn('[ARViewUnity] Failed to save AR photo to Saved items:', err);
              });
          }}
          onUnityError={(payload) => {
            setStatusMessage(payload.message || payload.code);
          }}
        />
      ) : unityAvailable ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Preparing Unity AR…</Text>
        </View>
      ) : (
        <View style={styles.unavailableLayer}>
          <Ionicons name="cube-outline" size={48} color={colors.accent} />
          <Text style={styles.unavailableTitle}>True Floor AR unavailable</Text>
          <Text style={styles.unavailableText}>
            This development build does not include the Unity native view. Rebuild with an
            ARDesignScene export to use the planner.
          </Text>
        </View>
      )}

      {unityAvailable && mountUnity && !unityReady && !unityTimedOut && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>
            {arMode === 'measure' ? 'Starting AR Measurement…' : 'Starting ARDesignScene…'}
          </Text>
        </View>
      )}

      {furnitureUiReady && (
        <ARPlannerOverlay
          catalogItems={catalogItems}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          roomConfirmed={placementUnlocked}
          scanModalOpen={measurementModalVisible}
          scanProgress={scanProgress}
          scanReady={scanReady}
          statusMessage={statusMessage}
          selectedCategory={selectedCategory}
          selectedLibraryItem={selectedLibraryItem}
          selectedPlacedModelId={selectedPlacedModelId}
          placedModelIds={placedModelIds}
          canUndo={canUndo}
          canRedo={canRedo}
          activeTool={activeTool}
          libraryOpen={libraryOpen}
          onSelectCategory={setSelectedCategory}
          onSelectItem={handleSelectItem}
          onConfirmScan={handleConfirmScan}
          onRescan={handleRescan}
          onUndo={() => unityRef.current?.undo()}
          onRedo={() => unityRef.current?.redo()}
          onClear={handleClear}
          onExport={() => unityRef.current?.exportLayout()}
          onSavePhoto={handleSavePhoto}
          savingPhoto={savingPhoto}
          onRemoveSelected={() => unityRef.current?.removeSelectedFurniture()}
          onSetTool={setActiveTool}
          onToggleLibrary={() => setLibraryOpen((open) => !open)}
          onBack={handleBack}
          style={savingPhoto ? { opacity: 0, pointerEvents: 'none' } : undefined}
        />
      )}

      {arMode === 'measure' && unityAvailable && (unityReady || unityTimedOut) && (
        <View style={styles.measureChrome} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.measureBackButton}
            onPress={handleBack}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#1C1B19" />
          </TouchableOpacity>

          {measurePlanReady && !measurementModalVisible ? (
            <TouchableOpacity
              style={[styles.measureExportButton, exportingMeasure && styles.measureExportDisabled]}
              onPress={handleExportMeasure}
              disabled={exportingMeasure}
              accessibilityLabel="Export 3D layout"
            >
              {exportingMeasure ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.measureExportText}>Export 3D</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {arMode === 'furniture' && (
        <RoomMeasurementSaveModal
          visible={measurementModalVisible}
          payload={confirmedPayload}
          saving={savingMeasurement}
          saved={measurementSaved}
          error={measurementError}
          onSave={handleSaveMeasurement}
          onContinue={handleContinueFromMeasurement}
        />
      )}

      {arMode === 'measure' && (
        <RoomMeasurementSaveModal
          visible={measurementModalVisible}
          payload={confirmedPayload}
          saving={savingMeasurement}
          saved={measurementSaved}
          error={measurementError}
          measureMode
          roomName={measureRoomName}
          onChangeRoomName={(text) => {
            setMeasureRoomName(text);
            if (measurementError) setMeasurementError(null);
          }}
          onSave={handleSaveMeasurement}
          onContinue={handleContinueFromMeasurement}
          onCancel={handleCancelMeasureName}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  unityLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  measureChrome: {
    ...StyleSheet.absoluteFillObject,
  },
  measureBackButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureExportButton: {
    position: 'absolute',
    top: 48,
    right: 16,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#0C295F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  measureExportDisabled: {
    opacity: 0.7,
  },
  measureExportText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  loadingText: {
    marginTop: spacing.md,
    color: '#FFFFFF',
    fontSize: 16,
  },
  unavailableLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: '#0F172A',
    gap: spacing.md,
  },
  unavailableTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  unavailableText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
