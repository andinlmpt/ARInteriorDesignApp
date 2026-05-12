/**
 * useSpatialMappingCalibration Hook
 * Manages calibration state and logic for spatial mapping
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  depthEstimationService,
  CALIBRATION_REFERENCES,
  CalibrationReference,
} from '@/services/DepthEstimationService';
import type { CalibrationResult, CalibrationStep } from '@/types/spatial-mapping-ui';
import { STORAGE_KEYS } from '@/config/spatialMapping.config';

interface UseSpatialMappingCalibrationReturn {
  // State
  showCalibrationModal: boolean;
  selectedReference: CalibrationReference | null;
  calibrationStep: CalibrationStep;
  detectedWidth: string;
  detectedHeight: string;
  calibrationResult: CalibrationResult | null;
  isCalibrated: boolean;
  customReferenceWidth: string;
  customReferenceHeight: string;
  // Actions
  setShowCalibrationModal: (show: boolean) => void;
  setDetectedWidth: (width: string) => void;
  setDetectedHeight: (height: string) => void;
  setCustomReferenceWidth: (width: string) => void;
  setCustomReferenceHeight: (height: string) => void;
  startCalibration: () => void;
  selectReferenceObject: (reference: CalibrationReference) => void;
  performCalibration: () => Promise<void>;
  createCustomReference: () => CalibrationReference | null;
  resetCalibration: () => Promise<void>;
}

export function useSpatialMappingCalibration(): UseSpatialMappingCalibrationReturn {
  // Calibration state
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [selectedReference, setSelectedReference] = useState<CalibrationReference | null>(null);
  const [calibrationStep, setCalibrationStep] = useState<CalibrationStep>('select');
  const [detectedWidth, setDetectedWidth] = useState('');
  const [detectedHeight, setDetectedHeight] = useState('');
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [customReferenceWidth, setCustomReferenceWidth] = useState('');
  const [customReferenceHeight, setCustomReferenceHeight] = useState('');

  // Load saved calibration on mount
  useEffect(() => {
    const loadCalibration = async () => {
      try {
        const savedCalibration = await AsyncStorage.getItem(STORAGE_KEYS.CALIBRATION);
        if (savedCalibration) {
          const factor = parseFloat(savedCalibration);
          if (!isNaN(factor) && factor > 0) {
            depthEstimationService.calibrateWithReference(
              CALIBRATION_REFERENCES[0],
              1 / factor,
              1 / factor
            );
            setIsCalibrated(true);
          }
        }
      } catch (error) {
        console.warn('[SpatialMapping] Failed to load calibration:', error);
      }
    };
    loadCalibration();
    
    // Initialize depth estimation service
    depthEstimationService.initialize();
  }, []);

  // Start calibration
  const startCalibration = useCallback(() => {
    setShowCalibrationModal(true);
    setCalibrationStep('select');
    setSelectedReference(null);
    setDetectedWidth('');
    setDetectedHeight('');
    setCalibrationResult(null);
  }, []);

  // Select reference object
  const selectReferenceObject = useCallback((reference: CalibrationReference) => {
    setSelectedReference(reference);
    setCalibrationStep('measure');
  }, []);

  // Perform calibration
  const performCalibration = useCallback(async () => {
    if (!selectedReference) return;

    const width = parseFloat(detectedWidth);
    const height = parseFloat(detectedHeight);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid measurements in centimeters.');
      return;
    }

    // Convert cm to meters
    const widthMeters = width / 100;
    const heightMeters = height / 100;

    const result = depthEstimationService.calibrateWithReference(
      selectedReference,
      widthMeters,
      heightMeters
    );

    setCalibrationResult(result);
    setCalibrationStep('confirm');

    if (result.success) {
      setIsCalibrated(true);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.CALIBRATION, result.factor.toString());
      } catch (error) {
        console.warn('[SpatialMapping] Failed to save calibration:', error);
      }
    }
  }, [selectedReference, detectedWidth, detectedHeight]);

  // Create custom reference
  const createCustomReference = useCallback((): CalibrationReference | null => {
    const width = parseFloat(customReferenceWidth);
    const height = parseFloat(customReferenceHeight);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid dimensions in centimeters.');
      return null;
    }

    return {
      id: 'custom',
      name: 'Custom Object',
      type: 'custom',
      realWidth: width / 100,
      realHeight: height / 100,
      icon: '📐',
      description: `Custom object: ${width}cm × ${height}cm`,
    };
  }, [customReferenceWidth, customReferenceHeight]);

  // Reset calibration
  const resetCalibration = useCallback(async () => {
    depthEstimationService.resetCalibration();
    setIsCalibrated(false);
    setCalibrationResult(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CALIBRATION);
    } catch (error) {
      console.warn('[SpatialMapping] Failed to remove calibration:', error);
    }
    Alert.alert('Calibration Reset', 'Measurement calibration has been reset to default.');
  }, []);

  return {
    showCalibrationModal,
    selectedReference,
    calibrationStep,
    detectedWidth,
    detectedHeight,
    calibrationResult,
    isCalibrated,
    customReferenceWidth,
    customReferenceHeight,
    setShowCalibrationModal,
    setDetectedWidth,
    setDetectedHeight,
    setCustomReferenceWidth,
    setCustomReferenceHeight,
    startCalibration,
    selectReferenceObject,
    performCalibration,
    createCustomReference,
    resetCalibration,
  };
}

