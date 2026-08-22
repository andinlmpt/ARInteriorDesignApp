export const UNITY_AR_GAME_OBJECT = 'Managers';
export const UNITY_AR_RECEIVE_METHOD = 'ReceiveMessage';

export type UnityToRNEvent =
  | 'unityReady'
  | 'furniturePlaced'
  | 'planeDetected'
  | 'error'
  // ARDesignScene (Unity: ARSceneBridge.cs)
  | 'scanStatus'
  | 'roomScanConfirmed'
  | 'furnitureRemoved'
  | 'furnitureSelected'
  | 'layoutChanged'
  | 'exportComplete'
  | 'historyChanged';

export type RNToUnityMethod =
  | 'selectFurniture'
  | 'clearFurniture'
  // ARDesignScene (Unity: ARSceneBridge.cs)
  | 'startRoomScan'
  | 'getScanStatus'
  | 'confirmRoomScan'
  | 'spawnFurniture'
  | 'removeSelectedFurniture'
  | 'clearScene'
  | 'getCurrentLayout'
  | 'exportLayout'
  | 'undo'
  | 'redo';

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
}

export type ScanPhase = 'idle' | 'scanning' | 'readyToConfirm' | 'confirmed';

export type ScanHint =
  | 'idle'
  | 'findFloor'
  | 'moveAround'
  | 'scanWalls'
  | 'keepScanning'
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
