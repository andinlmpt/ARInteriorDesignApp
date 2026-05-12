/**
 * AR Interaction State Hook
 * Manages gestures, dragging, rotation, and snapping state
 */

import { useState, useRef } from 'react';
import * as THREE from 'three';

export type GestureState = 'IDLE' | 'MOVE_SINGLE_FINGER' | 'PINCH_OR_ROTATE_TWO_FINGERS';

interface UseARInteractionStateReturn {
  // Gesture state
  gestureState: GestureState;
  setGestureState: React.Dispatch<React.SetStateAction<GestureState>>;
  
  // Drag state
  isDraggingFurniture: boolean;
  setIsDraggingFurniture: (dragging: boolean) => void;
  draggedFurnitureId: string | null;
  setDraggedFurnitureId: (id: string | null) => void;
  dragStartPosition: THREE.Vector3 | null;
  setDragStartPosition: (pos: THREE.Vector3 | null) => void;
  dragStartRotation: number | null;
  setDragStartRotation: (rotation: number | null) => void;
  dragRotation: number;
  setDragRotation: (rotation: number) => void;
  
  // Rotation state
  isRotatingFurniture: boolean;
  setIsRotatingFurniture: (rotating: boolean) => void;
  rotationStartAngle: number | null;
  setRotationStartAngle: (angle: number | null) => void;
  rotationStartTouchAngle: number | null;
  setRotationStartTouchAngle: (angle: number | null) => void;
  
  // Snapping state
  magneticSnapActive: boolean;
  setMagneticSnapActive: (active: boolean) => void;
  snapType: 'wall' | 'corner' | 'edge' | 'furniture' | null;
  setSnapType: (type: 'wall' | 'corner' | 'edge' | 'furniture' | null) => void;
  suggestedPositions: THREE.Vector3[];
  setSuggestedPositions: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
  
  // Refs for interaction
  twoFingerStartRef: React.MutableRefObject<{ angle: number; distance: number; centerX: number; centerY: number } | null>;
  lockedScaleRef: React.MutableRefObject<Map<string, number>>;
  lastDragUpdateRef: React.MutableRefObject<number>;
  pendingDragPositionRef: React.MutableRefObject<{ locationX: number; locationY: number } | null>;
  latestDragPositionRef: React.MutableRefObject<THREE.Vector3 | null>;
  dragGhostRef: React.MutableRefObject<THREE.Mesh | THREE.Group | null>;
  alignmentLinesRef: React.MutableRefObject<THREE.Line[]>;
  constraintLinesRef: React.MutableRefObject<THREE.Line[]>;
  dimensionLabelRef: React.MutableRefObject<THREE.Group | null>;
  suggestedPositionsRef: React.MutableRefObject<THREE.Mesh[]>;
  suggestedPositionLabelsRef: React.MutableRefObject<THREE.Group | null>;
  dragStateUpdateTimeoutRef: React.MutableRefObject<number | null>;
  dragStateUpdateQueue: React.MutableRefObject<{
    safety?: any;
    magneticSnap?: boolean;
    snapType?: 'wall' | 'corner' | 'edge' | 'furniture' | null;
  }[]>;
}

export function useARInteractionState(): UseARInteractionStateReturn {
  const [gestureState, setGestureState] = useState<GestureState>('IDLE');
  const [isDraggingFurniture, setIsDraggingFurniture] = useState(false);
  const [draggedFurnitureId, setDraggedFurnitureId] = useState<string | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<THREE.Vector3 | null>(null);
  const [dragStartRotation, setDragStartRotation] = useState<number | null>(null);
  const [dragRotation, setDragRotation] = useState(0);
  const [isRotatingFurniture, setIsRotatingFurniture] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState<number | null>(null);
  const [rotationStartTouchAngle, setRotationStartTouchAngle] = useState<number | null>(null);
  const [magneticSnapActive, setMagneticSnapActive] = useState(false);
  const [snapType, setSnapType] = useState<'wall' | 'corner' | 'edge' | 'furniture' | null>(null);
  const [suggestedPositions, setSuggestedPositions] = useState<THREE.Vector3[]>([]);
  
  // Refs
  const twoFingerStartRef = useRef<{ angle: number; distance: number; centerX: number; centerY: number } | null>(null);
  const lockedScaleRef = useRef<Map<string, number>>(new Map());
  const lastDragUpdateRef = useRef<number>(0);
  const pendingDragPositionRef = useRef<{ locationX: number; locationY: number } | null>(null);
  const latestDragPositionRef = useRef<THREE.Vector3 | null>(null);
  const dragGhostRef = useRef<THREE.Mesh | THREE.Group | null>(null);
  const alignmentLinesRef = useRef<THREE.Line[]>([]);
  const constraintLinesRef = useRef<THREE.Line[]>([]);
  const dimensionLabelRef = useRef<THREE.Group | null>(null);
  const suggestedPositionsRef = useRef<THREE.Mesh[]>([]);
  const suggestedPositionLabelsRef = useRef<THREE.Group | null>(null);
  const dragStateUpdateTimeoutRef = useRef<number | null>(null);
  const dragStateUpdateQueue = useRef<{
    safety?: any;
    magneticSnap?: boolean;
    snapType?: 'wall' | 'corner' | 'edge' | 'furniture' | null;
  }[]>([]);
  
  return {
    gestureState,
    setGestureState,
    isDraggingFurniture,
    setIsDraggingFurniture,
    draggedFurnitureId,
    setDraggedFurnitureId,
    dragStartPosition,
    setDragStartPosition,
    dragStartRotation,
    setDragStartRotation,
    dragRotation,
    setDragRotation,
    isRotatingFurniture,
    setIsRotatingFurniture,
    rotationStartAngle,
    setRotationStartAngle,
    rotationStartTouchAngle,
    setRotationStartTouchAngle,
    magneticSnapActive,
    setMagneticSnapActive,
    snapType,
    setSnapType,
    suggestedPositions,
    setSuggestedPositions,
    twoFingerStartRef,
    lockedScaleRef,
    lastDragUpdateRef,
    pendingDragPositionRef,
    latestDragPositionRef,
    dragGhostRef,
    alignmentLinesRef,
    constraintLinesRef,
    dimensionLabelRef,
    suggestedPositionsRef,
    suggestedPositionLabelsRef,
    dragStateUpdateTimeoutRef,
    dragStateUpdateQueue,
  };
}
