/**
 * AR Gestures Hook
 * Manages gesture recognition and handling for AR interactions
 */

import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { arGestureService, type GestureType } from '@/services/ARGestureService';
import { AR_CONFIG } from '@/config/arView.config';

export type GestureState = 'IDLE' | 'MOVE_SINGLE_FINGER' | 'PINCH_OR_ROTATE_TWO_FINGERS';

interface UseARGesturesReturn {
  // State
  gestureState: GestureState;
  isDragging: boolean;
  isRotating: boolean;
  isPinching: boolean;
  
  // Gesture handlers
  handleTouchStart: (touches: Array<{ x: number; y: number }>) => void;
  handleTouchMove: (touches: Array<{ x: number; y: number }>) => void;
  handleTouchEnd: () => void;
  
  // Gesture data
  dragDelta: { x: number; y: number } | null;
  rotationDelta: number | null;
  pinchScale: number | null;
  
  // Reset
  reset: () => void;
}

export function useARGestures(): UseARGesturesReturn {
  const [gestureState, setGestureState] = useState<GestureState>('IDLE');
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null);
  const [rotationDelta, setRotationDelta] = useState<number | null>(null);
  const [pinchScale, setPinchScale] = useState<number | null>(null);
  
  const previousTouchesRef = useRef<Array<{ x: number; y: number }>>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((touches: Array<{ x: number; y: number }>) => {
    previousTouchesRef.current = touches;
    touchStartTimeRef.current = Date.now();
    
    if (touches.length === 1) {
      setGestureState('MOVE_SINGLE_FINGER');
      
      // Set up long press timer
      longPressTimerRef.current = setTimeout(() => {
        // Long press detected - could trigger context menu or selection
        console.log('[ARGestures] Long press detected');
      }, 500);
    } else if (touches.length === 2) {
      setGestureState('PINCH_OR_ROTATE_TWO_FINGERS');
    }
  }, []);

  const handleTouchMove = useCallback((touches: Array<{ x: number; y: number }>) => {
    const previousTouches = previousTouchesRef.current;
    
    if (previousTouches.length === 0) {
      previousTouchesRef.current = touches;
      return;
    }
    
    const gestureType = arGestureService.detectGesture(touches, previousTouches);
    
    if (gestureType === 'drag' && touches.length === 1) {
      setIsDragging(true);
      setIsRotating(false);
      setIsPinching(false);
      
      const delta = {
        x: touches[0].x - previousTouches[0].x,
        y: touches[0].y - previousTouches[0].y,
      };
      setDragDelta(delta);
      
      // Cancel long press if dragging
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    } else if (gestureType === 'rotate' && touches.length === 2) {
      setIsRotating(true);
      setIsDragging(false);
      setIsPinching(false);
      
      const angle = arGestureService.calculateRotationAngle(touches, previousTouches);
      setRotationDelta(angle);
    } else if (gestureType === 'pinch' && touches.length === 2) {
      setIsPinching(true);
      setIsDragging(false);
      setIsRotating(false);
      
      const scale = arGestureService.calculatePinchScale(touches, previousTouches);
      setPinchScale(scale);
    }
    
    previousTouchesRef.current = touches;
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Cancel long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    setGestureState('IDLE');
    setIsDragging(false);
    setIsRotating(false);
    setIsPinching(false);
    setDragDelta(null);
    setRotationDelta(null);
    setPinchScale(null);
    previousTouchesRef.current = [];
    touchStartTimeRef.current = null;
    
    arGestureService.reset();
  }, []);

  const reset = useCallback(() => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  return {
    gestureState,
    isDragging,
    isRotating,
    isPinching,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    dragDelta,
    rotationDelta,
    pinchScale,
    reset,
  };
}


