/**
 * useLiveScanCamera Hook
 * Manages camera permissions, state, and profile for live scanning
 */

import { useState, useEffect, useRef } from 'react';
import { useCameraPermissions, CameraView } from 'expo-camera';
import { Animated } from 'react-native';
import {
  DEFAULT_CAMERA_PROFILE,
  resolveCameraProfile,
  CameraPerformanceProfile,
} from '@/utils/device';
import type { RoomData, MappingQualitySnapshot, CalibrationStatus } from '@/types/spatial-mapping';
import { ANIMATION_CONFIG } from '@/config/liveScan.config';

interface UseLiveScanCameraReturn {
  // Permission
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: ReturnType<typeof useCameraPermissions>[1];
  // State
  isCameraReady: boolean;
  setIsCameraReady: (ready: boolean) => void;
  cameraProfile: CameraPerformanceProfile;
  // Refs
  cameraRef: React.RefObject<CameraView | null>;
  cameraProfileRef: React.MutableRefObject<CameraPerformanceProfile>;
  // Animation
  pulseAnim: Animated.Value;
  fadeAnim: Animated.Value;
}

export function useLiveScanCamera(): UseLiveScanCameraReturn {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraProfile, setCameraProfile] = useState<CameraPerformanceProfile>(DEFAULT_CAMERA_PROFILE);
  
  // Refs
  const cameraRef = useRef<CameraView>(null);
  const cameraProfileRef = useRef<CameraPerformanceProfile>(DEFAULT_CAMERA_PROFILE);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Request permission if not already granted
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Keep camera profile ref in sync
  useEffect(() => {
    cameraProfileRef.current = cameraProfile;
  }, [cameraProfile]);

  // Resolve camera profile on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const profile = await resolveCameraProfile();
      if (mounted) {
        setCameraProfile(profile);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    permission,
    requestPermission,
    isCameraReady,
    setIsCameraReady,
    cameraProfile,
    cameraRef,
    cameraProfileRef,
    pulseAnim,
    fadeAnim,
  };
}

/**
 * Hook to manage scanning animations
 */
export function useScanAnimations(
  isScanning: boolean,
  pulseAnim: Animated.Value,
  fadeAnim: Animated.Value
) {
  useEffect(() => {
    if (isScanning) {
      // Pulse animation loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: ANIMATION_CONFIG.PULSE_SCALE,
            duration: ANIMATION_CONFIG.PULSE_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: ANIMATION_CONFIG.PULSE_DURATION,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_CONFIG.FADE_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [isScanning, pulseAnim, fadeAnim]);
}

