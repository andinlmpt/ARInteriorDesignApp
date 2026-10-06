import { describe, it, expect } from '@jest/globals';
import {
  footprintForRotation,
  normalizeYaw,
  roomLocalToUnity,
  unityToRoomLocal,
} from '@/utils/roomLocalToUnity';

describe('roomLocalToUnity', () => {
  it('places a min-corner item at the room origin onto the centred Unity floor', () => {
    const pose = roomLocalToUnity(
      { x: 0, z: 0 },
      0,
      { width: 1, depth: 0.8 },
      { width: 4, length: 5 },
    );
    expect(pose.x).toBeCloseTo(-1.5);
    expect(pose.z).toBeCloseTo(-2.1);
    expect(pose.y).toBe(0);
    expect(pose.rotationY).toBe(0);
  });

  it('swaps the footprint when the piece is rotated 90 degrees', () => {
    expect(footprintForRotation({ width: 2, depth: 0.9 }, 90)).toEqual({
      width: 0.9,
      depth: 2,
    });
    const pose = roomLocalToUnity(
      { x: 0, z: 0 },
      90,
      { width: 2, depth: 0.9 },
      { width: 4, length: 5 },
    );
    expect(pose.x).toBeCloseTo(-2 + 0.45);
    expect(pose.z).toBeCloseTo(-2.5 + 1);
    expect(pose.rotationY).toBe(90);
  });

  it('round-trips through unityToRoomLocal for a rotated piece', () => {
    const room = { width: 4, length: 5 };
    const size = { width: 2, depth: 0.9 };
    const pose = roomLocalToUnity({ x: 1.2, z: 3.1 }, 270, size, room);
    const local = unityToRoomLocal(pose, 270, size, room);
    expect(local.x).toBeCloseTo(1.2);
    expect(local.z).toBeCloseTo(3.1);
  });

  it('treats a nearly-straight piece as unrotated and wraps negative yaw', () => {
    expect(footprintForRotation({ width: 2, depth: 0.9 }, 3)).toEqual({ width: 2, depth: 0.9 });
    expect(footprintForRotation({ width: 2, depth: 0.9 }, -88)).toEqual({ width: 0.9, depth: 2 });
    expect(normalizeYaw(-90)).toBe(270);
  });
});
