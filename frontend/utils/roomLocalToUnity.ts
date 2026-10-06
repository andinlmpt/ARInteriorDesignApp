/**
 * Maps design-flow room-local metres onto the reconstructed Unity floor.
 *
 * The planner stores the min-corner of each rotated footprint, with x along
 * room width and z along room length.
 *
 * After leaving Unity, MeasuredRoomHandoff rebuilds an axis-aligned shell
 * centred on the origin from width × depth. Do not reuse the original scan's
 * world-space boundsMin — that origin is gone with the old AR session.
 */

export interface RoomLocalPoint {
  x: number;
  y?: number;
  z: number;
}

export interface RoomSize {
  width: number;
  length: number;
}

export interface FurnitureFootprint {
  width: number;
  depth: number;
}

export interface UnityFloorPose {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export function footprintForRotation(
  size: FurnitureFootprint,
  rotationY: number,
): FurnitureFootprint {
  const quarterTurns = Math.round((Number.isFinite(rotationY) ? rotationY : 0) / 90);
  const rotated = Math.abs(quarterTurns % 2) === 1;
  return rotated
    ? { width: size.depth, depth: size.width }
    : { width: size.width, depth: size.depth };
}

export function roomLocalToUnity(
  local: RoomLocalPoint,
  rotationY: number,
  size: FurnitureFootprint,
  room: RoomSize,
): UnityFloorPose {
  const footprint = footprintForRotation(size, rotationY);
  const safeW = room.width > 0 ? room.width : 1;
  const safeL = room.length > 0 ? room.length : 1;
  return {
    x: (local.x || 0) + footprint.width / 2 - safeW / 2,
    y: 0,
    z: (local.z || 0) + footprint.depth / 2 - safeL / 2,
    rotationY: Number.isFinite(rotationY) ? rotationY : 0,
  };
}

/** Inverse of `roomLocalToUnity`: centred Unity floor point back to the planner's min-corner frame. */
export function unityToRoomLocal(
  pose: { x: number; z: number },
  rotationY: number,
  size: FurnitureFootprint,
  room: RoomSize,
): RoomLocalPoint {
  const footprint = footprintForRotation(size, rotationY);
  const safeW = room.width > 0 ? room.width : 1;
  const safeL = room.length > 0 ? room.length : 1;
  return {
    x: (pose.x || 0) - footprint.width / 2 + safeW / 2,
    y: 0,
    z: (pose.z || 0) - footprint.depth / 2 + safeL / 2,
  };
}

/** Snaps degrees into [0, 360) so planner math sees the same value Unity used. */
export function normalizeYaw(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
