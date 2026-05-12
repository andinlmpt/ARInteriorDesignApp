/**
 * useLiveScanProcessing Hook
 * Manages frame processing, room scanning, and mapping state
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { CameraView } from 'expo-camera';
import { enhancedImageAnalysisService } from '@/services/EnhancedImageAnalysisService';
import { enhancedSpatialMappingService } from '@/services/EnhancedSpatialMappingService';
import type { 
  RoomData, 
  CalibrationStatus, 
  MappingQualitySnapshot 
} from '@/types/spatial-mapping';
import type { CameraPerformanceProfile } from '@/utils/device';
import { 
  SCAN_TIMING, 
  UI_CONSTANTS,
  CALIBRATION_STATUS 
} from '@/config/liveScan.config';

interface UseLiveScanProcessingProps {
  cameraRef: React.RefObject<CameraView | null>;
  cameraProfileRef: React.MutableRefObject<CameraPerformanceProfile>;
  isCameraReady: boolean;
  permissionGranted: boolean;
  cameraProfile: CameraPerformanceProfile;
}

interface UseLiveScanProcessingReturn {
  // State
  isScanning: boolean;
  roomData: RoomData | null;
  fps: number;
  confidence: number;
  calibrationStatus: CalibrationStatus;
  framesProcessed: number;
  coverage: number;
  scanDurationMs: number;
  recentSnapshots: MappingQualitySnapshot[];
  heatmapUpdatedAt: number | null;
  // Actions
  startLiveScanning: () => void;
  stopLiveScanning: () => void;
  handleRecalibrate: () => void;
  handleSaveScan: () => void;
  // Refs
  roomDataRef: React.MutableRefObject<RoomData | null>;
}

export function useLiveScanProcessing({
  cameraRef,
  cameraProfileRef,
  isCameraReady,
  permissionGranted,
  cameraProfile,
}: UseLiveScanProcessingProps): UseLiveScanProcessingReturn {
  const router = useRouter();
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [fps, setFps] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>('idle');
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [coverage, setCoverage] = useState(0);
  const [scanDurationMs, setScanDurationMs] = useState(0);
  const [recentSnapshots, setRecentSnapshots] = useState<MappingQualitySnapshot[]>([]);
  const [heatmapUpdatedAt, setHeatmapUpdatedAt] = useState<number | null>(null);

  // Refs
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const summaryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingFrameRef = useRef(false);
  const lastFullScanRef = useRef(0);
  const roomDataRef = useRef<RoomData | null>(null);
  const captureAndProcessFrameRef = useRef<(() => Promise<void>) | null>(null);

  // Keep room data ref in sync
  useEffect(() => {
    roomDataRef.current = roomData;
  }, [roomData]);

  // Apply mapping summary from service
  const applyMappingSummary = useCallback(() => {
    const summary = enhancedSpatialMappingService.getMappingSummary();
    setCalibrationStatus(summary.calibrationStatus);
    setFramesProcessed(summary.framesProcessed);
    setCoverage(summary.coverage);
    setRecentSnapshots(summary.recentSnapshots.slice(-UI_CONSTANTS.MAX_TREND_SNAPSHOTS));
    
    if (summary.heatmap && summary.lastHeatmapSnapshotAt) {
      setHeatmapUpdatedAt(summary.lastHeatmapSnapshotAt);
    }
    if (summary.roomData) {
      roomDataRef.current = summary.roomData;
      setRoomData(summary.roomData);
      setConfidence(summary.confidence);
    }
    if (summary.fps > 0) {
      setFps(summary.fps);
    }
  }, []);

  // Capture and process a single frame
  const captureAndProcessFrame = useCallback(async () => {
    if (!isCameraReady || !cameraRef.current || isProcessingFrameRef.current) {
      return;
    }

    isProcessingFrameRef.current = true;

    try {
      const activeProfile = cameraProfileRef.current;
      
      // Small delay to ensure camera has enough data
      await new Promise(resolve => setTimeout(resolve, SCAN_TIMING.PRE_CAPTURE_DELAY));
      
      // Check if camera is still available
      if (!cameraRef.current) {
        isProcessingFrameRef.current = false;
        return;
      }

      let photo;
      try {
        photo = await cameraRef.current.takePictureAsync({
          quality: activeProfile.captureQuality,
          skipProcessing: activeProfile.skipProcessing,
        });
      } catch (captureError: any) {
        // Handle "not enough camera data" error silently
        if (captureError?.message?.includes('camera data') || 
            captureError?.message?.includes('HTMLVideoElement')) {
          console.log('[LiveScan] Camera warming up, waiting for more frames...');
          isProcessingFrameRef.current = false;
          return;
        }
        throw captureError;
      }

      if (!photo?.uri) {
        isProcessingFrameRef.current = false;
        return;
      }

      const frameSource = photo.uri;

      // Process frame through image analysis
      const frameResult = await enhancedImageAnalysisService.processFrame(frameSource);
      const analysisFps = enhancedImageAnalysisService.getCurrentFPS();
      if (analysisFps > 0) {
        setFps(analysisFps);
      }

      // Process frame through spatial mapping
      await enhancedSpatialMappingService.processFrame(frameSource);
      const mappingFps = enhancedSpatialMappingService.getCurrentFPS();
      if (mappingFps > 0) {
        setFps(mappingFps);
      }

      // Update obstacles from frame result
      if (frameResult.obstacles.length > 0) {
        let updatedRoomData: RoomData | null = null;
        setRoomData((prev) => {
          if (!prev) return prev;
          updatedRoomData = { ...prev, obstacles: frameResult.obstacles };
          return updatedRoomData;
        });
        if (updatedRoomData) {
          roomDataRef.current = updatedRoomData;
          enhancedSpatialMappingService.setLatestRoomData(updatedRoomData);
        }
      }

      if (frameResult.confidence > 0) {
        setConfidence((prev) => Math.max(prev, frameResult.confidence));
      }

      // Perform full room scan periodically
      const now = Date.now();
      const hasBaselineRoom = roomDataRef.current !== null;
      if (!hasBaselineRoom || now - lastFullScanRef.current > SCAN_TIMING.FULL_SCAN_INTERVAL) {
        try {
          const fullRoomData = await enhancedImageAnalysisService.performRoomScan(frameSource);
          lastFullScanRef.current = now;
          roomDataRef.current = fullRoomData;
          setRoomData(fullRoomData);
          setConfidence(fullRoomData.confidence);
          enhancedSpatialMappingService.setLatestRoomData(fullRoomData);
        } catch (scanError: any) {
          if (scanError?.message === 'NO_CAMERA_DATA') {
            console.log('[LiveScan] Waiting for valid camera data...');
          } else {
            throw scanError;
          }
        }
      }
      
      applyMappingSummary();
    } catch (error) {
      console.error('Scanning error:', error);
    } finally {
      const resumePreview = (cameraRef.current as any)?.resumePreview;
      if (typeof resumePreview === 'function') {
        resumePreview.call(cameraRef.current);
      }
      isProcessingFrameRef.current = false;
    }
  }, [isCameraReady, cameraRef, cameraProfileRef, applyMappingSummary]);

  // Keep captureAndProcessFrame ref updated
  useEffect(() => {
    captureAndProcessFrameRef.current = captureAndProcessFrame;
  }, [captureAndProcessFrame]);

  // Duration update interval
  useEffect(() => {
    if (!isScanning) return;

    const durationInterval = setInterval(() => {
      const duration = enhancedSpatialMappingService.getScanDuration();
      setScanDurationMs(duration);
    }, SCAN_TIMING.DURATION_UPDATE_INTERVAL);

    return () => clearInterval(durationInterval);
  }, [isScanning]);

  // Frame capture interval based on camera profile
  useEffect(() => {
    if (!isScanning) return;

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(
      () => captureAndProcessFrameRef.current?.(),
      cameraProfile.frameIntervalMs
    );

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraProfile.frameIntervalMs, isScanning]);

  // Start live scanning
  const startLiveScanning = useCallback(() => {
    if (!permissionGranted || !isCameraReady || scanIntervalRef.current) {
      return;
    }

    // Start fresh session
    enhancedImageAnalysisService.startNewSession();
    
    setIsScanning(true);
    enhancedSpatialMappingService.startMapping();
    setCalibrationStatus('calibrating');
    setScanDurationMs(0);
    setFramesProcessed(0);
    setCoverage(0);

    // Initial capture after warmup delay
    setTimeout(() => {
      captureAndProcessFrameRef.current?.();
    }, SCAN_TIMING.INITIAL_CAPTURE_DELAY);
    
    // Summary interval
    summaryIntervalRef.current = setInterval(() => {
      applyMappingSummary();
    }, SCAN_TIMING.SUMMARY_INTERVAL);
  }, [permissionGranted, isCameraReady, applyMappingSummary]);

  // Stop live scanning
  const stopLiveScanning = useCallback(() => {
    setIsScanning(false);
    enhancedSpatialMappingService.stopMapping();

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (summaryIntervalRef.current) {
      clearInterval(summaryIntervalRef.current);
      summaryIntervalRef.current = null;
    }
    isProcessingFrameRef.current = false;
    lastFullScanRef.current = 0;
  }, []);

  // Recalibrate
  const handleRecalibrate = useCallback(() => {
    enhancedImageAnalysisService.forceNewSession();
    enhancedSpatialMappingService.startMapping();
    setCalibrationStatus('calibrating');
    setScanDurationMs(0);
    setFramesProcessed(0);
    setCoverage(0);
    setRoomData(null);
    roomDataRef.current = null;
    lastFullScanRef.current = 0;
    applyMappingSummary();
  }, [applyMappingSummary]);

  // Save scan and navigate
  const handleSaveScan = useCallback(() => {
    if (!roomData) return;
    
    router.push({
      pathname: '/spatial-mapping',
      params: { 
        fromLiveScan: 'true',
        roomDataJson: JSON.stringify(roomData),
      },
    });
  }, [roomData, router]);

  // Store refs for stable function references
  const startLiveScanningRef = useRef(startLiveScanning);
  const stopLiveScanningRef = useRef(stopLiveScanning);
  
  useEffect(() => {
    startLiveScanningRef.current = startLiveScanning;
  }, [startLiveScanning]);
  
  useEffect(() => {
    stopLiveScanningRef.current = stopLiveScanning;
  }, [stopLiveScanning]);

  // Auto-start scanning when camera is ready
  useEffect(() => {
    if (permissionGranted && isCameraReady) {
      const startTimeout = setTimeout(() => {
        startLiveScanningRef.current();
      }, SCAN_TIMING.CAMERA_READY_DELAY);
      
      return () => {
        clearTimeout(startTimeout);
        stopLiveScanningRef.current();
      };
    }

    return () => {
      stopLiveScanningRef.current();
    };
  }, [permissionGranted, isCameraReady]);

  return {
    isScanning,
    roomData,
    fps,
    confidence,
    calibrationStatus,
    framesProcessed,
    coverage,
    scanDurationMs,
    recentSnapshots,
    heatmapUpdatedAt,
    startLiveScanning,
    stopLiveScanning,
    handleRecalibrate,
    handleSaveScan,
    roomDataRef,
  };
}

