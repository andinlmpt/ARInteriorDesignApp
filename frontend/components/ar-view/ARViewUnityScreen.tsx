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
} from '@/types/unity-bridge';
import { RoomMeasurementService } from '@/services/RoomMeasurementService';
import { projectService } from '@/services/ProjectService';
import { colors, spacing, radii } from '@/components/ui/theme';
import { isUnityViewAvailable } from '@/utils/unityAvailability';

const UNITY_READY_TIMEOUT_MS = 15000;

function scanHintMessage(status: ScanStatusPayload | null): string {
  if (!status) return 'Walk around the room slowly — scanning runs in the background';
  switch (status.hint) {
    case 'findFloor':
      return 'Keep walking and looking around the room';
    case 'moveAround':
      return 'Turn slowly to cover more of the space';
    case 'scanWalls':
      return 'Look toward the walls to improve the room shell';
    case 'readyToConfirm':
      return 'Ready — tap Confirm room to lock the layout';
    case 'confirmed':
      return 'Room locked. Pick furniture from the side catalog';
    case 'keepScanning':
      return 'Keep scanning, or confirm when you are ready';
    default:
      return `Scanning… ${Math.round((status.progress || 0) * 100)}%`;
  }
}

export function ARViewUnityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ furniture?: string | string[] }>();
  const initialFurniture = Array.isArray(params.furniture)
    ? params.furniture[0]
    : params.furniture;
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
  const [unityUnavailable, setUnityUnavailable] = useState(!unityAvailable);
  const [statusMessage, setStatusMessage] = useState(
    unityAvailable ? 'Loading Unity AR…' : 'Unity AR is not available in this build'
  );
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [mountUnity, setMountUnity] = useState(false);
  const [roomConfirmed, setRoomConfirmed] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanReady, setScanReady] = useState(false);
  const [placedModelIds, setPlacedModelIds] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeTool, setActiveTool] = useState<PlannerTool>('place');
  const [measurementModalVisible, setMeasurementModalVisible] = useState(false);
  const [confirmedPayload, setConfirmedPayload] = useState<RoomConfirmedPayload | null>(null);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [measurementSaved, setMeasurementSaved] = useState(false);
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [placementUnlocked, setPlacementUnlocked] = useState(false);

  useEffect(() => {
    placementUnlockedRef.current = placementUnlocked;
  }, [placementUnlocked]);

  useEffect(() => {
    if (!unityAvailable) return;
    const timer = setTimeout(() => setMountUnity(true), 1200);
    return () => clearTimeout(timer);
  }, [unityAvailable]);

  useEffect(() => {
    if (!unityAvailable) return;

    const timer = setTimeout(() => {
      if (!unityReady) {
        setUnityTimedOut(true);
        setStatusMessage('Unity AR did not start. Export ARDesignScene and rebuild the dev client.');
      }
    }, UNITY_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [unityAvailable, unityReady]);

  const spawnCatalogItem = useCallback((itemId: string, items: FurnitureLibraryItem[]) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      pendingSpawnRef.current = itemId;
      setStatusMessage(`Furniture "${itemId}" is not in the catalog yet`);
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
  }, []);

  useEffect(() => {
    if (!placementUnlocked || catalogLoading || catalogItems.length === 0) return;
    const pendingId = pendingSpawnRef.current;
    if (!pendingId) return;

    pendingSpawnRef.current = null;
    spawnCatalogItem(pendingId, catalogItems);
  }, [placementUnlocked, catalogLoading, catalogItems, spawnCatalogItem]);

  const handleSelectItem = useCallback(
    (itemId: string) => {
      setSelectedLibraryItem(itemId);
      setActiveTool('place');
      spawnCatalogItem(itemId, catalogItems);
      setStatusMessage('Aim at the floor — tap when the white reticle appears');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [catalogItems, spawnCatalogItem]
  );

  const handleUnityReady = useCallback(() => {
    setUnityReady(true);
    setUnityTimedOut(false);
    setStatusMessage('Point the camera around the room to detect floors and walls');
    unityRef.current?.startRoomScan();

    if (initialFurniture && !autoSelectedRef.current) {
      // Wait until the room is confirmed before auto-spawning.
      autoSelectedRef.current = true;
      setSelectedLibraryItem(initialFurniture);
    }
  }, [initialFurniture]);

  const handleUnityUnavailable = useCallback(() => {
    setUnityUnavailable(true);
    setUnityTimedOut(true);
    setStatusMessage('Unity AR is not available in this build');
  }, []);

  const handleScanStatus = useCallback((payload: ScanStatusPayload) => {
    setScanProgress(payload.progress ?? 0);
    setScanReady(Boolean(payload.readyToConfirm));
    if (!placementUnlockedRef.current) {
      setRoomConfirmed(Boolean(payload.confirmed));
      setStatusMessage(scanHintMessage(payload));
    }
  }, []);

  const handleRoomConfirmed = useCallback(
    (payload: RoomConfirmedPayload) => {
      if (measurementFlowCompleteRef.current) return;

      setRoomConfirmed(true);
      setScanProgress(1);
      setScanReady(true);
      setPlacementUnlocked(false);
      setMeasurementSaved(false);
      setMeasurementError(null);
      setConfirmedPayload(payload);
      setMeasurementModalVisible(true);
      setStatusMessage('Room measured — save or continue to furniture');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (selectedLibraryItem) {
        pendingSpawnRef.current = selectedLibraryItem;
      }
    },
    [selectedLibraryItem]
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
        name: 'Room scan',
      });
      setMeasurementSaved(true);
      setStatusMessage(
        saved.dimensionLabel
          ? `Room saved — ${saved.dimensionLabel}`
          : 'Room size saved to your account'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setMeasurementError('Could not save. Check Wi‑Fi and that the backend is running.');
    } finally {
      setSavingMeasurement(false);
    }
  }, [confirmedPayload, measurementSaved, savingMeasurement]);

  const handleContinueFromMeasurement = useCallback(() => {
    if (savingMeasurement) return;

    measurementFlowCompleteRef.current = true;
    setMeasurementModalVisible(false);
    setPlacementUnlocked(true);
    placementUnlockedRef.current = true;
    setRoomConfirmed(true);
    setStatusMessage('Room locked. Aim at the floor and tap to place furniture');

    if (selectedLibraryItem) {
      if (catalogLoading || catalogItems.length === 0) {
        pendingSpawnRef.current = selectedLibraryItem;
      } else {
        spawnCatalogItem(selectedLibraryItem, catalogItems);
      }
    }
  }, [selectedLibraryItem, catalogItems, catalogLoading, savingMeasurement, spawnCatalogItem]);

  const handleLayoutChanged = useCallback((payload: LayoutPayload) => {
    setPlacedModelIds((payload.furniture ?? []).map((item) => item.modelId));
    if (!placementUnlockedRef.current) {
      setRoomConfirmed(Boolean(payload.roomConfirmed));
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
    setCanUndo(false);
    setCanRedo(false);
    unityRef.current?.startRoomScan();
    setStatusMessage('Rescanning room…');
  }, []);

  const handleClear = useCallback(() => {
    unityRef.current?.clearScene();
    setPlacedModelIds([]);
    setStatusMessage('Cleared furniture. Room scan kept.');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

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
          onScanStatus={handleScanStatus}
          onRoomScanConfirmed={handleRoomConfirmed}
          onLayoutChanged={handleLayoutChanged}
          onHistoryChanged={handleHistoryChanged}
          onFurnitureInstancePlaced={() => {
            setStatusMessage('Placed — drag to move, pinch to scale, twist to rotate');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
          onExportComplete={(payload) => {
            setStatusMessage(
              payload.success
                ? `Exported ${payload.fileName} (${Math.round(payload.byteLength / 1024)} KB)`
                : `Export failed: ${payload.error || 'unknown error'}`
            );
            if (payload.success) {
              void projectService
                .saveUnityLayoutExport(payload)
                .then(() => {
                  setStatusMessage(
                    `Saved to Projects · ${payload.fileName} (${Math.round(payload.byteLength / 1024)} KB)`
                  );
                })
                .catch((err) => {
                  console.warn('[ARViewUnity] Failed to save export to Projects:', err);
                });
            }
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
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/room-view')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Back to Floor Preview</Text>
          </TouchableOpacity>
        </View>
      )}

      {unityAvailable && mountUnity && !unityReady && !unityTimedOut && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Starting ARDesignScene…</Text>
        </View>
      )}

      {unityAvailable && (unityTimedOut || unityUnavailable) && (
        <View style={styles.setupBanner}>
          <Ionicons name="construct-outline" size={22} color="#FFFFFF" style={styles.setupIcon} />
          <Text style={styles.setupTitle}>Unity export required</Text>
          <Text style={styles.setupText}>
            In Unity: Build ARDesignScene, make it the startup scene, export to
            frontend/android/unityLibrary, then rebuild your dev client.
          </Text>
          <TouchableOpacity
            style={styles.bannerButton}
            onPress={() => router.replace('/room-view')}
            accessibilityRole="button"
          >
            <Text style={styles.bannerButtonText}>Use Floor Preview</Text>
          </TouchableOpacity>
        </View>
      )}

      {unityAvailable && unityReady && !unityTimedOut && (
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
          onRemoveSelected={() => unityRef.current?.removeSelectedFurniture()}
          onSetTool={setActiveTool}
          onToggleLibrary={() => setLibraryOpen((open) => !open)}
          onBack={handleBack}
        />
      )}

      <RoomMeasurementSaveModal
        visible={measurementModalVisible}
        payload={confirmedPayload}
        saving={savingMeasurement}
        saved={measurementSaved}
        error={measurementError}
        onSave={handleSaveMeasurement}
        onContinue={handleContinueFromMeasurement}
      />
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
  setupBanner: {
    position: 'absolute',
    top: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(127, 29, 29, 0.92)',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  setupIcon: {
    marginBottom: spacing.xs,
  },
  setupTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  setupText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  bannerButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  bannerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
