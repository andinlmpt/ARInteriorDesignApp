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
  scanMetadata?: RoomScanMetadata;
  confirmedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
