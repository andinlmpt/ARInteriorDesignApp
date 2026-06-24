/**
 * AR View Camera + GL viewport
 * Live camera feed with transparent Three.js overlay for furniture rendering.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, BarcodeScanningResult } from 'expo-camera';
import { GLView } from 'expo-gl';
import { ExpoWebGLRenderingContext } from 'expo-gl';
import { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

interface ARViewViewportProps {
  isARActive: boolean;
  markerTrackingEnabled: boolean;
  onMarkerScanned?: (result: BarcodeScanningResult) => void;
  onCanvasLayout: (event: LayoutChangeEvent) => void;
  onContextCreate: (gl: ExpoWebGLRenderingContext) => void;
  onResponderGrant: (event: GestureResponderEvent) => void;
  onResponderMove: (event: GestureResponderEvent) => void;
  onResponderRelease: (event: GestureResponderEvent) => void;
}

export function ARViewViewport({
  isARActive,
  markerTrackingEnabled,
  onMarkerScanned,
  onCanvasLayout,
  onContextCreate,
  onResponderGrant,
  onResponderMove,
  onResponderRelease,
}: ARViewViewportProps) {
  if (!isARActive) {
    return null;
  }

  return (
    <>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={markerTrackingEnabled ? onMarkerScanned : undefined}
        barcodeScannerSettings={markerTrackingEnabled ? { barcodeTypes: ['qr'] } : undefined}
      />
      <View
        style={styles.glContainer}
        onLayout={onCanvasLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onResponderGrant}
        onResponderMove={onResponderMove}
        onResponderRelease={onResponderRelease}
      >
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>
    </>
  );
}

import { styles } from '@/styles/arView.styles';
