/**
 * useSpatialMappingMeasurement Hook
 * Manages manual measurement state and logic
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert, GestureResponderEvent, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  depthEstimationService,
  MeasurementPoint,
  ManualMeasurement,
} from '@/services/DepthEstimationService';
import type { DepthMap } from '@/types/spatial-mapping';
import { STORAGE_KEYS } from '@/config/spatialMapping.config';
import { formatDimension } from '@/utils/spatialMappingHelpers';

interface UseSpatialMappingMeasurementProps {
  useMetric: boolean;
}

interface UseSpatialMappingMeasurementReturn {
  // State
  measurementMode: boolean;
  measurementPoints: MeasurementPoint[];
  measurements: ManualMeasurement[];
  currentDepthMap: DepthMap | null;
  isProcessingDepth: boolean;
  showMeasurementHistory: boolean;
  measurementLabel: string;
  depthEstimationEnabled: boolean;
  depthConfidence: number;
  averageRoomDepth: number;
  // Actions
  setMeasurementLabel: (label: string) => void;
  setShowMeasurementHistory: (show: boolean) => void;
  toggleMeasurementMode: () => Promise<void>;
  handleMeasurementTap: (event: GestureResponderEvent) => void;
  deleteMeasurement: (id: string) => void;
  clearAllMeasurements: () => void;
  cancelCurrentMeasurement: () => void;
  exportMeasurements: () => void;
}

export function useSpatialMappingMeasurement({
  useMetric,
}: UseSpatialMappingMeasurementProps): UseSpatialMappingMeasurementReturn {
  // Measurement state
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const [measurements, setMeasurements] = useState<ManualMeasurement[]>([]);
  const [currentDepthMap, setCurrentDepthMap] = useState<DepthMap | null>(null);
  const [isProcessingDepth, setIsProcessingDepth] = useState(false);
  const [showMeasurementHistory, setShowMeasurementHistory] = useState(false);
  const [measurementLabel, setMeasurementLabel] = useState('');
  const [depthEstimationEnabled] = useState(true);
  const [depthConfidence, setDepthConfidence] = useState(0);
  const [averageRoomDepth, setAverageRoomDepth] = useState(0);

  // Load saved measurements on mount
  useEffect(() => {
    const loadMeasurements = async () => {
      try {
        const savedMeasurements = await AsyncStorage.getItem(STORAGE_KEYS.MEASUREMENTS);
        if (savedMeasurements) {
          const parsed = JSON.parse(savedMeasurements) as ManualMeasurement[];
          if (Array.isArray(parsed)) {
            setMeasurements(parsed);
          }
        }
      } catch (error) {
        console.warn('[SpatialMapping] Failed to load measurements:', error);
      }
    };
    loadMeasurements();
  }, []);

  // Save measurements to storage
  const saveMeasurements = useCallback(async (measurementsToSave: ManualMeasurement[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MEASUREMENTS, JSON.stringify(measurementsToSave));
    } catch (error) {
      console.warn('[SpatialMapping] Failed to save measurements:', error);
    }
  }, []);

  // Toggle measurement mode
  const toggleMeasurementMode = useCallback(async () => {
    if (!measurementMode) {
      // Entering measurement mode
      setIsProcessingDepth(true);
      try {
        const result = await depthEstimationService.estimateDepth('current-frame');
        setCurrentDepthMap(result.depthMap);
        setDepthConfidence(result.confidence);
        setAverageRoomDepth(result.averageDepth);
        setMeasurementMode(true);
      } catch (error) {
        console.error('[SpatialMapping] Failed to generate depth map:', error);
        Alert.alert('Error', 'Failed to initialize measurement mode. Please try again.');
      } finally {
        setIsProcessingDepth(false);
      }
    } else {
      // Exiting measurement mode
      setMeasurementMode(false);
      setMeasurementPoints([]);
    }
  }, [measurementMode]);

  // Handle measurement tap
  const handleMeasurementTap = useCallback((event: GestureResponderEvent) => {
    if (!measurementMode || !currentDepthMap) return;

    const { locationX, locationY } = event.nativeEvent;
    
    // Create measurement point
    const point = depthEstimationService.createMeasurementPoint(
      locationX,
      locationY,
      currentDepthMap
    );

    const newPoints = [...measurementPoints, point];
    setMeasurementPoints(newPoints);

    // If we have 2 points, create a measurement
    if (newPoints.length === 2) {
      const measurement = depthEstimationService.createMeasurement(
        newPoints[0],
        newPoints[1],
        measurementLabel || undefined
      );
      
      const updatedMeasurements = [...measurements, measurement];
      setMeasurements(updatedMeasurements);
      setMeasurementPoints([]);
      setMeasurementLabel('');
      
      // Save measurements
      saveMeasurements(updatedMeasurements);

      // Show measurement result
      Alert.alert(
        '📏 Measurement Complete',
        `Distance: ${formatDimension(measurement.distance, useMetric)}\n\n` +
        `Start depth: ${measurement.startPoint.depth.toFixed(2)}m\n` +
        `End depth: ${measurement.endPoint.depth.toFixed(2)}m`,
        [{ text: 'OK' }]
      );
    }
  }, [measurementMode, currentDepthMap, measurementPoints, measurementLabel, measurements, saveMeasurements, useMetric]);

  // Delete measurement
  const deleteMeasurement = useCallback((id: string) => {
    const updated = measurements.filter(m => m.id !== id);
    setMeasurements(updated);
    depthEstimationService.deleteMeasurement(id);
    saveMeasurements(updated);
  }, [measurements, saveMeasurements]);

  // Clear all measurements
  const clearAllMeasurements = useCallback(() => {
    Alert.alert(
      'Clear All Measurements',
      'Are you sure you want to delete all measurements?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setMeasurements([]);
            depthEstimationService.clearMeasurements();
            try {
              await AsyncStorage.removeItem(STORAGE_KEYS.MEASUREMENTS);
            } catch (error) {
              console.warn('[SpatialMapping] Failed to clear measurements:', error);
            }
          },
        },
      ]
    );
  }, []);

  // Cancel current measurement
  const cancelCurrentMeasurement = useCallback(() => {
    setMeasurementPoints([]);
    setMeasurementLabel('');
  }, []);

  // Export measurements
  const exportMeasurements = useCallback(() => {
    const data = measurements.map((m, i) => ({
      number: i + 1,
      label: m.label || `Measurement ${i + 1}`,
      distance: formatDimension(m.distance, useMetric),
      distanceMeters: m.distance.toFixed(4),
      startPoint: m.startPoint.worldPosition,
      endPoint: m.endPoint.worldPosition,
      createdAt: new Date(m.createdAt).toISOString(),
    }));
    Share.share({
      message: JSON.stringify(data, null, 2),
      title: 'Measurement Data',
    });
  }, [measurements, useMetric]);

  return {
    measurementMode,
    measurementPoints,
    measurements,
    currentDepthMap,
    isProcessingDepth,
    showMeasurementHistory,
    measurementLabel,
    depthEstimationEnabled,
    depthConfidence,
    averageRoomDepth,
    setMeasurementLabel,
    setShowMeasurementHistory,
    toggleMeasurementMode,
    handleMeasurementTap,
    deleteMeasurement,
    clearAllMeasurements,
    cancelCurrentMeasurement,
    exportMeasurements,
  };
}

