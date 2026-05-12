/**
 * Live Scan Types
 * TypeScript definitions for live scanning functionality
 */

import type { CameraView } from 'expo-camera';
import type { Animated } from 'react-native';
import type { 
  RoomData, 
  CalibrationStatus, 
  MappingQualitySnapshot 
} from '@/types/spatial-mapping';
import type { CameraPerformanceProfile } from '@/utils/device';

// Scan state
export interface LiveScanState {
  isScanning: boolean;
  roomData: RoomData | null;
  fps: number;
  confidence: number;
  isCameraReady: boolean;
  calibrationStatus: CalibrationStatus;
  framesProcessed: number;
  coverage: number;
  scanDurationMs: number;
  recentSnapshots: MappingQualitySnapshot[];
  heatmapUpdatedAt: number | null;
}

// ML detection state (disabled)
export interface MLDetectionState {
  useRealDetection: boolean;
  mlModelReady: boolean;
  mlModelLoading: boolean;
  mlModelError: string | null;
}

// Camera refs
export interface CameraRefs {
  cameraRef: React.RefObject<CameraView>;
  scanIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  summaryIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  isProcessingFrameRef: React.MutableRefObject<boolean>;
  lastFullScanRef: React.MutableRefObject<number>;
  roomDataRef: React.MutableRefObject<RoomData | null>;
  cameraProfileRef: React.MutableRefObject<CameraPerformanceProfile>;
  captureAndProcessFrameRef: React.MutableRefObject<(() => Promise<void>) | null>;
}

// Animation refs
export interface AnimationRefs {
  pulseAnim: Animated.Value;
  fadeAnim: Animated.Value;
}

// Scan control functions
export interface ScanControls {
  startLiveScanning: () => void;
  stopLiveScanning: () => void;
  handleRecalibrate: () => void;
  captureAndProcessFrame: () => Promise<void>;
}

// Quality bar props
export interface QualityBarProps {
  snapshot: MappingQualitySnapshot;
  index: number;
}

