/**
 * AR Measurement State Hook
 * Manages measurement mode, points, and results
 */

import { useState, useRef } from 'react';
import * as THREE from 'three';

interface UseARMeasurementStateReturn {
  // Measurement mode
  measurementMode: 'distance' | 'area' | 'volume' | null;
  setMeasurementMode: (mode: 'distance' | 'area' | 'volume' | null) => void;
  
  // Measurement data
  measurementPoints: THREE.Vector3[];
  setMeasurementPoints: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
  measurementResults: {
    distance?: number;
    area?: number;
    volume?: number;
  } | null;
  setMeasurementResults: React.Dispatch<React.SetStateAction<{
    distance?: number;
    area?: number;
    volume?: number;
  } | null>>;
  
  // Refs for measurement visualization
  measurementLinesRef: React.MutableRefObject<THREE.Line[]>;
  measurementLabelsRef: React.MutableRefObject<THREE.Group | null>;
  measurementPointsRef: React.MutableRefObject<THREE.Mesh[]>;
  measurementMarkerAnimationsRef: React.MutableRefObject<Map<THREE.Mesh, { startTime: number; initialScale: number }>>;
  
  // Actions
  clearMeasurements: () => void;
}

export function useARMeasurementState(): UseARMeasurementStateReturn {
  const [measurementMode, setMeasurementMode] = useState<'distance' | 'area' | 'volume' | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<THREE.Vector3[]>([]);
  const [measurementResults, setMeasurementResults] = useState<{
    distance?: number;
    area?: number;
    volume?: number;
  } | null>(null);
  
  const measurementLinesRef = useRef<THREE.Line[]>([]);
  const measurementLabelsRef = useRef<THREE.Group | null>(null);
  const measurementPointsRef = useRef<THREE.Mesh[]>([]);
  const measurementMarkerAnimationsRef = useRef<Map<THREE.Mesh, { startTime: number; initialScale: number }>>(new Map());
  
  const clearMeasurements = () => {
    setMeasurementMode(null);
    setMeasurementPoints([]);
    setMeasurementResults(null);
  };
  
  return {
    measurementMode,
    setMeasurementMode,
    measurementPoints,
    setMeasurementPoints,
    measurementResults,
    setMeasurementResults,
    measurementLinesRef,
    measurementLabelsRef,
    measurementPointsRef,
    measurementMarkerAnimationsRef,
    clearMeasurements,
  };
}
