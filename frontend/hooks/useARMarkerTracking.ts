/**
 * AR Marker Tracking Hook
 * Manages marker-based AR tracking state
 */

import { useState, useRef } from 'react';
import * as THREE from 'three';

interface UseARMarkerTrackingReturn {
  // Marker tracking state
  markerTrackingEnabled: boolean;
  setMarkerTrackingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  lastMarkerPayload: string | null;
  setLastMarkerPayload: (payload: string | null) => void;
  markerLastSeenAt: number | null;
  setMarkerLastSeenAt: (time: number | null) => void;
  
  // Refs for marker tracking
  lastMarkerUpdateRef: React.MutableRefObject<number>;
  markerAnchorOffsetRef: React.MutableRefObject<THREE.Vector3 | null>;
  markerYawRef: React.MutableRefObject<number>;
  markerScaleRef: React.MutableRefObject<number>;
}

export function useARMarkerTracking(): UseARMarkerTrackingReturn {
  const [markerTrackingEnabled, setMarkerTrackingEnabled] = useState(false);
  const [lastMarkerPayload, setLastMarkerPayload] = useState<string | null>(null);
  const [markerLastSeenAt, setMarkerLastSeenAt] = useState<number | null>(null);
  
  const lastMarkerUpdateRef = useRef<number>(0);
  const markerAnchorOffsetRef = useRef<THREE.Vector3 | null>(null);
  const markerYawRef = useRef<number>(0);
  const markerScaleRef = useRef<number>(1);
  
  return {
    markerTrackingEnabled,
    setMarkerTrackingEnabled,
    lastMarkerPayload,
    setLastMarkerPayload,
    markerLastSeenAt,
    setMarkerLastSeenAt,
    lastMarkerUpdateRef,
    markerAnchorOffsetRef,
    markerYawRef,
    markerScaleRef,
  };
}
