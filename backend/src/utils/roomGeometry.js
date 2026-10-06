/**
 * Floor-outline geometry on the XZ plane (metres): walls, perimeter, area,
 * volume and validation. Mirrors Unity's RoomPolygonUtil so rooms saved by
 * older app builds still get the full room model.
 */

const EPSILON = 1e-6;
export const MIN_CORNERS = 3;
export const OPENING_TYPES = ['door', 'window'];
export const SWING_SIDES = ['left', 'right', 'none'];

const round = (value, digits = 3) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function toPoint(p) {
  return { x: finite(p?.x), y: finite(p?.y), z: finite(p?.z) };
}

function flatDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function onSegment(a, b, p) {
  return p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
    && p.z >= Math.min(a.z, b.z) - EPSILON && p.z <= Math.max(a.z, b.z) + EPSILON;
}

function segmentsIntersect(p1, p2, q1, q2) {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  if (((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON))
    && ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))) {
    return true;
  }
  return (Math.abs(d1) <= EPSILON && onSegment(q1, q2, p1))
    || (Math.abs(d2) <= EPSILON && onSegment(q1, q2, p2))
    || (Math.abs(d3) <= EPSILON && onSegment(p1, p2, q1))
    || (Math.abs(d4) <= EPSILON && onSegment(p1, p2, q2));
}

export function signedArea(polygon) {
  if (!Array.isArray(polygon) || polygon.length < MIN_CORNERS) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    area += a.x * b.z - b.x * a.z;
  }
  return area / 2;
}

export function isSelfIntersecting(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 4) return false;
  const n = polygon.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if ((i + 1) % n === j || (j + 1) % n === i) continue;
      if (segmentsIntersect(polygon[i], polygon[(i + 1) % n], polygon[j], polygon[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function validatePolygon(polygon) {
  const errors = [];
  if (!Array.isArray(polygon) || polygon.length < MIN_CORNERS) {
    errors.push('tooFewCorners');
    return { isValid: false, errors };
  }
  if (isSelfIntersecting(polygon)) errors.push('selfIntersecting');
  if (Math.abs(signedArea(polygon)) < 0.05) errors.push('zeroArea');
  return { isValid: errors.length === 0, errors };
}

export function buildWalls(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 2) return [];
  const edgeCount = polygon.length >= MIN_CORNERS ? polygon.length : polygon.length - 1;
  const walls = [];
  for (let i = 0; i < edgeCount; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    walls.push({ index: i, start, end, length: round(flatDistance(start, end)) });
  }
  return walls;
}

/**
 * Rotation (radians, XZ plane, counter-clockwise) that lays the outline's longest
 * wall along +X. AR outlines are in world space, so a real room is usually at an
 * arbitrary angle; its axis-aligned bounding box would overstate width × length.
 */
export function wallAlignmentAngle(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 2) return 0;
  let best = 0;
  let angle = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const len = flatDistance(a, b);
    if (len > best) {
      best = len;
      angle = Math.atan2(b.z - a.z, b.x - a.x);
    }
  }
  return -angle;
}

/** Rotates a point on the XZ plane by `angle` radians (counter-clockwise). */
export function rotateXZ(p, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { ...p, x: p.x * cos - p.z * sin, z: p.x * sin + p.z * cos };
}

/**
 * Width × length of the outline measured along its own walls.
 * @returns {{width:number,length:number,angle:number}|null}
 */
export function orientedRoomSize(floorPolygon) {
  const polygon = Array.isArray(floorPolygon) ? floorPolygon.map(toPoint) : [];
  if (polygon.length < MIN_CORNERS) return null;
  const angle = wallAlignmentAngle(polygon);
  const rotated = polygon.map((p) => rotateXZ(p, angle));
  const xs = rotated.map((p) => p.x);
  const zs = rotated.map((p) => p.z);
  const width = Math.max(...xs) - Math.min(...xs);
  const length = Math.max(...zs) - Math.min(...zs);
  if (width < 0.5 || length < 0.5) return null;
  return { width: round(width), length: round(length), angle };
}

/**
 * Derive the full room model from a floor outline and wall height.
 * @param {Array<{x:number,y:number,z:number}>} floorPolygon
 * @param {number} height metres
 */
export function computeRoomGeometry(floorPolygon, height) {
  const polygon = Array.isArray(floorPolygon) ? floorPolygon.map(toPoint) : [];
  const walls = buildWalls(polygon);
  const perimeterM = polygon.length >= MIN_CORNERS
    ? round(walls.reduce((sum, w) => sum + w.length, 0))
    : 0;
  const floorAreaSqm = round(Math.abs(signedArea(polygon)));
  const h = finite(height);
  return {
    floorY: polygon.length > 0 ? round(Math.min(...polygon.map((p) => p.y))) : 0,
    walls,
    perimeterM,
    floorAreaSqm,
    volumeM3: round(floorAreaSqm * Math.max(0, h)),
    validation: validatePolygon(polygon),
  };
}

export function sanitizeOpenings(openings, wallCount) {
  if (!Array.isArray(openings)) return [];
  return openings
    .filter((o) => o && OPENING_TYPES.includes(o.type))
    .map((o, i) => ({
      id: String(o.id || `opening-${i + 1}`).slice(0, 64),
      type: o.type,
      wallIndex: Math.max(0, Math.floor(finite(o.wallIndex))),
      offsetAlongWall: Math.max(0, finite(o.offsetAlongWall)),
      width: Math.max(0, finite(o.width)),
      height: Math.max(0, finite(o.height)),
      sillHeight: Math.max(0, finite(o.sillHeight)),
      swing: SWING_SIDES.includes(o.swing) ? o.swing : 'none',
    }))
    .filter((o) => o.width > 0 && (wallCount <= 0 || o.wallIndex < wallCount));
}

export function sanitizeObstacles(obstacles) {
  if (!Array.isArray(obstacles)) return [];
  return obstacles
    .filter((o) => o && typeof o === 'object')
    .map((o, i) => ({
      id: String(o.id || `obstacle-${i + 1}`).slice(0, 64),
      type: String(o.type || 'other').trim().slice(0, 40) || 'other',
      center: toPoint(o.center),
      size: {
        x: Math.max(0, finite(o.size?.x)),
        y: Math.max(0, finite(o.size?.y)),
        z: Math.max(0, finite(o.size?.z)),
      },
      yaw: finite(o.yaw),
    }))
    .filter((o) => o.size.x > 0 && o.size.z > 0);
}

export default {
  computeRoomGeometry,
  validatePolygon,
  isSelfIntersecting,
  buildWalls,
  signedArea,
  wallAlignmentAngle,
  rotateXZ,
  orientedRoomSize,
  sanitizeOpenings,
  sanitizeObstacles,
};
