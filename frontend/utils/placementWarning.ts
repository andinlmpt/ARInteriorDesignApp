import type { PlacementSafetyPayload } from '@/types/unity-bridge';

/**
 * Short user-facing reason a placement is unsafe, naming the other piece when Unity
 * reports one. Returns null when the placement is safe.
 */
export function describePlacementIssue(
  payload: PlacementSafetyPayload,
  nameOf: (modelId: string) => string | undefined,
): string | null {
  if (payload.isSafe) return null;

  const other = payload.otherModelId ? nameOf(payload.otherModelId) : undefined;
  if (payload.isBlocked) return other ? `${other} is in the way` : 'Another piece is in the way';
  if (payload.hasFurnitureCollision) return other ? `Overlaps ${other}` : 'Overlaps another piece';
  if (payload.hasWallCollision) return 'Goes through the wall';
  if (payload.isTooCloseToWall) return 'Too close to the wall';
  return payload.reason || 'Placement needs attention';
}
