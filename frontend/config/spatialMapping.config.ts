/**
 * Spatial Mapping Configuration
 * Constants and configuration for room scanning and spatial mapping
 */

// Scan stages
export interface ScanStage {
  name: string;
  emoji: string;
  /** Feather icon name */
  icon: string;
  progress: number;
  message: string;
}

export const SCAN_STAGES: ScanStage[] = [
  { name: 'initializing', emoji: '🔄', icon: 'refresh-cw', progress: 0, message: 'Initializing scanner...' },
  { name: 'detecting_walls', emoji: '🧱', icon: 'layers', progress: 20, message: 'Detecting walls and surfaces...' },
  { name: 'measuring', emoji: '📏', icon: 'maximize-2', progress: 40, message: 'Measuring room dimensions...' },
  { name: 'identifying_obstacles', emoji: '🔍', icon: 'search', progress: 60, message: 'Identifying obstacles and features...' },
  { name: 'mapping_planes', emoji: '🗺️', icon: 'map', progress: 75, message: 'Mapping spatial planes...' },
  { name: 'calculating', emoji: '🧮', icon: 'cpu', progress: 85, message: 'Calculating measurements...' },
  { name: 'finalizing', emoji: '✨', icon: 'zap', progress: 95, message: 'Finalizing scan...' },
  { name: 'complete', emoji: '✅', icon: 'check-circle', progress: 100, message: 'Scan complete!' },
] as const;

// Tutorial stages (same as scan stages for consistency)
export const TUTORIAL_STAGES = SCAN_STAGES;

// Scan timing configuration
export const SCAN_TIMING = {
  /** Stage update interval (ms) */
  STAGE_INTERVAL: 500,
  /** Progress update interval (ms) */
  PROGRESS_INTERVAL: 100,
  /** Progress increment per tick */
  PROGRESS_INCREMENT: 2,
  /** Maximum progress before completion */
  MAX_PROGRESS: 95,
} as const;

// View modes for data display
export const VIEW_MODES = ['overview', 'walls', 'obstacles'] as const;
export type ViewMode = typeof VIEW_MODES[number];

// Room size thresholds for insights
export const ROOM_SIZE_THRESHOLDS = {
  /** Small room (m²) */
  SMALL: 10,
  /** Large room (m²) */
  LARGE: 30,
  /** Aspect ratio for rectangular classification */
  RECTANGULAR: 1.5,
  /** Aspect ratio for narrow classification */
  NARROW: 0.7,
} as const;

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.7,
  MEDIUM: 0.5,
} as const;

// Colors for confidence levels
export const CONFIDENCE_COLORS = {
  HIGH: '#34C759',
  MEDIUM: '#FF9500',
  LOW: '#FF3B30',
} as const;

// Rating colors
export const RATING_COLORS: Record<string, string> = {
  excellent: '#34C759',
  good: '#5AC8FA',
  adequate: '#FF9500',
  poor: '#FF3B30',
};

// Compliance colors
export const COMPLIANCE_COLORS: Record<string, string> = {
  compliant: '#34C759',
  partial: '#FF9500',
  'non-compliant': '#FF3B30',
};

// Priority colors
export const PRIORITY_COLORS: Record<string, string> = {
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#5AC8FA',
};

// Obstacle type emoji mapping
export const OBSTACLE_EMOJIS: Record<string, string> = {
  Window: '🪟',
  Door: '🚪',
  Radiator: '🔥',
  'Electrical Outlet': '🔌',
  'Air Conditioning Unit': '❄️',
  default: '📌',
};

/** Feather icon names for each obstacle type */
export const OBSTACLE_ICONS: Record<string, string> = {
  Window: 'maximize',
  Door: 'log-out',
  Radiator: 'thermometer',
  'Electrical Outlet': 'zap',
  'Air Conditioning Unit': 'wind',
  Furniture: 'package',
  Other: 'map-pin',
  default: 'map-pin',
};

// Obstacle color mapping for floor plan
export const OBSTACLE_COLORS: Record<string, string> = {
  Window: '#87CEEB',
  Door: '#8B4513',
  default: '#FF6B6B',
};

// Storage keys
export const STORAGE_KEYS = {
  UNIT: 'spatialMapping_unit',
  CALIBRATION: 'spatialMapping_calibration',
  HISTORY: 'spatialMapping_history',
  MEASUREMENTS: 'spatialMapping_measurements',
} as const;

// Max items to keep in history
export const MAX_HISTORY_ITEMS = 10;

// Unit conversion factors
export const UNIT_CONVERSIONS = {
  METERS_TO_FEET: 3.28084,
  SQ_METERS_TO_SQ_FEET: 10.7639,
  CUBIC_METERS_TO_CUBIC_FEET: 35.3147,
} as const;

