/**
 * AR Core State Hook
 * Manages core AR state like initialization, anchor status, room data, and errors
 */

import { useState } from 'react';
import type { RoomData } from '@/types/spatial-mapping';
import type { AnchorStatus } from '@/types/anchor';
import type { ARInitError } from '@/types/ar-view';
import { arAnchorManager } from '@/services/ARAnchorManager';

interface UseARCoreStateReturn {
  // AR activation
  isARActive: boolean;
  setIsARActive: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Room data
  roomData: RoomData | null;
  setRoomData: (data: RoomData | null) => void;
  
  // Anchor status
  anchorStatus: AnchorStatus;
  setAnchorStatus: React.Dispatch<React.SetStateAction<AnchorStatus>>;
  
  // Initialization
  isInitializing: boolean;
  setIsInitializing: (initializing: boolean) => void;
  
  // Error state
  componentError: string | null;
  setComponentError: (error: string | null) => void;
  retryAttempts: Map<string, number>;
  setRetryAttempts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  retryCount: number;
  setRetryCount: React.Dispatch<React.SetStateAction<number>>;
  
  // AR availability
  arUnavailable: boolean;
  setArUnavailable: React.Dispatch<React.SetStateAction<boolean>>;
  arLimitedDismissed: boolean;
  setArLimitedDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Plane detection
  detectedPlanes: { id: string; type: 'horizontal' | 'vertical'; center: any; extent: { width: number; length: number }; confidence: number }[];
  setDetectedPlanes: React.Dispatch<React.SetStateAction<{ id: string; type: 'horizontal' | 'vertical'; center: any; extent: { width: number; length: number }; confidence: number }[]>>;
  
  // Collision warnings
  collisionWarnings: Set<string>;
  setCollisionWarnings: React.Dispatch<React.SetStateAction<Set<string>>>;
  
  // Demo mode
  demoMode: boolean;
  setDemoMode: (mode: boolean) => void;
  
  // Interactive stats
  interactiveStats: {
    totalFurniture: number;
    totalArea: number;
    averageSafety: number;
    placementCount: number;
  };
  setInteractiveStats: React.Dispatch<React.SetStateAction<{
    totalFurniture: number;
    totalArea: number;
    averageSafety: number;
    placementCount: number;
  }>>;
  
  // Placement safety
  placementSafety: {
    isSafe: boolean;
    safetyLevel: 'safe' | 'warning' | 'danger';
    safetyScore: number;
    reason: string | null;
    hasObstacleCollision: boolean;
    hasFurnitureCollision: boolean;
    hasWallCollision: boolean;
    isOutOfBounds: boolean;
    nearestObstacleDistance: number | null;
    nearestWallDistance: number | null;
    nearestFurnitureDistance: number | null;
    recommendations: string[];
  };
  setPlacementSafety: React.Dispatch<React.SetStateAction<{
    isSafe: boolean;
    safetyLevel: 'safe' | 'warning' | 'danger';
    safetyScore: number;
    reason: string | null;
    hasObstacleCollision: boolean;
    hasFurnitureCollision: boolean;
    hasWallCollision: boolean;
    isOutOfBounds: boolean;
    nearestObstacleDistance: number | null;
    nearestWallDistance: number | null;
    nearestFurnitureDistance: number | null;
    recommendations: string[];
  }>>;
}

export function useARCoreState(): UseARCoreStateReturn {
  const [isARActive, setIsARActive] = useState(false);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [anchorStatus, setAnchorStatus] = useState<AnchorStatus>(arAnchorManager.getStatus());
  const [isInitializing, setIsInitializing] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState<Map<string, number>>(new Map());
  const [retryCount, setRetryCount] = useState(0);
  const [arUnavailable, setArUnavailable] = useState(false);
  const [arLimitedDismissed, setArLimitedDismissed] = useState(false);
  const [detectedPlanes, setDetectedPlanes] = useState<{ id: string; type: 'horizontal' | 'vertical'; center: any; extent: { width: number; length: number }; confidence: number }[]>([]);
  const [collisionWarnings, setCollisionWarnings] = useState<Set<string>>(new Set());
  const [demoMode, setDemoMode] = useState(false);
  const [interactiveStats, setInteractiveStats] = useState({
    totalFurniture: 0,
    totalArea: 0,
    averageSafety: 100,
    placementCount: 0,
  });
  const [placementSafety, setPlacementSafety] = useState<{
    isSafe: boolean;
    safetyLevel: 'safe' | 'warning' | 'danger';
    safetyScore: number;
    reason: string | null;
    hasObstacleCollision: boolean;
    hasFurnitureCollision: boolean;
    hasWallCollision: boolean;
    isOutOfBounds: boolean;
    nearestObstacleDistance: number | null;
    nearestWallDistance: number | null;
    nearestFurnitureDistance: number | null;
    recommendations: string[];
  }>({
    isSafe: true,
    safetyLevel: 'safe',
    safetyScore: 100,
    reason: null,
    hasObstacleCollision: false,
    hasFurnitureCollision: false,
    hasWallCollision: false,
    isOutOfBounds: false,
    nearestObstacleDistance: null,
    nearestWallDistance: null,
    nearestFurnitureDistance: null,
    recommendations: [],
  });
  
  return {
    isARActive,
    setIsARActive,
    roomData,
    setRoomData,
    anchorStatus,
    setAnchorStatus,
    isInitializing,
    setIsInitializing,
    componentError,
    setComponentError,
    retryAttempts,
    setRetryAttempts,
    retryCount,
    setRetryCount,
    arUnavailable,
    setArUnavailable,
    arLimitedDismissed,
    setArLimitedDismissed,
    detectedPlanes,
    setDetectedPlanes,
    collisionWarnings,
    setCollisionWarnings,
    demoMode,
    setDemoMode,
    interactiveStats,
    setInteractiveStats,
    placementSafety,
    setPlacementSafety,
  };
}
