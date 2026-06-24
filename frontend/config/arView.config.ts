/**
 * AR View Configuration
 * All constants and configuration for AR functionality
 */

export const AR_CONFIG = {
  // Performance settings
  ANCHOR_UPDATE_INTERVAL: 2000,
  COLLISION_CHECK_THROTTLE: 200,
  PREVIEW_UPDATE_THROTTLE: 100,
  DRAG_UPDATE_THROTTLE: 16, // ~60fps
  
  // Reticle animation
  RETICLE_PULSE_SPEED: 0.05,
  RETICLE_PULSE_SCALE: 0.1,
  RETICLE_OPACITY_RANGE: { min: 0.2, max: 0.8, base: 0.5, variation: 0.3 },
  RETICLE_SMOOTHING_FACTOR: 0.2,
  
  // Collision and safety
  COLLISION_MARGIN: 0.05, // 5cm margin
  COLLISION_WARNING_TIMEOUT: 3000,
  SAFE_DISTANCE: 0.5, // 50cm
  WARNING_DISTANCE: 0.3, // 30cm
  DANGER_DISTANCE: 0.1, // 10cm
  MIN_WALL_DISTANCE: 0.2, // 20cm
  MIN_PLACEMENT_DISTANCE: 0.1,
  
  // Raycast and positioning
  RAYCAST_MAX_DISTANCE: 10.0,
  FLOOR_ALIGNMENT_THRESHOLD: 0.02, // 2cm
  POSITION_SMOOTHING_FACTOR: 0.15,
  
  // Snap and alignment
  GRID_SNAP_SIZE: 0.1, // 10cm
  ROTATION_SNAP_ANGLE: Math.PI / 4, // 45 degrees
  ALIGNMENT_THRESHOLD: 0.15, // 15cm
  WALL_SNAP_THRESHOLD: 0.2, // 20cm
  CORNER_SNAP_THRESHOLD: 0.25, // 25cm
  EDGE_SNAP_THRESHOLD: 0.15, // 15cm
  MAGNETIC_SNAP_FEEDBACK_DURATION: 300, // ms
  
  // History and memory
  MAX_HISTORY_ENTRIES: 20,
  DRAG_HISTORY_ENABLED: true,
  DRAG_HISTORY_THROTTLE: 500, // ms
  
  // Safety score weights
  SAFETY_SCORE_WEIGHTS: {
    obstacleDistance: 0.4,
    wallDistance: 0.3,
    furnitureDistance: 0.2,
    roomBoundary: 0.1,
  },
  
  // Animation
  ANIMATION_DURATION: 150, // ms
  INTERACTIVE_HIGHLIGHT_DURATION: 1000, // ms
  
  // Feature flags (disabled for performance)
  TUTORIAL_ENABLED: false,
  MEASUREMENT_DISPLAY_ENABLED: false,
  GESTURE_RECOGNITION_ENABLED: false,
  DEMO_MODE_ENABLED: false,
} as const;

// Memory management limits
export const MEMORY_LIMITS = {
  MAX_POOL_SIZE: 20,
  MAX_CACHE_SIZE: 50,
} as const;

// Obstacle color mapping
export const OBSTACLE_COLORS: Record<string, string> = {
  Window: '#38BDF8',
  Door: '#F97316',
  Furniture: '#FB7185',
  Radiator: '#FACC15',
  'Electrical Outlet': '#A855F7',
  Other: '#6B7280',
};

// Error messages
export const AR_ERROR_MESSAGES = {
  CAMERA_PERMISSION_DENIED: 'Camera permission is required for AR features.',
  ROOM_DATA_PARSE_ERROR: 'Failed to load room data. Please try scanning again.',
  FURNITURE_PLACEMENT_ERROR: 'Unable to place furniture. Please try again.',
  ANCHOR_ERROR: 'Unable to establish anchor. Move device slowly and try again.',
} as const;

// Error classification and recovery strategy mapping
import type { ARInitError } from '@/types/ar-view';export const AR_ERROR_CLASSIFICATION: Record<string, ARInitError> = {
  // Camera permission errors
  'camera-permission-denied': {
    type: 'camera_permission',
    message: 'Camera permission denied',
    recoverable: true,
    retryable: true,
    maxRetries: 3,
    fallbackMode: undefined,
    userMessage: 'Camera permission is required for AR features.',
    recoveryHint: 'Please grant camera permission in device settings.',
  },

  // WebGL context errors
  'webgl-context-lost': {
    type: 'webgl_context',
    message: 'WebGL context lost',
    recoverable: true,
    retryable: true,
    maxRetries: 5,
    fallbackMode: 'preview',
    userMessage: 'Graphics context was lost. Recovering...',
    recoveryHint: 'The app will attempt to recover automatically.',
  },
  'webgl-context-failed': {
    type: 'webgl_context',
    message: 'Failed to create WebGL context',
    recoverable: false,
    retryable: true,
    maxRetries: 3,
    fallbackMode: 'preview',
    userMessage: 'Your device may not support advanced graphics features.',
    recoveryHint: 'Try using preview mode or restart the app.',
  },
  'webgl-unsupported': {
    type: 'webgl_unsupported',
    message: 'WebGL not supported',
    recoverable: false,
    retryable: false,
    maxRetries: 0,
    fallbackMode: 'preview',
    userMessage: 'Your device does not support WebGL rendering.',
    recoveryHint: 'AR features are unavailable. Preview mode is available.',
  },

  // Renderer initialization errors
  'renderer-create-failed': {
    type: 'renderer_init',
    message: 'Failed to create renderer',
    recoverable: true,
    retryable: true,
    maxRetries: 3,
    fallbackMode: 'preview',
    userMessage: 'Failed to initialize 3D renderer.',
    recoveryHint: 'The app will retry or switch to preview mode.',
  },
  'invalid_context_dimensions': {
    type: 'renderer_init',
    message: 'Invalid WebGL context dimensions',
    recoverable: true,
    retryable: true,
    maxRetries: 5,
    fallbackMode: undefined,
    userMessage: 'Display configuration error. Retrying...',
    recoveryHint: 'Please wait while the app recovers.',
  },

  // Scene initialization errors
  'scene-create-failed': {
    type: 'scene_init',
    message: 'Failed to create 3D scene',
    recoverable: true,
    retryable: true,
    maxRetries: 3,
    fallbackMode: 'preview',
    userMessage: 'Failed to initialize 3D scene.',
    recoveryHint: 'The app will attempt to recover.',
  },

  // Lighting errors
  'lighting-init-failed': {
    type: 'lighting_init',
    message: 'Failed to initialize lighting',
    recoverable: true,
    retryable: true,
    maxRetries: 2,
    fallbackMode: undefined,
    userMessage: 'Lighting initialization issue. Continuing with default lighting...',
    recoveryHint: 'The app will use default lighting.',
  },

  // Anchor tracking errors
  'anchor-tracking-lost': {
    type: 'anchor_tracking',
    message: 'AR anchor tracking lost',
    recoverable: true,
    retryable: true,
    maxRetries: 5,
    fallbackMode: 'preview',
    userMessage: 'Lost AR tracking. Attempting to recover...',
    recoveryHint: 'Move your device slowly to help re-establish tracking.',
  },
  'anchor-poor-quality': {
    type: 'anchor_poor_quality',
    message: 'AR anchor quality is poor',
    recoverable: true,
    retryable: true,
    maxRetries: 3,
    fallbackMode: 'preview',
    userMessage: 'AR tracking quality is limited. Some features may not work perfectly.',
    recoveryHint: 'Move to a well-lit area with clear floor surfaces.',
  },
  'anchor-init-failed': {
    type: 'anchor_tracking',
    message: 'Failed to initialize AR anchor',
    recoverable: true,
    retryable: true,
    maxRetries: 5,
    fallbackMode: 'preview',
    userMessage: 'Unable to establish AR anchor. Try moving to a different location.',
    recoveryHint: 'Ensure good lighting and clear floor surfaces.',
  },

  // Memory errors
  'memory-limit-exceeded': {
    type: 'memory_limit',
    message: 'Memory limit exceeded',
    recoverable: true,
    retryable: true,
    maxRetries: 2,
    fallbackMode: 'minimal',
    userMessage: 'Device memory is limited. Some features may be reduced.',
    recoveryHint: 'Try removing some furniture or restart the app.',
  },

  // Texture loading errors
  'texture-load-failed': {
    type: 'texture_loading',
    message: 'Failed to load texture',
    recoverable: true,
    retryable: true,
    maxRetries: 3,
    fallbackMode: undefined,
    userMessage: 'Some textures failed to load. Using fallback materials.',
    recoveryHint: 'The app will continue with default materials.',
  },

  // Device compatibility
  'device-incompatible': {
    type: 'device_incompatible',
    message: 'Device incompatible with AR features',
    recoverable: false,
    retryable: false,
    maxRetries: 0,
    fallbackMode: 'preview',
    userMessage: 'Your device may not fully support AR features.',
    recoveryHint: 'Preview mode is available as an alternative.',
  },

  // Unknown errors
  'unknown-error': {
    type: 'unknown',
    message: 'Unknown initialization error',
    recoverable: true,
    retryable: true,
    maxRetries: 3,
    fallbackMode: 'preview',
    userMessage: 'An unexpected error occurred during initialization.',
    recoveryHint: 'The app will attempt to recover or switch to preview mode.',
  },
} as const;
