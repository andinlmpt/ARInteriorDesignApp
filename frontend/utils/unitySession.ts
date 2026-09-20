/**
 * Tracks whether the native Unity player has been started in this process.
 * Used to skip the first-mount delay on AR reopen (UaaL survives when we pause
 * instead of destroy).
 */

let unityPlayerWarm = false;

export function markUnityPlayerWarm(): void {
  unityPlayerWarm = true;
}

export function isUnityPlayerWarm(): boolean {
  return unityPlayerWarm;
}
