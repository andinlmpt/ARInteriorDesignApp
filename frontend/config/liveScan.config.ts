/**
 * Live Scan Configuration
 * Constants and configuration for real-time room scanning
 */

// Scan timing configuration
export const SCAN_TIMING = {
  /** Delay before first capture (ms) */
  INITIAL_CAPTURE_DELAY: 500,
  /** Interval between mapping summary updates (ms) */
  SUMMARY_INTERVAL: 1200,
  /** Interval between duration updates (ms) */
  DURATION_UPDATE_INTERVAL: 500,
  /** Time between full room scans (ms) */
  FULL_SCAN_INTERVAL: 5000,
  /** Delay before starting scan on camera ready (ms) */
  CAMERA_READY_DELAY: 300,
  /** Delay before taking picture (ms) */
  PRE_CAPTURE_DELAY: 100,
} as const;

// Animation configuration
export const ANIMATION_CONFIG = {
  /** Pulse animation duration (ms) */
  PULSE_DURATION: 800,
  /** Pulse scale factor */
  PULSE_SCALE: 1.2,
  /** Fade animation duration (ms) */
  FADE_DURATION: 500,
} as const;

// UI constants
export const UI_CONSTANTS = {
  /** Maximum obstacles to show in compact list */
  MAX_VISIBLE_OBSTACLES: 3,
  /** Maximum snapshots to show in trend */
  MAX_TREND_SNAPSHOTS: 5,
  /** Progress bar minimum width percentage */
  MIN_PROGRESS_WIDTH: 5,
  /** Progress bar maximum width percentage */
  MAX_PROGRESS_WIDTH: 100,
} as const;

// Quality thresholds for trend bars
export const QUALITY_THRESHOLDS = {
  /** High confidence threshold */
  HIGH: 0.75,
  /** Medium confidence threshold */
  MEDIUM: 0.6,
} as const;

// Quality colors for trend bars
export const QUALITY_COLORS = {
  HIGH: '#22C55E',
  MEDIUM: '#FACC15',
  LOW: '#F97316',
} as const;

// ML Detection configuration (disabled - TensorFlow.js compatibility issues)
export const ML_CONFIG = {
  /** Whether to use real ML detection */
  USE_REAL_DETECTION: false,
  /** Model ready state */
  MODEL_READY: false,
  /** Model loading state */
  MODEL_LOADING: false,
  /** Error message */
  ERROR_MESSAGE: 'TensorFlow.js not compatible with Expo bundler',
} as const;

// Calibration status values
export const CALIBRATION_STATUS = {
  IDLE: 'idle',
  CALIBRATING: 'calibrating',
  CALIBRATED: 'calibrated',
} as const;

