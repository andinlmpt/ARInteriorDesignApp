/**
 * Spatial Mapping UI Types
 * TypeScript definitions specific to the spatial mapping UI
 */

import type { RoomData, SpatialMappingResult, DepthMap } from '@/types/spatial-mapping';
import type { 
  CalibrationReference, 
  MeasurementPoint, 
  ManualMeasurement 
} from '@/services/DepthEstimationService';
import type { ProfessionalReport } from '@/services/ProfessionalDesignService';
import type { ScanStage, ViewMode } from '@/config/spatialMapping.config';

// Scan statistics
export interface ScanStats {
  planesDetected: number;
  obstaclesFound: number;
  confidence: number;
  processingTime: number;
}

// Scan metrics
export interface ScanMetrics {
  averageConfidence: number;
  totalPointsScanned: number;
  scanSpeed: number;
  coveragePercentage: number;
}

// Calibration result
export interface CalibrationResult {
  success: boolean;
  factor: number;
  accuracy: number;
}

// Calibration step type
export type CalibrationStep = 'select' | 'measure' | 'confirm';

// Scan state
export interface SpatialMappingScanState {
  isScanning: boolean;
  scanComplete: boolean;
  roomData: RoomData | null;
  scanResult: SpatialMappingResult | null;
  scanProgress: number;
  currentStage: ScanStage;
  scanStats: ScanStats;
  error: string | null;
}

// UI state
export interface SpatialMappingUIState {
  useMetric: boolean;
  showFloorPlan: boolean;
  selectedView: ViewMode;
  showHistory: boolean;
  showProfessionalReport: boolean;
  showTutorial: boolean;
  tutorialStep: number;
  showInteractiveHelp: boolean;
  showRealTimeStats: boolean;
}

// Calibration state
export interface CalibrationState {
  showCalibrationModal: boolean;
  selectedReference: CalibrationReference | null;
  calibrationStep: CalibrationStep;
  detectedWidth: string;
  detectedHeight: string;
  calibrationResult: CalibrationResult | null;
  isCalibrated: boolean;
  customReferenceWidth: string;
  customReferenceHeight: string;
}

// Measurement state
export interface MeasurementState {
  measurementMode: boolean;
  measurementPoints: MeasurementPoint[];
  measurements: ManualMeasurement[];
  currentDepthMap: DepthMap | null;
  isProcessingDepth: boolean;
  showMeasurementHistory: boolean;
  measurementLabel: string;
  depthEstimationEnabled: boolean;
  depthConfidence: number;
  averageRoomDepth: number;
}

// Combined state
export interface SpatialMappingState extends 
  SpatialMappingScanState, 
  SpatialMappingUIState, 
  CalibrationState, 
  MeasurementState {
  scanHistory: SpatialMappingResult[];
  professionalReport: ProfessionalReport | null;
  scanMetrics: ScanMetrics;
}

