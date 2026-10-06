import type { RoomObstacle, RoomOpening, RoomValidation, RoomWall } from './room-measurement';

export const UNITY_AR_GAME_OBJECT = 'Managers';
export const UNITY_AR_RECEIVE_METHOD = 'ReceiveMessage';

export type UnityToRNEvent =
  | 'unityReady'
  | 'reloadComplete'
  | 'furniturePlaced'
  | 'furnitureReady'
  | 'planeDetected'
  | 'error'
  | 'requestClose'
  // ARDesignScene (Unity: ARSceneBridge.cs)
  | 'scanStatus'
  | 'roomScanConfirmed'
  | 'furnitureRemoved'
  | 'furnitureSelected'
  | 'layoutChanged'
  | 'exportComplete'
  | 'exportStarted'
  | 'photoCaptured'
  | 'historyChanged'
  | 'placementSafety'
  | 'measurementPlanReady'
  | 'measurementPlanClosed'
  | 'requestRnExport3d'
  | 'measuredFurnitureReady'
  | 'layoutAlignment';

export type RNToUnityMethod =
  | 'selectFurniture'
  | 'clearFurniture'
  // ARDesignScene (Unity: ARSceneBridge.cs)
  | 'startRoomScan'
  | 'startFurniturePlacement'
  | 'openRoomMeasurement'
  | 'openFurnitureDesign'
  | 'openMeasuredFurnitureDesign'
  | 'openDesignLayoutInAr'
  | 'getScanStatus'
  | 'confirmRoomScan'
  | 'spawnFurniture'
  | 'applyLayout'
  | 'removeSelectedFurniture'
  | 'replaceSelectedFurniture'
  | 'setFurnitureColor'
  | 'clearScene'
  | 'getCurrentLayout'
  | 'exportLayout'
  | 'undo'
  | 'redo'
  | 'capturePhoto'
  | 'savePhoto'
  | 'commitRoomName'
  | 'cancelRoomName'
  | 'pauseMeasurement'
  | 'reloadMeasurement'
  | 'pauseFurniture'
  | 'reloadFurniture'
  | 'resumeFurniture'
  | 'prefetchFurniture'
  | 'plannerOrbit'
  | 'plannerPointer'
  | 'wakePlanner'
  | 'furnitureGesture'
  | 'beginLayoutAlignment'
  | 'markAlignmentCorner'
  | 'undoAlignmentCorner'
  | 'flipLayoutAlignment'
  | 'setLayoutView';

export interface UnityOutboundMessage {
  event: UnityToRNEvent | string;
  data: string;
}

export interface UnityInboundMessage {
  method: RNToUnityMethod | string;
  data: string;
}

/**
 * Unity's JsonUtility can only serialize flat `{ method, data }` envelopes, so
 * structured payloads travel as a JSON string inside `data`. Parse with
 * `parseUnityPayload` rather than reading `data` directly for these events.
 */
export type StructuredUnityEvent =
  | 'scanStatus'
  | 'roomScanConfirmed'
  | 'furniturePlaced'
  | 'furnitureSelected'
  | 'layoutChanged'
  | 'exportComplete'
  | 'photoCaptured'
  | 'historyChanged'
  | 'error';

export interface HistoryStatePayload {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

export interface UnityVec3 {
  x: number;
  y: number;
  z: number;
}

/** Payload for the `spawnFurniture` method. Dimensions are real-world metres. */
export interface SpawnFurnitureRequest {
  modelId: string;
  /** Remote or local GLB. Requires glTFast in the Unity build; falls back to the catalog prefab. */
  glbUrl?: string;
  /** Id into Unity's built-in FurnitureCatalog, used when `glbUrl` is absent. */
  catalogId?: string;
  width: number;
  height: number;
  depth: number;
  /**
   * When true, Unity places immediately at `position` instead of waiting for a tap.
   * Required because a missing vector and (0,0,0) look the same to JsonUtility.
   */
  hasPosition?: boolean;
  /** World-space floor point in metres (feet of the piece). */
  position?: UnityVec3;
  /** Degrees around Y. Used only when hasPosition is true. */
  rotationY?: number;
  /** Optional "#RRGGBB" tint applied once the piece is placed. */
  colorHex?: string;
}

/** Payload for `setFurnitureColor`. Empty `instanceId` targets the selected piece. */
export interface FurnitureColorRequest {
  instanceId?: string;
  /** "#RRGGBB", or empty to restore the model's own colours. */
  colorHex: string;
}

export type LayoutAlignmentState = 'idle' | 'aligning' | 'aligned';
export type LayoutViewMode = 'real' | 'plan';
export type LayoutAlignmentError = '' | 'noFloor' | 'tooClose' | 'noRoom';

/** `layoutAlignment` event — lining the design layout up with the real room. */
export interface LayoutAlignmentPayload {
  state: LayoutAlignmentState;
  /** Corners marked so far while aligning (0 or 1). */
  step: number;
  floorDetected: boolean;
  /** Distance between the marked corners (live while aiming the second), metres. */
  measuredM: number;
  /** Length of the plan wall it was matched to, metres. */
  planM: number;
  view: LayoutViewMode;
  error: LayoutAlignmentError;
}

/** Payload for the `applyLayout` method — a full design-flow proposal. */
export interface ApplyLayoutRequest {
  clearExisting?: boolean;
  items: SpawnFurnitureRequest[];
}

export type ScanPhase = 'idle' | 'scanning' | 'readyToConfirm' | 'confirmed';

export type ScanHint =
  | 'idle'
  | 'tapFloorHeight'
  | 'extrudeHeight'
  | 'tapFirstCorner'
  | 'tapNextCorner'
  | 'tapThirdCorner'
  | 'tapMoreCorners'
  | 'findFloor'
  | 'moveAround'
  | 'scanWalls'
  | 'keepScanning'
  | 'closeOutline'
  | 'outlineCrosses'
  | 'readyToConfirm'
  | 'confirmed';

/** Payload of the `scanStatus` and `roomScanConfirmed` events. */
export interface ScanStatusPayload {
  phase: ScanPhase;
  /** 0..1 overall coverage estimate. */
  progress: number;
  readyToConfirm: boolean;
  confirmed: boolean;
  planeCount: number;
  horizontalPlaneCount: number;
  verticalPlaneCount: number;
  meshChunkCount: number;
  pointCount: number;
  horizontalAreaSqm: number;
  verticalAreaSqm: number;
  /** 0..1 fraction of the yaw circle the user has swept. */
  lookAroundCoverage: number;
  hint: ScanHint | string;
}

/** Payload of the `roomScanConfirmed` event — includes computed room dimensions. */
export interface RoomConfirmedPayload extends ScanStatusPayload {
  /** Room width in metres (X). */
  width: number;
  /** Room length/depth in metres (Z). */
  depth: number;
  /** Wall height in metres (Y). */
  height: number;
  floorAreaSqm: number;
  wallHeight: number;
  /** e.g. L 4.2m × W 3.1m × H 2.5m */
  dimensionLabel: string;
  boundsMin?: UnityVec3;
  boundsMax?: UnityVec3;
  cornerCount?: number;
  floorPolygon?: { points?: UnityVec3[] };
  /** True when Unity skipped real measurement (synthetic open floor). */
  furniturePlacementOnly?: boolean;
  /** World-space floor height in metres. Older Unity builds omit the room-model fields. */
  floorY?: number;
  perimeterM?: number;
  volumeM3?: number;
  walls?: RoomWall[];
  openings?: RoomOpening[];
  obstacles?: RoomObstacle[];
  validation?: RoomValidation;
}

/** Payload of the `furniturePlaced` event and of each entry in `layoutChanged`. */
export interface PlacedFurniturePayload {
  instanceId: string;
  modelId: string;
  position: UnityVec3;
  /** Degrees around Y. Furniture never tilts. */
  rotationY: number;
  /** Uniform multiplier on the model's real-world size; 1 is true scale. */
  scale: number;
  dimensions: UnityVec3;
  selected: boolean;
  /** "#RRGGBB" tint chosen by the user; empty keeps the model's own colours. */
  colorHex?: string;
  /**
   * True when `sourcePosition` is valid: the pose in the frame sent with `applyLayout`
   * (room-centred metres), with the two-corner wall alignment undone.
   */
  hasSource?: boolean;
  sourcePosition?: UnityVec3;
  sourceRotationY?: number;
}

/** Payload of the `layoutChanged` event. */
export interface LayoutPayload {
  phase: ScanPhase;
  roomConfirmed: boolean;
  roomMeshCount: number;
  count: number;
  furniture: PlacedFurniturePayload[];
}

/** Payload of the `furnitureSelected` event. `selected: false` means nothing is selected. */
export interface SelectionPayload {
  instanceId: string;
  modelId: string;
  selected: boolean;
}

/** Payload of the `placementSafety` event from Unity. */
export interface PlacementSafetyPayload {
  instanceId: string;
  modelId: string;
  isSafe: boolean;
  hasFurnitureCollision: boolean;
  hasWallCollision: boolean;
  isTooCloseToWall: boolean;
  nearestFurnitureDistance: number;
  nearestWallDistance: number;
  reason: string;
}

/**
 * Payload of the `exportComplete` event.
 *
 * `path` is an absolute path inside Unity's persistentDataPath, which on Android
 * resolves to the app's own external files directory. Read it with
 * expo-file-system using a `file://` prefix — the GLB bytes are intentionally
 * never sent across the bridge because a scanned room plus textures is
 * megabytes of base64.
 */
export interface ExportResultPayload {
  success: boolean;
  path: string;
  fileName: string;
  byteLength: number;
  furnitureCount: number;
  roomMeshCount: number;
  error: string;
}

/**
 * Payload of the `photoCaptured` event (AR Furniture save-photo button).
 *
 * `path` is absolute under Unity persistentDataPath — read with `file://` prefix.
 * Bytes are not sent over the bridge (same approach as exportComplete).
 */
export interface ARPhotoCapturedPayload {
  success: boolean;
  path: string;
  fileName: string;
  byteLength: number;
  mimeType: string;
  gallerySaved: boolean;
  error: string;
}

/** Payload of the `error` event. */
export interface UnityErrorPayload {
  code: string;
  message: string;
}

/**
 * Safely reads a structured payload out of a Unity message. Returns null when
 * the event carries a plain string rather than JSON.
 */
export function parseUnityPayload<T>(message: UnityOutboundMessage): T | null {
  if (!message?.data) return null;

  try {
    const parsed = JSON.parse(message.data);
    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null;
  } catch {
    return null;
  }
}
