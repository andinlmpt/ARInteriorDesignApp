import { planLayouts, classifyFurniture, checkRoomFit } from '../../src/services/layoutPlanner.js';

const LIVING_ROOM = [
  { id: 'sofa', type: 'sofa', name: '3-Seater Sofa', width: 2.2, length: 0.9, height: 0.85, category: 'seating' },
  { id: 'armchair', type: 'armchair', name: 'Accent Armchair', width: 0.8, length: 0.8, height: 0.9, category: 'seating' },
  { id: 'coffee', type: 'coffee-table', name: 'Coffee Table', width: 1.2, length: 0.6, height: 0.45, category: 'table' },
  { id: 'tv', type: 'tv-stand', name: 'TV Console', width: 1.8, length: 0.45, height: 0.5, category: 'storage' },
  { id: 'shelf', type: 'bookshelf', name: 'Bookshelf', width: 1.0, length: 0.35, height: 1.8, category: 'storage' },
  { id: 'lamp', type: 'floor-lamp', name: 'Floor Lamp', width: 0.4, length: 0.4, height: 1.7, category: 'lighting' },
  { id: 'rug', type: 'rug', name: 'Area Rug', width: 2.5, length: 3.5, height: 0.02, category: 'decor' },
];

const BEDROOM = [
  { id: 'bed', type: 'bed', name: 'Queen Bed', width: 1.6, length: 2.1, height: 0.5, category: 'bed' },
  { id: 'night', type: 'nightstand', name: 'Nightstand', width: 0.5, length: 0.4, height: 0.55, category: 'table' },
  { id: 'dresser', type: 'dresser', name: 'Dresser', width: 1.4, length: 0.5, height: 0.8, category: 'storage' },
  { id: 'wardrobe', type: 'wardrobe', name: 'Wardrobe', width: 1.8, length: 0.6, height: 2.2, category: 'storage' },
  { id: 'desk', type: 'desk', name: 'Writing Desk', width: 1.2, length: 0.6, height: 0.75, category: 'table' },
  { id: 'chair', type: 'chair', name: 'Desk Chair', width: 0.5, length: 0.5, height: 0.9, category: 'seating' },
];

function footprint(item) {
  const rotated = item.position.rotation % 180 !== 0;
  return {
    x: item.position.x,
    z: item.position.z,
    w: rotated ? item.dimensions.length : item.dimensions.width,
    d: rotated ? item.dimensions.width : item.dimensions.length,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w - 0.005 && b.x < a.x + a.w - 0.005 && a.z < b.z + b.d - 0.005 && b.z < a.z + a.d - 0.005;
}

describe('layoutPlanner', () => {
  it('classifies common furniture names', () => {
    expect(classifyFurniture({ name: 'Desk Chair' })).toBe('desk-chair');
    expect(classifyFurniture({ name: 'France Sofa bed' })).toBe('sofa');
    expect(classifyFurniture({ name: 'TV Console', category: 'storage' })).toBe('tv-stand');
    expect(classifyFurniture({ name: 'Nightstand', category: 'table' })).toBe('nightstand');
  });

  it.each([
    ['living room', LIVING_ROOM, { width: 4, length: 5, height: 2.7 }],
    ['large living room', LIVING_ROOM, { width: 9.16, length: 10.12, height: 2.66 }],
    ['bedroom', BEDROOM, { width: 3.5, length: 4, height: 2.6 }],
  ])('keeps a %s inside the room without overlaps', (_label, furniture, room) => {
    const layouts = planLayouts(room, furniture, { count: 3, seed: 42 });
    expect(layouts).toHaveLength(3);
    layouts.forEach((layout) => {
      const solid = layout.furniture.filter((item) => item.role !== 'rug').map(footprint);
      solid.forEach((rect) => {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.z).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w).toBeLessThanOrEqual(room.width + 0.001);
        expect(rect.z + rect.d).toBeLessThanOrEqual(room.length + 0.001);
      });
      for (let i = 0; i < solid.length; i += 1) {
        for (let j = i + 1; j < solid.length; j += 1) {
          expect(overlaps(solid[i], solid[j])).toBe(false);
        }
      }
      expect(layout.score.fit).toBe(100);
    });
  });

  it('puts the bed against a wall with the nightstand beside it', () => {
    const room = { width: 3.5, length: 4, height: 2.6 };
    const [layout] = planLayouts(room, BEDROOM, { count: 1, seed: 7 });
    const bed = footprint(layout.furniture.find((item) => item.role === 'bed'));
    const night = footprint(layout.furniture.find((item) => item.role === 'nightstand'));
    const touchesWall = bed.x <= 0.1 || bed.z <= 0.1 || bed.x + bed.w >= room.width - 0.1 || bed.z + bed.d >= room.length - 0.1;
    expect(touchesWall).toBe(true);
    const gapX = Math.max(0, night.x - (bed.x + bed.w), bed.x - (night.x + night.w));
    const gapZ = Math.max(0, night.z - (bed.z + bed.d), bed.z - (night.z + night.d));
    expect(Math.hypot(gapX, gapZ)).toBeLessThanOrEqual(0.15);
  });

  it('still places the sofa when its armchair does not fit beside it', () => {
    // A small room and an armchair as big as a love seat: together they fit nowhere.
    const room = { width: 3.2, length: 1.7, height: 2.4 };
    const furniture = [
      { id: 'loveseat', type: 'sofa', name: 'Love Seat', width: 1.78, length: 0.54, height: 0.56, category: 'sofa' },
      { id: 'armchair', type: 'armchair', name: 'Big Accent Chair', width: 1.37, length: 1.52, height: 1.32, category: 'chair' },
    ];
    const [layout] = planLayouts(room, furniture, { count: 1, seed: 3 });
    const names = layout.furniture.map((item) => item.name);
    expect(names).toContain('Love Seat');
    const solid = layout.furniture.map(footprint);
    for (let i = 0; i < solid.length; i += 1) {
      const s = solid[i];
      expect(s.x).toBeGreaterThanOrEqual(-0.001);
      expect(s.z).toBeGreaterThanOrEqual(-0.001);
      expect(s.x + s.w).toBeLessThanOrEqual(room.width + 0.001);
      expect(s.z + s.d).toBeLessThanOrEqual(room.length + 0.001);
      for (let j = i + 1; j < solid.length; j += 1) expect(overlaps(s, solid[j])).toBe(false);
    }
  });

  it('returns options anchored on different walls', () => {
    const layouts = planLayouts({ width: 5, length: 6, height: 2.7 }, LIVING_ROOM, { count: 3, seed: 3 });
    const walls = new Set(layouts.map((layout) => layout.primaryWall));
    expect(walls.size).toBeGreaterThan(1);
  });
});

describe('checkRoomFit', () => {
  const sofa = { name: '3-Seater Sofa', type: 'sofa', width: 2.2, length: 0.9, height: 0.85 };

  it('fits a sofa in an empty room, turned to fit the short side if needed', () => {
    expect(checkRoomFit({ width: 3, length: 3, height: 2.5 }, sofa)).toEqual({ fits: true, reason: null });
    expect(checkRoomFit({ width: 1.2, length: 3, height: 2.5 }, sofa).fits).toBe(true);
  });

  it('leaves out a piece bigger than the room, or taller than the ceiling', () => {
    expect(checkRoomFit({ width: 2, length: 2, height: 2.5 }, sofa)).toEqual({ fits: false, reason: 'too-big' });
    const wardrobe = { name: 'Wardrobe', width: 1.2, length: 0.6, height: 2.4 };
    expect(checkRoomFit({ width: 4, length: 4, height: 2.3 }, wardrobe)).toEqual({ fits: false, reason: 'too-tall' });
  });

  it('leaves out a piece the existing furniture leaves no space for', () => {
    // A 3 × 3 m room with tables along both sides: a 0.8 m wide strip stays free in the middle.
    const room = { width: 3, length: 3, height: 2.5 };
    const features = {
      obstacles: [
        { id: 'desk-a', type: 'table', x: 0, z: 0, w: 1.1, d: 3 },
        { id: 'desk-b', type: 'table', x: 1.9, z: 0, w: 1.1, d: 3 },
      ],
    };
    expect(checkRoomFit(room, sofa, features)).toEqual({ fits: false, reason: 'no-space' });
    // Exactly as wide as the strip: found by trying the spot right against the table.
    const chair = { name: 'Accent Chair', width: 0.8, length: 0.8, height: 0.9 };
    expect(checkRoomFit(room, chair, features).fits).toBe(true);
  });

  it('keeps a door clear', () => {
    const room = { width: 2.5, length: 1.5, height: 2.5 };
    expect(checkRoomFit(room, sofa).fits).toBe(true);
    const features = { doorZones: [{ id: 'door', x: 1, z: 0, w: 0.9, d: 0.9 }] };
    expect(checkRoomFit(room, sofa, features)).toEqual({ fits: false, reason: 'no-space' });
  });

  it('follows an L-shaped outline, not its bounding box', () => {
    // 4 × 4 m with the 2.5 × 2.5 m corner cut away: the arms are 1.5 m wide.
    const room = { width: 4, length: 4, height: 2.5 };
    const polygon = [
      { x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 1.5 }, { x: 1.5, z: 1.5 }, { x: 1.5, z: 4 }, { x: 0, z: 4 },
    ];
    const bed = { name: 'Queen Bed', width: 1.6, length: 2.1, height: 0.5 };
    expect(checkRoomFit(room, bed)).toEqual({ fits: true, reason: null });
    expect(checkRoomFit(room, bed, { polygon })).toEqual({ fits: false, reason: 'too-big' });
    expect(checkRoomFit(room, sofa, { polygon }).fits).toBe(true);
  });

  it('always lets a rug through (the planner trims it to the room)', () => {
    const rug = { name: 'Area Rug', type: 'rug', width: 3, length: 4, height: 0.02 };
    expect(checkRoomFit({ width: 2, length: 2, height: 2.5 }, rug).fits).toBe(true);
  });
});
