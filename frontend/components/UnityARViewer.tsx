import React, { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import {
  UNITY_AR_GAME_OBJECT,
  UNITY_AR_RECEIVE_METHOD,
  parseUnityPayload,
  type ExportResultPayload,
  type ARPhotoCapturedPayload,
  type HistoryStatePayload,
  type LayoutPayload,
  type PlacedFurniturePayload,
  type ScanStatusPayload,
  type RoomConfirmedPayload,
  type SelectionPayload,
  type SpawnFurnitureRequest,
  type UnityErrorPayload,
  type UnityInboundMessage,
  type UnityOutboundMessage,
  type PlacementSafetyPayload,
} from '@/types/unity-bridge';
import { isUnityViewAvailable } from '@/utils/unityAvailability';

export interface UnityARViewerHandle {
  sendToUnity: (method: string, data: string) => void;

  // ARFurniture scene (legacy single-item flow)
  clearFurniture: () => void;
  selectFurniture: (unityCatalogId: string) => void;

  // ARDesignScene: scan → confirm → place → export
  startRoomScan: () => void;
  /** Skip measurement; unlock live floor placement (RN AR Furniture). */
  startFurniturePlacement: () => void;
  /** Load Unity ARRoomMeasurement scene (native measurement HUDs). */
  openRoomMeasurement: () => void;
  /** Ensure ARDesignScene + furniture placement (safe after measurement). */
  openFurnitureDesign: () => void;
  /** Asks Unity to push a fresh `scanStatus` event. Progress is also pushed automatically. */
  getScanStatus: () => void;
  confirmRoomScan: () => void;
  spawnFurniture: (request: SpawnFurnitureRequest) => void;
  removeSelectedFurniture: () => void;
  clearScene: () => void;
  /** Asks Unity to push a fresh `layoutChanged` event. */
  getCurrentLayout: () => void;
  /** Writes the room + furniture GLB to disk; the path arrives via `onExportComplete`. */
  exportLayout: () => void;
  /** Screenshots the AR view; result arrives via `onPhotoCaptured`. */
  capturePhoto: () => void;
  undo: () => void;
  redo: () => void;
  /** AR Measurement: apply room name from RN modal and open the plan HUD. */
  commitRoomName: (name: string) => void;
  /** AR Measurement: dismiss name modal with "Untitled room". */
  cancelRoomName: () => void;
}

interface UnityARViewerProps {
  style?: ViewStyle;
  onUnityReady?: (sceneName?: string) => void;
  onUnityMessage?: (message: UnityOutboundMessage) => void;
  onUnityUnavailable?: () => void;

  /** Raw instance name. Kept for the legacy ARFurniture scene. */
  onFurniturePlaced?: (instanceName: string) => void;

  // ARDesignScene events
  onFurnitureInstancePlaced?: (payload: PlacedFurniturePayload) => void;
  onScanStatus?: (payload: ScanStatusPayload) => void;
  onRoomScanConfirmed?: (payload: RoomConfirmedPayload) => void;
  onFurnitureSelected?: (payload: SelectionPayload) => void;
  onFurnitureRemoved?: (instanceId: string) => void;
  onLayoutChanged?: (payload: LayoutPayload) => void;
  onExportComplete?: (payload: ExportResultPayload) => void;
  onPhotoCaptured?: (payload: ARPhotoCapturedPayload) => void;
  onHistoryChanged?: (payload: HistoryStatePayload) => void;
  onPlacementSafety?: (payload: PlacementSafetyPayload) => void;
  onUnityError?: (payload: UnityErrorPayload) => void;
  /** Unity native back / exit from ARRoomMeasurement. */
  onRequestClose?: () => void;
  /** Measurement plan HUD opened (after room name) — show RN Export. */
  onMeasurementPlanReady?: () => void;
  /** Measurement plan HUD closed. */
  onMeasurementPlanClosed?: () => void;
}

type UnityViewComponent = React.ComponentType<{
  ref?: React.Ref<unknown>;
  style?: ViewStyle;
  fullScreen?: boolean;
  androidKeepPlayerMounted?: boolean;
  onUnityMessage?: (event: { nativeEvent: { message: string } }) => void;
}> & {
  postMessage?: (gameObject: string, methodName: string, message: string) => void;
};

function loadUnityView(): UnityViewComponent | null {
  if (!isUnityViewAvailable()) {
    return null;
  }

  try {
    // Lazy require so missing native manager never evaluates at module load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@azesmway/react-native-unity');
    return (mod.default ?? mod) as UnityViewComponent;
  } catch (error) {
    console.warn('[UnityARViewer] Failed to load UnityView module:', error);
    return null;
  }
}

export const UnityARViewer = forwardRef<UnityARViewerHandle, UnityARViewerProps>(
  function UnityARViewer(
    {
      style,
      onUnityReady,
      onFurniturePlaced,
      onUnityMessage,
      onUnityUnavailable,
      onFurnitureInstancePlaced,
      onScanStatus,
      onRoomScanConfirmed,
      onFurnitureSelected,
      onFurnitureRemoved,
      onLayoutChanged,
      onExportComplete,
      onPhotoCaptured,
      onHistoryChanged,
      onPlacementSafety,
      onUnityError,
      onRequestClose,
      onMeasurementPlanReady,
      onMeasurementPlanClosed,
    },
    ref
  ) {
    const unityRef = useRef<{ postMessage?: (a: string, b: string, c: string) => void } | null>(null);
    const readyRef = useRef(false);
    const UnityView = useRef<UnityViewComponent | null>(loadUnityView()).current;
    const unavailableNotified = useRef(false);

    useEffect(() => {
      if (!UnityView && !unavailableNotified.current) {
        unavailableNotified.current = true;
        onUnityUnavailable?.();
      }
    }, [UnityView, onUnityUnavailable]);

    const sendToUnity = useCallback((method: string, data: string) => {
      if (!unityRef.current?.postMessage) return;
      const payload: UnityInboundMessage = { method, data };
      unityRef.current.postMessage(
        UNITY_AR_GAME_OBJECT,
        UNITY_AR_RECEIVE_METHOD,
        JSON.stringify(payload)
      );
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        sendToUnity,
        clearFurniture: () => sendToUnity('clearFurniture', ''),
        selectFurniture: (unityCatalogId: string) =>
          sendToUnity('selectFurniture', unityCatalogId),

        startRoomScan: () => sendToUnity('startRoomScan', ''),
        startFurniturePlacement: () => sendToUnity('startFurniturePlacement', ''),
        openRoomMeasurement: () => sendToUnity('openRoomMeasurement', ''),
        openFurnitureDesign: () => sendToUnity('openFurnitureDesign', ''),
        getScanStatus: () => sendToUnity('getScanStatus', ''),
        confirmRoomScan: () => sendToUnity('confirmRoomScan', ''),
        spawnFurniture: (request: SpawnFurnitureRequest) =>
          sendToUnity('spawnFurniture', JSON.stringify(request)),
        removeSelectedFurniture: () => sendToUnity('removeSelectedFurniture', ''),
        clearScene: () => sendToUnity('clearScene', ''),
        getCurrentLayout: () => sendToUnity('getCurrentLayout', ''),
        exportLayout: () => sendToUnity('exportLayout', ''),
        capturePhoto: () => sendToUnity('capturePhoto', ''),
        undo: () => sendToUnity('undo', ''),
        redo: () => sendToUnity('redo', ''),
        commitRoomName: (name: string) => sendToUnity('commitRoomName', name ?? ''),
        cancelRoomName: () => sendToUnity('cancelRoomName', ''),
      }),
      [sendToUnity]
    );

    const handleUnityMessage = useCallback(
      (event: { nativeEvent: { message: string } }) => {
        let msg: UnityOutboundMessage;
        try {
          msg = JSON.parse(event.nativeEvent.message) as UnityOutboundMessage;
        } catch {
          return; // Ignore malformed bridge payloads.
        }

        onUnityMessage?.(msg);

        switch (msg.event) {
          case 'unityReady':
            readyRef.current = true;
            onUnityReady?.(typeof msg.data === 'string' ? msg.data : undefined);
            break;

          case 'furniturePlaced': {
            onFurniturePlaced?.(msg.data);
            const payload = parseUnityPayload<PlacedFurniturePayload>(msg);
            if (payload) onFurnitureInstancePlaced?.(payload);
            break;
          }

          case 'scanStatus': {
            const payload = parseUnityPayload<ScanStatusPayload>(msg);
            if (payload) onScanStatus?.(payload);
            break;
          }

          case 'roomScanConfirmed': {
            const payload = parseUnityPayload<RoomConfirmedPayload>(msg);
            if (payload) onRoomScanConfirmed?.(payload);
            break;
          }

          case 'furnitureSelected': {
            const payload = parseUnityPayload<SelectionPayload>(msg);
            if (payload) onFurnitureSelected?.(payload);
            break;
          }

          case 'furnitureRemoved':
            onFurnitureRemoved?.(msg.data);
            break;

          case 'layoutChanged': {
            const payload = parseUnityPayload<LayoutPayload>(msg);
            if (payload) onLayoutChanged?.(payload);
            break;
          }

          case 'exportComplete': {
            const payload = parseUnityPayload<ExportResultPayload>(msg);
            onExportComplete?.(
              payload ?? {
                success: false,
                path: '',
                fileName: '',
                byteLength: 0,
                furnitureCount: 0,
                roomMeshCount: 0,
                error: 'Invalid export response from Unity',
              }
            );
            break;
          }

          case 'photoCaptured': {
            const payload = parseUnityPayload<ARPhotoCapturedPayload>(msg);
            if (payload) onPhotoCaptured?.(payload);
            break;
          }

          case 'historyChanged': {
            const payload = parseUnityPayload<HistoryStatePayload>(msg);
            if (payload) onHistoryChanged?.(payload);
            break;
          }

          case 'placementSafety': {
            const payload = parseUnityPayload<PlacementSafetyPayload>(msg);
            if (payload) onPlacementSafety?.(payload);
            break;
          }

          case 'error': {
            const payload = parseUnityPayload<UnityErrorPayload>(msg);
            onUnityError?.(payload ?? { code: 'unknown', message: msg.data });
            break;
          }

          case 'requestClose':
            onRequestClose?.();
            break;

          case 'measurementPlanReady':
            onMeasurementPlanReady?.();
            break;

          case 'measurementPlanClosed':
            onMeasurementPlanClosed?.();
            break;
        }
      },
      [
        onExportComplete,
        onPhotoCaptured,
        onFurnitureInstancePlaced,
        onFurniturePlaced,
        onFurnitureRemoved,
        onFurnitureSelected,
        onHistoryChanged,
        onPlacementSafety,
        onLayoutChanged,
        onMeasurementPlanClosed,
        onMeasurementPlanReady,
        onRequestClose,
        onRoomScanConfirmed,
        onScanStatus,
        onUnityError,
        onUnityMessage,
        onUnityReady,
      ]
    );

    useEffect(() => {
      return () => {
        readyRef.current = false;
      };
    }, []);

    if (!UnityView) {
      return (
        <View style={[styles.container, style, styles.fallback]}>
          <Text style={styles.fallbackTitle}>Unity AR not in this build</Text>
          <Text style={styles.fallbackBody}>
            The native Unity view is missing, so True Floor AR cannot start. Use the camera floor
            preview, or rebuild the app with a Unity export.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        <UnityView
          ref={unityRef}
          style={styles.unity}
          fullScreen
          androidKeepPlayerMounted
          onUnityMessage={handleUnityMessage}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  unity: {
    flex: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  fallbackBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
