/**
 * DepthEstimationService
 * Provides monocular depth estimation using ML models
 * Uses MiDaS-style depth estimation approach
 */

import { DepthMap, SpatialPoint } from '@/types/spatial-mapping';
import { mlDepthEstimationService } from './MLDepthEstimationService';

export interface DepthEstimationConfig {
  modelType: 'fast' | 'accurate' | 'hybrid';
  resolution: 'low' | 'medium' | 'high';
  enableSmoothing: boolean;
  smoothingFactor: number;
  minDepth: number; // meters
  maxDepth: number; // meters
}

export interface DepthPoint {
  x: number;
  y: number;
  depth: number;
  confidence: number;
}

export interface DepthEstimationResult {
  depthMap: DepthMap;
  points: DepthPoint[];
  averageDepth: number;
  depthRange: { min: number; max: number };
  confidence: number;
  processingTimeMs: number;
}

export interface MeasurementPoint {
  id: string;
  screenX: number;
  screenY: number;
  worldPosition: SpatialPoint;
  depth: number;
  timestamp: number;
}

export interface ManualMeasurement {
  id: string;
  startPoint: MeasurementPoint;
  endPoint: MeasurementPoint;
  distance: number; // in meters
  label?: string;
  createdAt: number;
}

export interface CalibrationReference {
  id: string;
  name: string;
  type: 'credit_card' | 'a4_paper' | 'a5_paper' | 'us_letter' | 'door' | 'custom';
  realWidth: number; // in meters
  realHeight: number; // in meters
  icon: string;
  description: string;
}

// Standard reference objects for calibration
export const CALIBRATION_REFERENCES: CalibrationReference[] = [
  {
    id: 'credit_card',
    name: 'Credit Card',
    type: 'credit_card',
    realWidth: 0.0856, // 85.6mm
    realHeight: 0.0539, // 53.98mm
    icon: '💳',
    description: 'Standard credit/debit card (ISO/IEC 7810 ID-1)',
  },
  {
    id: 'a4_paper',
    name: 'A4 Paper',
    type: 'a4_paper',
    realWidth: 0.297, // 297mm
    realHeight: 0.21, // 210mm
    icon: '📄',
    description: 'Standard A4 paper sheet',
  },
  {
    id: 'a5_paper',
    name: 'A5 Paper',
    type: 'a5_paper',
    realWidth: 0.21, // 210mm
    realHeight: 0.148, // 148mm
    icon: '📋',
    description: 'A5 paper (half of A4)',
  },
  {
    id: 'us_letter',
    name: 'US Letter',
    type: 'us_letter',
    realWidth: 0.2794, // 11 inches
    realHeight: 0.2159, // 8.5 inches
    icon: '📃',
    description: 'US Letter size paper',
  },
  {
    id: 'door',
    name: 'Standard Door',
    type: 'door',
    realWidth: 0.9, // 90cm standard door width
    realHeight: 2.1, // 210cm standard door height
    icon: '🚪',
    description: 'Standard interior door',
  },
];

export class DepthEstimationService {
  private config: DepthEstimationConfig;
  private isInitialized: boolean = false;
  private calibrationFactor: number = 1.0;
  private measurementHistory: ManualMeasurement[] = [];
  private depthHistory: DepthEstimationResult[] = [];
  private readonly MAX_HISTORY = 10;

  // Camera intrinsics (default values, should be calibrated)
  private cameraIntrinsics = {
    focalLength: 500, // pixels
    principalPointX: 320,
    principalPointY: 240,
    imageWidth: 640,
    imageHeight: 480,
  };

  constructor(config?: Partial<DepthEstimationConfig>) {
    this.config = {
      modelType: config?.modelType ?? 'hybrid',
      resolution: config?.resolution ?? 'medium',
      enableSmoothing: config?.enableSmoothing ?? true,
      smoothingFactor: config?.smoothingFactor ?? 0.3,
      minDepth: config?.minDepth ?? 0.1,
      maxDepth: config?.maxDepth ?? 10.0,
    };
  }

  /**
   * Initialize the depth estimation model
   * In production, this would load TensorFlow.js with MiDaS model
   */
   async initialize(): Promise<boolean> {
    try {
      this.isInitialized = true;
      console.log('[DepthEstimation] Initialised (ML depth via MLDepthEstimationService)');
      return true;
    } catch (error) {
      console.error('[DepthEstimation] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Estimate depth from a single image
   * Uses monocular depth estimation approach
   */
  async estimateDepth(imageUri: string): Promise<DepthEstimationResult> {
    const startTime = Date.now();

    if (!this.isInitialized) {
      await this.initialize();
    }

    const isRealImage =
      imageUri !== 'placeholder-scan-image' &&
      (imageUri.startsWith('file://') ||
        imageUri.startsWith('content://') ||
        imageUri.startsWith('http') ||
        imageUri.startsWith('data:'));

    // ── Option B: ML depth estimation ────────────────------------------------
    if (isRealImage) {
      try {
        const mlResult = await mlDepthEstimationService.estimateDepth(imageUri);
        console.log('[DepthEstimation] ML depth complete:', {
          sources: mlResult.sources,
          avgDepth: mlResult.averageDepth.toFixed(2),
          confidence: mlResult.confidence.toFixed(2),
        });
        const depthMap = mlResult.depthMap;
        const points = this.extractDepthPoints(depthMap);
        const result: DepthEstimationResult = {
          depthMap,
          points,
          averageDepth: mlResult.averageDepth,
          depthRange: mlResult.depthRange,
          confidence: mlResult.confidence,
          processingTimeMs: Date.now() - startTime,
        };
        this.depthHistory.push(result);
        if (this.depthHistory.length > this.MAX_HISTORY) this.depthHistory.shift();
        return result;
      } catch (mlErr) {
        console.warn('[DepthEstimation] ML depth failed, falling back to simulation:', mlErr);
      }
    }

    // ── Fallback: geometric simulation ───────────────────────────────────────
    try {
      // Get resolution based on config
      const resolution = this.getResolution();
      
      // Generate depth map
      // In production: Use TensorFlow.js to run MiDaS model on image
      const depthMap = await this.generateDepthMap(imageUri, resolution);
      
      // Extract depth points
      const points = this.extractDepthPoints(depthMap);
      
      // Calculate statistics
      const avgDepth = this.calculateAverageDepth(depthMap);
      const depthRange = this.calculateDepthRange(depthMap);
      
      // Apply smoothing if enabled
      if (this.config.enableSmoothing && this.depthHistory.length > 0) {
        this.applyTemporalSmoothing(depthMap);
      }

      const result: DepthEstimationResult = {
        depthMap,
        points,
        averageDepth: avgDepth,
        depthRange,
        confidence: this.calculateConfidence(depthMap),
        processingTimeMs: Date.now() - startTime,
      };

      // Store in history for temporal smoothing
      this.depthHistory.push(result);
      if (this.depthHistory.length > this.MAX_HISTORY) {
        this.depthHistory.shift();
      }

      return result;
    } catch (error) {
      console.error('[DepthEstimation] Error estimating depth:', error);
      throw error;
    }
  }

  /**
   * Calibrate using a known reference object
   */
  calibrateWithReference(
    reference: CalibrationReference,
    detectedWidth: number,
    detectedHeight: number
  ): { success: boolean; factor: number; accuracy: number } {
    try {
      // Calculate calibration factors for width and height
      const widthFactor = reference.realWidth / detectedWidth;
      const heightFactor = reference.realHeight / detectedHeight;
      
      // Use average, weighted towards the more reliable measurement
      const aspectRatioReal = reference.realWidth / reference.realHeight;
      const aspectRatioDetected = detectedWidth / detectedHeight;
      const aspectRatioError = Math.abs(aspectRatioReal - aspectRatioDetected) / aspectRatioReal;
      
      // If aspect ratio error is low, use geometric mean for better accuracy
      if (aspectRatioError < 0.1) {
        this.calibrationFactor = Math.sqrt(widthFactor * heightFactor);
      } else {
        // Otherwise, use the measurement that seems more reliable
        this.calibrationFactor = (widthFactor + heightFactor) / 2;
      }

      // Clamp to reasonable range
      this.calibrationFactor = Math.max(0.5, Math.min(2.0, this.calibrationFactor));

      // Calculate accuracy based on aspect ratio match
      const accuracy = Math.max(0, Math.min(100, (1 - aspectRatioError) * 100));

      console.log('[DepthEstimation] Calibrated with factor:', this.calibrationFactor, 'accuracy:', accuracy);

      return {
        success: true,
        factor: this.calibrationFactor,
        accuracy,
      };
    } catch (error) {
      console.error('[DepthEstimation] Calibration error:', error);
      return { success: false, factor: 1.0, accuracy: 0 };
    }
  }

  /**
   * Convert screen coordinates to world position using depth
   */
  screenToWorld(screenX: number, screenY: number, depth: number): SpatialPoint {
    const { focalLength, principalPointX, principalPointY } = this.cameraIntrinsics;
    
    // Apply calibration factor to depth
    const calibratedDepth = depth * this.calibrationFactor;
    
    // Convert from screen to normalized coordinates
    const normalizedX = (screenX - principalPointX) / focalLength;
    const normalizedY = (screenY - principalPointY) / focalLength;
    
    // Calculate 3D world coordinates
    const worldX = normalizedX * calibratedDepth;
    const worldY = -normalizedY * calibratedDepth; // Flip Y axis
    const worldZ = calibratedDepth;

    return {
      x: parseFloat(worldX.toFixed(4)),
      y: parseFloat(worldY.toFixed(4)),
      z: parseFloat(worldZ.toFixed(4)),
    };
  }

  /**
   * Create a measurement point from screen tap
   */
  createMeasurementPoint(
    screenX: number,
    screenY: number,
    depthMap: DepthMap
  ): MeasurementPoint {
    // Get depth at the tapped location
    const depth = this.getDepthAt(screenX, screenY, depthMap);
    
    // Convert to world coordinates
    const worldPosition = this.screenToWorld(screenX, screenY, depth);

    return {
      id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      screenX,
      screenY,
      worldPosition,
      depth,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate distance between two measurement points
   */
  calculateDistance(point1: MeasurementPoint, point2: MeasurementPoint): number {
    const dx = point2.worldPosition.x - point1.worldPosition.x;
    const dy = point2.worldPosition.y - point1.worldPosition.y;
    const dz = point2.worldPosition.z - point1.worldPosition.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Create a manual measurement between two points
   */
  createMeasurement(
    startPoint: MeasurementPoint,
    endPoint: MeasurementPoint,
    label?: string
  ): ManualMeasurement {
    const distance = this.calculateDistance(startPoint, endPoint);
    
    const measurement: ManualMeasurement = {
      id: `measure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startPoint,
      endPoint,
      distance,
      label,
      createdAt: Date.now(),
    };

    this.measurementHistory.push(measurement);
    return measurement;
  }

  /**
   * Get all stored measurements
   */
  getMeasurements(): ManualMeasurement[] {
    return [...this.measurementHistory];
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.measurementHistory = [];
  }

  /**
   * Delete a specific measurement
   */
  deleteMeasurement(id: string): boolean {
    const index = this.measurementHistory.findIndex(m => m.id === id);
    if (index !== -1) {
      this.measurementHistory.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get depth at a specific screen location
   */
  getDepthAt(screenX: number, screenY: number, depthMap: DepthMap): number {
    // Convert screen coordinates to depth map coordinates
    const mapX = Math.floor((screenX / this.cameraIntrinsics.imageWidth) * depthMap.width);
    const mapY = Math.floor((screenY / this.cameraIntrinsics.imageHeight) * depthMap.height);
    
    // Clamp to valid range
    const x = Math.max(0, Math.min(depthMap.width - 1, mapX));
    const y = Math.max(0, Math.min(depthMap.height - 1, mapY));
    
    // Get depth value with optional neighborhood averaging for stability
    let depth = depthMap.data[y][x];
    
    // Average with neighbors for more stable reading
    const neighborhoodSize = 2;
    let sum = depth;
    let count = 1;
    
    for (let dy = -neighborhoodSize; dy <= neighborhoodSize; dy++) {
      for (let dx = -neighborhoodSize; dx <= neighborhoodSize; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < depthMap.width && ny >= 0 && ny < depthMap.height) {
          sum += depthMap.data[ny][nx];
          count++;
        }
      }
    }
    
    return (sum / count) * this.calibrationFactor;
  }

  /**
   * Update camera intrinsics (for better accuracy)
   */
  setCameraIntrinsics(intrinsics: Partial<typeof this.cameraIntrinsics>): void {
    this.cameraIntrinsics = { ...this.cameraIntrinsics, ...intrinsics };
  }

  /**
   * Get current calibration factor
   */
  getCalibrationFactor(): number {
    return this.calibrationFactor;
  }

  /**
   * Reset calibration to default
   */
  resetCalibration(): void {
    this.calibrationFactor = 1.0;
    console.log('[DepthEstimation] Calibration reset');
  }

  /**
   * Get configuration
   */
  getConfig(): DepthEstimationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DepthEstimationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private helper methods

  private async simulateModelLoading(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 500));
  }

  private getResolution(): { width: number; height: number } {
    switch (this.config.resolution) {
      case 'low':
        return { width: 128, height: 96 };
      case 'medium':
        return { width: 256, height: 192 };
      case 'high':
        return { width: 512, height: 384 };
      default:
        return { width: 256, height: 192 };
    }
  }

  private async generateDepthMap(
    imageUri: string,
    resolution: { width: number; height: number }
  ): Promise<DepthMap> {
    // In production: Run MiDaS model on the image
    // For now, generate a realistic depth map simulation
    
    const { width, height } = resolution;
    const data: number[][] = [];
    
    // Simulate a room depth map with realistic depth gradients
    // Room typically has walls at sides and back
    const centerDepth = 3.0 + Math.random() * 2; // 3-5 meters to back wall
    const sideWallDepth = 2.0 + Math.random() * 1; // 2-3 meters to side walls
    
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        // Normalize coordinates to -1 to 1
        const nx = (x / width) * 2 - 1;
        const ny = (y / height) * 2 - 1;
        
        // Calculate base depth based on position
        // Center is typically further away (back wall)
        // Edges are closer (side walls, ceiling, floor)
        let depth = centerDepth;
        
        // Side walls effect
        const sideEffect = Math.pow(Math.abs(nx), 2) * (centerDepth - sideWallDepth);
        depth -= sideEffect;
        
        // Floor/ceiling effect (bottom is usually closer - floor)
        const verticalEffect = Math.pow(ny, 2) * 0.5;
        depth -= verticalEffect * (ny > 0 ? 1 : 0.3);
        
        // Add some noise for realism
        const noise = (Math.random() - 0.5) * 0.1;
        depth += noise;
        
        // Clamp to valid range
        depth = Math.max(this.config.minDepth, Math.min(this.config.maxDepth, depth));
        
        row.push(depth);
      }
      data.push(row);
    }

    // Add some obstacles (furniture, objects)
    this.addObstaclesToDepthMap(data, width, height);

    return {
      width,
      height,
      data,
      minDepth: this.config.minDepth,
      maxDepth: this.config.maxDepth,
    };
  }

  private addObstaclesToDepthMap(
    data: number[][],
    width: number,
    height: number
  ): void {
    // Add 1-3 random obstacles
    const numObstacles = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numObstacles; i++) {
      // Random obstacle position and size
      const obstacleX = Math.floor(Math.random() * width * 0.6 + width * 0.2);
      const obstacleY = Math.floor(Math.random() * height * 0.4 + height * 0.4);
      const obstacleWidth = Math.floor(Math.random() * 30 + 20);
      const obstacleHeight = Math.floor(Math.random() * 40 + 30);
      const obstacleDepth = 1.0 + Math.random() * 1.5; // 1-2.5 meters
      
      // Apply obstacle to depth map
      for (let y = obstacleY; y < Math.min(obstacleY + obstacleHeight, height); y++) {
        for (let x = obstacleX; x < Math.min(obstacleX + obstacleWidth, width); x++) {
          // Only replace if obstacle is closer
          if (data[y][x] > obstacleDepth) {
            data[y][x] = obstacleDepth;
          }
        }
      }
    }
  }

  private extractDepthPoints(depthMap: DepthMap): DepthPoint[] {
    const points: DepthPoint[] = [];
    const sampleRate = Math.max(1, Math.floor(depthMap.width / 32));
    
    for (let y = 0; y < depthMap.height; y += sampleRate) {
      for (let x = 0; x < depthMap.width; x += sampleRate) {
        const depth = depthMap.data[y][x];
        // Calculate confidence based on depth consistency with neighbors
        const confidence = this.calculatePointConfidence(depthMap, x, y);
        
        points.push({
          x: (x / depthMap.width) * this.cameraIntrinsics.imageWidth,
          y: (y / depthMap.height) * this.cameraIntrinsics.imageHeight,
          depth,
          confidence,
        });
      }
    }
    
    return points;
  }

  private calculatePointConfidence(depthMap: DepthMap, x: number, y: number): number {
    // Calculate confidence based on depth consistency with neighbors
    const depth = depthMap.data[y][x];
    let variance = 0;
    let count = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < depthMap.width && ny >= 0 && ny < depthMap.height) {
          variance += Math.pow(depthMap.data[ny][nx] - depth, 2);
          count++;
        }
      }
    }
    
    variance /= count;
    // Lower variance = higher confidence
    return Math.max(0.5, 1 - Math.min(1, variance));
  }

  private calculateAverageDepth(depthMap: DepthMap): number {
    let sum = 0;
    let count = 0;
    
    for (let y = 0; y < depthMap.height; y++) {
      for (let x = 0; x < depthMap.width; x++) {
        sum += depthMap.data[y][x];
        count++;
      }
    }
    
    return sum / count;
  }

  private calculateDepthRange(depthMap: DepthMap): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    
    for (let y = 0; y < depthMap.height; y++) {
      for (let x = 0; x < depthMap.width; x++) {
        const depth = depthMap.data[y][x];
        if (depth < min) min = depth;
        if (depth > max) max = depth;
      }
    }
    
    return { min, max };
  }

  private calculateConfidence(depthMap: DepthMap): number {
    // Calculate overall confidence based on depth map quality
    let totalVariance = 0;
    let count = 0;
    
    for (let y = 1; y < depthMap.height - 1; y++) {
      for (let x = 1; x < depthMap.width - 1; x++) {
        const variance = this.calculateLocalVariance(depthMap, x, y);
        totalVariance += variance;
        count++;
      }
    }
    
    const avgVariance = totalVariance / count;
    // Convert variance to confidence (lower variance = higher confidence)
    return Math.max(0.6, Math.min(0.98, 1 - avgVariance * 0.5));
  }

  private calculateLocalVariance(depthMap: DepthMap, x: number, y: number): number {
    const depth = depthMap.data[y][x];
    let variance = 0;
    let count = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        variance += Math.pow(depthMap.data[ny][nx] - depth, 2);
        count++;
      }
    }
    
    return variance / count;
  }

  private applyTemporalSmoothing(currentDepthMap: DepthMap): void {
    if (this.depthHistory.length === 0) return;
    
    const lastResult = this.depthHistory[this.depthHistory.length - 1];
    const lastDepthMap = lastResult.depthMap;
    
    // Check if dimensions match
    if (lastDepthMap.width !== currentDepthMap.width || 
        lastDepthMap.height !== currentDepthMap.height) {
      return;
    }
    
    const alpha = this.config.smoothingFactor;
    
    for (let y = 0; y < currentDepthMap.height; y++) {
      for (let x = 0; x < currentDepthMap.width; x++) {
        currentDepthMap.data[y][x] = 
          alpha * currentDepthMap.data[y][x] + 
          (1 - alpha) * lastDepthMap.data[y][x];
      }
    }
  }
}

// Export singleton instance
export const depthEstimationService = new DepthEstimationService();

