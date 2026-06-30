export interface RoomDimensions {
  width: number;  // in meters
  length: number; // in meters
  height: number; // in meters
  unit: 'meters' | 'feet';
  accuracy: number; // percentage accuracy (e.g., 97 for ±3%)
}

export interface BoundingBox {
  x: number;      // top-left x coordinate
  y: number;      // top-left y coordinate
  width: number;  // box width
  height: number; // box height
}

export interface Obstacle {
  id: string;
  type: 'Window' | 'Door' | 'Radiator' | 'Electrical Outlet' | 'Air Conditioning Unit' | 'Furniture' | 'Other';
  label: string;
  position: string;
  size: string;
  distanceFromCamera: number; // in meters
  confidence: number;         // 0-1 detection confidence
  boundingBox: BoundingBox;
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
}

export interface WallBoundary {
  id: string;
  orientation: 'north' | 'south' | 'east' | 'west';
  startPoint: SpatialPoint;
  endPoint: SpatialPoint;
  length: number;
  thickness?: number;
}

export interface RoomData {
  dimensions: RoomDimensions;
  area: number; // in square meters
  volume: number; // in cubic meters
  obstacles: Obstacle[];
  walls: WallBoundary[];
  floorBoundary: SpatialPoint[];
  ceilingBoundary: SpatialPoint[];
  floorType?: string;
  naturalLight?: string;
  confidence: number;
  timestamp: number;
}

export interface SpatialPoint {
  x: number;
  y: number;
  z: number;
}

export interface DetectedPlane {
  id: string;
  type: 'horizontal' | 'vertical';
  points: SpatialPoint[];
  center: SpatialPoint;
  normal: SpatialPoint;
  area: number;
  confidence: number;
  timestamp: number;
}

export interface DepthMap {
  width: number;
  height: number;
  data: number[][]; // depth values in meters
  minDepth: number;
  maxDepth: number;
}

export interface SpatialMap3D {
  points: SpatialPoint[];
  colors?: string[];
  normals?: SpatialPoint[];
  grid: number[][][]; // 3D voxel grid
}

export interface SpatialHeatmap {
  width: number;
  height: number;
  data: number[][]; // occupancy values 0-1
  resolution: number; // meters per cell
}

export interface SpatialMappingResult {
  planes: DetectedPlane[];
  roomData: RoomData | null;
  depthMap: DepthMap | null;
  spatialMap3D: SpatialMap3D | null;
  heatmap: SpatialHeatmap | null;
  timestamp: number;
  confidence: number;
  fps: number;
  professionalReport?: any;
}

export interface ImageAnalysisConfig {
  enableEdgeDetection: boolean;
  enableObjectDetection: boolean;
  enableDepthEstimation: boolean;
  enableSegmentation: boolean;
  minConfidence: number;
  scanResolution: 'low' | 'medium' | 'high';
  targetFPS: number;
  measurementAccuracy: number; // target accuracy in percentage
}

export interface FrameAnalysisResult {
  obstacles: Obstacle[];
  depthMap: DepthMap | null;
  edges: SpatialPoint[][];
  segmentedRegions: Array<{
    id: string;
    type: string;
    points: SpatialPoint[];
    color: string;
  }>;
  confidence: number;
  processingTime: number;
}

export interface VisualizationOverlay {
  boundingBoxes: Array<{
    box: BoundingBox;
    label: string;
    color: string;
    confidence: number;
  }>;
  distanceIndicators: Array<{
    from: SpatialPoint;
    to: SpatialPoint;
    distance: number;
    label: string;
  }>;
  labels: Array<{
    position: { x: number; y: number };
    text: string;
    color: string;
  }>;
}

export interface SpatialMappingOutput {
  roomDimensions: {
    width: number;
    length: number;
    height: number;
    unit: string;
    accuracy: number;
  };
  detectedObstacles: Array<{
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number; z: number };
    distance: number;
    confidence: number;
    boundingBox: BoundingBox;
  }>;
  spatialMap: {
    type: '3D' | 'heatmap';
    data: any;
    timestamp: number;
  };
  metadata: {
    scanDuration: number;
    fps: number;
    confidence: number;
    timestamp: number;
  };
}

export type CalibrationStatus = 'idle' | 'calibrating' | 'ready';

export interface MappingQualitySnapshot {
  timestamp: number;
  confidence: number;
  fps: number;
  coverage: number;
  obstaclesDetected: number;
}

export interface SpatialMappingSummary {
  calibrationStatus: CalibrationStatus;
  calibrationElapsedMs: number;
  framesProcessed: number;
  fps: number;
  confidence: number;
  coverage: number;
  heatmap?: SpatialHeatmap | null;
  lastHeatmapSnapshotAt?: number;
  obstaclesDetected: number;
  roomData?: RoomData | null;
  recentSnapshots: MappingQualitySnapshot[];
}