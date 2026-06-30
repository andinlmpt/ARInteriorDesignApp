/**
 * useARCoreSpatialScan
 * Manages an ARCore/ARKit session specifically for the spatial-mapping screen.
 * Handles availability checks, session lifecycle, live plane polling,
 * event-based plane ingestion, tracking quality, and hit testing.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isARSessionAvailable,
  isARSessionSupported,
  startARSession,
  stopARSession,
  getARPlanes,
  hitTestAR,
  arSessionEvents,
  getARPlatformName,
} from '@/native/ARSessionNative';
import type { DetectedPlane, SpatialPoint } from '@/types/spatial-mapping';

/** Mirrors ARCore tracking state names at the JS level */
export type ARTrackingQuality = 'notAvailable' | 'initializing' | 'limited' | 'normal';

export interface UseARCoreSpatialScanReturn {
  /** Whether the device supports ARCore/ARKit */
  isARAvailable: boolean;
  /** Whether an AR session is currently running */
  isARActive: boolean;
  /** 'ARCore' on Android, 'ARKit' on iOS, null when unavailable */
  arPlatform: 'ARCore' | 'ARKit' | null;
  /** All planes detected so far in the active session */
  detectedPlanes: DetectedPlane[];
  /** Current tracking quality */
  trackingQuality: ARTrackingQuality;
  /** Start the AR session. Returns true on success. */
  startAR: () => Promise<boolean>;
  /** Stop the AR session and clean up. */
  stopAR: () => void;
  /** Perform a hit test at the given screen coordinates. Returns 3-D world position or null. */
  performHitTest: (screenX: number, screenY: number) => Promise<SpatialPoint | null>;
}

const PLANE_POLL_INTERVAL_MS = 2_000;

function toSpatialPoint(raw: SpatialPoint | number[]): SpatialPoint {
  if (Array.isArray(raw)) {
    return { x: raw[0] ?? 0, y: raw[1] ?? 0, z: raw[2] ?? 0 };
  }
  return raw;
}

export function useARCoreSpatialScan(): UseARCoreSpatialScanReturn {
  const [isARAvailable, setIsARAvailable] = useState(false);
  const [isARActive, setIsARActive] = useState(false);
  const [arPlatform, setARPlatform] = useState<'ARCore' | 'ARKit' | null>(null);
  const [detectedPlanes, setDetectedPlanes] = useState<DetectedPlane[]>([]);
  const [trackingQuality, setTrackingQuality] = useState<ARTrackingQuality>('notAvailable');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const planeListenerRef = useRef<{ remove: () => void } | null>(null);
  const isActiveRef = useRef(false);

  // Check device support once on mount
  useEffect(() => {
    (async () => {
      if (!isARSessionAvailable()) return;
      const supported = await isARSessionSupported();
      if (supported) {
        setIsARAvailable(true);
        setARPlatform(getARPlatformName());
      }
    })();
  }, []);

  // Ensure cleanup when the component unmounts
  useEffect(() => {
    return () => {
      cleanupInternal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupInternal = () => {
    isActiveRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (planeListenerRef.current) {
      planeListenerRef.current.remove();
      planeListenerRef.current = null;
    }
    stopARSession();
  };

  const startAR = useCallback(async (): Promise<boolean> => {
    if (!isARAvailable) return false;

    try {
      setTrackingQuality('initializing');
      setDetectedPlanes([]);

      const started = await startARSession();
      if (!started) {
        setTrackingQuality('notAvailable');
        return false;
      }

      isActiveRef.current = true;
      setIsARActive(true);
      setTrackingQuality('limited');

      // Subscribe to native onPlaneDetected events
      if (arSessionEvents) {
        const sub = arSessionEvents.addListener('onPlaneDetected', (raw: any) => {
          if (!isActiveRef.current) return;
          const center = toSpatialPoint(raw.center ?? [0, 0, 0]);
          const normal = toSpatialPoint(
            raw.normal ?? (raw.type === 'horizontal' ? [0, 1, 0] : [0, 0, 1])
          );
          const newPlane: DetectedPlane = {
            id: raw.id ?? String(Date.now()),
            type: raw.type ?? 'horizontal',
            center,
            normal,
            area: raw.area ?? 0,
            confidence: raw.confidence ?? 0.8,
            timestamp: raw.timestamp ?? Date.now(),
            points: [],
          };
          setDetectedPlanes((prev) => {
            if (prev.some((p) => p.id === newPlane.id)) return prev;
            return [...prev, newPlane];
          });
          setTrackingQuality('normal');
        });
        planeListenerRef.current = sub as unknown as { remove: () => void };
      }

      // Poll for updated planes periodically
      pollRef.current = setInterval(async () => {
        if (!isActiveRef.current) return;
        try {
          const raw = await getARPlanes();
          if (raw.length > 0) {
            const planes: DetectedPlane[] = raw.map((p) => ({
              ...p,
              points: p.points ?? [],
            }));
            setDetectedPlanes(planes);
            setTrackingQuality('normal');
          }
        } catch {
          // silently ignore frame errors
        }
      }, PLANE_POLL_INTERVAL_MS);

      return true;
    } catch (err) {
      console.warn('[ARCoreSpatialScan] startAR failed:', err);
      setTrackingQuality('notAvailable');
      return false;
    }
  }, [isARAvailable]);

  const stopAR = useCallback(() => {
    cleanupInternal();
    setIsARActive(false);
    setTrackingQuality('notAvailable');
  }, []);

  const performHitTest = useCallback(
    async (screenX: number, screenY: number): Promise<SpatialPoint | null> => {
      if (!isActiveRef.current) return null;
      const result = await hitTestAR(screenX, screenY);
      return result?.position ?? null;
    },
    []
  );

  return {
    isARAvailable,
    isARActive,
    arPlatform,
    detectedPlanes,
    trackingQuality,
    startAR,
    stopAR,
    performHitTest,
  };
}
