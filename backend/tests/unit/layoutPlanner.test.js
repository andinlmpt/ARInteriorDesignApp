import { planLayouts, classifyFurniture } from '../../src/services/layoutPlanner.js';

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

  it('returns options anchored on different walls', () => {
    const layouts = planLayouts({ width: 5, length: 6, height: 2.7 }, LIVING_ROOM, { count: 3, seed: 3 });
    const walls = new Set(layouts.map((layout) => layout.primaryWall));
    expect(walls.size).toBeGreaterThan(1);
  });
});
