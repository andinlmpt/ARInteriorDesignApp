/**
 * AR Animation Utilities
 * Helper functions for animations and visual effects
 */

import * as THREE from 'three';
import { AR_CONFIG } from '@/config/arView.config';

/**
 * Update reticle pulse animation
 */
export function updateReticlePulse(
  reticle: THREE.Mesh,
  pulseRef: { current: number }
): void {
  pulseRef.current += AR_CONFIG.RETICLE_PULSE_SPEED;
  const pulseScale = 1 + Math.sin(pulseRef.current) * AR_CONFIG.RETICLE_PULSE_SCALE;
  const pulseOpacity = AR_CONFIG.RETICLE_OPACITY_RANGE.base + 
    Math.sin(pulseRef.current * 2) * AR_CONFIG.RETICLE_OPACITY_RANGE.variation;
  
  if (reticle.children.length > 0) {
    const pulseMesh = reticle.children[0] as THREE.Mesh;
    if (pulseMesh && pulseMesh.visible) {
      pulseMesh.scale.set(pulseScale, 1, pulseScale);
      if (pulseMesh.material instanceof THREE.MeshBasicMaterial) {
        pulseMesh.material.opacity = Math.max(
          AR_CONFIG.RETICLE_OPACITY_RANGE.min,
          Math.min(AR_CONFIG.RETICLE_OPACITY_RANGE.max, pulseOpacity)
        );
      }
    }
  }
}

/**
 * Animate measurement point marker
 */
export function animateMeasurementMarker(
  marker: THREE.Mesh,
  startTime: number,
  now: number
): void {
  const elapsed = (now - startTime) / 1000; // Convert to seconds
  
  // Pop-in animation: scale from 0 to 1 over 0.3 seconds
  if (elapsed < 0.3) {
    const t = elapsed / 0.3;
    const scale = 1 - Math.pow(1 - t, 3); // Ease-out cubic
    marker.scale.set(scale, scale, scale);
  } else {
    // After pop-in, add pulsing animation
    const pulseScale = 1.0 + Math.sin(now / 300) * 0.15; // Pulse between 1.0 and 1.15
    marker.scale.set(pulseScale, pulseScale, pulseScale);
    
    // Pulse emissive intensity
    if (marker.material instanceof THREE.MeshStandardMaterial) {
      marker.material.emissiveIntensity = 0.5 + Math.sin(now / 300) * 0.5;
    }
  }
}

/**
 * Create smooth transition animation
 */
export function createTransitionAnimation(
  from: number,
  to: number,
  duration: number = AR_CONFIG.ANIMATION_DURATION
): (progress: number) => number {
  return (progress: number) => {
    const t = Math.min(1, progress / duration);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    return from + (to - from) * eased;
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) {
  let inThrottle: boolean;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      timeoutId = setTimeout(() => {
        inThrottle = false;
        timeoutId = null;
      }, limit);
    }
  };
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Safely executes an async operation with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  defaultValue: T,
  errorContext: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[AR] ${errorContext}:`, error);
    return defaultValue;
  }
}


