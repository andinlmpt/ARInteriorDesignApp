/**
 * Derive AR planes from spatial mapping room data.
 * Used when native plane visualization is enabled.
 */

import type { DetectedPlane, RoomData, SpatialPoint } from '@/types/spatial-mapping';

export function derivePlanesFromRoomData(data: RoomData): DetectedPlane[] {
  const { width, length, height } = data.dimensions;
  const halfW = width / 2;
  const halfL = length / 2;
  const timestamp = data.timestamp ?? Date.now();
  const confidence = data.confidence ?? 0.6;

  const floorPoints: SpatialPoint[] =
    data.floorBoundary && data.floorBoundary.length >= 3
      ? data.floorBoundary
      : [
          { x: -halfW, y: 0, z: -halfL },
          { x: halfW, y: 0, z: -halfL },
          { x: halfW, y: 0, z: halfL },
          { x: -halfW, y: 0, z: halfL },
        ];

  const ceilingPoints: SpatialPoint[] =
    data.ceilingBoundary && data.ceilingBoundary.length >= 3
      ? data.ceilingBoundary
      : floorPoints.map((p) => ({ x: p.x, y: height, z: p.z }));

  const derived: DetectedPlane[] = [
    {
      id: 'derived-floor',
      type: 'horizontal',
      points: floorPoints,
      center: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      area: Math.max(0.01, data.area || width * length),
      confidence,
      timestamp,
    },
    {
      id: 'derived-ceiling',
      type: 'horizontal',
      points: ceilingPoints,
      center: { x: 0, y: height, z: 0 },
      normal: { x: 0, y: -1, z: 0 },
      area: Math.max(0.01, width * length),
      confidence: Math.max(0.3, confidence - 0.1),
      timestamp,
    },
  ];

  if (data.walls && data.walls.length > 0) {
    for (const wall of data.walls) {
      const bottomA = wall.startPoint;
      const bottomB = wall.endPoint;
      const topA = { x: bottomA.x, y: height, z: bottomA.z };
      const topB = { x: bottomB.x, y: height, z: bottomB.z };

      const center: SpatialPoint = {
        x: (bottomA.x + bottomB.x) / 2,
        y: height / 2,
        z: (bottomA.z + bottomB.z) / 2,
      };

      const normal: SpatialPoint =
        wall.orientation === 'north'
          ? { x: 0, y: 0, z: 1 }
          : wall.orientation === 'south'
            ? { x: 0, y: 0, z: -1 }
            : wall.orientation === 'east'
              ? { x: -1, y: 0, z: 0 }
              : { x: 1, y: 0, z: 0 };

      derived.push({
        id: `derived-wall-${wall.id}`,
        type: 'vertical',
        points: [bottomA, bottomB, topB, topA],
        center,
        normal,
        area: Math.max(0.01, wall.length * height),
        confidence: Math.max(0.3, confidence - 0.05),
        timestamp,
      });
    }
  }

  return derived;
}

export function getExtentFromPlane(plane: DetectedPlane): { width: number; length: number } {
  const fallback = Math.sqrt(Math.max(plane.area || 1, 1));
  const pts = plane.points ?? [];
  if (pts.length < 2) {
    return { width: fallback, length: fallback };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  const spanX = Math.max(0.01, maxX - minX);
  const spanY = Math.max(0.01, maxY - minY);
  const spanZ = Math.max(0.01, maxZ - minZ);

  if (plane.type === 'horizontal') {
    return { width: spanX || fallback, length: spanZ || fallback };
  }

  const horizontalSpan = Math.max(spanX, spanZ);
  return { width: horizontalSpan || fallback, length: spanY || fallback };
}
