import type { SpatialPoint } from './spatial-mapping';

export type AnchorType = 'floor' | 'wall' | 'user';

export interface AnchorPose {
  id: string;
  type: AnchorType;
  position: SpatialPoint;
  quaternion: [number, number, number, number];
  /**
   * Optional scale factor applied to local coordinates before anchoring.
   * Used by marker-based calibration (e.g., QR marker of known size).
   */
  scale?: number;
  confidence: number;
  updatedAt: number;
  source?: 'ar-session' | 'spatial-map' | 'manual' | 'marker';
}

export interface AnchorStatus {
  hasLock: boolean;
  anchor?: AnchorPose;
  quality: 'poor' | 'medium' | 'good';
  hints: string[];
}

