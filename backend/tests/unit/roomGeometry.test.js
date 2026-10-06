import {
  computeRoomGeometry,
  isSelfIntersecting,
  sanitizeObstacles,
  sanitizeOpenings,
  validatePolygon,
} from '../../src/utils/roomGeometry.js';

const p = (x, z, y = 0.1) => ({ x, y, z });

const RECT_4x3 = [p(0, 0), p(4, 0), p(4, 3), p(0, 3)];
// L-shape: 4x4 square with a 2x2 notch removed — area 12, perimeter 16.
const L_SHAPE = [p(0, 0), p(4, 0), p(4, 2), p(2, 2), p(2, 4), p(0, 4)];
const BOWTIE = [p(0, 0), p(4, 3), p(4, 0), p(0, 3)];

describe('roomGeometry', () => {
  it('computes walls, perimeter, area and volume for a rectangle', () => {
    const g = computeRoomGeometry(RECT_4x3, 2.5);
    expect(g.walls).toHaveLength(4);
    expect(g.walls.map((w) => w.length)).toEqual([4, 3, 4, 3]);
    expect(g.perimeterM).toBe(14);
    expect(g.floorAreaSqm).toBe(12);
    expect(g.volumeM3).toBe(30);
    expect(g.floorY).toBe(0.1);
    expect(g.validation).toEqual({ isValid: true, errors: [] });
  });

  it('handles concave L-shaped rooms', () => {
    const g = computeRoomGeometry(L_SHAPE, 2.4);
    expect(g.floorAreaSqm).toBe(12);
    expect(g.perimeterM).toBe(16);
    expect(g.validation.isValid).toBe(true);
  });

  it('is winding independent', () => {
    const reversed = [...RECT_4x3].reverse();
    expect(computeRoomGeometry(reversed, 2.5).floorAreaSqm).toBe(12);
  });

  it('flags self-intersecting outlines', () => {
    expect(isSelfIntersecting(BOWTIE)).toBe(true);
    expect(isSelfIntersecting(L_SHAPE)).toBe(false);
    expect(validatePolygon(BOWTIE).errors).toContain('selfIntersecting');
  });

  it('flags too few corners and zero area', () => {
    expect(validatePolygon([p(0, 0), p(1, 0)]).errors).toEqual(['tooFewCorners']);
    expect(validatePolygon([p(0, 0), p(1, 0), p(2, 0)]).errors).toContain('zeroArea');
  });

  it('sanitizes openings and drops ones on missing walls', () => {
    const openings = sanitizeOpenings([
      { type: 'door', wallIndex: 1, offsetAlongWall: 0.5, width: 0.9, height: 2.1, swing: 'left' },
      { type: 'window', wallIndex: 9, width: 1.2, height: 1 },
      { type: 'skylight', wallIndex: 0, width: 1 },
    ], 4);
    expect(openings).toHaveLength(1);
    expect(openings[0]).toMatchObject({ type: 'door', wallIndex: 1, swing: 'left', id: 'opening-1' });
  });

  it('sanitizes obstacles and drops empty footprints', () => {
    const obstacles = sanitizeObstacles([
      { type: 'sofa', center: { x: 1, y: 0, z: 1 }, size: { x: 2, y: 0.8, z: 0.9 } },
      { type: 'ghost', size: { x: 0, y: 1, z: 0 } },
    ]);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].type).toBe('sofa');
  });
});
