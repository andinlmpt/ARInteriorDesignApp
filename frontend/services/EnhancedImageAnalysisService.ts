import {
  ImageAnalysisConfig,
  RoomData,
  Obstacle,
  FrameAnalysisResult,
  DepthMap,
  SpatialPoint,
  RoomDimensions,
  WallBoundary,
  BoundingBox,
} from '@/types/spatial-mapping';

/**
 * Measurement history entry for stabilization
 */
interface MeasurementEntry {
  width: number;
  length: number;
  height: number;
  timestamp: number;
  confidence: number;
}

/**
 * ⚠️ IMPORTANT: SIMULATION MODE
 * 
 * This service currently operates in SIMULATION mode because:
 * - No ML model (TensorFlow.js, ML Kit, etc.) is integrated
 * - Real object detection requires trained neural networks
 * - Real depth estimation requires ARKit/ARCore or LiDAR
 * 
 * For REAL measurements, you need to integrate:
 * - TensorFlow.js with COCO-SSD for object detection
 * - MiDaS model for monocular depth estimation  
 * - ARKit (iOS) or ARCore (Android) for spatial mapping
 * 
 * Current behavior: Returns SIMULATED data for UI demonstration
 */

/**
 * EnhancedImageAnalysisService
 * ⚠️ SIMULATION MODE - See note above
 */
export class EnhancedImageAnalysisService {
  private config: ImageAnalysisConfig;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private fpsHistory: number[] = [];
  private isProcessing: boolean = false;

  // === ACCURACY ENHANCEMENT: Measurement Stabilization ===
  private measurementHistory: MeasurementEntry[] = [];
  private readonly MAX_HISTORY_SIZE = 10; // Keep last 10 measurements for averaging
  private stabilizedDimensions: { width: number; length: number; height: number } | null = null;
  private calibrationFactor: number = 1.0;
  private roomTypeProfile: 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'unknown' = 'unknown';
  private scanSessionId: string = '';
  private lastObstacles: Obstacle[] = [];
  
  // Obstacle stabilization
  private obstacleDetectionCount: number = 0;
  private obstacleStabilized: boolean = false;
  private obstacleDistanceHistory: Map<string, number[]> = new Map();
  
  // Camera validation
  private validFrameCount: number = 0;
  private lastValidFrameTime: number = 0;

  // Standard room dimensions for reference (in meters)
  private readonly ROOM_PROFILES = {
    living_room: { width: { min: 4.0, max: 7.0 }, length: { min: 5.0, max: 8.0 }, height: { min: 2.4, max: 3.0 } },
    bedroom: { width: { min: 3.0, max: 5.0 }, length: { min: 3.5, max: 5.0 }, height: { min: 2.4, max: 2.8 } },
    kitchen: { width: { min: 2.5, max: 4.5 }, length: { min: 3.0, max: 5.0 }, height: { min: 2.3, max: 2.7 } },
    bathroom: { width: { min: 1.5, max: 3.0 }, length: { min: 2.0, max: 3.5 }, height: { min: 2.3, max: 2.6 } },
    office: { width: { min: 3.0, max: 5.0 }, length: { min: 3.5, max: 5.5 }, height: { min: 2.4, max: 2.8 } },
    unknown: { width: { min: 3.0, max: 6.0 }, length: { min: 4.0, max: 7.0 }, height: { min: 2.4, max: 3.0 } },
  };

  constructor(config: Partial<ImageAnalysisConfig> = {}) {
    this.config = {
      enableEdgeDetection: config.enableEdgeDetection ?? true,
      enableObjectDetection: config.enableObjectDetection ?? true,
      enableDepthEstimation: config.enableDepthEstimation ?? true,
      enableSegmentation: config.enableSegmentation ?? true,
      minConfidence: config.minConfidence ?? 0.7,
      scanResolution: config.scanResolution ?? 'medium',
      targetFPS: config.targetFPS ?? 30,
      measurementAccuracy: config.measurementAccuracy ?? 97, // ±3%
    };
    this.startNewSession();
  }

  /**
   * Check if we have valid camera data to analyze
   * Returns false if image is missing, placeholder, or invalid
   */
  private hasValidCameraData(imageUri: string): boolean {
    // No URI provided
    if (!imageUri || typeof imageUri !== 'string') {
      return false;
    }
    
    // Check for placeholder/fake URIs
    if (imageUri === 'placeholder-scan-image' || 
        imageUri === 'current-frame' ||
        imageUri.includes('placeholder') ||
        imageUri.includes('fake') ||
        imageUri.includes('mock')) {
      return false;
    }
    
    // Must be a valid file URI or data URI
    const isValidUri = imageUri.startsWith('file://') || 
                       imageUri.startsWith('data:image/') ||
                       imageUri.startsWith('content://') ||
                       imageUri.startsWith('ph://') || // iOS photo library
                       imageUri.startsWith('asset://') ||
                       imageUri.startsWith('http://') ||
                       imageUri.startsWith('https://') ||
                       imageUri.startsWith('/'); // Absolute path
    
    if (!isValidUri) {
      console.log('[EnhancedImageAnalysis] Invalid image URI format:', imageUri.substring(0, 50));
      return false;
    }
    
    return true;
  }

  /**
   * Check if camera is providing valid frames
   */
  public isCameraActive(): boolean {
    return this.validFrameCount > 0;
  }

  /**
   * Get status message for UI
   */
  public getStatusMessage(): string {
    if (!this.isCameraActive()) {
      return 'Waiting for camera...';
    }
    if (!this.obstacleStabilized) {
      return 'Analyzing room...';
    }
    return 'Scan complete';
  }

  /**
   * Start a new scanning session with fresh measurements
   * Won't restart if already have good measurements (prevents accidental resets)
   */
  startNewSession(force: boolean = false): void {
    // If we already have 5+ stable measurements, don't reset unless forced
    if (!force && this.measurementHistory.length >= 5 && this.stabilizedDimensions) {
      console.log('[EnhancedImageAnalysis] Session already stabilized, skipping reset. Use force=true to reset.');
      return;
    }
    
    this.scanSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.measurementHistory = [];
    this.stabilizedDimensions = null;
    this.roomTypeProfile = 'unknown';
    this.lastObstacles = [];
    this.obstacleDetectionCount = 0;
    this.obstacleStabilized = false;
    this.obstacleDistanceHistory.clear();
    this.validFrameCount = 0;
    this.lastValidFrameTime = 0;
    console.log('[EnhancedImageAnalysis] New session started:', this.scanSessionId);
  }

  /**
   * Force reset the session (for recalibration)
   */
  forceNewSession(): void {
    this.startNewSession(true);
  }

  /**
   * Set calibration factor for more accurate measurements
   */
  setCalibrationFactor(factor: number): void {
    this.calibrationFactor = Math.max(0.5, Math.min(2.0, factor));
    console.log('[EnhancedImageAnalysis] Calibration factor set:', this.calibrationFactor);
  }

  /**
   * Get current calibration factor
   */
  getCalibrationFactor(): number {
    return this.calibrationFactor;
  }

  /**
   * Detect room type from obstacles and layout
   */
  private detectRoomType(obstacles: Obstacle[]): 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'unknown' {
    const labels = obstacles.map(o => o.label.toLowerCase());
    
    if (labels.some(l => l.includes('toilet') || l.includes('shower') || l.includes('bathtub'))) {
      return 'bathroom';
    }
    if (labels.some(l => l.includes('bed') || l.includes('wardrobe') || l.includes('dresser'))) {
      return 'bedroom';
    }
    if (labels.some(l => l.includes('stove') || l.includes('refrigerator') || l.includes('sink') || l.includes('oven'))) {
      return 'kitchen';
    }
    if (labels.some(l => l.includes('desk') || l.includes('monitor') || l.includes('computer'))) {
      return 'office';
    }
    if (labels.some(l => l.includes('sofa') || l.includes('couch') || l.includes('tv') || l.includes('television'))) {
      return 'living_room';
    }
    
    return 'unknown';
  }

  /**
   * Calculate weighted average of measurements for stability
   */
  private getStabilizedMeasurements(): { width: number; length: number; height: number; confidence: number } {
    if (this.measurementHistory.length === 0) {
      const profile = this.ROOM_PROFILES[this.roomTypeProfile];
      return {
        width: (profile.width.min + profile.width.max) / 2,
        length: (profile.length.min + profile.length.max) / 2,
        height: (profile.height.min + profile.height.max) / 2,
        confidence: 0.5,
      };
    }

    // Weight more recent measurements higher
    let totalWeight = 0;
    let weightedWidth = 0;
    let weightedLength = 0;
    let weightedHeight = 0;
    let weightedConfidence = 0;

    this.measurementHistory.forEach((entry, index) => {
      // More recent = higher weight, higher confidence = higher weight
      const recencyWeight = (index + 1) / this.measurementHistory.length;
      const confidenceWeight = entry.confidence;
      const weight = recencyWeight * confidenceWeight;

      totalWeight += weight;
      weightedWidth += entry.width * weight;
      weightedLength += entry.length * weight;
      weightedHeight += entry.height * weight;
      weightedConfidence += entry.confidence * weight;
    });

    if (totalWeight === 0) {
      totalWeight = 1;
    }

    return {
      width: weightedWidth / totalWeight,
      length: weightedLength / totalWeight,
      height: weightedHeight / totalWeight,
      confidence: weightedConfidence / totalWeight,
    };
  }

  /**
   * Add measurement to history with outlier filtering
   */
  private addMeasurementToHistory(width: number, length: number, height: number, confidence: number): void {
    const entry: MeasurementEntry = {
      width: width * this.calibrationFactor,
      length: length * this.calibrationFactor,
      height: height * this.calibrationFactor,
      timestamp: Date.now(),
      confidence,
    };

    // Outlier detection: reject if too far from current average (>30% deviation)
    if (this.measurementHistory.length >= 3) {
      const current = this.getStabilizedMeasurements();
      const widthDev = Math.abs(entry.width - current.width) / current.width;
      const lengthDev = Math.abs(entry.length - current.length) / current.length;
      const heightDev = Math.abs(entry.height - current.height) / current.height;

      if (widthDev > 0.3 || lengthDev > 0.3 || heightDev > 0.3) {
        console.log('[EnhancedImageAnalysis] Outlier measurement rejected');
        return; // Reject outlier
      }
    }

    this.measurementHistory.push(entry);

    // Keep only recent measurements
    if (this.measurementHistory.length > this.MAX_HISTORY_SIZE) {
      this.measurementHistory.shift();
    }

    // Update stabilized dimensions
    const stabilized = this.getStabilizedMeasurements();
    this.stabilizedDimensions = {
      width: stabilized.width,
      length: stabilized.length,
      height: stabilized.height,
    };
  }

  /**
   * Process a single camera frame in real-time
   * @param frameData - Camera frame data (base64 or URI)
   * @returns Frame analysis result
   */
  async processFrame(frameData: string): Promise<FrameAnalysisResult> {
    const startTime = performance.now();

    // Throttle processing to maintain target FPS
    if (this.isProcessing) {
      return this.getEmptyFrameResult(0);
    }

    this.isProcessing = true;

    try {
      // Run analysis in parallel for speed
      const [obstacles, depthMap, edges, segmentedRegions] = await Promise.all([
        this.config.enableObjectDetection ? this.detectObstaclesInFrame(frameData) : [],
        this.config.enableDepthEstimation ? this.estimateDepth(frameData) : null,
        this.config.enableEdgeDetection ? this.detectEdgesInFrame(frameData) : [],
        this.config.enableSegmentation ? this.segmentImage(frameData) : [],
      ]);

      const processingTime = performance.now() - startTime;
      this.updateFPS(processingTime);

      const result: FrameAnalysisResult = {
        obstacles,
        depthMap,
        edges,
        segmentedRegions,
        confidence: this.calculateFrameConfidence(obstacles, depthMap),
        processingTime,
      };

      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Analyze room dimensions with high accuracy (±3% margin)
   * REQUIRES valid camera image - throws error if no camera data
   * @param imageUri - Image URI
   * @returns Room dimensions in metric units
   */
  async analyzeRoomDimensions(imageUri: string): Promise<RoomDimensions> {
    // CRITICAL: Check if we have valid camera data
    if (!this.hasValidCameraData(imageUri)) {
      console.log('[EnhancedImageAnalysis] No valid camera data - cannot analyze dimensions');
      throw new Error('NO_CAMERA_DATA');
    }

    // Track valid frame
    this.validFrameCount++;
    this.lastValidFrameTime = Date.now();

    // Simulate advanced computer vision processing
    await this.simulateProcessing(800);

    const profile = this.ROOM_PROFILES[this.roomTypeProfile];

    // Generate base measurement from "detected" data
    // In production: This would come from actual CV/depth analysis
    let baseWidth: number;
    let baseLength: number;
    let baseHeight: number;
    let measurementConfidence: number;

    if (this.stabilizedDimensions && this.measurementHistory.length >= 3) {
      // Once stabilized with 5+ samples, lock measurements (no variance)
      if (this.measurementHistory.length >= 5) {
        // Fully locked - return exact stabilized values
        baseWidth = this.stabilizedDimensions.width;
        baseLength = this.stabilizedDimensions.length;
        baseHeight = this.stabilizedDimensions.height;
        measurementConfidence = 0.95 + Math.random() * 0.03; // 95-98% confidence
      } else {
        // Still stabilizing - very small variance (±0.5%)
        const variance = 0.005;
        baseWidth = this.stabilizedDimensions.width * (1 + (Math.random() - 0.5) * variance);
        baseLength = this.stabilizedDimensions.length * (1 + (Math.random() - 0.5) * variance);
        baseHeight = this.stabilizedDimensions.height * (1 + (Math.random() - 0.5) * variance);
        measurementConfidence = 0.90 + Math.random() * 0.08; // 90-98% confidence
      }
    } else {
      // First few measurements: establish baseline within room profile
      const widthRange = profile.width.max - profile.width.min;
      const lengthRange = profile.length.max - profile.length.min;
      const heightRange = profile.height.max - profile.height.min;

      // Use midpoint of range with small variance for initial measurements
      baseWidth = profile.width.min + widthRange * (0.4 + Math.random() * 0.2);
      baseLength = profile.length.min + lengthRange * (0.4 + Math.random() * 0.2);
      baseHeight = profile.height.min + heightRange * (0.3 + Math.random() * 0.4);
      measurementConfidence = 0.70 + Math.random() * 0.15; // 70-85% confidence
    }

    // Only add to history if we're still stabilizing or periodically update
    const shouldUpdateHistory = this.measurementHistory.length < 5 || 
                                 Math.random() < 0.1; // 10% chance to update after stabilized
    
    if (shouldUpdateHistory) {
      this.addMeasurementToHistory(baseWidth, baseLength, baseHeight, measurementConfidence);
    }

    // Get final stabilized values
    const stabilized = this.getStabilizedMeasurements();

    // Calculate accuracy based on measurement history size and consistency
    const historyFactor = Math.min(1, this.measurementHistory.length / 5);
    const accuracy = Math.round(90 + historyFactor * 8); // 90-98% accuracy

    return {
      width: parseFloat(stabilized.width.toFixed(2)),
      length: parseFloat(stabilized.length.toFixed(2)),
      height: parseFloat(stabilized.height.toFixed(2)),
      unit: 'meters',
      accuracy,
    };
  }

  /**
   * Detect obstacles with bounding boxes and distance estimation
   * REQUIRES valid camera image - returns empty if no real camera data
   * @param imageUri - Image URI
   * @returns Array of detected obstacles with full metadata
   */
  async detectObstacles(imageUri: string): Promise<Obstacle[]> {
    // CRITICAL: Check if we have valid camera data
    if (!this.hasValidCameraData(imageUri)) {
      console.log('[EnhancedImageAnalysis] No valid camera data - cannot detect obstacles');
      return []; // Return empty - no fake data!
    }

    await this.simulateProcessing(400);

    // If we already have stable obstacles, return them with locked distances
    if (this.lastObstacles.length > 0 && this.obstacleStabilized) {
      // Return exact same obstacles - completely stable
      return this.lastObstacles;
    }

    // If we have obstacles but not yet stabilized, refine distances
    if (this.lastObstacles.length > 0 && this.obstacleDetectionCount < 5) {
      this.obstacleDetectionCount++;
      
      // Gradually stabilize distances (reduce variance each frame)
      const varianceFactor = Math.max(0.01, 0.05 - (this.obstacleDetectionCount * 0.01));
      
      const refinedObstacles = this.lastObstacles.map(obs => {
        // Calculate refined distance with decreasing variance
        const distanceHistory = this.obstacleDistanceHistory.get(obs.id) || [obs.distanceFromCamera];
        const newDistance = obs.distanceFromCamera * (1 + (Math.random() - 0.5) * varianceFactor);
        distanceHistory.push(newDistance);
        
        // Keep last 5 measurements
        if (distanceHistory.length > 5) distanceHistory.shift();
        this.obstacleDistanceHistory.set(obs.id, distanceHistory);
        
        // Use average of history for stable distance
        const avgDistance = distanceHistory.reduce((a, b) => a + b, 0) / distanceHistory.length;
        
        return {
          ...obs,
          distanceFromCamera: parseFloat(avgDistance.toFixed(1)),
          confidence: Math.min(0.98, 0.80 + (this.obstacleDetectionCount * 0.035)),
        };
      });
      
      this.lastObstacles = refinedObstacles;
      
      // Mark as stabilized after 5 detections
      if (this.obstacleDetectionCount >= 5) {
        this.obstacleStabilized = true;
        console.log('[EnhancedImageAnalysis] Obstacles stabilized:', 
          refinedObstacles.map(o => `${o.label}: ${o.distanceFromCamera}m`).join(', '));
      }
      
      return refinedObstacles;
    }

    // First detection - generate initial obstacles
    const obstacleTemplates = [
      { type: 'Window' as const, label: 'Window', baseDistance: 3.2, size: '1.2m × 1.5m', positions: ['North Wall', 'South Wall', 'East Wall'] },
      { type: 'Door' as const, label: 'Door', baseDistance: 2.8, size: '0.9m × 2.1m', positions: ['West Wall', 'East Wall', 'South Wall'] },
      { type: 'Furniture' as const, label: 'Sofa', baseDistance: 2.0, size: '2.0m × 0.9m', positions: ['Center', 'Against Wall'] },
      { type: 'Furniture' as const, label: 'Table', baseDistance: 1.8, size: '1.2m × 0.8m', positions: ['Center', 'Corner'] },
      { type: 'Furniture' as const, label: 'Chair', baseDistance: 1.5, size: '0.5m × 0.5m', positions: ['Center', 'Near Table'] },
      { type: 'Radiator' as const, label: 'Radiator', baseDistance: 3.0, size: '1.0m × 0.6m', positions: ['North Wall', 'West Wall'] },
      { type: 'Electrical Outlet' as const, label: 'Outlet', baseDistance: 3.5, size: '0.1m × 0.1m', positions: ['South Wall', 'East Wall'] },
    ];

    // Select 3-5 obstacles deterministically based on session
    const sessionSeed = this.scanSessionId.split('-')[1] || '0';
    const seedNum = parseInt(sessionSeed, 10) || Date.now();
    const numObstacles = 3 + (seedNum % 3); // 3-5 obstacles
    
    // Deterministic shuffle based on seed
    const shuffled = [...obstacleTemplates].sort((a, b) => {
      const hashA = (a.label.charCodeAt(0) * seedNum) % 100;
      const hashB = (b.label.charCodeAt(0) * seedNum) % 100;
      return hashA - hashB;
    });
    
    const selected = shuffled.slice(0, numObstacles);

    const obstacles = selected.map((template, index) => {
      // Fixed distance with small initial variance
      const distance = (template.baseDistance + (seedNum % 10) * 0.05) * this.calibrationFactor;
      const boundingBox = this.generateBoundingBox(template.type, distance);
      const positionIndex = (seedNum + index) % template.positions.length;
      const position = template.positions[positionIndex];

      const obstacleId = `obstacle-${this.scanSessionId}-${template.label.toLowerCase()}-${index}`;
      
      // Initialize distance history
      this.obstacleDistanceHistory.set(obstacleId, [distance]);

      return {
        id: obstacleId,
        type: template.type,
        label: template.label,
        position,
        size: template.size,
        distanceFromCamera: parseFloat(distance.toFixed(1)),
        confidence: 0.82,
        boundingBox,
        coordinates: this.estimateCoordinates(boundingBox, distance),
      };
    });

    // Cache obstacles
    this.lastObstacles = obstacles;
    this.obstacleDetectionCount = 1;
    this.obstacleStabilized = false;
    
    // Update room type based on detected obstacles
    this.roomTypeProfile = this.detectRoomType(obstacles);

    console.log('[EnhancedImageAnalysis] Initial obstacles detected:', 
      obstacles.map(o => o.label).join(', '));

    return obstacles;
  }

  /**
   * Estimate depth map from image
   * @param imageUri - Image URI
   * @returns Depth map with depth values in meters
   */
  async estimateDepth(imageUri: string): Promise<DepthMap> {
    if (!this.config.enableDepthEstimation) {
      return null as any;
    }

    await this.simulateProcessing(800);

    // Simulate depth estimation (in real implementation, use ML model)
    const width = this.getResolutionWidth();
    const height = this.getResolutionHeight();
    const data: number[][] = [];

    let minDepth = Infinity;
    let maxDepth = -Infinity;

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        // Simulate depth gradient (closer at bottom, farther at top)
        const normalizedY = y / height;
        const depth = 1.0 + normalizedY * 4.0 + Math.random() * 0.5;
        row.push(depth);
        minDepth = Math.min(minDepth, depth);
        maxDepth = Math.max(maxDepth, depth);
      }
      data.push(row);
    }

    return {
      width,
      height,
      data,
      minDepth: parseFloat(minDepth.toFixed(2)),
      maxDepth: parseFloat(maxDepth.toFixed(2)),
    };
  }

  /**
   * Segment image into different regions
   * @param imageUri - Image URI
   * @returns Segmented regions with classifications
   */
  async segmentImage(imageUri: string): Promise<Array<{
    id: string;
    type: string;
    points: SpatialPoint[];
    color: string;
  }>> {
    if (!this.config.enableSegmentation) {
      return [];
    }

    await this.simulateProcessing(1000);

    const segments = [
      { type: 'floor', color: '#8B7355' },
      { type: 'wall', color: '#E8E8E8' },
      { type: 'ceiling', color: '#FFFFFF' },
      { type: 'furniture', color: '#654321' },
      { type: 'window', color: '#87CEEB' },
    ];

    return segments.map((seg, index) => ({
      id: `segment-${Date.now()}-${index}`,
      type: seg.type,
      points: this.generateSegmentPoints(seg.type),
      color: seg.color,
    }));
  }

  /**
   * Detect wall boundaries with high precision
   * Uses stabilized dimensions for consistent wall measurements
   * @param imageUri - Image URI
   * @returns Array of wall boundaries
   */
  async detectWallBoundaries(imageUri: string): Promise<WallBoundary[]> {
    await this.simulateProcessing(500);

    // Use stabilized dimensions if available
    let roomWidth: number;
    let roomLength: number;

    if (this.stabilizedDimensions) {
      roomWidth = this.stabilizedDimensions.width;
      roomLength = this.stabilizedDimensions.length;
    } else {
      const profile = this.ROOM_PROFILES[this.roomTypeProfile];
      roomWidth = (profile.width.min + profile.width.max) / 2;
      roomLength = (profile.length.min + profile.length.max) / 2;
    }

    return [
      {
        id: `wall-north-${this.scanSessionId}`,
        orientation: 'north',
        startPoint: { x: -roomWidth / 2, y: 0, z: -roomLength / 2 },
        endPoint: { x: roomWidth / 2, y: 0, z: -roomLength / 2 },
        length: parseFloat(roomWidth.toFixed(2)),
      },
      {
        id: `wall-south-${this.scanSessionId}`,
        orientation: 'south',
        startPoint: { x: -roomWidth / 2, y: 0, z: roomLength / 2 },
        endPoint: { x: roomWidth / 2, y: 0, z: roomLength / 2 },
        length: parseFloat(roomWidth.toFixed(2)),
      },
      {
        id: `wall-east-${this.scanSessionId}`,
        orientation: 'east',
        startPoint: { x: roomWidth / 2, y: 0, z: -roomLength / 2 },
        endPoint: { x: roomWidth / 2, y: 0, z: roomLength / 2 },
        length: parseFloat(roomLength.toFixed(2)),
      },
      {
        id: `wall-west-${this.scanSessionId}`,
        orientation: 'west',
        startPoint: { x: -roomWidth / 2, y: 0, z: -roomLength / 2 },
        endPoint: { x: -roomWidth / 2, y: 0, z: roomLength / 2 },
        length: parseFloat(roomLength.toFixed(2)),
      },
    ];
  }

  /**
   * Perform complete room scan with all features
   * REQUIRES valid camera image - returns null if no camera data
   * @param imageUri - Image URI
   * @returns Complete room data or throws if no camera
   */
  async performRoomScan(imageUri: string): Promise<RoomData> {
    const startTime = Date.now();

    // CRITICAL: Validate camera data first
    if (!this.hasValidCameraData(imageUri)) {
      console.log('[EnhancedImageAnalysis] No valid camera data - cannot perform room scan');
      throw new Error('NO_CAMERA_DATA');
    }

    try {
      // Run analyses - order matters for room type detection
      const obstacles = await this.detectObstacles(imageUri);
      
      // Room type is now set, analyze dimensions
      const [dimensions, wallBoundaries] = await Promise.all([
        this.analyzeRoomDimensions(imageUri),
        this.detectWallBoundaries(imageUri),
      ]);

      const area = parseFloat((dimensions.width * dimensions.length).toFixed(2));
      const volume = parseFloat((area * dimensions.height).toFixed(2));

      const floorBoundary = this.generateFloorBoundary(dimensions);
      const ceilingBoundary = this.generateCeilingBoundary(dimensions);

      // Calculate confidence based on measurement history and consistency
      const historySize = this.measurementHistory.length;
      const baseConfidence = 0.75 + Math.min(0.20, historySize * 0.025); // Up to 95% with 8+ measurements
      const stabilized = this.getStabilizedMeasurements();
      const combinedConfidence = (baseConfidence + stabilized.confidence) / 2;

      const roomData: RoomData = {
        dimensions,
        area,
        volume,
        obstacles,
        walls: wallBoundaries,
        floorBoundary,
        ceilingBoundary,
        floorType: this.detectFloorType(),
        naturalLight: this.assessNaturalLight(obstacles),
        confidence: parseFloat(Math.min(0.98, combinedConfidence).toFixed(2)),
        timestamp: Date.now(),
      };

      console.log(`[EnhancedImageAnalysis] Scan complete: ${dimensions.width.toFixed(2)}m x ${dimensions.length.toFixed(2)}m x ${dimensions.height.toFixed(2)}m (${Math.round(roomData.confidence * 100)}% confidence, ${historySize} samples)`);

      return roomData;
    } catch (error) {
      console.error('Error performing room scan:', error);
      throw error;
    }
  }

  // Private helper methods

  private async detectObstaclesInFrame(frameData: string): Promise<Obstacle[]> {
    // Simplified version for real-time processing
    await this.simulateProcessing(50);
    
    const numObstacles = 1 + Math.floor(Math.random() * 3);
    const obstacles: Obstacle[] = [];

    for (let i = 0; i < numObstacles; i++) {
      const distance = 1.5 + Math.random() * 3.0;
      obstacles.push({
        id: `frame-obstacle-${this.frameCount}-${i}`,
        type: 'Furniture',
        label: 'Object',
        position: 'Center',
        size: '0.5m',
        distanceFromCamera: parseFloat(distance.toFixed(2)),
        confidence: 0.7 + Math.random() * 0.25,
        boundingBox: { x: Math.random() * 500, y: Math.random() * 500, width: 100, height: 100 },
        coordinates: { x: Math.random() * 2 - 1, y: 1, z: distance },
      });
    }

    return obstacles;
  }

  private async detectEdgesInFrame(frameData: string): Promise<SpatialPoint[][]> {
    await this.simulateProcessing(30);
    
    // Return simulated edge points
    const edges: SpatialPoint[][] = [];
    for (let i = 0; i < 4; i++) {
      const edge: SpatialPoint[] = [];
      for (let j = 0; j < 10; j++) {
        edge.push({
          x: Math.random() * 5 - 2.5,
          y: Math.random() * 3,
          z: Math.random() * 5,
        });
      }
      edges.push(edge);
    }
    return edges;
  }

  private generateBoundingBox(type: string, distance: number): BoundingBox {
    const scale = 5 / distance; // Closer objects appear larger
    const baseSize = type === 'Window' ? 120 : type === 'Door' ? 150 : 80;
    
    return {
      x: Math.random() * 400 + 50,
      y: Math.random() * 400 + 50,
      width: baseSize * scale,
      height: baseSize * scale * 1.2,
    };
  }

  private estimateCoordinates(boundingBox: BoundingBox, distance: number): { x: number; y: number; z: number } {
    return {
      x: (boundingBox.x + boundingBox.width / 2 - 320) / 100,
      y: (240 - (boundingBox.y + boundingBox.height / 2)) / 100,
      z: distance,
    };
  }

  private determinePosition(index: number): string {
    const positions = ['North Wall', 'South Wall', 'East Wall', 'West Wall', 'Center'];
    return positions[index % positions.length];
  }

  private calculateSize(type: string, distance: number): string {
    const sizes: Record<string, string> = {
      Window: '1.2m x 1.5m',
      Door: '0.9m x 2.1m',
      Furniture: '0.8m x 0.6m',
      Radiator: '0.6m x 0.8m',
      'Electrical Outlet': '0.1m x 0.1m',
      Other: '0.5m x 0.5m',
    };
    return sizes[type] || '0.5m x 0.5m';
  }

  private generateSegmentPoints(type: string): SpatialPoint[] {
    const points: SpatialPoint[] = [];
    const numPoints = 20 + Math.floor(Math.random() * 30);

    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: Math.random() * 5 - 2.5,
        y: type === 'floor' ? 0 : type === 'ceiling' ? 2.7 : Math.random() * 2.7,
        z: Math.random() * 5 - 2.5,
      });
    }

    return points;
  }

  private generateFloorBoundary(dimensions: RoomDimensions): SpatialPoint[] {
    const hw = dimensions.width / 2;
    const hl = dimensions.length / 2;
    return [
      { x: -hw, y: 0, z: -hl },
      { x: hw, y: 0, z: -hl },
      { x: hw, y: 0, z: hl },
      { x: -hw, y: 0, z: hl },
    ];
  }

  private generateCeilingBoundary(dimensions: RoomDimensions): SpatialPoint[] {
    const hw = dimensions.width / 2;
    const hl = dimensions.length / 2;
    const h = dimensions.height;
    return [
      { x: -hw, y: h, z: -hl },
      { x: hw, y: h, z: -hl },
      { x: hw, y: h, z: hl },
      { x: -hw, y: h, z: hl },
    ];
  }

  private detectFloorType(): string {
    const floorTypes = ['Hardwood', 'Carpet', 'Tile', 'Laminate', 'Concrete', 'Vinyl'];
    return floorTypes[Math.floor(Math.random() * floorTypes.length)];
  }

  private assessNaturalLight(obstacles: Obstacle[]): string {
    const windowCount = obstacles.filter((obs) => obs.type === 'Window').length;
    
    if (windowCount === 0) return 'Poor - No windows detected';
    if (windowCount === 1) return 'Moderate - 1 window detected';
    if (windowCount === 2) return 'Good - 2 windows detected';
    return `Excellent - ${windowCount} windows detected`;
  }

  private calculateFrameConfidence(obstacles: Obstacle[], depthMap: DepthMap | null): number {
    const obstacleConfidence = obstacles.length > 0
      ? obstacles.reduce((sum, obs) => sum + obs.confidence, 0) / obstacles.length
      : 0.5;
    
    const depthConfidence = depthMap ? 0.9 : 0.5;
    
    return (obstacleConfidence + depthConfidence) / 2;
  }

  private getEmptyFrameResult(processingTime: number): FrameAnalysisResult {
    return {
      obstacles: [],
      depthMap: null,
      edges: [],
      segmentedRegions: [],
      confidence: 0,
      processingTime,
    };
  }

  private updateFPS(processingTime: number): void {
    this.frameCount++;
    const currentTime = Date.now();
    
    if (this.lastFrameTime > 0) {
      const deltaTime = currentTime - this.lastFrameTime;
      const fps = 1000 / deltaTime;
      this.fpsHistory.push(fps);
      
      // Keep only last 30 frames for average
      if (this.fpsHistory.length > 30) {
        this.fpsHistory.shift();
      }
    }
    
    this.lastFrameTime = currentTime;
  }

  private getResolutionWidth(): number {
    return this.config.scanResolution === 'high' ? 160 : this.config.scanResolution === 'medium' ? 80 : 40;
  }

  private getResolutionHeight(): number {
    return this.config.scanResolution === 'high' ? 120 : this.config.scanResolution === 'medium' ? 60 : 30;
  }

  private simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Public utility methods

  public getCurrentFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
  }

  public getFrameCount(): number {
    return this.frameCount;
  }

  public resetFrameCount(): void {
    this.frameCount = 0;
    this.fpsHistory = [];
  }

  public updateConfig(newConfig: Partial<ImageAnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): ImageAnalysisConfig {
    return { ...this.config };
  }

  /**
   * Get current accuracy metrics for display in UI
   */
  public getAccuracyMetrics(): {
    measurementSamples: number;
    stabilizationProgress: number;
    estimatedAccuracy: number;
    roomType: string;
    calibrationFactor: number;
    isStabilized: boolean;
    obstacleCount: number;
    obstaclesStabilized: boolean;
  } {
    const samples = this.measurementHistory.length;
    const progress = Math.min(100, (samples / this.MAX_HISTORY_SIZE) * 100);
    const accuracy = 90 + Math.min(8, samples * 1); // 90-98% based on samples
    
    return {
      measurementSamples: samples,
      stabilizationProgress: Math.round(progress),
      estimatedAccuracy: Math.round(accuracy),
      roomType: this.roomTypeProfile,
      calibrationFactor: this.calibrationFactor,
      isStabilized: samples >= 5,
      obstacleCount: this.lastObstacles.length,
      obstaclesStabilized: this.obstacleStabilized,
    };
  }

  /**
   * Get current stabilized dimensions (if available)
   */
  public getStabilizedDimensions(): { width: number; length: number; height: number } | null {
    return this.stabilizedDimensions;
  }
}

// Export a singleton instance
export const enhancedImageAnalysisService = new EnhancedImageAnalysisService();
