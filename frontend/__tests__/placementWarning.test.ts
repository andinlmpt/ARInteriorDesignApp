import { describe, it, expect } from '@jest/globals';
import { describePlacementIssue } from '@/utils/placementWarning';
import type { PlacementSafetyPayload } from '@/types/unity-bridge';

const safe: PlacementSafetyPayload = {
  instanceId: 'fur-1',
  modelId: 'bed',
  isSafe: true,
  hasFurnitureCollision: false,
  hasWallCollision: false,
  isTooCloseToWall: false,
  nearestFurnitureDistance: -1,
  nearestWallDistance: -1,
  reason: '',
};

const names: Record<string, string> = { 'abu-dhabi-sofa': 'Abu Dhabi Sofa' };
const nameOf = (id: string) => names[id];

describe('describePlacementIssue', () => {
  it('returns null for a safe placement', () => {
    expect(describePlacementIssue(safe, nameOf)).toBeNull();
  });

  it('names the piece blocking a drag', () => {
    const payload = { ...safe, isSafe: false, isBlocked: true, otherModelId: 'abu-dhabi-sofa' };
    expect(describePlacementIssue(payload, nameOf)).toBe('Abu Dhabi Sofa is in the way');
  });

  it('prefers blocked over overlap and falls back when the other piece is unknown', () => {
    const payload = {
      ...safe,
      isSafe: false,
      isBlocked: true,
      hasFurnitureCollision: true,
      otherModelId: 'not-in-catalog',
    };
    expect(describePlacementIssue(payload, nameOf)).toBe('Another piece is in the way');
  });

  it('names the overlapped piece', () => {
    const payload = { ...safe, isSafe: false, hasFurnitureCollision: true, otherModelId: 'abu-dhabi-sofa' };
    expect(describePlacementIssue(payload, nameOf)).toBe('Overlaps Abu Dhabi Sofa');
  });

  it('describes wall problems', () => {
    expect(describePlacementIssue({ ...safe, isSafe: false, hasWallCollision: true }, nameOf))
      .toBe('Goes through the wall');
    expect(describePlacementIssue({ ...safe, isSafe: false, isTooCloseToWall: true }, nameOf))
      .toBe('Too close to the wall');
  });

  it('falls back to the reason from Unity', () => {
    expect(describePlacementIssue({ ...safe, isSafe: false, reason: 'Custom' }, nameOf)).toBe('Custom');
  });
});
