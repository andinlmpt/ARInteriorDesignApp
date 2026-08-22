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
import { mapFurnitureIdToUnity } from '@/config/unity-furniture-map';
import { FURNITURE_LIBRARY } from '@/data/furnitureLibrary';
import type { FurnitureCategory } from '@/types/ar-view';
import type {
  HistoryStatePayload,
  LayoutPayload,
  ScanStatusPayload,
} from '@/types/unity-bridge';
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
  const unityAvailable = isUnityViewAvailable();

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

  const spawnCatalogItem = useCallback((itemId: string) => {
    const item = FURNITURE_LIBRARY.find((entry) => entry.id === itemId);
    const unityId = mapFurnitureIdToUnity(itemId);
    unityRef.current?.spawnFurniture({
      modelId: itemId,
      catalogId: unityId,
      width: item?.dimensions.width ?? 0.6,
      height: item?.dimensions.height ?? 0.6,
      depth: item?.dimensions.length ?? 0.6,
    });
  }, []);

  const handleSelectItem = useCallback(
    (itemId: string) => {
      setSelectedLibraryItem(itemId);
      setActiveTool('place');
      spawnCatalogItem(itemId);
      setStatusMessage('Placing… drag to move, pinch to scale, twist to rotate');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [spawnCatalogItem]
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
    setRoomConfirmed(Boolean(payload.confirmed));
    setStatusMessage(scanHintMessage(payload));
  }, []);

  const handleRoomConfirmed = useCallback(
    (payload: ScanStatusPayload) => {
      setRoomConfirmed(true);
      setScanProgress(1);
      setScanReady(true);
      setStatusMessage(scanHintMessage({ ...payload, hint: 'confirmed' }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (selectedLibraryItem) {
        spawnCatalogItem(selectedLibraryItem);
      }
    },
    [selectedLibraryItem, spawnCatalogItem]
  );

  const handleLayoutChanged = useCallback((payload: LayoutPayload) => {
    setPlacedModelIds((payload.furniture ?? []).map((item) => item.modelId));
    setRoomConfirmed(Boolean(payload.roomConfirmed));
  }, []);

  const handleHistoryChanged = useCallback((payload: HistoryStatePayload) => {
    setCanUndo(Boolean(payload.canUndo));
    setCanRedo(Boolean(payload.canRedo));
  }, []);

  const handleConfirmScan = useCallback(() => {
    unityRef.current?.confirmRoomScan();
  }, []);

  const handleRescan = useCallback(() => {
    setRoomConfirmed(false);
    setScanProgress(0);
    setScanReady(false);
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
            setStatusMessage('Furniture placed');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
          onExportComplete={(payload) => {
            setStatusMessage(
              payload.success
                ? `Exported ${payload.fileName} (${Math.round(payload.byteLength / 1024)} KB)`
                : `Export failed: ${payload.error || 'unknown error'}`
            );
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
          roomConfirmed={roomConfirmed}
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
