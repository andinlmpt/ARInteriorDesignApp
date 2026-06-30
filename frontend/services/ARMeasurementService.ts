/**
 * AR Measurement Service
 * Handles AR-based distance measurements using tap-to-measure functionality
 */

import * as THREE from 'three';
import { arCoreManager } from './ARCoreManager';

export interface MeasurementPoint {
  id: string;
  position: THREE.Vector3;
  timestamp: number;
}

export interface Measurement {
  id: string;
  point1: MeasurementPoint;
  point2: MeasurementPoint;
  distanceMeters: number;
  distanceFeet: number;
  timestamp: number;
}

class ARMeasurementServiceClass {
  private currentPoints: MeasurementPoint[] = [];
  private measurements: Measurement[] = [];
  private pointIdCounter = 0;
  private measurementIdCounter = 0;

  /**
   * Perform hit test at screen coordinates to get 3D point
   * In a real implementation, this would use ARCore/ARKit hit testing
   */
  async tapToMeasure(screenX: number, screenY: number): Promise<MeasurementPoint | null> {
    try {
      const hit = await arCoreManager.hitTest(screenX, screenY);
      if (!hit) {
        return null;
      }

      const position = new THREE.Vector3(
        hit.position.x,
        hit.position.y,
        hit.position.z
      );

      const point: MeasurementPoint = {
        id: `point-${this.pointIdCounter++}`,
        position,
        timestamp: Date.now(),
      };

      return point;
    } catch (error) {
      console.error('[ARMeasurementService] Hit test failed:', error);
      return null;
    }
  }

  /**
   * Add a measurement point
   * Returns a Measurement if two points are collected, null otherwise
   */
  addPoint(point: MeasurementPoint): Measurement | null {
    this.currentPoints.push(point);

    // If we have two points, create a measurement
    if (this.currentPoints.length === 2) {
      const point1 = this.currentPoints[0];
      const point2 = this.currentPoints[1];

      // Calculate distance
      const distanceMeters = point1.position.distanceTo(point2.position);
      const distanceFeet = distanceMeters * 3.28084; // Convert meters to feet

      const measurement: Measurement = {
        id: `measurement-${this.measurementIdCounter++}`,
        point1,
        point2,
        distanceMeters,
        distanceFeet,
        timestamp: Date.now(),
      };

      this.measurements.push(measurement);
      this.currentPoints = []; // Clear current points for next measurement

      return measurement;
    }

    return null;
  }

  /**
   * Get current measurement points
   */
  getCurrentPoints(): MeasurementPoint[] {
    return [...this.currentPoints];
  }

  /**
   * Get all measurements
   */
  getMeasurements(): Measurement[] {
    return [...this.measurements];
  }

  /**
   * Clear current points (for starting a new measurement)
   */
  clearCurrentPoints(): void {
    this.currentPoints = [];
  }

  /**
   * Clear all measurements
   */
  clearAllMeasurements(): void {
    this.measurements = [];
    this.currentPoints = [];
  }

  /**
   * Save measurements with a name
   */
  async saveMeasurement(name: string): Promise<boolean> {
    try {
      // In a real implementation, this would save to storage
      const savedData = {
        name,
        measurements: this.measurements,
        timestamp: Date.now(),
      };

      // For now, just log it
      console.log('[ARMeasurementService] Saving measurements:', savedData);
      
      // TODO: Implement actual storage (AsyncStorage, database, etc.)
      // await AsyncStorage.setItem(`measurement_${Date.now()}`, JSON.stringify(savedData));

      return true;
    } catch (error) {
      console.error('[ARMeasurementService] Failed to save measurements:', error);
      return false;
    }
  }

  /**
   * Load saved measurements
   */
  async loadMeasurements(): Promise<Measurement[]> {
    try {
      // TODO: Implement actual storage loading
      // const saved = await AsyncStorage.getItem('measurements');
      // if (saved) {
      //   const data = JSON.parse(saved);
      //   this.measurements = data.measurements || [];
      // }
      return this.measurements;
    } catch (error) {
      console.error('[ARMeasurementService] Failed to load measurements:', error);
      return [];
    }
  }
}

export const arMeasurementService = new ARMeasurementServiceClass();
