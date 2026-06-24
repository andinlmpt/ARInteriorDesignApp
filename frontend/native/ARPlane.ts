import type { SpatialPoint, DetectedPlane } from '@/types/spatial-mapping';

export type ARNativePlaneType = 'horizontal' | 'vertical';

export type ARNativePlane = {
  id: string;
  type: ARNativePlaneType;
  center: SpatialPoint;
  normal: SpatialPoint;
  area: number;
  confidence: number;
  timestamp: number;
  points?: SpatialPoint[];
};

export function nativePlaneToDetectedPlane(p: ARNativePlane): DetectedPlane {
  return {
    id: p.id,
    type: p.type,
    points: p.points ?? [],
    center: p.center,
    normal: p.normal,
    area: p.area,
    confidence: p.confidence,
    timestamp: p.timestamp,
  };
}

