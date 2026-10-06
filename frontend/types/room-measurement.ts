/**
 * Saved room measurements from AR scan.
 */

import type { UnityVec3 } from './unity-bridge';

export interface RoomScanMetadata {
  planeCount?: number;
  meshChunkCount?: number;
  horizontalAreaSqm?: number;
  verticalAreaSqm?: number;
  cornerCount?: number;
  source?: string;
}

/** One wall of the floor outline — edge from corner `index` to `index + 1`. */
export interface RoomWall {
  index: number;
  start: UnityVec3;
  end: UnityVec3;
  /** Metres. */
  length: number;
}

export type RoomOpeningType = 'door' | 'window';
export type RoomOpeningSwing = 'left' | 'right' | 'none';

/** Door or window on a wall. Offsets are metres from the wall's start corner. */
export interface RoomOpening {
  id: string;
  type: RoomOpeningType;
  wallIndex: number;
  offsetAlongWall: number;
  width: number;
  height: number;
  sillHeight: number;
  swing: RoomOpeningSwing;
}

/** Existing furniture the user marked in the room. */
export interface RoomObstacle {
  id: string;
  type: string;
  center: UnityVec3;
  /** Metres: x = width, y = height, z = depth. */
  size: UnityVec3;
  /** Degrees around Y. */
  yaw: number;
}

export type RoomValidationError = 'tooFewCorners' | 'selfIntersecting' | 'zeroArea';

export interface RoomValidation {
  isValid: boolean;
  errors: (RoomValidationError | string)[];
}

export interface RoomMeasurementRecord {
  id: string;
  userId?: string;
  projectId?: string;
  name: string;
  /** Metres — room width (X). */
  width: number;
  /** Metres — room length/depth (Z). */
  depth: number;
  /** Metres — wall height (Y). */
  height: number;
  floorAreaSqm: number;
  wallHeight: number;
  dimensionLabel: string;
  boundsMin?: UnityVec3 | null;
  boundsMax?: UnityVec3 | null;
  floorPolygon?: UnityVec3[];
  floorY?: number;
  perimeterM?: number;
  volumeM3?: number;
  walls?: RoomWall[];
  openings?: RoomOpening[];
  obstacles?: RoomObstacle[];
  validation?: RoomValidation;
  scanMetadata?: RoomScanMetadata;
  confirmedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Device-local .glb path from Unity Export 3D (linked for preview). */
  exportPath?: string;
  exportFileName?: string;
  exportByteLength?: number;
  exportFurnitureCount?: number;
  exportedAt?: string | null;
}

/** PATCH body — rename and/or attach a Unity layout export. */
export interface UpdateRoomMeasurementInput {
  name?: string;
  projectId?: string;
  exportPath?: string;
  exportFileName?: string;
  exportByteLength?: number;
  exportFurnitureCount?: number;
  exportedAt?: string;
}

export interface SaveRoomMeasurementInput {
  projectId?: string;
  name?: string;
  width: number;
  depth: number;
  height: number;
  floorAreaSqm?: number;
  wallHeight?: number;
  dimensionLabel?: string;
  boundsMin?: UnityVec3;
  boundsMax?: UnityVec3;
  floorPolygon?: UnityVec3[];
  openings?: RoomOpening[];
  obstacles?: RoomObstacle[];
  scanMetadata?: RoomScanMetadata;
  confirmedAt?: string;
}

export interface RoomMeasurementListResponse {
  success: boolean;
  count: number;
  measurements: RoomMeasurementRecord[];
}

export interface RoomMeasurementResponse {
  success: boolean;
  measurement: RoomMeasurementRecord;
}
