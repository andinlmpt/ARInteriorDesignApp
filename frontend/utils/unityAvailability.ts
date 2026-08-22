import { Platform, UIManager } from 'react-native';

const UNITY_VIEW_NAME = 'RNUnityView';

/**
 * True when the native RNUnityView manager is registered in this binary.
 * Mounting UnityView without it crashes Fabric with IllegalViewOperationException.
 */
export function isUnityViewAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  try {
    const uiManager = UIManager as typeof UIManager & {
      getViewManagerConfig?: (name: string) => unknown;
      hasViewManagerConfig?: (name: string) => boolean;
    };

    if (typeof uiManager.hasViewManagerConfig === 'function') {
      return uiManager.hasViewManagerConfig(UNITY_VIEW_NAME);
    }

    if (typeof uiManager.getViewManagerConfig === 'function') {
      return uiManager.getViewManagerConfig(UNITY_VIEW_NAME) != null;
    }

    // Legacy bridge: missing config throws or returns undefined.
    // @ts-expect-error - older RN typed UIManager index access
    return uiManager[UNITY_VIEW_NAME] != null;
  } catch {
    return false;
  }
}
