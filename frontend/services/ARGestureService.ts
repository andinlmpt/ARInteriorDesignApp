/**
 * AR Gesture Service
 * Business logic for gesture recognition and interpretation
 */

import * as THREE from 'three';

export type GestureType = 'tap' | 'drag' | 'pinch' | 'rotate' | 'longPress' | 'twoFingerPan';

export interface GestureState {
  type: GestureType | null;
  startPosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
  startTime: number | null;
  touches: Array<{ x: number; y: number }>;
}

export class ARGestureService {
  private gestureState: GestureState = {
    type: null,
    startPosition: null,
    currentPosition: null,
    startTime: null,
    touches: [],
  };

  /**
   * Detect gesture type from touch events
   */
  detectGesture(
    touches: Array<{ x: number; y: number }>,
    previousTouches?: Array<{ x: number; y: number }>
  ): GestureType | null {
    const touchCount = touches.length;
    
    if (touchCount === 0) {
      return null;
    }
    
    if (touchCount === 1) {
      // Single touch gestures
      if (previousTouches && previousTouches.length === 1) {
        const distance = this.calculateDistance(touches[0], previousTouches[0]);
        if (distance > 10) {
          return 'drag';
        }
      }
      return 'tap';
    }
    
    if (touchCount === 2) {
      // Two finger gestures
      if (previousTouches && previousTouches.length === 2) {
        const prevDistance = this.calculateDistance(
          previousTouches[0],
          previousTouches[1]
        );
        const currDistance = this.calculateDistance(touches[0], touches[1]);
        const distanceDelta = Math.abs(currDistance - prevDistance);
        
        if (distanceDelta > 5) {
          return 'pinch';
        }
        
        // Check for rotation
        const prevAngle = this.calculateAngle(
          previousTouches[0],
          previousTouches[1]
        );
        const currAngle = this.calculateAngle(touches[0], touches[1]);
        const angleDelta = Math.abs(currAngle - prevAngle);
        
        if (angleDelta > 0.1) {
          return 'rotate';
        }
        
        // Check for two-finger pan
        const centerDelta = this.calculateDistance(
          this.getCenter(previousTouches),
          this.getCenter(touches)
        );
        if (centerDelta > 10) {
          return 'twoFingerPan';
        }
      }
      return 'pinch'; // Default for two fingers
    }
    
    return null;
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  /**
   * Calculate angle between two points
   */
  private calculateAngle(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  /**
   * Get center point of multiple touches
   */
  getCenter(touches: Array<{ x: number; y: number }>): { x: number; y: number } {
    if (touches.length === 0) {
      return { x: 0, y: 0 };
    }
    
    const sum = touches.reduce(
      (acc, touch) => ({ x: acc.x + touch.x, y: acc.y + touch.y }),
      { x: 0, y: 0 }
    );
    
    return {
      x: sum.x / touches.length,
      y: sum.y / touches.length,
    };
  }

  /**
   * Calculate pinch scale factor
   */
  calculatePinchScale(
    currentTouches: Array<{ x: number; y: number }>,
    previousTouches: Array<{ x: number; y: number }>
  ): number {
    if (currentTouches.length !== 2 || previousTouches.length !== 2) {
      return 1.0;
    }
    
    const prevDistance = this.calculateDistance(
      previousTouches[0],
      previousTouches[1]
    );
    const currDistance = this.calculateDistance(
      currentTouches[0],
      currentTouches[1]
    );
    
    if (prevDistance === 0) {
      return 1.0;
    }
    
    return currDistance / prevDistance;
  }

  /**
   * Calculate rotation angle from two-finger gesture
   */
  calculateRotationAngle(
    currentTouches: Array<{ x: number; y: number }>,
    previousTouches: Array<{ x: number; y: number }>
  ): number {
    if (currentTouches.length !== 2 || previousTouches.length !== 2) {
      return 0;
    }
    
    const prevAngle = this.calculateAngle(
      previousTouches[0],
      previousTouches[1]
    );
    const currAngle = this.calculateAngle(
      currentTouches[0],
      currentTouches[1]
    );
    
    return currAngle - prevAngle;
  }

  /**
   * Check if gesture is a long press
   */
  isLongPress(
    startTime: number,
    currentTime: number,
    threshold: number = 500
  ): boolean {
    return currentTime - startTime >= threshold;
  }

  /**
   * Reset gesture state
   */
  reset(): void {
    this.gestureState = {
      type: null,
      startPosition: null,
      currentPosition: null,
      startTime: null,
      touches: [],
    };
  }

  /**
   * Get current gesture state
   */
  getState(): GestureState {
    return { ...this.gestureState };
  }

  /**
   * Update gesture state
   */
  updateState(updates: Partial<GestureState>): void {
    this.gestureState = { ...this.gestureState, ...updates };
  }
}

export const arGestureService = new ARGestureService();


