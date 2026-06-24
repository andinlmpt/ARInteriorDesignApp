/**
 * AI Design Validation Utilities
 * Business logic for validating design inputs
 */

import { LIMITS } from '@/config/aiDesign.config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate design form inputs
 */
export function validateDesignInputs(
  selectedRoom: string,
  selectedStyle: string,
  roomWidth: string,
  roomLength: string,
  roomHeight: string,
  prompt?: string
): ValidationResult {
  const errors: string[] = [];

  // Relax requirements if prompt is provided and has sufficient length
  const hasSubstantialPrompt = prompt && prompt.trim().length >= 10;

  if (!selectedRoom && !hasSubstantialPrompt) errors.push('Room type is required');
  if (!selectedStyle && !hasSubstantialPrompt) errors.push('Design style is required');

  const width = parseFloat(roomWidth);
  const length = parseFloat(roomLength);
  const height = parseFloat(roomHeight);

  // Width validation
  if (isNaN(width) || width <= 0) {
    errors.push('Room width must be a valid positive number');
  } else {
    if (width < LIMITS.MIN_ROOM_DIMENSION) {
      errors.push(`Room width must be at least ${LIMITS.MIN_ROOM_DIMENSION}m`);
    }
    if (width > LIMITS.MAX_ROOM_WIDTH) {
      errors.push(`Room width exceeds maximum (${LIMITS.MAX_ROOM_WIDTH}m)`);
    }
  }

  // Length validation
  if (isNaN(length) || length <= 0) {
    errors.push('Room length must be a valid positive number');
  } else {
    if (length < LIMITS.MIN_ROOM_DIMENSION) {
      errors.push(`Room length must be at least ${LIMITS.MIN_ROOM_DIMENSION}m`);
    }
    if (length > LIMITS.MAX_ROOM_LENGTH) {
      errors.push(`Room length exceeds maximum (${LIMITS.MAX_ROOM_LENGTH}m)`);
    }
  }

  // Height validation
  if (isNaN(height) || height <= 0) {
    errors.push('Room height must be a valid positive number');
  } else {
    if (height < LIMITS.MIN_ROOM_HEIGHT) {
      errors.push(`Room height must be at least ${LIMITS.MIN_ROOM_HEIGHT}m`);
    }
    if (height > LIMITS.MAX_ROOM_HEIGHT) {
      errors.push(`Room height exceeds maximum (${LIMITS.MAX_ROOM_HEIGHT}m)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create cache key for design caching
 */
export function createCacheKey(
  selectedRoom: string,
  selectedStyle: string,
  width: number,
  length: number,
  height: number,
  budget: string,
  optimizationGoal: string,
  prompt: string = ''
): string {
  // Normalize prompt to avoid cache misses due to minor whitespace/case differences
  const normalizedPrompt = prompt.trim().toLowerCase().substring(0, 100);
  return `${selectedRoom}-${selectedStyle}-${width}-${length}-${height}-${budget}-${optimizationGoal}-${normalizedPrompt}`;
}

/**
 * Check if cache is still valid
 */
export function isCacheValid(timestamp: number): boolean {
  const cacheAge = Date.now() - timestamp;
  const maxAge = LIMITS.CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  return cacheAge < maxAge;
}

