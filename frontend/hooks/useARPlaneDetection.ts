/**
 * Keeps plane visualization disabled while AR is active.
 * Plane collision detection still uses internal spatial data.
 */

import { useEffect } from 'react';
import type { DetectedPlane } from '@/types/spatial-mapping';

interface UseARPlaneDetectionOptions {
  rendererReady: boolean;
  isARActive: boolean;
  setDetectedPlanes: (planes: DetectedPlane[]) => void;
}

export function useARPlaneDetection({
  rendererReady,
  isARActive,
  setDetectedPlanes,
}: UseARPlaneDetectionOptions): void {
  useEffect(() => {
    if (!rendererReady || !isARActive) {
      return;
    }

    // Visualization intentionally disabled to preserve a clean scanning experience.
    setDetectedPlanes([]);
  }, [rendererReady, isARActive, setDetectedPlanes]);
}
