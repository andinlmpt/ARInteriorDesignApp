/**
 * Unity AR embed in React Native is disabled while ARDesignScene is developed
 * in Unity Build & Run. Set EXPO_PUBLIC_UNITY_AR_ENABLED=true when ready to
 * export unityLibrary and embed the scene in the dev client.
 */
export const UNITY_AR_EMBED_ENABLED =
  process.env.EXPO_PUBLIC_UNITY_AR_ENABLED === 'true';
