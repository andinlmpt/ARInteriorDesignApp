import { DetectedPlane, SpatialPoint, SpatialMappingResult, RoomData, DepthMap, SpatialMap3D, SpatialHeatmap } from '@/types/spatial-mapping';
import { imageAnalysisService } from './ImageAnalysisService';

/**
 * SpatialMappingService
 * Handles real-time spatial mapping, plane detection, and coordinate tracking
 */
export class SpatialMappingService {
  private isScanning: boolean = false;
  private detectedPlanes: DetectedPlane[] = [];
  private scanStartTime: number = 0;

  /**
   * Starts the spatial mapping process
   */
  startMapping(): void {
    this.isScanning = true;
    this.scanStartTime = Date.now();
    this.detectedPlanes = [];
  }

  /**
   * Stops the spatial mapping process
   */
  stopMapping(): void {
    this.isScanning = false;
  }

  /**
   * Checks if currently scanning
   */
  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  /**
   * Processes a camera frame to detect planes and surfaces
   * @param frameData - Camera frame data (base64 or URI)
   * @returns Detected planes in the frame
   */
  async processFrame(frameData: string): Promise<DetectedPlane[]> {
    if (!this.isScanning) {
      return [];
    }

    // Note: Plane detection is currently simulated
    // In production, this should integrate with:
    // - ARKit (iOS): ARPlaneAnchor, ARSession
    // - ARCore (Android): Plane, Session
    // - expo-gl and expo-three for 3D rendering
    // For now, simulate plane detection for development/testing
    await this.simulateFrameProcessing();

    // Simulate detection of horizontal and vertical planes
    const newPlanes = this.simulatePlaneDetection();
    this.detectedPlanes = [...this.detectedPlanes, ...newPlanes];

    return newPlanes;
  }

  /**
   * Detects horizontal planes (floors, tables, etc.)
   * @returns Array of horizontal planes
   */
  async detectHorizontalPlanes(): Promise<DetectedPlane[]> {
    return this.detectedPlanes.filter((plane) => plane.type === 'horizontal');
  }

  /**
   * Detects vertical planes (walls)
   * @returns Array of vertical planes
   */
  async detectVerticalPlanes(): Promise<DetectedPlane[]> {
    return this.detectedPlanes.filter((plane) => plane.type === 'vertical');
  }

  /**
   * Performs a complete spatial scan and returns mapping results with improved logic
   * @param imageUri - Captured image URI
   * @returns Complete spatial mapping result
   */
  async performSpatialScan(imageUri: string): Promise<SpatialMappingResult> {
    if (!imageUri || typeof imageUri !== 'string') {
      throw new Error('Invalid image URI provided for spatial scan');
    }

    try {
      // Start mapping
      this.startMapping();

      // Perform room analysis using image analysis service first
      const roomData = await imageAnalysisService.performRoomScan(imageUri);

      if (!roomData || !roomData.dimensions) {
        throw new Error('Failed to analyze room data');
      }

      const { width, length, height } = roomData.dimensions;
      const halfWidth = width / 2;
      const halfLength = length / 2;
      const wallHeight = height / 2;

      // Simulate progressive plane detection based on actual room dimensions
      const planes: DetectedPlane[] = [];

      // Detect floor plane with realistic size
      const floorCenter: SpatialPoint = { x: 0, y: 0, z: 0 };
      planes.push(this.createPlane('floor', 'horizontal', floorCenter, width, length));

      // Detect wall planes (4 walls) based on actual room dimensions
      planes.push(this.createPlane('wall-north', 'vertical', { x: 0, y: wallHeight, z: -halfLength }, width, height));
      planes.push(this.createPlane('wall-south', 'vertical', { x: 0, y: wallHeight, z: halfLength }, width, height));
      planes.push(this.createPlane('wall-east', 'vertical', { x: halfWidth, y: wallHeight, z: 0 }, length, height));
      planes.push(this.createPlane('wall-west', 'vertical', { x: -halfWidth, y: wallHeight, z: 0 }, length, height));

      // Optionally detect ceiling plane
      planes.push(this.createPlane('ceiling', 'horizontal', { x: 0, y: height, z: 0 }, width, length));

      this.detectedPlanes = planes;

      // Calculate confidence based on number of detected planes and room data quality
      // Improved accuracy calculation with better weighting
      const planeConfidence = Math.min(0.95, 0.5 + (planes.length * 0.07));
      const roomDataConfidence = roomData.confidence || 0.7;
      const dimensionAccuracy = roomData.dimensions?.accuracy || 85;
      const accuracyFactor = dimensionAccuracy / 100; // Convert to 0-1 scale

      // Weighted confidence: planes (30%), room data (30%), dimension accuracy (40%)
      const confidence = (planeConfidence * 0.3) + (roomDataConfidence * 0.3) + (accuracyFactor * 0.4);

      // Ensure confidence is within reasonable bounds
      const finalConfidence = Math.max(0.3, Math.min(0.98, confidence));

      // Estimate FPS based on processing time (simulated)
      const estimatedFPS = 20 + Math.random() * 10;

      // Generate depth map from room data
      const depthMap = this.generateDepthMap(roomData, planes);

      // Create 3D spatial map
      const spatialMap3D = this.create3DSpatialMap(planes, roomData);

      // Generate heatmap of detected features
      const heatmap = this.generateHeatmap(planes, roomData);

      const result: SpatialMappingResult = {
        planes,
        roomData,
        depthMap,
        spatialMap3D,
        heatmap,
        timestamp: Date.now(),
        confidence: finalConfidence,
        fps: Math.round(estimatedFPS),
      };

      this.stopMapping();
      return result;
    } catch (error) {
      console.error('[SpatialMappingService] Error performing spatial scan:', error);
      this.stopMapping();

      // Return minimal fallback result instead of throwing
      return {
        planes: [],
        roomData: {
          dimensions: { width: 4.0, length: 5.0, height: 2.5, unit: 'meters', accuracy: 0.5 },
          area: 20.0,
          volume: 50.0,
          obstacles: [],
          walls: [],
          floorBoundary: [],
          ceilingBoundary: [],
          floorType: 'Unknown',
          naturalLight: 'Unknown',
          confidence: 0.3,
          timestamp: Date.now(),
        },
        depthMap: null,
        spatialMap3D: null,
        heatmap: null,
        timestamp: Date.now(),
        confidence: 0.2,
        fps: 0,
      };
    }
  }

  /**
   * Converts screen coordinates to 3D spatial coordinates
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @returns 3D spatial point
   */
  screenToSpatialCoordinates(screenX: number, screenY: number): SpatialPoint {
    // Implement coordinate transformation using camera intrinsics
    // This uses a pinhole camera model with estimated intrinsics

    // Estimated camera intrinsics (would be calibrated in production)
    const focalLength = 800; // pixels
    const principalPointX = 0.5; // normalized
    const principalPointY = 0.5; // normalized

    // Convert normalized screen coordinates to image coordinates
    const imageX = (screenX - principalPointX) * 2; // -1 to 1 range
    const imageY = (screenY - principalPointY) * 2; // -1 to 1 range

    // Estimate depth based on detected planes (average room depth)
    const averageDepth = 3.0; // meters

    // Transform to 3D spatial coordinates using camera model
    // X = (u - cx) * Z / fx
    // Y = (v - cy) * Z / fy
    // Z = estimated depth
    const z = averageDepth;
    const x = (imageX * z) / focalLength;
    const y = (imageY * z) / focalLength;

    // Adjust for typical camera height (1.5m above floor)
    return {
      x: x * 2, // Scale factor for room space
      y: 1.5 + y, // Camera height + vertical offset
      z: z * 2, // Scale factor for room space
    };
  }

  /**
   * Calculates the distance between two spatial points
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

  /**
   * Gets all currently detected planes
   * @returns Array of detected planes
   */
  getDetectedPlanes(): DetectedPlane[] {
    return [...this.detectedPlanes];
  }

  /**
   * Clears all detected planes
   */
  clearDetectedPlanes(): void {
    this.detectedPlanes = [];
  }

  /**
   * Gets the scanning duration in milliseconds
   * @returns Scanning duration
   */
  getScanDuration(): number {
    if (this.scanStartTime === 0) return 0;
    return Date.now() - this.scanStartTime;
  }

  /**
   * Creates a simulated plane for testing with customizable dimensions
   * @param id - Plane identifier
   * @param type - Plane type (horizontal or vertical)
   * @param center - Center point of the plane
   * @param width - Width/dimension 1 of the plane
   * @param length - Length/dimension 2 of the plane
   * @returns Detected plane object
   */
  private createPlane(
    id: string,
    type: 'horizontal' | 'vertical',
    center: SpatialPoint,
    width: number = 3.0,
    length: number = 3.0
  ): DetectedPlane {
    const halfWidth = width / 2;
    const halfLength = length / 2;
    const points: SpatialPoint[] = [];

    // Create corner points based on plane type with actual dimensions
    if (type === 'horizontal') {
      // Horizontal plane (floor/ceiling)
      points.push(
        { x: center.x - halfWidth, y: center.y, z: center.z - halfLength },
        { x: center.x + halfWidth, y: center.y, z: center.z - halfLength },
        { x: center.x + halfWidth, y: center.y, z: center.z + halfLength },
        { x: center.x - halfWidth, y: center.y, z: center.z + halfLength }
      );
    } else {
      // Vertical plane (walls)
      const halfHeight = length / 2; // For vertical planes, length represents height
      points.push(
        { x: center.x, y: center.y - halfHeight, z: center.z - halfWidth },
        { x: center.x, y: center.y + halfHeight, z: center.z - halfWidth },
        { x: center.x, y: center.y + halfHeight, z: center.z + halfWidth },
        { x: center.x, y: center.y - halfHeight, z: center.z + halfWidth }
      );
    }

    // Calculate normal vector based on plane orientation
    let normal: SpatialPoint;
    if (type === 'horizontal') {
      normal = { x: 0, y: center.y >= 0 ? 1 : -1, z: 0 };
    } else {
      // Normal points outward from room center
      if (Math.abs(center.x) > Math.abs(center.z)) {
        normal = { x: center.x >= 0 ? 1 : -1, y: 0, z: 0 };
      } else {
        normal = { x: 0, y: 0, z: center.z >= 0 ? 1 : -1 };
      }
    }

    const area = type === 'horizontal' ? width * length : width * length;

    return {
      id,
      type,
      points,
      center,
      normal,
      area,
      confidence: 0.75 + Math.random() * 0.2,
      timestamp: Date.now(),
    };
  }

  /**
   * Simulates plane detection for testing
   * @returns Array of newly detected planes
   */
  private simulatePlaneDetection(): DetectedPlane[] {
    // Return empty array most of the time, occasionally detect a plane
    if (Math.random() > 0.3) {
      return [];
    }

    const planeId = `plane-${Date.now()}-${Math.random()}`;
    const type = Math.random() > 0.5 ? 'horizontal' : 'vertical';
    const center: SpatialPoint = {
      x: (Math.random() - 0.5) * 6,
      y: type === 'horizontal' ? 0 : 1.5,
      z: (Math.random() - 0.5) * 6,
    };

    return [this.createPlane(planeId, type, center)];
  }

  /**
   * Simulates frame processing delay
   */
  private simulateFrameProcessing(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 50));
  }

  /**
   * Generate depth map from room data and planes
   * @param roomData - Room analysis data
   * @param planes - Detected planes
   * @returns Depth map data structure
   */
  private generateDepthMap(roomData: RoomData, planes: DetectedPlane[]): DepthMap {
    const { width, length, height } = roomData.dimensions;
    const resolution = 50; // 50x50 grid

    // Create depth grid based on room dimensions and detected planes
    const depthGrid: number[][] = [];
    for (let i = 0; i < resolution; i++) {
      const row: number[] = [];
      for (let j = 0; j < resolution; j++) {
        const x = (i / resolution - 0.5) * width;
        const z = (j / resolution - 0.5) * length;

        // Calculate depth based on distance to nearest plane
        let minDistance = height;
        for (const plane of planes) {
          const distance = this.calculateDistance(
            { x, y: 0, z },
            plane.center
          );
          if (distance < minDistance) {
            minDistance = distance;
          }
        }

        // Normalize depth (0 = far, 1 = near)
        const normalizedDepth = 1 - Math.min(1, minDistance / height);
        row.push(normalizedDepth);
      }
      depthGrid.push(row);
    }

    return {
      width,
      height,
      data: depthGrid,
      minDepth: 0,
      maxDepth: height,
    };
  }

  /**
   * Create 3D spatial map from planes and room data
   * @param planes - Detected planes
   * @param roomData - Room analysis data
   * @returns 3D spatial map structure
   */
  private create3DSpatialMap(planes: DetectedPlane[], roomData: RoomData): SpatialMap3D {
    const { width, length, height } = roomData.dimensions;

    // Create 3D mesh from planes
    const mesh = {
      vertices: [] as Array<[number, number, number]>,
      faces: [] as Array<[number, number, number]>,
      normals: [] as Array<[number, number, number]>,
    };

    // Add vertices and faces from each plane
    let vertexIndex = 0;
    for (const plane of planes) {
      const startIndex = vertexIndex;

      // Add vertices
      for (const point of plane.points) {
        mesh.vertices.push([point.x, point.y, point.z]);
        mesh.normals.push([plane.normal.x, plane.normal.y, plane.normal.z]);
        vertexIndex++;
      }

      // Add faces (triangles) for the plane
      if (plane.points.length >= 4) {
        // Two triangles to form a quad
        mesh.faces.push([startIndex, startIndex + 1, startIndex + 2]);
        mesh.faces.push([startIndex, startIndex + 2, startIndex + 3]);
      }
    }

    // Convert mesh to points and grid format
    const points: SpatialPoint[] = mesh.vertices.map(v => ({
      x: v[0],
      y: v[1],
      z: v[2],
    }));

    // Create simple voxel grid (simplified for now)
    const gridResolution = 10;
    const grid: number[][][] = Array.from({ length: gridResolution }, () =>
      Array.from({ length: gridResolution }, () =>
        Array(gridResolution).fill(0)
      )
    );

    return {
      points,
      normals: mesh.normals.map(n => ({ x: n[0], y: n[1], z: n[2] })),
      grid,
    };
  }

  /**
   * Generate heatmap of detected features
   * @param planes - Detected planes
   * @param roomData - Room analysis data
   * @returns Heatmap data structure
   */
  private generateHeatmap(planes: DetectedPlane[], roomData: RoomData): SpatialHeatmap {
    const { width, length } = roomData.dimensions;
    const resolution = 100; // 100x100 grid for detailed heatmap

    // Create heatmap grid showing feature density
    const heatmapGrid: number[][] = [];
    for (let i = 0; i < resolution; i++) {
      const row: number[] = [];
      for (let j = 0; j < resolution; j++) {
        const x = (i / resolution - 0.5) * width;
        const z = (j / resolution - 0.5) * length;

        // Calculate feature density (proximity to planes and obstacles)
        let density = 0;

        // Add density from planes
        for (const plane of planes) {
          const distance = this.calculateDistance(
            { x, y: 0, z },
            plane.center
          );
          const influence = Math.max(0, 1 - distance / 2); // Influence radius of 2m
          density += influence * plane.confidence;
        }

        // Add density from obstacles
        if (roomData.obstacles) {
          for (const obstacle of roomData.obstacles) {
            if (obstacle.coordinates) {
              const distance = this.calculateDistance(
                { x, y: 0, z },
                obstacle.coordinates
              );
              const influence = Math.max(0, 1 - distance / 1.5); // Influence radius of 1.5m
              density += influence * (obstacle.confidence || 0.8);
            }
          }
        }

        // Normalize density (0-1 range)
        row.push(Math.min(1, density / 3));
      }
      heatmapGrid.push(row);
    }

    return {
      width,
      height: length,
      data: heatmapGrid,
      resolution,
    };
  }
}

// Export a singleton instance
export const spatialMappingService = new SpatialMappingService();
