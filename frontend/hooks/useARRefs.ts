/**
 * AR Refs Hook
 * Manages all Three.js refs and scene references
 */

import { useRef } from 'react';
import * as THREE from 'three';
import type { FurnitureMapEntry } from '@/types/ar-view';

interface UseARRefsReturn {
  // Furniture and obstacle maps
  furnitureMapRef: React.MutableRefObject<Map<string, FurnitureMapEntry>>;
  obstacleMapRef: React.MutableRefObject<Map<string, THREE.Mesh>>;
  roomGroupRef: React.MutableRefObject<THREE.Group | null>;
  
  // Raycasting
  raycasterRef: React.MutableRefObject<THREE.Raycaster>;
  floorPlaneRef: React.MutableRefObject<THREE.Plane>;
  
  // Geometry and material pools
  geometryPoolRef: React.MutableRefObject<Map<string, THREE.BoxGeometry[]>>;
  materialPoolRef: React.MutableRefObject<Map<string, THREE.MeshStandardMaterial[]>>;
  geometryCacheRef: React.MutableRefObject<Map<string, THREE.BoxGeometry>>;
  materialCacheRef: React.MutableRefObject<Map<string, THREE.MeshStandardMaterial>>;
  
  // Touch and gesture refs
  lastPanRef: React.MutableRefObject<{ x: number; y: number } | null>;
  touchStartRef: React.MutableRefObject<{ distance: number; angle: number; touches: { x: number; y: number }[] } | null>;
  isPanningRef: React.MutableRefObject<boolean>;
  isZoomingRef: React.MutableRefObject<boolean>;
  isRotatingRef: React.MutableRefObject<boolean>;
  longPressTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  
  // UI refs
  tooltipRef: React.MutableRefObject<{ furnitureId: string; position: THREE.Vector3 } | null>;
  
  // History and timing refs
  lastHistorySaveRef: React.MutableRefObject<number>;
  lastCollisionCheckRef: React.MutableRefObject<number>;
  
  // Demo mode refs
  demoIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  demoTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export function useARRefs(): UseARRefsReturn {
  const furnitureMapRef = useRef<Map<string, FurnitureMapEntry>>(new Map());
  const obstacleMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const roomGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const floorPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const geometryPoolRef = useRef<Map<string, THREE.BoxGeometry[]>>(new Map());
  const materialPoolRef = useRef<Map<string, THREE.MeshStandardMaterial[]>>(new Map());
  const geometryCacheRef = useRef<Map<string, THREE.BoxGeometry>>(new Map());
  const materialCacheRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ distance: number; angle: number; touches: { x: number; y: number }[] } | null>(null);
  const isPanningRef = useRef(false);
  const isZoomingRef = useRef(false);
  const isRotatingRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<{ furnitureId: string; position: THREE.Vector3 } | null>(null);
  const lastHistorySaveRef = useRef<number>(0);
  const lastCollisionCheckRef = useRef<number>(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  return {
    furnitureMapRef,
    obstacleMapRef,
    roomGroupRef,
    raycasterRef,
    floorPlaneRef,
    geometryPoolRef,
    materialPoolRef,
    geometryCacheRef,
    materialCacheRef,
    lastPanRef,
    touchStartRef,
    isPanningRef,
    isZoomingRef,
    isRotatingRef,
    longPressTimerRef,
    tooltipRef,
    lastHistorySaveRef,
    lastCollisionCheckRef,
    demoIntervalRef,
    demoTimeoutRef,
  };
}
