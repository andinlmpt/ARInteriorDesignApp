export const UNITY_AR_GAME_OBJECT = 'Managers';
export const UNITY_AR_RECEIVE_METHOD = 'ReceiveMessage';

export type UnityToRNEvent =
  | 'unityReady'
  | 'furniturePlaced'
  | 'planeDetected'
  | 'error';

export type RNToUnityMethod =
  | 'selectFurniture'
  | 'clearFurniture';

export interface UnityOutboundMessage {
  event: UnityToRNEvent | string;
  data: string;
}

export interface UnityInboundMessage {
  method: RNToUnityMethod | string;
  data: string;
}
