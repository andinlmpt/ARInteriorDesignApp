import React, { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import UnityView from '@azesmway/react-native-unity';
import {
  UNITY_AR_GAME_OBJECT,
  UNITY_AR_RECEIVE_METHOD,
  type UnityInboundMessage,
  type UnityOutboundMessage,
} from '@/types/unity-bridge';

export interface UnityARViewerHandle {
  sendToUnity: (method: string, data: string) => void;
  clearFurniture: () => void;
  selectFurniture: (unityCatalogId: string) => void;
}

interface UnityARViewerProps {
  style?: ViewStyle;
  onUnityReady?: () => void;
  onFurniturePlaced?: (instanceName: string) => void;
  onUnityMessage?: (message: UnityOutboundMessage) => void;
}

export const UnityARViewer = forwardRef<UnityARViewerHandle, UnityARViewerProps>(
  function UnityARViewer(
    { style, onUnityReady, onFurniturePlaced, onUnityMessage },
    ref
  ) {
    const unityRef = useRef<UnityView>(null);
    const readyRef = useRef(false);

    const sendToUnity = useCallback((method: string, data: string) => {
      const payload: UnityInboundMessage = { method, data };
      unityRef.current?.postMessage(
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
      }),
      [sendToUnity]
    );

    const handleUnityMessage = useCallback(
      (event: { nativeEvent: { message: string } }) => {
        try {
          const msg = JSON.parse(event.nativeEvent.message) as UnityOutboundMessage;
          onUnityMessage?.(msg);

          if (msg.event === 'unityReady' && !readyRef.current) {
            readyRef.current = true;
            onUnityReady?.();
          }

          if (msg.event === 'furniturePlaced') {
            onFurniturePlaced?.(msg.data);
          }
        } catch {
          // Ignore malformed bridge payloads.
        }
      },
      [onFurniturePlaced, onUnityMessage, onUnityReady]
    );

    useEffect(() => {
      return () => {
        readyRef.current = false;
      };
    }, []);

    return (
      <View style={[styles.container, style]}>
        <UnityView
          ref={unityRef}
          style={styles.unity}
          fullScreen
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
});
