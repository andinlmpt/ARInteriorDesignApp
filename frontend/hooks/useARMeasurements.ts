/**
 * AR Measurements Hook
 * Manages measurement tools for distance, area, and volume calculations
 */

import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { AR_CONFIG } from '@/config/arView.config';

export type MeasurementMode = 'distance' | 'area' | 'volume' | null;

interface MeasurementPoint {
  position: THREE.Vector3;
  timestamp: number;
}

interface MeasurementResult {
  distance?: number;
  area?: number;
  volume?: number;
  points: THREE.Vector3[];
}

interface UseARMeasurementsReturn {
  // State
  measurementMode: MeasurementMode;
  measurementPoints: THREE.Vector3[];
  measurementResult: MeasurementResult | null;
  isActive: boolean;
  
  // Actions
  setMeasurementMode: (mode: MeasurementMode) => void;
  addMeasurementPoint: (position: THREE.Vector3) => void;
  clearMeasurements: () => void;
  calculateMeasurement: () => MeasurementResult | null;
  
  // Helpers
  formatDistance: (distance: number) => string;
  formatArea: (area: number) => string;
  formatVolume: (volume: number) => string;
}

export function useARMeasurements(): UseARMeasurementsReturn {
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(null);
  const [measurementPoints, setMeasurementPoints] = useState<THREE.Vector3[]>([]);
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const pointsRef = useRef<MeasurementPoint[]>([]);

  const isActive = measurementMode !== null;

  const addMeasurementPoint = useCallback((position: THREE.Vector3) => {
    if (!measurementMode) return;
    
    const newPoint: MeasurementPoint = {
      position: position.clone(),
      timestamp: Date.now(),
    };
    
    pointsRef.current.push(newPoint);
    setMeasurementPoints([...pointsRef.current.map(p => p.position)]);
    
    // Auto-calculate if enough points
    if (measurementMode === 'distance' && pointsRef.current.length >= 2) {
      const result = calculateMeasurement();
      if (result) {
        setMeasurementResult(result);
      }
    } else if (measurementMode === 'area' && pointsRef.current.length >= 3) {
      const result = calculateMeasurement();
      if (result) {
        setMeasurementResult(result);
      }
    } else if (measurementMode === 'volume' && pointsRef.current.length >= 4) {
      const result = calculateMeasurement();
      if (result) {
        setMeasurementResult(result);
      }
    }
  }, [measurementMode]);

  const calculateMeasurement = useCallback((): MeasurementResult | null => {
    const points = pointsRef.current.map(p => p.position);
    
    if (points.length < 2) {
      return null;
    }
    
    const result: MeasurementResult = {
      points,
      distance: undefined,
      area: undefined,
      volume: undefined,
    };
    
    if (measurementMode === 'distance' && points.length >= 2) {
      // Calculate distance between two points
      result.distance = points[0].distanceTo(points[1]);
    } else if (measurementMode === 'area' && points.length >= 3) {
      // Calculate area of polygon (simplified - assumes points form a polygon)
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].z;
        area -= points[j].x * points[i].z;
      }
      result.area = Math.abs(area / 2);
    } else if (measurementMode === 'volume' && points.length >= 4) {
      // Simplified volume calculation (would need height for accurate volume)
      // For now, calculate as if points form a box
      if (points.length >= 4) {
        const width = points[0].distanceTo(points[1]);
        const length = points[1].distanceTo(points[2]);
        const height = points[0].y; // Simplified - use Y coordinate as height
        result.volume = width * length * Math.abs(height);
      }
    }
    
    return result;
  }, [measurementMode]);

  const clearMeasurements = useCallback(() => {
    pointsRef.current = [];
    setMeasurementPoints([]);
    setMeasurementResult(null);
  }, []);

  const handleSetMeasurementMode = useCallback((mode: MeasurementMode) => {
    setMeasurementMode(mode);
    clearMeasurements();
  }, [clearMeasurements]);

  // Format helpers
  const formatDistance = useCallback((distance: number): string => {
    if (distance < 1) {
      return `${(distance * 100).toFixed(0)} cm`;
    }
    return `${distance.toFixed(2)} m`;
  }, []);

  const formatArea = useCallback((area: number): string => {
    if (area < 1) {
      return `${(area * 10000).toFixed(0)} cm²`;
    }
    return `${area.toFixed(2)} m²`;
  }, []);

  const formatVolume = useCallback((volume: number): string => {
    if (volume < 1) {
      return `${(volume * 1000000).toFixed(0)} cm³`;
    }
    return `${volume.toFixed(2)} m³`;
  }, []);

  return {
    measurementMode,
    measurementPoints,
    measurementResult,
    isActive,
    setMeasurementMode: handleSetMeasurementMode,
    addMeasurementPoint,
    clearMeasurements,
    calculateMeasurement,
    formatDistance,
    formatArea,
    formatVolume,
  };
}


