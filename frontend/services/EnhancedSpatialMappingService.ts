import {
  DetectedPlane,
  SpatialPoint,
  SpatialMappingResult,
  RoomData,
  SpatialMap3D,
  SpatialHeatmap,
  DepthMap,
  SpatialMappingSummary,
  CalibrationStatus,
  MappingQualitySnapshot,
} from '@/types/spatial-mapping';
import { enhancedImageAnalysisService } from './EnhancedImageAnalysisService';

/**
 * EnhancedSpatialMappingService
 * Real-time 3D spatial mapping with heatmap generation and FPS monitoring
 */
export class EnhancedSpatialMappingService {
  private isScanning: boolean = false;
  private detectedPlanes: DetectedPlane[] = [];
  private scanStartTime: number = 0;
  private spatialMap3D: SpatialMap3D | null = null;
  private heatmap: SpatialHeatmap | null = null;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private fpsHistory: number[] = [];
  private obstacleMap: Map<string, any> = new Map();
  private frameBuffer: string[] = [];
  private frameBufferLimit: number = 45;
  private calibrationStatus: CalibrationStatus = 'idle';
  private calibrationStartTime: number = 0;
  private totalFramesProcessed: number = 0;
  private coverageScore: number = 0;
  private lastHeatmapSnapshotAt: number = 0;
  private qualitySnapshots: MappingQualitySnapshot[] = [];
  private maxQualitySnapshots: number = 25;
  private lastRoomData: RoomData | null = null;
  private lastResult: SpatialMappingResult | null = null;

  // Configuration
  private config = {
    targetFPS: 25,
    heatmapResolution: 0.1, // meters per cell
    voxelSize: 0.05, // meters
    maxDetectedPlanes: 20,
    remappingThreshold: 0.3, // confidence threshold for remapping
  };

  /**
   * Start spatial mapping session
   */
  startMapping(): void {
    this.isScanning = true;
    this.scanStartTime = Date.now();
    this.detectedPlanes = [];
    this.frameCount = 0;
    this.fpsHistory = [];
    this.obstacleMap.clear();
    this.frameBuffer = [];
    this.calibrationStatus = 'calibrating';
    this.calibrationStartTime = Date.now();
    this.totalFramesProcessed = 0;
    this.coverageScore = 0;
    this.lastHeatmapSnapshotAt = 0;
    this.qualitySnapshots = [];
  }

  /**
   * Stop spatial mapping session
   */
  stopMapping(): void {
    this.isScanning = false;
    this.calibrationStatus = 'idle';
  }

  /**
   * Check if currently scanning
   */
  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  /**
   * Process a camera frame in real-time (15-30 FPS)
   * @param frameData - Camera frame data
   * @returns Detected planes in the current frame
   */
  async processFrame(frameData: string): Promise<DetectedPlane[]> {
    if (!this.isScanning) {
      return [];
    }

    const startTime = performance.now();
    this.frameCount++;
    this.totalFramesProcessed++;
    this.frameBuffer.push(frameData);
    if (this.frameBuffer.length > this.frameBufferLimit) {
      this.frameBuffer.shift();
    }
    this.updateCalibrationState();

    try {
      // Detect planes in the current frame
      const newPlanes = await this.detectPlanesInFrame(frameData);

      // Update the spatial map
      if (newPlanes.length > 0) {
        this.mergePlanes(newPlanes);
        await this.updateSpatialMap3D(newPlanes);
        await this.updateHeatmap(newPlanes);
        this.incrementCoverageScore(newPlanes.length);
      }

      // Update FPS tracking
      this.updateFPS(startTime);
      this.recordQualitySnapshot();

      return newPlanes;
    } catch (error) {
      console.error('Error processing frame:', error);
      return [];
    }
  }

  /**
   * Perform complete spatial scan with all features
   * @param imageUri - Image URI
   * @returns Complete spatial mapping result
   */
  async performSpatialScan(imageUri: string): Promise<SpatialMappingResult> {
    try {
      this.startMapping();

      // Perform room analysis
      const roomData = await enhancedImageAnalysisService.performRoomScan(imageUri);

      // Generate planes from room data
      const planes = this.generatePlanesFromRoomData(roomData);
      this.detectedPlanes = planes;

      // Generate 3D map
      const spatialMap3D = await this.generate3DMap(roomData, planes);

      // Generate heatmap
      const heatmap = await this.generateHeatmap(roomData);

      // Get depth map from image analysis
      const depthMap = await enhancedImageAnalysisService.estimateDepth(imageUri);

      const confidence = this.calculateOverallConfidence(roomData, planes);
      const fps = this.getCurrentFPS();

      const result: SpatialMappingResult = {
        planes,
        roomData,
        depthMap,
        spatialMap3D,
        heatmap,
        timestamp: Date.now(),
        confidence,
        fps,
      };

      this.lastRoomData = roomData;
      this.lastResult = result;
      this.coverageScore = Math.min(1, this.coverageScore + 0.35);
      this.recordQualitySnapshot();
      this.stopMapping();
      return result;
    } catch (error) {
      console.error('Error performing spatial scan:', error);
      this.stopMapping();
      throw error;
    }
  }

  /**
   * Generate 3D spatial map from room data
   * @param roomData - Room data
   * @param planes - Detected planes
   * @returns 3D spatial map
   */
  async generate3DMap(roomData: RoomData, planes: DetectedPlane[]): Promise<SpatialMap3D> {
    const points: SpatialPoint[] = [];
    const colors: string[] = [];
    const normals: SpatialPoint[] = [];

    // Add points from floor boundary
    roomData.floorBoundary.forEach((point) => {
      points.push(point);
      colors.push('#8B7355');
      normals.push({ x: 0, y: 1, z: 0 });
    });

    // Add points from ceiling boundary
    roomData.ceilingBoundary.forEach((point) => {
      points.push(point);
      colors.push('#FFFFFF');
      normals.push({ x: 0, y: -1, z: 0 });
    });

    // Add points from walls
    roomData.walls.forEach((wall) => {
      points.push(wall.startPoint);
      points.push(wall.endPoint);
      colors.push('#E8E8E8', '#E8E8E8');
      
      const normal = this.calculateWallNormal(wall.orientation);
      normals.push(normal, normal);
    });

    // Add points from obstacles
    roomData.obstacles.forEach((obstacle) => {
      points.push(obstacle.coordinates);
      colors.push(this.getObstacleColor(obstacle.type));
      normals.push({ x: 0, y: 1, z: 0 });
    });

    // Generate voxel grid
    const grid = this.generateVoxelGrid(roomData, points);

    this.spatialMap3D = {
      points,
      colors,
      normals,
      grid,
    };

    return this.spatialMap3D;
  }

  /**
   * Generate top-down spatial heatmap
   * @param roomData - Room data
   * @returns Spatial heatmap
   */
  async generateHeatmap(roomData: RoomData): Promise<SpatialHeatmap> {
    const resolution = this.config.heatmapResolution;
    const width = Math.ceil(roomData.dimensions.width / resolution);
    const height = Math.ceil(roomData.dimensions.length / resolution);

    // Initialize heatmap with zeros
    const data: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

    // Mark obstacles in heatmap (1 = occupied, 0 = free)
    roomData.obstacles.forEach((obstacle) => {
      const x = Math.floor((obstacle.coordinates.x + roomData.dimensions.width / 2) / resolution);
      const z = Math.floor((obstacle.coordinates.z + roomData.dimensions.length / 2) / resolution);

      if (x >= 0 && x < width && z >= 0 && z < height) {
        // Mark obstacle and surrounding cells
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx >= 0 && nx < width && nz >= 0 && nz < height) {
              data[nz][nx] = Math.max(data[nz][nx], 1.0 - Math.abs(dx) * 0.3 - Math.abs(dz) * 0.3);
            }
          }
        }
      }
    });

    this.heatmap = {
      width,
      height,
      data,
      resolution,
    };

    return this.heatmap;
  }

  /**
   * Detect horizontal planes (floors, tables, etc.)
   * @returns Array of horizontal planes
   */
  async detectHorizontalPlanes(): Promise<DetectedPlane[]> {
    return this.detectedPlanes.filter((plane) => plane.type === 'horizontal');
  }

  /**
   * Detect vertical planes (walls)
   * @returns Array of vertical planes
   */
  async detectVerticalPlanes(): Promise<DetectedPlane[]> {
    return this.detectedPlanes.filter((plane) => plane.type === 'vertical');
  }

  /**
   * Update obstacle dynamically in real-time
   * @param obstacleId - Obstacle ID
   * @param newPosition - New position
   */
  updateObstaclePosition(obstacleId: string, newPosition: SpatialPoint): void {
    this.obstacleMap.set(obstacleId, {
      position: newPosition,
      timestamp: Date.now(),
    });

    // Trigger heatmap update
    if (this.heatmap) {
      this.updateHeatmapForObstacle(obstacleId, newPosition);
    }
  }

  /**
   * Re-map environment (useful when lighting/angle changes)
   * @param imageUri - New image URI
   * @returns Updated mapping result
   */
  async remapEnvironment(imageUri: string): Promise<SpatialMappingResult> {
    console.log('Remapping environment due to environmental changes...');
    
    // Clear previous data
    this.detectedPlanes = [];
    this.spatialMap3D = null;
    this.heatmap = null;

    // Perform new scan
    return await this.performSpatialScan(imageUri);
  }

  /**
   * Check if remapping is needed based on confidence
   * @param confidence - Current confidence score
   * @returns Whether remapping is recommended
   */
  shouldRemap(confidence: number): boolean {
    return confidence < this.config.remappingThreshold;
  }

  /**
   * Get current FPS
   * @returns Current frames per second
   */
  getCurrentFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    const avgFPS = this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
    return parseFloat(avgFPS.toFixed(1));
  }

  /**
   * Get scan duration in milliseconds
   * @returns Duration
   */
  getScanDuration(): number {
    if (this.scanStartTime === 0) return 0;
    return Date.now() - this.scanStartTime;
  }

  /**
   * Get all detected planes
   * @returns Array of planes
   */
  getDetectedPlanes(): DetectedPlane[] {
    return [...this.detectedPlanes];
  }

  /**
   * Get current 3D spatial map
   * @returns 3D spatial map or null
   */
  getSpatialMap3D(): SpatialMap3D | null {
    return this.spatialMap3D;
  }

  /**
   * Get current heatmap
   * @returns Spatial heatmap or null
   */
  getHeatmap(): SpatialHeatmap | null {
    return this.heatmap;
  }

  /**
   * Capture and optionally return the most recent heatmap snapshot
   */
  captureHeatmapSnapshot(force: boolean = false): SpatialHeatmap | null {
    if (!this.heatmap) {
      return null;
    }

    const now = Date.now();
    if (force || now - this.lastHeatmapSnapshotAt > 1500) {
      this.lastHeatmapSnapshotAt = now;
      return this.heatmap;
    }

    return null;
  }

  /**
   * Get the latest computed room data
   */
  getLatestRoomData(): RoomData | null {
    return this.lastRoomData;
  }

  /**
   * Override the latest room data (useful for live scan updates)
   */
  setLatestRoomData(roomData: RoomData): void {
    this.lastRoomData = roomData;
  }

  /**
   * Get the most recent full spatial mapping result
   */
  getLatestSpatialResult(): SpatialMappingResult | null {
    return this.lastResult;
  }

  /**
   * Get the current spatial mapping summary with calibration/coverage details
   */
  getMappingSummary(): SpatialMappingSummary {
    return {
      calibrationStatus: this.calibrationStatus,
      calibrationElapsedMs: this.calibrationStatus === 'calibrating'
        ? Date.now() - this.calibrationStartTime
        : 0,
      framesProcessed: this.totalFramesProcessed,
      fps: this.getCurrentFPS(),
      confidence: this.lastResult?.confidence ?? this.lastRoomData?.confidence ?? 0,
      coverage: Math.min(1, this.coverageScore),
      heatmap: this.heatmap,
      lastHeatmapSnapshotAt: this.lastHeatmapSnapshotAt || undefined,
      obstaclesDetected: this.lastRoomData?.obstacles.length ?? this.detectedPlanes.length,
      roomData: this.lastRoomData,
      recentSnapshots: [...this.qualitySnapshots],
    };
  }

  /**
   * Clear all detected data
   */
  clearDetectedPlanes(): void {
    this.detectedPlanes = [];
    this.spatialMap3D = null;
    this.heatmap = null;
    this.obstacleMap.clear();
  }

  /**
   * Calculate distance between two spatial points
   * @param point1 - First point
   * @param point2 - Second point
   * @returns Distance in meters
   */
  calculateDistance(point1: SpatialPoint, point2: SpatialPoint): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = point2.z - point1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Private helper methods

  private async detectPlanesInFrame(frameData: string): Promise<DetectedPlane[]> {
    // Simulate real-time plane detection
    await this.simulateProcessing(30);

    const planes: DetectedPlane[] = [];
    const numPlanes = Math.random() > 0.7 ? 1 : 0;

    for (let i = 0; i < numPlanes; i++) {
      const type = Math.random() > 0.5 ? 'horizontal' : 'vertical';
      const center: SpatialPoint = {
        x: (Math.random() - 0.5) * 5,
        y: type === 'horizontal' ? 0 : 1.5,
        z: (Math.random() - 0.5) * 5,
      };

      planes.push(this.createPlane(`plane-${this.frameCount}-${i}`, type, center));
    }

    return planes;
  }

  private createPlane(id: string, type: 'horizontal' | 'vertical', center: SpatialPoint): DetectedPlane {
    const size = 2.0 + Math.random() * 2.0;
    const points: SpatialPoint[] = [];

    if (type === 'horizontal') {
      points.push(
        { x: center.x - size / 2, y: center.y, z: center.z - size / 2 },
        { x: center.x + size / 2, y: center.y, z: center.z - size / 2 },
        { x: center.x + size / 2, y: center.y, z: center.z + size / 2 },
        { x: center.x - size / 2, y: center.y, z: center.z + size / 2 }
      );
    } else {
      points.push(
        { x: center.x, y: center.y - size / 2, z: center.z - size / 2 },
        { x: center.x, y: center.y + size / 2, z: center.z - size / 2 },
        { x: center.x, y: center.y + size / 2, z: center.z + size / 2 },
        { x: center.x, y: center.y - size / 2, z: center.z + size / 2 }
      );
    }

    const normal: SpatialPoint = type === 'horizontal' 
      ? { x: 0, y: 1, z: 0 } 
      : { x: 1, y: 0, z: 0 };

    return {
      id,
      type,
      points,
      center,
      normal,
      area: size * size,
      confidence: 0.75 + Math.random() * 0.2,
      timestamp: Date.now(),
    };
  }

  private mergePlanes(newPlanes: DetectedPlane[]): void {
    newPlanes.forEach((newPlane) => {
      // Check if plane already exists (merge logic)
      const existingIndex = this.detectedPlanes.findIndex((plane) => 
        this.calculateDistance(plane.center, newPlane.center) < 0.5
      );

      if (existingIndex >= 0) {
        // Update existing plane
        this.detectedPlanes[existingIndex] = {
          ...this.detectedPlanes[existingIndex],
          confidence: Math.max(this.detectedPlanes[existingIndex].confidence, newPlane.confidence),
          timestamp: newPlane.timestamp,
        };
      } else if (this.detectedPlanes.length < this.config.maxDetectedPlanes) {
        // Add new plane
        this.detectedPlanes.push(newPlane);
      }
    });
  }

  private async updateSpatialMap3D(newPlanes: DetectedPlane[]): Promise<void> {
    if (!this.spatialMap3D) return;

    // Add new points from planes
    newPlanes.forEach((plane) => {
      plane.points.forEach((point) => {
        this.spatialMap3D!.points.push(point);
        this.spatialMap3D!.colors?.push(plane.type === 'horizontal' ? '#8B7355' : '#E8E8E8');
        this.spatialMap3D!.normals?.push(plane.normal);
      });
    });
  }

  private async updateHeatmap(newPlanes: DetectedPlane[]): Promise<void> {
    // Update heatmap based on new plane detections
    // (simplified for demo)
  }

  private updateHeatmapForObstacle(obstacleId: string, position: SpatialPoint): void {
    if (!this.heatmap) return;

    const resolution = this.config.heatmapResolution;
    const x = Math.floor((position.x + 5) / resolution); // Assuming 10m max width
    const z = Math.floor((position.z + 5) / resolution);

    if (x >= 0 && x < this.heatmap.width && z >= 0 && z < this.heatmap.height) {
      this.heatmap.data[z][x] = 1.0;
    }
  }

  private generatePlanesFromRoomData(roomData: RoomData): DetectedPlane[] {
    const planes: DetectedPlane[] = [];

    // Floor plane
    planes.push({
      id: 'floor',
      type: 'horizontal',
      points: roomData.floorBoundary,
      center: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      area: roomData.area,
      confidence: roomData.confidence,
      timestamp: Date.now(),
    });

    // Ceiling plane
    planes.push({
      id: 'ceiling',
      type: 'horizontal',
      points: roomData.ceilingBoundary,
      center: { x: 0, y: roomData.dimensions.height, z: 0 },
      normal: { x: 0, y: -1, z: 0 },
      area: roomData.area,
      confidence: roomData.confidence,
      timestamp: Date.now(),
    });

    // Wall planes
    roomData.walls.forEach((wall) => {
      const wallPoints = this.generateWallPoints(wall, roomData.dimensions.height);
      planes.push({
        id: wall.id,
        type: 'vertical',
        points: wallPoints,
        center: {
          x: (wall.startPoint.x + wall.endPoint.x) / 2,
          y: roomData.dimensions.height / 2,
          z: (wall.startPoint.z + wall.endPoint.z) / 2,
        },
        normal: this.calculateWallNormal(wall.orientation),
        area: wall.length * roomData.dimensions.height,
        confidence: roomData.confidence,
        timestamp: Date.now(),
      });
    });

    return planes;
  }

  private generateWallPoints(wall: any, height: number): SpatialPoint[] {
    return [
      { ...wall.startPoint, y: 0 },
      { ...wall.endPoint, y: 0 },
      { ...wall.endPoint, y: height },
      { ...wall.startPoint, y: height },
    ];
  }

  private calculateWallNormal(orientation: 'north' | 'south' | 'east' | 'west'): SpatialPoint {
    switch (orientation) {
      case 'north': return { x: 0, y: 0, z: 1 };
      case 'south': return { x: 0, y: 0, z: -1 };
      case 'east': return { x: -1, y: 0, z: 0 };
      case 'west': return { x: 1, y: 0, z: 0 };
    }
  }

  private generateVoxelGrid(roomData: RoomData, points: SpatialPoint[]): number[][][] {
    const voxelSize = this.config.voxelSize;
    const width = Math.ceil(roomData.dimensions.width / voxelSize);
    const height = Math.ceil(roomData.dimensions.height / voxelSize);
    const length = Math.ceil(roomData.dimensions.length / voxelSize);

    // Initialize 3D grid
    const grid: number[][][] = Array(width).fill(0).map(() =>
      Array(height).fill(0).map(() => Array(length).fill(0))
    );

    // Mark occupied voxels
    points.forEach((point) => {
      const x = Math.floor((point.x + roomData.dimensions.width / 2) / voxelSize);
      const y = Math.floor(point.y / voxelSize);
      const z = Math.floor((point.z + roomData.dimensions.length / 2) / voxelSize);

      if (x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < length) {
        grid[x][y][z] = 1;
      }
    });

    return grid;
  }

  private getObstacleColor(type: string): string {
    const colors: Record<string, string> = {
      Window: '#87CEEB',
      Door: '#8B4513',
      Furniture: '#654321',
      Radiator: '#C0C0C0',
      'Electrical Outlet': '#FFD700',
      Other: '#808080',
    };
    return colors[type] || '#808080';
  }

  private calculateOverallConfidence(roomData: RoomData, planes: DetectedPlane[]): number {
    const roomConfidence = roomData.confidence;
    const planeConfidence = planes.length > 0
      ? planes.reduce((sum, plane) => sum + plane.confidence, 0) / planes.length
      : 0.5;
    
    return (roomConfidence + planeConfidence) / 2;
  }

  private updateFPS(startTime: number): void {
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    const currentTime = Date.now();
    if (this.lastFrameTime > 0) {
      const deltaTime = currentTime - this.lastFrameTime;
      const fps = 1000 / deltaTime;
      
      this.fpsHistory.push(fps);
      
      // Keep only last 30 frames
      if (this.fpsHistory.length > 30) {
        this.fpsHistory.shift();
      }
    }
    
    this.lastFrameTime = currentTime;
  }

  private updateCalibrationState(): void {
    if (this.calibrationStatus !== 'calibrating') {
      return;
    }
    const elapsed = Date.now() - this.calibrationStartTime;
    if (elapsed > 3000 || this.totalFramesProcessed > 20) {
      this.calibrationStatus = 'ready';
    }
  }

  private incrementCoverageScore(newPlanesDetected: number): void {
    if (newPlanesDetected <= 0) {
      this.coverageScore = Math.min(1, this.coverageScore + 0.01);
      return;
    }
    const increment = Math.min(0.12, 0.04 * newPlanesDetected);
    this.coverageScore = Math.min(1, this.coverageScore + increment);
  }

  private recordQualitySnapshot(): void {
    const snapshot: MappingQualitySnapshot = {
      timestamp: Date.now(),
      confidence: this.lastResult?.confidence
        ?? this.lastRoomData?.confidence
        ?? Math.max(0.4, this.coverageScore),
      fps: this.getCurrentFPS(),
      coverage: Math.min(1, this.coverageScore),
      obstaclesDetected: this.lastRoomData?.obstacles.length ?? 0,
    };

    this.qualitySnapshots.push(snapshot);
    if (this.qualitySnapshots.length > this.maxQualitySnapshots) {
      this.qualitySnapshots.shift();
    }
  }

  private simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const enhancedSpatialMappingService = new EnhancedSpatialMappingService();
