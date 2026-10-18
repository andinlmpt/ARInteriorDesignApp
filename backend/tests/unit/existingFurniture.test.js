import { buildRoomFeatures } from '../../src/services/roomFeatures.js';
import { describeRoomFeatures, planLayouts } from '../../src/services/layoutPlanner.js';
import { selectCatalogFurnitureSet } from '../../src/services/catalogLayoutSelector.js';
import { optimizeLayout } from '../../src/services/layoutOptimizer.js';

// 4 m × 3.5 m room; the scan's world frame already matches the room frame.
const ROOM = { width: 4, length: 3.5, height: 2.6 };
const OUTLINE = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3.5 }, { x: 0, z: 3.5 }];

const scanned = (obstacles, openings = []) => buildRoomFeatures(ROOM, { floorPolygon: OUTLINE, openings, obstacles });
const obstacle = (id, type, label, center, size) => ({ id, type, label, center: { ...center, y: 0 }, size, yaw: 0 });

function rectOf(item) {
  const rotated = item.position.rotation % 180 !== 0;
  return {
    x: item.position.x,
    z: item.position.z,
    w: rotated ? item.length : item.width,
    d: rotated ? item.width : item.length,
  };
}

function gap(a, b) {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dz = Math.max(0, b.z - (a.z + a.d), a.z - (b.z + b.d));
  return Math.hypot(dx, dz);
}

function overlaps(a, b) {
  return a.x < b.x + b.w - 0.005 && b.x < a.x + a.w - 0.005 && a.z < b.z + b.d - 0.005 && b.z < a.z + a.d - 0.005;
}

// Sofa against the south wall (z = 3.5), seen by the detector as a "Couch".
const SOFA_SCAN = scanned(
  [obstacle('auto-obstacle-1', 'sofa', 'Couch', { x: 2, z: 3 }, { x: 2, y: 0.85, z: 0.9 })],
  [{ id: 'auto-door', type: 'door', wallIndex: 0, offsetAlongWall: 0.3, width: 0.9, height: 2.1 }],
);
const SOFA_RECT = SOFA_SCAN.obstacles[0];

const LIVING = [
  { id: 'ct', name: 'Coffee table', category: 'table', width: 1, length: 0.55, height: 0.45 },
  { id: 'tv', name: 'TV stand', category: 'storage', width: 1.6, length: 0.4, height: 0.5 },
  { id: 'lamp', name: 'Floor lamp', category: 'lighting', width: 0.4, length: 0.4, height: 1.6 },
];

describe('scan furniture roles', () => {
  it('uses the detector label for the role, and keeps where openings sit on the wall', () => {
    const features = scanned(
      [
        obstacle('a', 'table', 'Coffee table', { x: 2, z: 2 }, { x: 1, y: 0.45, z: 0.6 }),
        obstacle('b', 'other', 'Television', { x: 2, z: 0.3 }, { x: 1.2, y: 0.6, z: 0.4 }),
        obstacle('c', 'table', 'Kitchen & dining room table', { x: 1, z: 1.5 }, { x: 1.2, y: 0.75, z: 0.8 }),
        obstacle('d', 'sofa', '', { x: 2, z: 3 }, { x: 2, y: 0.85, z: 0.9 }),
      ],
      [{ id: 'w', type: 'window', wallIndex: 0, offsetAlongWall: 1, width: 1.2, sillHeight: 0.9 }],
    );
    expect(features.obstacles.map((o) => o.role)).toEqual(['coffee-table', 'tv-stand', 'dining-table', 'sofa']);
    expect(features.windowZones[0].span).toEqual({ x1: 1, z1: 0, x2: 2.2, z2: 0 });
  });
});

describe('catalog pick with furniture already in the room', () => {
  const pool = [
    { catalogId: 'sofa-a', name: 'Chad Sofa', category: 'sofa', pricePhp: 30000 },
    { catalogId: 'sofa-b', name: 'Bahamas Sofa', category: 'sofa', pricePhp: 32000 },
    { catalogId: 'ct', name: 'Coffee table', category: 'table', pricePhp: 8000 },
    { catalogId: 'tv', name: 'TV stand', category: 'storage', pricePhp: 9000 },
    { catalogId: 'dt', name: 'Dining table', category: 'table', pricePhp: 15000 },
    { catalogId: 'dc', name: 'Dining chair', category: 'seating', pricePhp: 2000 },
  ].map((item) => ({ ...item, id: item.catalogId, styles: [] }));
  const names = (set) => set.furniture.map((item) => item.name);

  it('adds no sofa when the room has one, not even as an extra', () => {
    const set = selectCatalogFurnitureSet(pool, { roomType: 'Living Room', existingRoles: ['sofa'] });
    expect(names(set)).not.toContain('Chad Sofa');
    expect(names(set)).not.toContain('Bahamas Sofa');
    expect(names(set)).toContain('Coffee table');
    expect(names(set)).toContain('TV stand');
  });

  it('still picks a sofa for an empty room', () => {
    const set = selectCatalogFurnitureSet(pool, { roomType: 'Living Room' });
    expect(names(set)).toContain('Chad Sofa');
  });

  it('treats a scanned table as the dining table and still adds chairs', () => {
    const set = selectCatalogFurnitureSet(pool, { roomType: 'Dining Room', existingRoles: ['table'] });
    expect(names(set)).not.toContain('Dining table');
    expect(names(set)).toContain('Dining chair');
  });
});

describe('layouts around existing furniture', () => {
  const plan = (furniture, features, seed = 7) => planLayouts(ROOM, furniture, { count: 1, seed, features })[0];

  it('sets the coffee table and TV with your sofa instead of beside a new one', () => {
    for (const seed of [1, 2, 3]) {
      const layout = plan(LIVING, SOFA_SCAN, seed);
      const byRole = Object.fromEntries(layout.furniture.map((item) => [item.role, item]));
      const coffee = rectOf(byRole['coffee-table']);
      expect(gap(coffee, SOFA_RECT)).toBeGreaterThanOrEqual(0.3);
      expect(gap(coffee, SOFA_RECT)).toBeLessThanOrEqual(0.7);
      // Sofa faces -z (its back is on the south wall), so the TV is on the north side facing it.
      expect(byRole['tv-stand'].position.rotation).toBe(0);
      expect(rectOf(byRole['tv-stand']).z).toBeLessThan(0.2);
      layout.furniture.forEach((item) => expect(overlaps(rectOf(item), SOFA_RECT)).toBe(false));
      // Nothing but the coffee table in the walkway in front of the sofa.
      const front = { x: SOFA_RECT.x, z: SOFA_RECT.z - 0.6, w: SOFA_RECT.w, d: 0.6 };
      layout.furniture
        .filter((item) => item.role !== 'coffee-table')
        .forEach((item) => expect(overlaps(rectOf(item), front)).toBe(false));
      expect(layout.pros).toEqual(expect.arrayContaining([
        'Coffee table placed in front of your sofa',
        'TV faces your sofa',
      ]));
    }
  });

  it('puts nightstands beside your bed', () => {
    // Bed with its head on the north wall (z = 0).
    const features = scanned([obstacle('bed', 'bed', 'Bed', { x: 2, z: 1.1 }, { x: 1.6, y: 0.5, z: 2.1 })]);
    const layout = plan([
      { id: 'n1', name: 'Nightstand', category: 'table', width: 0.5, length: 0.4, height: 0.55 },
      { id: 'n2', name: 'Nightstand', category: 'table', width: 0.5, length: 0.4, height: 0.55 },
    ], features);
    const bed = features.obstacles[0];
    const stands = layout.furniture.filter((item) => item.role === 'nightstand').map(rectOf);
    expect(stands).toHaveLength(2);
    stands.forEach((stand) => {
      expect(gap(stand, bed)).toBeLessThanOrEqual(0.15);
      expect(stand.z).toBeLessThan(0.2);
    });
    expect(layout.pros).toContain('Nightstand beside your bed');
  });

  it('pulls a chair up to your desk', () => {
    const features = scanned([obstacle('desk', 'desk', 'Desk', { x: 3.4, z: 1.5 }, { x: 0.6, y: 0.75, z: 1.2 })]);
    const layout = plan([{ id: 'c', name: 'Desk chair', category: 'seating', width: 0.5, length: 0.5, height: 0.9 }], features);
    const chair = rectOf(layout.furniture[0]);
    expect(gap(chair, features.obstacles[0])).toBeLessThanOrEqual(0.2);
    expect(layout.pros).toContain('Chair pulled up to your desk');
  });

  it('sets four dining chairs around your table', () => {
    const features = scanned([obstacle('t', 'table', 'Dining table', { x: 2, z: 1.75 }, { x: 1.4, y: 0.75, z: 0.9 })]);
    const layout = plan([{ id: 'dc', name: 'Dining chair', category: 'seating', width: 0.45, length: 0.5, height: 0.9 }], features);
    const chairs = layout.furniture.filter((item) => item.role === 'dining-chair').map(rectOf);
    expect(chairs).toHaveLength(4);
    chairs.forEach((chair) => expect(gap(chair, features.obstacles[0])).toBeLessThanOrEqual(0.2));
  });
});

describe('optimizer with fixed furniture', () => {
  it('never moves or overlaps the existing piece', () => {
    const existing = [{
      id: 'sofa', role: 'sofa', name: 'your sofa', width: 2, length: 0.9, height: 0.85,
      groupKey: 'existing-sofa', pose: { x: 1, z: 2.55, rot: 180 },
    }];
    const sofaRect = { x: 1, z: 2.55, w: 2, d: 0.9, id: 'sofa' };
    const result = optimizeLayout({
      room: ROOM,
      features: { obstacles: [sofaRect], existing },
      items: [{ id: 'ct', role: 'coffee-table', name: 'Coffee table', width: 1, length: 0.55, height: 0.45, groupKey: 'existing-sofa' }],
      poses: [{ x: 0.2, z: 0.2, rot: 0 }],
      rng: (() => {
        let a = 42;
        return () => ((a = (a * 16807) % 2147483647) / 2147483647);
      })(),
      iterations: 1500,
    });
    expect(result.poses).toHaveLength(1);
    const pose = result.poses[0];
    const rect = { x: pose.x, z: pose.z, w: pose.rot % 180 === 0 ? 1 : 0.55, d: pose.rot % 180 === 0 ? 0.55 : 1 };
    expect(overlaps(rect, sofaRect)).toBe(false);
    // Pulled from the far corner to the middle of the sofa's front (the sofa faces -z).
    expect(result.after.checks).toContainEqual({ rule: 'Coffee table at your sofa', passed: true });
    expect(Math.abs(rect.x + rect.w / 2 - 2)).toBeLessThan(0.25);
    expect(rect.z + rect.d).toBeLessThanOrEqual(sofaRect.z);
  });
});

describe('describeRoomFeatures', () => {
  it('lists existing furniture with the way it faces, and the door on its wall', () => {
    const scan = describeRoomFeatures(ROOM, SOFA_SCAN);
    expect(scan.existingFurniture).toEqual([expect.objectContaining({
      id: 'auto-obstacle-1',
      role: 'sofa',
      label: 'Couch',
      width: 2,
      length: 0.9,
      position: { x: 1, y: 0, z: 2.55, rotation: 180 },
    })]);
    expect(scan.doors).toEqual([{ id: 'auto-door', x1: 0.3, z1: 0, x2: 1.2, z2: 0 }]);
    expect(scan.windows).toEqual([]);
  });
});
