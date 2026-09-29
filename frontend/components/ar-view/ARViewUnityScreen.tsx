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
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { UnityARViewer, type UnityARViewerHandle } from '@/components/UnityARViewer';
import {
  ARPlannerOverlay,
  type PlannerTool,
} from '@/components/ar-view/ARPlannerOverlay';
import { RoomMeasurementSaveModal } from '@/components/ar-view/RoomMeasurementSaveModal';
import { ARToastNotice } from '@/components/ar-view/ARToastNotice';
import { AppDialog } from '@/components/ui/AppDialog';
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
  ExportResultPayload,
} from '@/types/unity-bridge';
import { RoomMeasurementService } from '@/services/RoomMeasurementService';
import { projectService } from '@/services/ProjectService';
import { colors, spacing } from '@/components/ui/theme';
import { isUnityViewAvailable } from '@/utils/unityAvailability';
import { buildModelPreviewExportHref } from '@/utils/modelPreviewExport';
import { persistRoomExportGlb } from '@/utils/roomExportStorage';
import { canPlaceMore, getRemainingPlacements } from '@/utils/furnitureCatalogHelpers';
import { isUnityPlayerWarm, markUnityPlayerWarm } from '@/utils/unitySession';

const UNITY_READY_TIMEOUT_MS = 15000;
/** First cold start waits for Unity/ARCore; warm remounts should be instant. */
const UNITY_MOUNT_DELAY_MS = 1200;
const FURNITURE_UNITY_SCENE = 'ARDesignScene';
const MEASUREMENT_UNITY_SCENE = 'ARRoomMeasurement';

function normalizeUnitySceneName(sceneName?: string | null): string | null {
  if (sceneName === FURNITURE_UNITY_SCENE || sceneName === MEASUREMENT_UNITY_SCENE) {
    return sceneName;
  }
  return null;
}

function isSceneSyncedForArMode(
  mode: 'furniture' | 'measure',
  scene: string,
  measuredFurnitureActive: boolean
): boolean {
  const expected = mode === 'furniture' ? FURNITURE_UNITY_SCENE : MEASUREMENT_UNITY_SCENE;
  if (scene === expected) return true;
  return (
    mode === 'measure' && measuredFurnitureActive && scene === MEASUREMENT_UNITY_SCENE
  );
}

function isSyntheticFurnitureOnlyRoom(payload: RoomConfirmedPayload): boolean {
  if (payload.furniturePlacementOnly) return true;
  // BeginFurniturePlacementOnly uses a 24×24 m floor at 2.5 m height (576 m²).
  return (
    Math.abs(payload.width - 24) < 0.05 &&
    Math.abs(payload.depth - 24) < 0.05 &&
    Math.abs(payload.height - 2.5) < 0.05
  );
}

function buildMeasuredFurnitureHandoffPayload(
  payload: RoomConfirmedPayload,
  roomName: string
) {
  const points = payload.floorPolygon?.points;
  return {
    roomName: roomName || 'Untitled room',
    width: payload.width,
    depth: payload.depth,
    height: payload.height,
    wallHeight: payload.wallHeight || payload.height,
    boundsMin: payload.boundsMin,
    boundsMax: payload.boundsMax,
    floorPolygon: Array.isArray(points)
      ? points.map((p) => ({ x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0 }))
      : undefined,
  };
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
  const params = useLocalSearchParams<{
    furniture?: string | string[];
    mode?: string | string[];
    projectId?: string | string[];
  }>();
  /** Named project from the Start new project tab — exports attach to it. */
  const activeProjectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const initialFurniture = Array.isArray(params.furniture)
    ? params.furniture[0]
    : params.furniture;
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const arMode: 'furniture' | 'measure' = modeParam === 'measure' ? 'measure' : 'furniture';
  /** New project or mode — force Unity scene sync (player stays warm across visits). */
  const arSessionKey = `${arMode}:${activeProjectId ?? ''}`;
  const unityRef = useRef<UnityARViewerHandle>(null);
  const autoSelectedRef = useRef(false);
  const pendingSpawnRef = useRef<string | null>(null);
  const placementUnlockedRef = useRef(false);
  const measurementFlowCompleteRef = useRef(false);
  /** After naming a measured room, Unity places furniture on that shell (ARDesignScene). */
  const measuredFurnitureActiveRef = useRef(false);
  /** Prevents requestClose ↔ handleBack feedback loops that crash UaaL on reopen. */
  const closingRef = useRef(false);
  /** One soft-reload per screen mount when already on ARRoomMeasurement. */
  const measureNeedsReloadRef = useRef(arMode === 'measure');
  /** One soft-reload per screen mount when already on ARDesignScene (furniture). */
  const furnitureNeedsReloadRef = useRef(arMode === 'furniture');
  /** Ensures open/reload runs once per AR screen mount (ping must not re-boot). */
  const modeBootedRef = useRef(false);
  /** User closed the catalog sheet — ignore duplicate Unity unlock events that re-open it. */
  const libraryUserDismissedRef = useRef(false);

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
  const [furnitureLoading, setFurnitureLoading] = useState(false);
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
  /** True after room name save — Unity measured-furniture handoff is in progress / active. */
  const [measuredFurnitureActive, setMeasuredFurnitureActive] = useState(false);
  const [exportingMeasure, setExportingMeasure] = useState(false);
  const measureExportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureExportKickoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureExportStartedRef = useRef(false);
  const furnitureLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mongo id of the room measurement saved in this AR session (for linking Export 3D). */
  const savedMeasurementIdRef = useRef<string | null>(null);
  const [placementUnlocked, setPlacementUnlocked] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const photoCaptureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportResultDialog, setExportResultDialog] = useState<
    | {
        kind: 'success';
        roomName: string;
        fileName: string;
        sizeKb: number;
        previewUri: string;
        projectId?: string;
        furnitureCount?: number;
        linkedToMeasurement: boolean;
        savedToProjects: boolean;
      }
    | { kind: 'error'; message: string }
    | null
  >(null);
  /** Short top notice (e.g. "Room measurement saved") — auto-hides. */
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Measure mode: save the room automatically (no name modal) once the layout is generated. */
  const autoSaveMeasurePendingRef = useRef(false);
  /** Name typed on the Start new project tab — used as the room measurement name. */
  const projectNameRef = useRef<string | null>(null);
  /** Project that AR Furniture captures are attached to (created on first capture if absent). */
  const photoProjectIdRef = useRef<string | undefined>(activeProjectId);
  /** After Save measure succeeds — prompt user to run Export 3D next. */
  const [measureSavedPrompt, setMeasureSavedPrompt] = useState<{
    roomName: string;
  } | null>(null);
  /** Confirm before leaving AR Measurement / Furniture so we can reset the scene. */
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);

  useEffect(() => {
    placementUnlockedRef.current = placementUnlocked;
  }, [placementUnlocked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !mountUnity) return;
      unityRef.current?.resumeUnityPlayer?.();
      if (measuredFurnitureActiveRef.current && placementUnlockedRef.current) {
        unityRef.current?.wakeUnityPlayer?.();
      }
    });
    return () => sub.remove();
  }, [mountUnity]);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    projectService
      .getProjectById(activeProjectId)
      .then((project) => {
        if (!cancelled) projectNameRef.current = project?.name ?? null;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  const showToast = useCallback((message: string, durationMs = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

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
        setFurnitureLoading(false);
        setStatusMessage(`Furniture "${itemId}" is not in the catalog yet`);
        return;
      }

      // Measured flow: wait until Unity armed placement on the plan.
      if (arMode === 'measure' && !placementUnlockedRef.current) {
        pendingSpawnRef.current = itemId;
        setFurnitureLoading(false);
        setStatusMessage('Opening measured room — try again in a moment');
        return;
      }

      const placedCount = placedModelIds.filter((id) => id === itemId).length;
      if (!canPlaceMore(item.quantity, placedCount)) {
        const remaining = getRemainingPlacements(item.quantity, placedCount);
        setFurnitureLoading(false);
        setStatusMessage(
          remaining === 0 && (item.quantity ?? 0) > 0
            ? `${item.name} — all ${item.quantity} available placed`
            : `${item.name} is out of stock`
        );
        return;
      }

      const glbUrl = typeof item.model3D?.url === 'string' ? item.model3D.url : undefined;
      setFurnitureLoading(true);
      setStatusMessage(`Loading ${item.name}…`);
      if (furnitureLoadTimeoutRef.current) clearTimeout(furnitureLoadTimeoutRef.current);
      furnitureLoadTimeoutRef.current = setTimeout(() => {
        setFurnitureLoading((prev) => {
          if (!prev) return prev;
          setStatusMessage(`Still loading ${item.name} — check Wi‑Fi, or try again`);
          return false;
        });
      }, 45000);

      unityRef.current?.spawnFurniture({
        modelId: itemId,
        catalogId: mapFurnitureIdToUnity(itemId),
        glbUrl,
        width: item.dimensions.width,
        height: item.dimensions.height,
        depth: item.dimensions.length,
      });
    },
    [arMode, placedModelIds]
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
      if (furnitureLoading) return;

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [catalogItems, spawnCatalogItem, countPlaced, furnitureLoading]
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
    if (closingRef.current) return;

    const scene =
      normalizeUnitySceneName(sceneName) ??
      (arMode === 'measure' ? MEASUREMENT_UNITY_SCENE : FURNITURE_UNITY_SCENE);
    setActiveUnityScene(scene);

    const synced = isSceneSyncedForArMode(
      arMode,
      scene,
      measuredFurnitureActiveRef.current
    );
    if (synced) {
      markUnityPlayerWarm();
      setUnityReady(true);
      setUnityTimedOut(false);
    } else {
      unityRef.current?.resumeUnityPlayer?.();
    }

    if (arMode === 'measure') {
      // Do not unlock furniture from unityReady/ping — wait for reloadComplete after
      // openMeasuredFurnitureDesign arms placement on this scene.
      if (!measuredFurnitureActiveRef.current || !placementUnlockedRef.current) {
        setLibraryOpen(false);
      }
      setMeasurementModalVisible(false);
      if (!measuredFurnitureActiveRef.current) {
        setMeasurePlanReady(false);
      }
      setMeasureSavedPrompt(null);
      setExportResultDialog(null);
      setExportingMeasure(false);
      if (!measuredFurnitureActiveRef.current) {
        measurementFlowCompleteRef.current = false;
        setStatusMessage('Point the camera around the room to measure');
      }

      // Ping / late unityReady must not open/reload again after the first boot.
      if (
        modeBootedRef.current &&
        scene === MEASUREMENT_UNITY_SCENE &&
        !measureNeedsReloadRef.current
      ) {
        return;
      }

      if (scene !== MEASUREMENT_UNITY_SCENE) {
        modeBootedRef.current = true;
        measureNeedsReloadRef.current = false;
        unityRef.current?.resumeUnityPlayer?.();
        unityRef.current?.openRoomMeasurement();
      } else if (measureNeedsReloadRef.current) {
        modeBootedRef.current = true;
        measureNeedsReloadRef.current = false;
        unityRef.current?.reloadMeasurement();
      } else {
        // Fresh LoadScene already auto-starts the scan.
        modeBootedRef.current = true;
      }
      return;
    }

    // Furniture mode — wait until Unity is actually on ARDesignScene before showing RN chrome.
    if (scene === MEASUREMENT_UNITY_SCENE) {
      setLibraryOpen(false);
      setMeasurementModalVisible(false);
      setStatusMessage('Switching to AR Furniture…');
      // LoadScene + PendingBootAction boots furniture — do not soft-reload again after.
      furnitureNeedsReloadRef.current = false;
      unityRef.current?.resumeUnityPlayer?.();
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

    if (modeBootedRef.current && scene === FURNITURE_UNITY_SCENE) return;
    modeBootedRef.current = true;

    if (furnitureNeedsReloadRef.current) {
      furnitureNeedsReloadRef.current = false;
      // Warm player on ARDesignScene: clear placed items only — keep GLB memory/disk cache.
      if (isUnityPlayerWarm() && scene === FURNITURE_UNITY_SCENE) {
        unityRef.current?.resumeFurniture();
      } else {
        unityRef.current?.reloadFurniture();
      }
    } else {
      unityRef.current?.openFurnitureDesign();
    }

    if (initialFurniture && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      setSelectedLibraryItem(initialFurniture);
    }
  }, [arMode, initialFurniture]);

  const openLibrarySheet = useCallback(() => {
    if (libraryUserDismissedRef.current) return;
    setLibraryOpen(true);
  }, []);

  const unlockMeasuredFurnitureUi = useCallback(() => {
    if (placementUnlockedRef.current) return;

    placementUnlockedRef.current = true;
    openLibrarySheet();
    setMeasurementModalVisible(false);
    setMeasurePlanReady(true);
    setMeasuredFurnitureActive(true);
    measuredFurnitureActiveRef.current = true;
    setPlacementUnlocked(true);
    setRoomConfirmed(true);
    setScanProgress(1);
    setScanReady(true);
    setStatusMessage('Tap to place · 1 finger move · 2 on piece rotate · 2 on room orbit');
  }, [openLibrarySheet]);

  const handleReloadComplete = useCallback(
    (sceneName?: string) => {
      if (closingRef.current) return;

      markUnityPlayerWarm();
      setUnityReady(true);
      setUnityTimedOut(false);
      modeBootedRef.current = true;
      measureNeedsReloadRef.current = false;
      furnitureNeedsReloadRef.current = false;

      const scene =
        normalizeUnitySceneName(sceneName) ??
        (arMode === 'measure' ? MEASUREMENT_UNITY_SCENE : FURNITURE_UNITY_SCENE);
      setActiveUnityScene(scene);

      if (arMode === 'measure') {
        // Measured furniture unlocks on ARRoomMeasurement (no scene switch).
        if (measuredFurnitureActiveRef.current) {
          unlockMeasuredFurnitureUi();
          return;
        }

        setLibraryOpen(false);
        setMeasurementModalVisible(false);
        setMeasurePlanReady(false);
        setStatusMessage('Point the camera around the room to measure');
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
    },
    [arMode, unlockMeasuredFurnitureUi]
  );

  /** Dedicated unlock from Unity after openMeasuredFurnitureDesign (reloadComplete can drop on UaaL). */
  const handleMeasuredFurnitureReady = useCallback(
    (sceneName?: string) => {
      if (closingRef.current) return;
      if (arMode !== 'measure') return;

      markUnityPlayerWarm();
      setUnityReady(true);
      setUnityTimedOut(false);
      modeBootedRef.current = true;
      if (sceneName === 'ARRoomMeasurement' || sceneName === 'ARDesignScene') {
        setActiveUnityScene(sceneName);
      } else {
        setActiveUnityScene('ARRoomMeasurement');
      }
      measuredFurnitureActiveRef.current = true;
      setMeasuredFurnitureActive(true);
      const wasLocked = !placementUnlockedRef.current;
      unlockMeasuredFurnitureUi();
      if (wasLocked && __DEV__) {
        console.log('[ARViewUnity] measuredFurnitureReady from Unity');
      }
    },
    [arMode, unlockMeasuredFurnitureUi]
  );

  const furnitureUiReady =
    unityReady &&
    (arMode === 'furniture'
      ? activeUnityScene === FURNITURE_UNITY_SCENE
      : measuredFurnitureActive && measurePlanReady && placementUnlocked);

  const expectedUnityScene =
    arMode === 'furniture' ? FURNITURE_UNITY_SCENE : MEASUREMENT_UNITY_SCENE;
  const unitySceneSynced =
    activeUnityScene === expectedUnityScene ||
    (arMode === 'measure' &&
      measuredFurnitureActive &&
      activeUnityScene === MEASUREMENT_UNITY_SCENE);

  const measureHandoffPending =
    arMode === 'measure' && measuredFurnitureActive && !placementUnlocked;

  // Do NOT bulk-prefetch GLBs on open — sofa files are 70–250 MB and loading
  // many at once OOMs / freeze the device. Models load on place (with disk cache).

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

      // Measured room reapplied on ARDesignScene after handoff — unlock placement.
      if (arMode === 'measure' && measuredFurnitureActiveRef.current) {
        if (isSyntheticFurnitureOnlyRoom(payload)) {
          setStatusMessage('Waiting for measured room shell…');
          return;
        }
        if (placementUnlockedRef.current) {
          return;
        }
        setConfirmedPayload(payload);
        setMeasurementModalVisible(false);
        setMeasurePlanReady(true);
        setPlacementUnlocked(true);
        placementUnlockedRef.current = true;
        setRoomConfirmed(true);
        setScanProgress(1);
        setScanReady(true);
        openLibrarySheet();
        setActiveUnityScene('ARDesignScene');
        setStatusMessage('Tap to place · 1 finger move · 2 on piece rotate · 2 on room orbit');
        return;
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
      savedMeasurementIdRef.current = null;
      setMeasurementError(null);
      setMeasurePlanReady(false);
      measuredFurnitureActiveRef.current = false;
      setMeasuredFurnitureActive(false);
      setConfirmedPayload(payload);
      if (arMode === 'measure') {
        // Skip the name modal — save under the project name and go straight to placement.
        const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        setMeasureRoomName(projectNameRef.current?.trim() || `Room ${stamp}`);
        autoSaveMeasurePendingRef.current = true;
        setMeasurementModalVisible(false);
        setStatusMessage('Saving room measurement…');
      } else {
        setMeasureRoomName('');
        setMeasurementModalVisible(true);
        setStatusMessage('Room measured — save or continue to furniture');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (selectedLibraryItem) {
        pendingSpawnRef.current = selectedLibraryItem;
      }
    },
    [arMode, openLibrarySheet, selectedLibraryItem]
  );

  const clearMeasureExportTimeout = useCallback(() => {
    if (measureExportTimeoutRef.current) {
      clearTimeout(measureExportTimeoutRef.current);
      measureExportTimeoutRef.current = null;
    }
  }, []);

  const clearMeasureExportKickoff = useCallback(() => {
    if (measureExportKickoffTimeoutRef.current) {
      clearTimeout(measureExportKickoffTimeoutRef.current);
      measureExportKickoffTimeoutRef.current = null;
    }
  }, []);

  const clearAllMeasureExportTimers = useCallback(() => {
    clearMeasureExportTimeout();
    clearMeasureExportKickoff();
    measureExportStartedRef.current = false;
  }, [clearMeasureExportKickoff, clearMeasureExportTimeout]);

  const armMeasureExportTimeout = useCallback(
    (ms: number) => {
      clearMeasureExportTimeout();
      measureExportTimeoutRef.current = setTimeout(() => {
        setExportingMeasure((prev) => {
          if (prev) {
            setExportResultDialog({
              kind: 'error',
              message: 'Export timed out. Try Export 3D again.',
            });
            setStatusMessage('Export timed out');
          }
          return false;
        });
      }, ms);
    },
    [clearMeasureExportTimeout]
  );

  const finalizeMeasureExport = useCallback(
    async (payload: ExportResultPayload) => {
      let previewUri = payload.path;
      let projectId: string | undefined;
      let savedToProjects = false;
      let linkedToMeasurement = false;
      const sizeKb = Math.round((payload.byteLength || 0) / 1024);

      try {
        const project = await projectService.saveUnityLayoutExport(payload, activeProjectId);
        projectId = project.id;
        savedToProjects = true;
        setStatusMessage(`Saved to Projects · ${payload.fileName} (${sizeKb} KB)`);
      } catch (err) {
        console.warn('[ARViewUnity] Failed to save export to Projects:', err);
      }

      let measurementId = savedMeasurementIdRef.current;
      if (!measurementId && confirmedPayload) {
        try {
          const trimmed =
            measureRoomName.trim() ||
            payload.fileName?.replace(/\.glb$/i, '') ||
            'Room scan';
          const created = await RoomMeasurementService.save({
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
            name: trimmed,
            projectId,
          });
          measurementId = created.id;
          savedMeasurementIdRef.current = created.id;
          setMeasurementSaved(true);
        } catch (err) {
          console.warn('[ARViewUnity] Could not auto-save room for export link:', err);
        }
      }

      if (measurementId) {
        try {
          previewUri = await persistRoomExportGlb(measurementId, payload.path);
        } catch (err) {
          console.warn('[ARViewUnity] Could not copy export into app storage:', err);
          previewUri = payload.path;
        }

        try {
          await RoomMeasurementService.linkExport(measurementId, {
            projectId,
            exportPath: previewUri,
            exportFileName: payload.fileName,
            exportByteLength: payload.byteLength,
            exportFurnitureCount: payload.furnitureCount,
          });
          linkedToMeasurement = true;
          setStatusMessage('Export linked to this room measurement');
        } catch (err) {
          console.warn('[ARViewUnity] Failed to link export to measurement:', err);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setExportResultDialog({
        kind: 'success',
        roomName: measureRoomName.trim() || 'Room scan',
        fileName: payload.fileName || 'room-layout.glb',
        sizeKb,
        previewUri,
        projectId,
        furnitureCount: payload.furnitureCount,
        linkedToMeasurement,
        savedToProjects,
      });
    },
    [activeProjectId, confirmedPayload, measureRoomName]
  );

  const handleExportMeasure = useCallback(async () => {
    if (exportingMeasure) return;

    if (!measuredFurnitureActiveRef.current || !placementUnlockedRef.current) {
      setExportResultDialog({
        kind: 'error',
        message: 'Save the room name first, then wait for the furniture workspace to open.',
      });
      return;
    }

    setExportingMeasure(true);
    setStatusMessage('Creating 3D layout…');
    measureExportStartedRef.current = false;
    armMeasureExportTimeout(180_000);

    measureExportKickoffTimeoutRef.current = setTimeout(() => {
      if (!measureExportStartedRef.current) {
        clearAllMeasureExportTimers();
        setExportingMeasure(false);
        setExportResultDialog({
          kind: 'error',
          message:
            'Unity did not start export. Switch back to the app and try Export again.',
        });
        setStatusMessage('Export did not start');
      }
    }, 12_000);

    try {
      unityRef.current?.wakeUnityPlayer?.();
      unityRef.current?.exportLayout();
    } catch (err) {
      clearAllMeasureExportTimers();
      console.warn('[ARViewUnity] Unity export failed to start:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setExportingMeasure(false);
      setExportResultDialog({
        kind: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Could not create the 3D layout. Try Export 3D again.',
      });
    }
  }, [armMeasureExportTimeout, clearAllMeasureExportTimers, exportingMeasure]);

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
      savedMeasurementIdRef.current = saved.id;
      setMeasurementSaved(true);
      setStatusMessage(
        saved.dimensionLabel
          ? `Room saved — ${saved.name || saved.dimensionLabel}`
          : 'Room size saved to your account'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (arMode === 'measure') {
        showToast('Room measurement saved');
        // Unity commitRoomName opens the plan + arms furniture placement on this scene.
        libraryUserDismissedRef.current = false;
        measuredFurnitureActiveRef.current = true;
        setMeasuredFurnitureActive(true);
        setMeasurementModalVisible(false);
        setMeasurePlanReady(false);
        setPlacementUnlocked(false);
        placementUnlockedRef.current = false;
        setLibraryOpen(false);
        setStatusMessage('Opening measured room for furniture…');
        unityRef.current?.commitRoomName(trimmedName);
        const wakeUnity = () => unityRef.current?.wakeUnityPlayer?.();
        setTimeout(wakeUnity, 50);
        setTimeout(wakeUnity, 400);
        // Safety: if measurementPlanReady never arrives, unlock anyway.
        setTimeout(() => {
          if (!placementUnlockedRef.current && measuredFurnitureActiveRef.current) {
            console.warn('[ARViewUnity] Unlocking measured furniture UI (measurementPlanReady timeout)');
            unlockMeasuredFurnitureUi();
          }
        }, 2500);
      }
    } catch {
      setMeasurementError('Could not save. Check Wi‑Fi and that the backend is running.');
      if (arMode === 'measure') {
        // Auto-save failed — fall back to the modal so the user can retry or skip.
        setMeasurementModalVisible(true);
        setStatusMessage('Room measurement not saved');
      }
    } finally {
      setSavingMeasurement(false);
    }
  }, [
    arMode,
    confirmedPayload,
    measureRoomName,
    measurementSaved,
    savingMeasurement,
    showToast,
    unlockMeasuredFurnitureUi,
  ]);

  // Runs after the room-confirmed handler has committed payload + name to state.
  useEffect(() => {
    if (!autoSaveMeasurePendingRef.current) return;
    if (!confirmedPayload || !measureRoomName.trim()) return;
    autoSaveMeasurePendingRef.current = false;
    void handleSaveMeasurement();
  }, [confirmedPayload, handleSaveMeasurement, measureRoomName]);

  const startExportAfterSave = useCallback(() => {
    setMeasureSavedPrompt(null);
    setStatusMessage('Measurement saved — exporting 3D layout…');
    handleExportMeasure();
  }, [handleExportMeasure]);

  const handleCancelMeasureName = useCallback(() => {
    if (savingMeasurement) return;
    setMeasurementModalVisible(false);
    setMeasurementError(null);
    measuredFurnitureActiveRef.current = true;
    setMeasuredFurnitureActive(true);
    setMeasurePlanReady(false);
    setPlacementUnlocked(false);
    placementUnlockedRef.current = false;
    setLibraryOpen(false);
    setStatusMessage('Opening measured room for furniture…');
    unityRef.current?.cancelRoomName();
    const wakeUnity = () => unityRef.current?.wakeUnityPlayer?.();
    setTimeout(wakeUnity, 50);
    setTimeout(wakeUnity, 400);
    setTimeout(() => {
      if (!placementUnlockedRef.current && measuredFurnitureActiveRef.current) {
        console.warn('[ARViewUnity] Unlocking measured furniture UI (measurementPlanReady timeout)');
        unlockMeasuredFurnitureUi();
      }
    }, 2500);
  }, [savingMeasurement, unlockMeasuredFurnitureUi]);

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
      if (arMode === 'measure') {
        setStatusMessage('Selected — 1 finger drag · 2 fingers on piece to rotate');
      }
    } else {
      setSelectedPlacedModelId(null);
    }
  }, [arMode]);

  const handlePlacementSafety = useCallback((payload: PlacementSafetyPayload) => {
    if (payload.isSafe) {
      setStatusMessage(
        arMode === 'measure'
          ? 'Placed — 1 finger move · 2 fingers on piece to twist-rotate'
          : 'Placed — drag to move, pinch to scale, twist to rotate'
      );
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
  }, [arMode]);

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
    savedMeasurementIdRef.current = null;
    setMeasurementError(null);
    setSavingMeasurement(false);
    setMeasurePlanReady(false);
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

  const leaveArScreen = useCallback(
    (destination?: '/projects') => {
      if (closingRef.current) return;
      closingRef.current = true;
      setExitConfirmVisible(false);
      if (destination) router.replace(destination);
      else if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    },
    [router]
  );

  const resetMeasureSessionLocally = useCallback(() => {
    measurementFlowCompleteRef.current = false;
    measuredFurnitureActiveRef.current = false;
    libraryUserDismissedRef.current = false;
    setMeasuredFurnitureActive(false);
    savedMeasurementIdRef.current = null;
    setMeasurementModalVisible(false);
    setConfirmedPayload(null);
    setMeasurementSaved(false);
    setMeasurementError(null);
    setMeasureRoomName('');
    setMeasurePlanReady(false);
    setExportingMeasure(false);
    setMeasureSavedPrompt(null);
    setExportResultDialog(null);
    setRoomConfirmed(false);
    setScanProgress(0);
    setScanReady(false);
    setPlacementUnlocked(false);
    placementUnlockedRef.current = false;
    setPlacedModelIds([]);
    setSelectedPlacedModelId(null);
    setLibraryOpen(false);
    libraryUserDismissedRef.current = false;
  }, []);

  const resetFurnitureSessionLocally = useCallback(() => {
    autoSelectedRef.current = false;
    pendingSpawnRef.current = null;
    setPlacedModelIds([]);
    setSelectedPlacedModelId(null);
    setSelectedLibraryItem(null);
    setCanUndo(false);
    setCanRedo(false);
    setActiveTool('place');
    setLibraryOpen(true);
    setExportResultDialog(null);
    setExportingMeasure(false);
    setSavingPhoto(false);
    setStatusMessage('Select your desired furniture');
  }, []);

  /** Full RN + boot-flag reset when switching AR Furniture ↔ AR Measurement (Unity player stays alive). */
  useEffect(() => {
    closingRef.current = false;
    modeBootedRef.current = false;
    measuredFurnitureActiveRef.current = false;
    libraryUserDismissedRef.current = false;
    measurementFlowCompleteRef.current = false;
    placementUnlockedRef.current = false;
    autoSelectedRef.current = false;
    pendingSpawnRef.current = null;
    measureNeedsReloadRef.current = arMode === 'measure';
    furnitureNeedsReloadRef.current = arMode === 'furniture';

    setUnityReady(false);
    setUnityTimedOut(false);
    setActiveUnityScene(null);
    setMeasuredFurnitureActive(false);
    setPlacementUnlocked(false);
    setRoomConfirmed(false);
    setScanProgress(0);
    setScanReady(false);
    setPlacedModelIds([]);
    setSelectedPlacedModelId(null);
    setCanUndo(false);
    setCanRedo(false);
    setLibraryOpen(false);
    setMeasurementModalVisible(false);
    setConfirmedPayload(null);
    setMeasurementSaved(false);
    setMeasurementError(null);
    setMeasureRoomName('');
    setMeasurePlanReady(false);
    setExportingMeasure(false);
    setMeasureSavedPrompt(null);
    setExportResultDialog(null);
    setSelectedLibraryItem(initialFurniture ?? null);
    setStatusMessage(
      arMode === 'measure' ? 'Loading AR measurement…' : 'Loading AR Furniture…'
    );
  }, [arSessionKey, arMode, initialFurniture]);

  const bootstrapUnitySceneForSession = useCallback(() => {
    if (closingRef.current || !unityAvailable) return;
    try {
      unityRef.current?.resumeUnityPlayer?.();
    } catch {
      /* native view may not be attached yet */
    }
    if (arMode === 'furniture') {
      unityRef.current?.openFurnitureDesign();
      return;
    }
    if (measuredFurnitureActiveRef.current) return;
    unityRef.current?.openRoomMeasurement();
  }, [arMode, unityAvailable]);

  useEffect(() => {
    if (!mountUnity || !unityAvailable) return;
    const runBootAttempt = () => {
      bootstrapUnitySceneForSession();
      unityRef.current?.sendToUnity('ping', '');
    };
    const delays = isUnityPlayerWarm() ? [0, 120, 400, 900, 1800] : [400, 900, 1800];
    const timers = delays.map((ms) => setTimeout(runBootAttempt, ms));
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [arSessionKey, mountUnity, unityAvailable, bootstrapUnitySceneForSession]);

  useFocusEffect(
    useCallback(() => {
      if (!unityAvailable || !mountUnity) return;
      try {
        unityRef.current?.resumeUnityPlayer?.();
      } catch {
        /* native view may not be attached yet */
      }
    }, [unityAvailable, mountUnity])
  );

  const exitAr = useCallback((destination?: '/projects') => {
    if (closingRef.current) return;
    setExitConfirmVisible(false);

    if (arMode === 'measure') {
      resetMeasureSessionLocally();
      try {
        if (activeUnityScene === FURNITURE_UNITY_SCENE) {
          unityRef.current?.pauseFurniture();
        } else {
          unityRef.current?.pauseMeasurement();
        }
      } catch (err) {
        console.warn('[ARViewUnity] pause AR failed:', err);
      }
      measureNeedsReloadRef.current = true;
    } else {
      resetFurnitureSessionLocally();
      try {
        unityRef.current?.pauseFurniture();
      } catch (err) {
        console.warn('[ARViewUnity] pauseFurniture failed:', err);
      }
      furnitureNeedsReloadRef.current = true;
    }

    leaveArScreen(destination);
  }, [
    activeUnityScene,
    arMode,
    leaveArScreen,
    resetFurnitureSessionLocally,
    resetMeasureSessionLocally,
  ]);

  const confirmExitAr = useCallback(() => exitAr(), [exitAr]);

  const handleBack = useCallback(() => {
    if (closingRef.current) return;
    setExitConfirmVisible(true);
  }, []);

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
          onReloadComplete={handleReloadComplete}
          onMeasuredFurnitureReady={handleMeasuredFurnitureReady}
          onUnityUnavailable={handleUnityUnavailable}
          onRequestClose={() => {
            // Unity native back — same confirm flow as the RN chevron.
            setExitConfirmVisible(true);
          }}
          onScanStatus={handleScanStatus}
          onRoomScanConfirmed={handleRoomConfirmed}
          onLayoutChanged={handleLayoutChanged}
          onFurnitureSelected={handleFurnitureSelected}
          onPlacementSafety={handlePlacementSafety}
          onHistoryChanged={handleHistoryChanged}
          onFurnitureInstancePlaced={(payload) => {
            if (furnitureLoadTimeoutRef.current) {
              clearTimeout(furnitureLoadTimeoutRef.current);
              furnitureLoadTimeoutRef.current = null;
            }
            if (payload?.modelId) setSelectedPlacedModelId(payload.modelId);
            setFurnitureLoading(false);
            setStatusMessage(
              arMode === 'measure'
                ? 'Placed — 1 finger move · 2 on piece rotate'
                : 'Selected — drag to move, pinch to scale, twist to rotate'
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
          onFurnitureReady={() => {
            if (furnitureLoadTimeoutRef.current) {
              clearTimeout(furnitureLoadTimeoutRef.current);
              furnitureLoadTimeoutRef.current = null;
            }
            setFurnitureLoading(false);
            setStatusMessage(
              arMode === 'measure'
                ? 'Furniture ready — placed on your measured room'
                : 'Aim at the floor — tap when the black reticle appears'
            );
          }}
          onExportStarted={() => {
            if (arMode !== 'measure') return;
            measureExportStartedRef.current = true;
            clearMeasureExportKickoff();
            armMeasureExportTimeout(180_000);
          }}
          onExportComplete={(payload) => {
            // Measurement mode: Unity native Export used to be ignored — finalize here too
            // so GLB + Room Measurements link always happen.
            if (arMode === 'measure') {
              clearAllMeasureExportTimers();
              setExportingMeasure(false);
              if (!payload.success || !payload.path) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                setExportResultDialog({
                  kind: 'error',
                  message: payload.error || 'Export failed. Try Export 3D again.',
                });
                return;
              }
              void finalizeMeasureExport(payload);
              return;
            }

            clearAllMeasureExportTimers();
            setExportingMeasure(false);
            setStatusMessage(
              payload.success
                ? `Exported ${payload.fileName} (${Math.round((payload.byteLength || 0) / 1024)} KB)`
                : `Export failed: ${payload.error || 'unknown error'}`
            );

            if (!payload.success || !payload.path) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              return;
            }

            void projectService
              .saveUnityLayoutExport(payload, activeProjectId)
              .then((project) => {
                router.push(
                  buildModelPreviewExportHref({
                    uri: payload.path,
                    title: project.name || payload.fileName,
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
          }}
          onMeasurementPlanReady={() => {
            if (arMode !== 'measure') return;
            setMeasurePlanReady(true);
            if (measuredFurnitureActiveRef.current) {
              const wasLocked = !placementUnlockedRef.current;
              unlockMeasuredFurnitureUi();
              if (wasLocked && __DEV__) {
                console.log('[ARViewUnity] Unlocked furniture via measurementPlanReady');
              }
              return;
            }
            if (!measureSavedPrompt && !exportingMeasure) {
              setStatusMessage('Room plan ready — place furniture, then Export 3D');
            }
          }}
          onMeasurementPlanClosed={() => {
            // SoftClose / scene handoff closes the measurement plan — keep UI unlocked
            // while measured furniture placement is starting on ARDesignScene.
            if (measuredFurnitureActiveRef.current) return;
            setMeasurePlanReady(false);
          }}
          onRequestRnExport3d={() => {
            if (arMode !== 'measure') return;
            void handleExportMeasure();
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

            void projectService
              .addProjectPhoto(photoProjectIdRef.current, {
                uri,
                fileName: payload.fileName || `ar-photo-${Date.now()}.png`,
                byteLength: payload.byteLength || 0,
                capturedAt: Date.now(),
                gallerySaved: Boolean(payload.gallerySaved),
              })
              .then((project) => {
                photoProjectIdRef.current = project.id;
                setStatusMessage(
                  payload.gallerySaved
                    ? `Saved to Gallery + Projects · ${project.name}`
                    : `Saved to Projects · ${project.name}`
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                  () => {}
                );
              })
              .catch((err) => {
                console.warn('[ARViewUnity] Failed to save AR photo to Projects:', err);
              });
          }}
          onUnityError={(payload) => {
            if (furnitureLoadTimeoutRef.current) {
              clearTimeout(furnitureLoadTimeoutRef.current);
              furnitureLoadTimeoutRef.current = null;
            }
            setFurnitureLoading(false);
            setStatusMessage(payload.message || payload.code);
            if (
              payload.code === 'noMeasuredRoom' ||
              payload.code === 'applyMeasuredRoomFailed'
            ) {
              measuredFurnitureActiveRef.current = false;
              setMeasuredFurnitureActive(false);
              setPlacementUnlocked(false);
              placementUnlockedRef.current = false;
            }
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

      {unityAvailable && mountUnity && (!unityReady || !unitySceneSynced) && !unityTimedOut && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>
            {arMode === 'measure'
              ? activeUnityScene === FURNITURE_UNITY_SCENE
                ? 'Switching to AR Measurement…'
                : 'Starting AR Measurement…'
              : activeUnityScene === MEASUREMENT_UNITY_SCENE
                ? 'Switching to AR Furniture…'
                : 'Starting AR Furniture…'}
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
          furnitureLoading={furnitureLoading}
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
          onExport={
            arMode === 'measure'
              ? () => {
                  void handleExportMeasure();
                }
              : undefined
          }
          exportDisabled={arMode === 'measure' && exportingMeasure}
          onSavePhoto={handleSavePhoto}
          savingPhoto={savingPhoto}
          onRemoveSelected={() => unityRef.current?.removeSelectedFurniture()}
          onSetTool={setActiveTool}
          onToggleLibrary={() => {
            setLibraryOpen((open) => {
              const next = !open;
              libraryUserDismissedRef.current = !next;
              return next;
            });
          }}
          onBack={handleBack}
          enablePlannerOrbit={arMode === 'measure' && measuredFurnitureActive}
          onPlannerPointer={(payload) => unityRef.current?.plannerPointer(payload)}
          style={savingPhoto ? { opacity: 0, pointerEvents: 'none' } : undefined}
        />
      )}

      {measureHandoffPending && !furnitureUiReady && (
        <View style={styles.measureChrome} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.measureBackButton}
            onPress={handleBack}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#1C1B19" />
          </TouchableOpacity>
          <View style={styles.handoffChip} pointerEvents="none">
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.handoffChipText}>Opening measured room for furniture…</Text>
          </View>
        </View>
      )}

      {arMode === 'measure' &&
        unityAvailable &&
        (unityReady || unityTimedOut) &&
        !furnitureUiReady &&
        !measureHandoffPending && (
        <View style={styles.measureChrome} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.measureBackButton}
            onPress={handleBack}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#1C1B19" />
          </TouchableOpacity>
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

      <ARToastNotice message={toastMessage} />

      {/* Inline overlay, not <Modal>: an Android dialog window steals focus and pauses Unity mid-export. */}
      {arMode === 'measure' && exportingMeasure ? (
        <View style={styles.exportBusyBackdrop} pointerEvents="auto">
          <View style={styles.exportBusyCard}>
            <ActivityIndicator size="large" color="#0C295F" />
            <Text style={styles.exportBusyTitle}>Creating 3D layout…</Text>
            <Text style={styles.exportBusyBody}>
              Building your room model from the saved measurements and linking it to Room
              Measurements and Projects.
            </Text>
          </View>
        </View>
      ) : null}

      <AppDialog
        visible={exitConfirmVisible}
        title={arMode === 'measure' ? 'Exit measurement?' : 'Exit AR Furniture?'}
        message={
          arMode === 'measure'
            ? 'Are you sure you want to exit? Your current scan on screen will be cleared so the next open starts fresh.'
            : 'Are you sure you want to exit? Placed furniture on screen will be cleared so the next open starts fresh.'
        }
        icon="exit-outline"
        dismissOnBackdrop={!exportingMeasure && !savingMeasurement && !savingPhoto}
        onRequestClose={() => {
          if (exportingMeasure || savingMeasurement || savingPhoto) return;
          setExitConfirmVisible(false);
        }}
        actions={[
          {
            label: 'Stay',
            tone: 'ghost',
            onPress: () => setExitConfirmVisible(false),
          },
          {
            label: 'Yes, exit',
            tone: 'primary',
            onPress: confirmExitAr,
          },
        ]}
      />

      <AppDialog
        visible={Boolean(measureSavedPrompt)}
        title="Measurement saved"
        message={
          measureSavedPrompt
            ? `“${measureSavedPrompt.roomName}” is saved to Room Measurements. Next, export the 3D layout so you can preview it and find it in Projects.`
            : undefined
        }
        icon="checkmark-circle-outline"
        dismissOnBackdrop={false}
        onRequestClose={() => setMeasureSavedPrompt(null)}
        actions={[
          {
            label: 'Later',
            tone: 'ghost',
            onPress: () => {
              setMeasureSavedPrompt(null);
              setStatusMessage('Room saved — tap Export 3D anytime');
            },
          },
          {
            label: 'Export 3D',
            tone: 'primary',
            onPress: startExportAfterSave,
          },
        ]}
      />

      <AppDialog
        visible={exportResultDialog?.kind === 'success'}
        title="3D layout exported"
        message={
          exportResultDialog?.kind === 'success'
            ? [
                `“${exportResultDialog.roomName}” is ready (${exportResultDialog.sizeKb} KB).`,
                exportResultDialog.savedToProjects
                  ? 'Saved to Projects.'
                  : 'Could not add to Projects.',
                exportResultDialog.linkedToMeasurement
                  ? 'Linked for cube preview on Room Measurements.'
                  : 'Preview link could not be saved — try Export 3D again.',
              ].join(' ')
            : undefined
        }
        icon="checkmark-circle-outline"
        dismissOnBackdrop={false}
        onRequestClose={() => setExportResultDialog(null)}
        actions={
          exportResultDialog?.kind === 'success'
            ? [
                {
                  label: 'Done',
                  tone: 'ghost',
                  onPress: () => {
                    // Export is saved to the project — finish the AR session and show it in Projects.
                    setExportResultDialog(null);
                    exitAr('/projects');
                  },
                },
                {
                  label: 'View layout',
                  tone: 'primary',
                  onPress: () => {
                    const result = exportResultDialog;
                    setExportResultDialog(null);
                    if (!result || result.kind !== 'success') return;
                    router.push(
                      buildModelPreviewExportHref({
                        uri: result.previewUri,
                        title: result.fileName,
                        furnitureCount: result.furnitureCount,
                        projectId: result.projectId,
                      })
                    );
                  },
                },
              ]
            : undefined
        }
      />

      <AppDialog
        visible={exportResultDialog?.kind === 'error'}
        title="Export failed"
        message={exportResultDialog?.kind === 'error' ? exportResultDialog.message : undefined}
        icon="alert-circle-outline"
        variant="danger"
        onRequestClose={() => setExportResultDialog(null)}
        actions={[
          {
            label: 'Close',
            tone: 'ghost',
            onPress: () => setExportResultDialog(null),
          },
          {
            label: 'Try again',
            tone: 'primary',
            onPress: () => {
              setExportResultDialog(null);
              handleExportMeasure();
            },
          },
        ]}
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
    zIndex: 2,
  },
  handoffChip: {
    position: 'absolute',
    top: 54,
    left: 72,
    right: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(12, 41, 95, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 2,
  },
  handoffChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  measureTopActions: {
    position: 'absolute',
    top: 48,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  measureToolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureToolButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  measureExportButton: {
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
  measureLibrarySheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  measureLibraryTitle: {
    color: '#1C1B19',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 4,
  },
  measureLibraryState: {
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  measureLibraryStateText: {
    color: '#64748B',
    fontSize: 13,
  },
  measureLibraryRow: {
    paddingBottom: 4,
    paddingRight: 8,
  },
  measureItemCard: {
    width: 104,
    marginRight: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  measureItemCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  measureItemCardLocked: {
    opacity: 0.45,
  },
  measureItemCardLast: {
    marginRight: 4,
  },
  measureItemMedia: {
    height: 64,
    borderRadius: 10,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  measureItemThumb: {
    width: '100%',
    height: '100%',
  },
  measureItemSwatch: {
    width: '70%',
    height: '70%',
    borderRadius: 8,
  },
  measureItemName: {
    marginTop: 6,
    color: '#1C1B19',
    fontSize: 12,
    fontWeight: '600',
  },
  measureItemMeta: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 10,
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
  exportBusyBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  exportBusyCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  exportBusyTitle: {
    marginTop: spacing.sm,
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  exportBusyBody: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
