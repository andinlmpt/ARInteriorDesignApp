/**
 * useSpatialMappingScan Hook
 * Manages room scanning state and logic
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spatialMappingService } from '@/services/SpatialMappingService';
import { professionalDesignService } from '@/services/ProfessionalDesignService';
import type { ProfessionalReport } from '@/services/ProfessionalDesignService';
import type { RoomData, SpatialMappingResult } from '@/types/spatial-mapping';
import type { ScanStats } from '@/types/spatial-mapping-ui';
import { 
  SCAN_STAGES, 
  SCAN_TIMING, 
  STORAGE_KEYS, 
  MAX_HISTORY_ITEMS 
} from '@/config/spatialMapping.config';
import type { ScanStage } from '@/config/spatialMapping.config';

interface UseSpatialMappingScanReturn {
  // State
  isScanning: boolean;
  scanComplete: boolean;
  roomData: RoomData | null;
  scanResult: SpatialMappingResult | null;
  scanProgress: number;
  currentStage: ScanStage;
  scanStats: ScanStats;
  error: string | null;
  scanHistory: SpatialMappingResult[];
  professionalReport: ProfessionalReport | null;
  // Actions
  startScan: (imageUri?: string) => Promise<void>;
  resetScan: () => void;
  setRoomData: (data: RoomData | null) => void;
  setScanResult: (result: SpatialMappingResult | null) => void;
}

export function useSpatialMappingScan(): UseSpatialMappingScanReturn {
  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [scanResult, setScanResult] = useState<SpatialMappingResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<ScanStage>(SCAN_STAGES[0]);
  const [scanStats, setScanStats] = useState<ScanStats>({
    planesDetected: 0,
    obstaclesFound: 0,
    confidence: 0,
    processingTime: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<SpatialMappingResult[]>([]);
  const [professionalReport, setProfessionalReport] = useState<ProfessionalReport | null>(null);

  // Refs for intervals
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load scan history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const historyJson = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
        if (historyJson) {
          const parsed = JSON.parse(historyJson) as SpatialMappingResult[];
          if (Array.isArray(parsed)) {
            setScanHistory(parsed.slice(-MAX_HISTORY_ITEMS));
          }
        }
      } catch (error) {
        console.warn('[SpatialMapping] Failed to load scan history:', error);
      }
    };
    loadHistory();
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
      }
    };
  }, []);

  // Save scan to history
  const saveScanToHistory = useCallback(async (result: SpatialMappingResult) => {
    try {
      const updated = [...scanHistory, result].slice(-MAX_HISTORY_ITEMS);
      setScanHistory(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
    } catch (error) {
      console.warn('[SpatialMapping] Failed to save scan history:', error);
    }
  }, [scanHistory]);

  // Start scan
  const startScan = useCallback(async (imageUri?: string) => {
    setIsScanning(true);
    setScanProgress(0);
    setError(null);
    setCurrentStage(SCAN_STAGES[0]);
    setScanStats({ planesDetected: 0, obstaclesFound: 0, confidence: 0, processingTime: 0 });
    
    const startTime = Date.now();
    let stageIndex = 0;

    // Update scan stage periodically
    stageIntervalRef.current = setInterval(() => {
      if (stageIndex < SCAN_STAGES.length - 1) {
        stageIndex++;
        const newStage = SCAN_STAGES[stageIndex];
        setCurrentStage(newStage);
        setScanProgress(newStage.progress);
      }
    }, SCAN_TIMING.STAGE_INTERVAL);

    // Smooth progress updates
    progressIntervalRef.current = setInterval(() => {
      setScanProgress((prev) => {
        const currentStageProgress = SCAN_STAGES[stageIndex]?.progress || 0;
        if (prev >= currentStageProgress - 1) {
          return Math.min(SCAN_TIMING.MAX_PROGRESS, prev);
        }
        return Math.min(SCAN_TIMING.MAX_PROGRESS, prev + SCAN_TIMING.PROGRESS_INCREMENT);
      });
    }, SCAN_TIMING.PROGRESS_INTERVAL);

    try {
      const scanImageUri = imageUri || 'placeholder-scan-image';
      const result = await spatialMappingService.performSpatialScan(scanImageUri);
      const processingTime = Date.now() - startTime;

      // Clear intervals
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
        stageIntervalRef.current = null;
      }

      // Finalize
      setScanProgress(100);
      setCurrentStage(SCAN_STAGES[SCAN_STAGES.length - 1]);
      setScanResult(result);
      setRoomData(result.roomData);
      setScanStats({
        planesDetected: result.planes?.length || 0,
        obstaclesFound: result.roomData?.obstacles?.length || 0,
        confidence: result.confidence,
        processingTime,
      });
      
      // Save to history
      await saveScanToHistory(result);
      
      // Generate professional report
      if (result.roomData) {
        const report = professionalDesignService.generateProfessionalReport(
          result.roomData,
          'Spatial Mapping Project'
        );
        setProfessionalReport(report);
      }
      
      setIsScanning(false);
      setScanComplete(true);

      // Success alert
      Alert.alert(
        'Scan Complete! ✅',
        `Room mapped successfully!\n\n` +
        `📊 Confidence: ${Math.round(result.confidence * 100)}%\n` +
        `🧱 Planes detected: ${result.planes?.length || 0}\n` +
        `🚧 Obstacles found: ${result.roomData?.obstacles?.length || 0}\n` +
        `⏱️ Processing time: ${(processingTime / 1000).toFixed(1)}s`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      // Clear intervals on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
        stageIntervalRef.current = null;
      }

      setIsScanning(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan room. Please try again.';
      setError(errorMessage);
      Alert.alert('Scan Failed', errorMessage);
      console.error('[SpatialMapping] Scan error:', err);
    }
  }, [saveScanToHistory]);

  // Reset scan
  const resetScan = useCallback(() => {
    setIsScanning(false);
    setScanComplete(false);
    setRoomData(null);
    setScanResult(null);
    setScanProgress(0);
    setCurrentStage(SCAN_STAGES[0]);
    setScanStats({ planesDetected: 0, obstaclesFound: 0, confidence: 0, processingTime: 0 });
    setError(null);
  }, []);

  return {
    isScanning,
    scanComplete,
    roomData,
    scanResult,
    scanProgress,
    currentStage,
    scanStats,
    error,
    scanHistory,
    professionalReport,
    startScan,
    resetScan,
    setRoomData,
    setScanResult,
  };
}

