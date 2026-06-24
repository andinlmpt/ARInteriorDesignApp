/**
 * AR View measurement visualization in the 3D scene.
 */

import { useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { RoomData } from '@/types/spatial-mapping';

export interface UseARViewMeasurementVisualizationParams {
  rootGroupRef: React.MutableRefObject<THREE.Group | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  measurementLinesRef: React.MutableRefObject<THREE.Line[]>;
  measurementLabelsRef: React.MutableRefObject<THREE.Group | null>;
  measurementPointsRef: React.MutableRefObject<THREE.Mesh[]>;
  measurementMarkerAnimationsRef: React.MutableRefObject<Map<THREE.Mesh, { startTime: number; initialScale: number }>>;
  suggestedPositionsRef: React.MutableRefObject<THREE.Mesh[]>;
  suggestedPositionLabelsRef: React.MutableRefObject<THREE.Group | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  measurementMode: 'distance' | 'area' | 'volume' | null;
  measurementPoints: THREE.Vector3[];
  suggestedPositions: THREE.Vector3[];
  roomData: RoomData | null;
  rendererReady: boolean;
  setMeasurementPoints: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
  setMeasurementResults: React.Dispatch<React.SetStateAction<{ distance?: number; area?: number; volume?: number } | null>>;
}

export function useARViewMeasurementVisualization({
  rootGroupRef,
  sceneRef,
  measurementLinesRef,
  measurementLabelsRef,
  measurementPointsRef,
  measurementMarkerAnimationsRef,
  suggestedPositionsRef,
  suggestedPositionLabelsRef,
  cameraRef,
  measurementMode,
  measurementPoints,
  suggestedPositions,
  roomData,
  rendererReady,
  setMeasurementPoints,
  setMeasurementResults,
}: UseARViewMeasurementVisualizationParams) {
  // Measurement calculation functions
  const calculateDistance = useCallback((point1: THREE.Vector3, point2: THREE.Vector3): number => {
    return point1.distanceTo(point2);
  }, []);

  const calculateArea = useCallback((points: THREE.Vector3[]): number => {
    if (points.length < 3) return 0;
    // Calculate area using shoelace formula for polygon
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].z;
      area -= points[j].x * points[i].z;
    }
    return Math.abs(area) / 2;
  }, []);

  const calculateVolume = useCallback((points: THREE.Vector3[], height: number): number => {
    const area = calculateArea(points);
    return area * height;
  }, [calculateArea]);

  // Create text label sprite for measurements
  const createTextLabel = useCallback((text: string, position: THREE.Vector3): THREE.Sprite | null => {
    if (typeof document === 'undefined' || !document.createElement) {
      return null;
    }

    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      canvas.width = 256;
      canvas.height = 64;

      // Draw text with background
      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = 'white';
      context.font = 'Bold 24px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      // Create texture with Expo GL compatible settings
      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = false; // Prevent pixelStorei warning in Expo GL
      texture.needsUpdate = true;

      // Create sprite material
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
      });

      // Create sprite
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(0.5, 0.125, 1);

      return sprite;
    } catch (error) {
      console.warn('[ARView] Error creating text label:', error);
      return null;
    }
  }, []);

  // Render measurement lines and points
  const updateMeasurementVisualization = useCallback(() => {
    if (!rootGroupRef.current || !sceneRef.current) return;

    // Clear existing measurements
    measurementLinesRef.current.forEach(line => {
      rootGroupRef.current?.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    measurementLinesRef.current = [];

    measurementPointsRef.current.forEach(point => {
      rootGroupRef.current?.remove(point);
      point.geometry.dispose();
      (point.material as THREE.Material).dispose();
    });
    measurementPointsRef.current = [];

    if (measurementLabelsRef.current) {
      rootGroupRef.current.remove(measurementLabelsRef.current);
      measurementLabelsRef.current.clear();
    } else {
      measurementLabelsRef.current = new THREE.Group();
      rootGroupRef.current.add(measurementLabelsRef.current);
    }

    if (measurementPoints.length === 0) return;

    // Create point markers with animation
    const pointGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const pointMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0,
    });

    measurementPoints.forEach((point, index) => {
      // Check if marker already exists for this point
      const existingMarker = measurementPointsRef.current[index];
      if (existingMarker) {
        // Marker already exists, skip creation
        return;
      }

      // Create new marker
      const pointMesh = new THREE.Mesh(pointGeometry.clone(), pointMaterial.clone());
      pointMesh.position.copy(point);

      // Initialize scale to 0 for pop-in animation
      pointMesh.scale.set(0, 0, 0);

      // Store animation data
      const now = Date.now();
      measurementMarkerAnimationsRef.current.set(pointMesh, {
        startTime: now,
        initialScale: 0,
      });

      rootGroupRef.current?.add(pointMesh);
      measurementPointsRef.current.push(pointMesh);
    });

    // Create lines based on measurement mode
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 3,
    });

    if (measurementMode === 'distance' && measurementPoints.length >= 2) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        measurementPoints[0],
        measurementPoints[1],
      ]);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      rootGroupRef.current.add(line);
      measurementLinesRef.current.push(line);

      // Add distance label at midpoint
      const midpoint = new THREE.Vector3()
        .addVectors(measurementPoints[0], measurementPoints[1])
        .multiplyScalar(0.5);
      midpoint.y += 0.2; // Offset above line

      const distance = calculateDistance(measurementPoints[0], measurementPoints[1]);
      const distanceText = `${distance.toFixed(2)}m`;
      const label = createTextLabel(distanceText, midpoint);
      if (label && measurementLabelsRef.current) {
        measurementLabelsRef.current.add(label);
      }
    } else if (measurementMode === 'area' && measurementPoints.length >= 3) {
      // Draw polygon lines
      for (let i = 0; i < measurementPoints.length; i++) {
        const next = (i + 1) % measurementPoints.length;
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          measurementPoints[i],
          measurementPoints[next],
        ]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        rootGroupRef.current.add(line);
        measurementLinesRef.current.push(line);
      }

      // Add area label at center of polygon
      const center = new THREE.Vector3();
      measurementPoints.forEach(point => center.add(point));
      center.divideScalar(measurementPoints.length);
      center.y += 0.2; // Offset above polygon

      const area = calculateArea(measurementPoints);
      const areaText = `${area.toFixed(2)}m²`;
      const label = createTextLabel(areaText, center);
      if (label && measurementLabelsRef.current) {
        measurementLabelsRef.current.add(label);
      }
    } else if (measurementMode === 'volume' && measurementPoints.length >= 3) {
      // Draw base polygon
      for (let i = 0; i < measurementPoints.length; i++) {
        const next = (i + 1) % measurementPoints.length;
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          measurementPoints[i],
          measurementPoints[next],
        ]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        rootGroupRef.current.add(line);
        measurementLinesRef.current.push(line);
      }

      // Add volume label at center of polygon
      const center = new THREE.Vector3();
      measurementPoints.forEach(point => center.add(point));
      center.divideScalar(measurementPoints.length);
      center.y += 0.2; // Offset above polygon

      const height = roomData?.dimensions.height || 2.7;
      const volume = calculateVolume(measurementPoints, height);
      const volumeText = `${volume.toFixed(2)}m³`;
      const label = createTextLabel(volumeText, center);
      if (label && measurementLabelsRef.current) {
        measurementLabelsRef.current.add(label);
      }
    }
  }, [measurementPoints, measurementMode, calculateDistance, calculateArea, calculateVolume, createTextLabel, roomData]);

  // Visualize suggested alternative positions
  const visualizeSuggestedPositions = useCallback(() => {
    if (!rootGroupRef.current) return;

    // Clean up old suggestions
    suggestedPositionsRef.current.forEach(indicator => {
      rootGroupRef.current?.remove(indicator);
      indicator.geometry.dispose();
      (indicator.material as THREE.Material).dispose();
    });
    suggestedPositionsRef.current = [];

    // Clean up old labels
    if (suggestedPositionLabelsRef.current) {
      rootGroupRef.current.remove(suggestedPositionLabelsRef.current);
      suggestedPositionLabelsRef.current.clear();
      suggestedPositionLabelsRef.current = null;
    }

    if (suggestedPositions.length === 0) return;

    // Create label group
    suggestedPositionLabelsRef.current = new THREE.Group();
    rootGroupRef.current.add(suggestedPositionLabelsRef.current);

    // Create visual indicators for each suggested position
    suggestedPositions.forEach((pos, index) => {
      // Create ring geometry indicator
      const indicatorGeometry = new THREE.RingGeometry(0.2, 0.25, 32);
      const indicatorMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
      indicator.rotation.x = -Math.PI / 2; // Rotate to lie flat on floor
      indicator.position.copy(pos);
      indicator.position.y = 0.01; // Slightly above floor

      rootGroupRef.current?.add(indicator);
      suggestedPositionsRef.current.push(indicator);

      // Add number label (using canvas texture if available)
      if (typeof document !== 'undefined' && document.createElement) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 128;
          const context = canvas.getContext('2d');
          if (context && suggestedPositionLabelsRef.current) {
            context.fillStyle = '#00ff00';
            context.font = 'bold 64px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(`${index + 1}`, 64, 64);

            const texture = new THREE.CanvasTexture(canvas);
            texture.flipY = false; // Prevent pixelStorei warning in Expo GL
            const labelMaterial = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              opacity: 0.9,
            });
            const labelGeometry = new THREE.PlaneGeometry(0.3, 0.3);
            const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
            labelMesh.position.copy(pos);
            labelMesh.position.y = 0.5; // Above the ring
            if (cameraRef.current) {
              labelMesh.lookAt(cameraRef.current.position);
            }

            suggestedPositionLabelsRef.current.add(labelMesh);
          }
        } catch (error) {
          // Canvas not available, skip label
          console.warn('[ARView] Canvas not available for label rendering:', error);
        }
      }
    });
  }, [suggestedPositions]);

  // Update suggested positions visualization when positions change
  useEffect(() => {
    if (rendererReady) {
      visualizeSuggestedPositions();
    }
  }, [suggestedPositions, rendererReady, visualizeSuggestedPositions]);

  // Update measurement visualization when points change
  useEffect(() => {
    if (rendererReady) {
      updateMeasurementVisualization();
    }
  }, [measurementPoints, measurementMode, rendererReady, updateMeasurementVisualization]);

  // Clear measurements when mode changes
  useEffect(() => {
    if (!measurementMode) {
      setMeasurementPoints([]);
      setMeasurementResults(null);
    }
  }, [measurementMode]);

  useEffect(() => {
    if (rendererReady) {
      visualizeSuggestedPositions();
    }
  }, [suggestedPositions, rendererReady, visualizeSuggestedPositions]);

  useEffect(() => {
    if (rendererReady) {
      updateMeasurementVisualization();
    }
  }, [measurementPoints, measurementMode, rendererReady, updateMeasurementVisualization]);

  useEffect(() => {
    if (!measurementMode) {
      setMeasurementPoints([]);
      setMeasurementResults(null);
    }
  }, [measurementMode, setMeasurementPoints, setMeasurementResults]);

  return {
    calculateDistance,
    calculateArea,
    calculateVolume,
    updateMeasurementVisualization,
    visualizeSuggestedPositions,
  };
}
