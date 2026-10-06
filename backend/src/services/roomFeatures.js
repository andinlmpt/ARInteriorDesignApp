/**
 * Room Features
 * Converts a saved room scan (world-space outline, doors, windows, existing
 * furniture) into layout-planner features in room-local metres.
 *
 * Room-local frame matches layoutPlanner: the outline is rotated so its longest
 * wall runs along X, then shifted so its min X / min Z sit at the origin
 * (x along room width, z along room length).
 */

import { orientedRoomSize, rotateXZ, signedArea, wallAlignmentAngle } from '../utils/roomGeometry.js';

/** Minimum clear depth inside the room in front of a door (metres). */
const DOOR_MIN_CLEARANCE = 0.9;
/** Extra width kept clear on each side of a door (metres). */
const DOOR_SIDE_MARGIN = 0.1;
/** Depth in front of a window where tall furniture is discouraged (metres). */
const WINDOW_ZONE_DEPTH = 0.5;
/** Furniture taller than this blocks a window even with a high sill. */
const TALL_ITEM_HEIGHT = 1.2;
/** Outline span may differ from the requested room size by this much (metres). */
const OUTLINE_SIZE_TOLERANCE = 0.3;

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

function aabb(points) {
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const x = Math.min(...xs);
  const z = Math.min(...zs);
  return { x, z, w: Math.max(...xs) - x, d: Math.max(...zs) - z };
}

function clipToRoom(rect, room) {
  const x0 = Math.max(0, rect.x);
  const z0 = Math.max(0, rect.z);
  const x1 = Math.min(room.width, rect.x + rect.w);
  const z1 = Math.min(room.length, rect.z + rect.d);
  if (x1 <= x0 || z1 <= z0) return null;
  return { x: x0, z: z0, w: x1 - x0, d: z1 - z0 };
}

/**
 * Rectangle on the room side of a wall opening.
 * @returns {{x:number,z:number,w:number,d:number}|null}
 */
function openingZone(polygon, opening, depth, sideMargin) {
  const n = polygon.length;
  const i = Math.floor(finite(opening.wallIndex, -1));
  if (i < 0 || i >= n) return null;

  const a = polygon[i];
  const b = polygon[(i + 1) % n];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 1e-3) return null;

  const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  // Inward normal: left of the edge for counter-clockwise outlines.
  const ccw = signedArea(polygon) > 0;
  const inward = ccw ? { x: -dir.z, z: dir.x } : { x: dir.z, z: -dir.x };

  const start = Math.max(0, finite(opening.offsetAlongWall) - sideMargin);
  const end = Math.min(len, finite(opening.offsetAlongWall) + finite(opening.width) + sideMargin);
  if (end <= start) return null;

  const p0 = { x: a.x + dir.x * start, z: a.z + dir.z * start };
  const p1 = { x: a.x + dir.x * end, z: a.z + dir.z * end };
  return aabb([
    p0,
    p1,
    { x: p0.x + inward.x * depth, z: p0.z + inward.z * depth },
    { x: p1.x + inward.x * depth, z: p1.z + inward.z * depth },
  ]);
}

function obstacleRect(obstacle) {
  const cx = finite(obstacle.center?.x);
  const cz = finite(obstacle.center?.z);
  const hw = Math.max(0, finite(obstacle.size?.x)) / 2;
  const hd = Math.max(0, finite(obstacle.size?.z)) / 2;
  const yaw = (finite(obstacle.yaw) * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => ({
    x: cx + u * cos + v * sin,
    z: cz - u * sin + v * cos,
  }));
  return aabb(corners);
}

/**
 * @param {{width:number,length:number}} room planner room size (metres)
 * @param {{floorPolygon?:Array, openings?:Array, obstacles?:Array}} scan world-space scan data
 * @returns {{polygon:Array<{x:number,z:number}>|null, doorZones:Array, windowZones:Array, obstacles:Array}}
 */
export function buildRoomFeatures(room, scan = {}) {
  const empty = { polygon: null, doorZones: [], windowZones: [], obstacles: [] };
  const worldPolygon = Array.isArray(scan.floorPolygon)
    ? scan.floorPolygon.map((p) => ({ x: finite(p?.x), z: finite(p?.z) }))
    : [];
  if (worldPolygon.length < 3) return empty;

  const angle = wallAlignmentAngle(worldPolygon);
  const aligned = worldPolygon.map((p) => rotateXZ(p, angle));
  const minX = Math.min(...aligned.map((p) => p.x));
  const minZ = Math.min(...aligned.map((p) => p.z));
  const toLocal = (p) => {
    const r = rotateXZ(p, angle);
    return { x: r.x - minX, z: r.z - minZ };
  };
  const localPolygon = worldPolygon.map(toLocal);
  // obstacleRect uses Unity yaw (clockwise from above); rotateXZ is counter-clockwise.
  const yawOffsetDeg = (-angle * 180) / Math.PI;
  // Only trust the outline when it matches the room size the planner was given.
  const spanX = Math.max(...localPolygon.map((p) => p.x));
  const spanZ = Math.max(...localPolygon.map((p) => p.z));
  const matchesRoom = Math.abs(spanX - room.width) <= OUTLINE_SIZE_TOLERANCE
    && Math.abs(spanZ - room.length) <= OUTLINE_SIZE_TOLERANCE;
  const polygon = localPolygon;

  const doorZones = [];
  const windowZones = [];
  (Array.isArray(scan.openings) ? scan.openings : []).forEach((opening) => {
    if (opening?.type === 'door') {
      const depth = Math.max(DOOR_MIN_CLEARANCE, finite(opening.width));
      const zone = openingZone(polygon, opening, depth, DOOR_SIDE_MARGIN);
      const clipped = zone && clipToRoom(zone, room);
      if (clipped) doorZones.push({ ...clipped, id: opening.id || `door-${doorZones.length + 1}` });
    } else if (opening?.type === 'window') {
      const zone = openingZone(polygon, opening, WINDOW_ZONE_DEPTH, 0);
      const clipped = zone && clipToRoom(zone, room);
      if (clipped) {
        windowZones.push({
          ...clipped,
          id: opening.id || `window-${windowZones.length + 1}`,
          maxHeight: Math.min(TALL_ITEM_HEIGHT, Math.max(0.3, finite(opening.sillHeight, 0.9))),
        });
      }
    }
  });

  const obstacles = (Array.isArray(scan.obstacles) ? scan.obstacles : [])
    .map((obstacle, index) => {
      const local = {
        ...obstacle,
        center: toLocal({ x: finite(obstacle?.center?.x), z: finite(obstacle?.center?.z) }),
        yaw: finite(obstacle?.yaw) + yawOffsetDeg,
      };
      const rect = clipToRoom(obstacleRect(local), room);
      if (!rect) return null;
      return {
        ...rect,
        id: obstacle.id || `obstacle-${index + 1}`,
        type: String(obstacle.type || 'other'),
        height: Math.max(0, finite(obstacle.size?.y, 0.8)),
      };
    })
    .filter(Boolean);

  return { polygon: matchesRoom ? polygon : null, doorZones, windowZones, obstacles };
}

/**
 * Room size for the planner. A scanned outline wins over the request dimensions,
 * which older app builds took from the world-axis bounding box of a rotated room.
 * @param {{width:number,length:number,height:number}} room
 * @param {{floorPolygon?:Array}} scan
 */
export function resolvePlannerRoom(room, scan = {}) {
  const size = orientedRoomSize(scan.floorPolygon);
  if (!size) return room;
  return { ...room, width: size.width, length: size.length };
}

export default { buildRoomFeatures, resolvePlannerRoom };
