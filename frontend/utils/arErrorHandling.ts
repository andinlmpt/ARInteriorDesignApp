/**
 * AR Error Handling Utilities
 * Error classification and recovery strategies for AR
 */

import type { ARInitError, ARInitErrorType } from '@/types/ar-view';

/**
 * Error classification and recovery strategy mapping
 */
export const AR_ERROR_CLASSIFICATION: Record<string, ARInitError> = {
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
  'invalid-context-dimensions': {
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
};

/**
 * Classify an error and return appropriate error details
 */
export function classifyARError(error: Error | unknown): ARInitError {
  const errorMessage = error instanceof Error 
    ? error.message.toLowerCase() 
    : String(error).toLowerCase();
  
  // Try to match specific error patterns
  if (errorMessage.includes('permission') || errorMessage.includes('camera')) {
    return AR_ERROR_CLASSIFICATION['camera-permission-denied'];
  }
  if (errorMessage.includes('webgl') && errorMessage.includes('lost')) {
    return AR_ERROR_CLASSIFICATION['webgl-context-lost'];
  }
  if (errorMessage.includes('webgl') && (errorMessage.includes('not supported') || errorMessage.includes('unsupported'))) {
    return AR_ERROR_CLASSIFICATION['webgl-unsupported'];
  }
  if (errorMessage.includes('webgl') || errorMessage.includes('context')) {
    return AR_ERROR_CLASSIFICATION['webgl-context-failed'];
  }
  if (errorMessage.includes('renderer') || errorMessage.includes('render')) {
    return AR_ERROR_CLASSIFICATION['renderer-create-failed'];
  }
  if (errorMessage.includes('dimension') || (errorMessage.includes('invalid') && errorMessage.includes('context'))) {
    return AR_ERROR_CLASSIFICATION['invalid-context-dimensions'];
  }
  if (errorMessage.includes('scene') || errorMessage.includes('3d scene')) {
    return AR_ERROR_CLASSIFICATION['scene-create-failed'];
  }
  if (errorMessage.includes('light') || errorMessage.includes('lighting')) {
    return AR_ERROR_CLASSIFICATION['lighting-init-failed'];
  }
  if (errorMessage.includes('anchor') && (errorMessage.includes('lost') || errorMessage.includes('tracking'))) {
    return AR_ERROR_CLASSIFICATION['anchor-tracking-lost'];
  }
  if (errorMessage.includes('anchor') && errorMessage.includes('quality')) {
    return AR_ERROR_CLASSIFICATION['anchor-poor-quality'];
  }
  if (errorMessage.includes('anchor')) {
    return AR_ERROR_CLASSIFICATION['anchor-init-failed'];
  }
  if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
    return AR_ERROR_CLASSIFICATION['memory-limit-exceeded'];
  }
  if (errorMessage.includes('texture')) {
    return AR_ERROR_CLASSIFICATION['texture-load-failed'];
  }
  if (errorMessage.includes('incompatible') || errorMessage.includes('not supported')) {
    return AR_ERROR_CLASSIFICATION['device-incompatible'];
  }
  
  // Default to unknown error
  return AR_ERROR_CLASSIFICATION['unknown-error'];
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: ARInitError): boolean {
  return error.recoverable && error.retryable && error.maxRetries > 0;
}

/**
 * Get recovery action for error type
 */
export function getRecoveryAction(errorType: ARInitErrorType): 'retry' | 'fallback' | 'abort' {
  const error = Object.values(AR_ERROR_CLASSIFICATION).find(e => e.type === errorType);
  
  if (!error) return 'abort';
  if (error.retryable && error.maxRetries > 0) return 'retry';
  if (error.fallbackMode) return 'fallback';
  return 'abort';
}

