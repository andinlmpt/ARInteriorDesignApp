import { buildRoomFeatures, resolvePlannerRoom } from '../../src/services/roomFeatures.js';
import { planLayouts } from '../../src/services/layoutPlanner.js';

const BEDROOM = [
  { id: 'bed', type: 'bed', name: 'Queen Bed', width: 1.6, length: 2.1, height: 0.5, category: 'bed' },
  { id: 'night', type: 'nightstand', name: 'Nightstand', width: 0.5, length: 0.4, height: 0.55, category: 'table' },
  { id: 'wardrobe', type: 'wardrobe', name: 'Wardrobe', width: 1.8, length: 0.6, height: 2.2, category: 'storage' },
  { id: 'desk', type: 'desk', name: 'Writing Desk', width: 1.2, length: 0.6, height: 0.75, category: 'table' },
  { id: 'chair', type: 'chair', name: 'Desk Chair', width: 0.5, length: 0.5, height: 0.9, category: 'seating' },
];

// 4 m × 3.5 m room scanned around a world origin that is not at the corner.
const OFFSET = { x: -2, z: -1.75 };
const w = (x, z) => ({ x: x + OFFSET.x, y: 0.05, z: z + OFFSET.z });
const RECT_SCAN = [w(0, 0), w(4, 0), w(4, 3.5), w(0, 3.5)];
const ROOM = { width: 4, length: 3.5, height: 2.6 };

function footprint(item) {
  const rotated = item.position.rotation % 180 !== 0;
  return {
    x: item.position.x,
    z: item.position.z,
    w: rotated ? item.dimensions.length : item.dimensions.width,
    d: rotated ? item.dimensions.width : item.dimensions.length,
    height: item.dimensions.height,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w - 0.005 && b.x < a.x + a.w - 0.005 && a.z < b.z + b.d - 0.005 && b.z < a.z + a.d - 0.005;
}

describe('buildRoomFeatures', () => {
  it('maps a door into a clear zone inside the room', () => {
    const features = buildRoomFeatures(ROOM, {
      floorPolygon: RECT_SCAN,
      openings: [{ type: 'door', wallIndex: 0, offsetAlongWall: 1, width: 0.9, height: 2.1 }],
    });
    expect(features.polygon).toHaveLength(4);
    expect(features.doorZones).toHaveLength(1);
    const zone = features.doorZones[0];
    expect(zone.x).toBeCloseTo(0.9);
    expect(zone.w).toBeCloseTo(1.1);
    expect(zone.z).toBeCloseTo(0);
    expect(zone.d).toBeCloseTo(0.9);
  });

  it('works for clockwise outlines too', () => {
    const features = buildRoomFeatures(ROOM, {
      floorPolygon: [...RECT_SCAN].reverse(),
      // Reversed wall 2 runs from (4,0) to (0,0): same physical wall as above.
      openings: [{ type: 'door', wallIndex: 2, offsetAlongWall: 2.1, width: 0.9 }],
    });
    const zone = features.doorZones[0];
    expect(zone.z).toBeCloseTo(0);
    expect(zone.d).toBeCloseTo(0.9);
    expect(zone.x).toBeCloseTo(0.9);
  });

  it('maps windows and existing furniture to room-local rects', () => {
    const features = buildRoomFeatures(ROOM, {
      floorPolygon: RECT_SCAN,
      openings: [{ type: 'window', wallIndex: 1, offsetAlongWall: 1, width: 1.2, height: 1.2, sillHeight: 0.9 }],
      obstacles: [{ type: 'sofa', center: w(1, 2.5), size: { x: 2, y: 0.8, z: 0.9 }, yaw: 0 }],
    });
    expect(features.windowZones[0]).toMatchObject({ maxHeight: 0.9 });
    expect(features.windowZones[0].x).toBeCloseTo(3.5);
    expect(features.windowZones[0].z).toBeCloseTo(1);
    expect(features.obstacles[0]).toMatchObject({ type: 'sofa' });
    expect(features.obstacles[0].x).toBeCloseTo(0);
    expect(features.obstacles[0].w).toBeCloseTo(2);
  });

  it('leaves the request size alone when there is no outline', () => {
    expect(resolvePlannerRoom(ROOM, {})).toBe(ROOM);
  });

  it('drops the outline when it does not match the planner room size', () => {
    const features = buildRoomFeatures({ width: 6, length: 6 }, { floorPolygon: RECT_SCAN });
    expect(features.polygon).toBeNull();
  });
});

describe('layoutPlanner with room features', () => {
  it('keeps doorways and existing furniture clear', () => {
    const features = buildRoomFeatures(ROOM, {
      floorPolygon: RECT_SCAN,
      openings: [{ type: 'door', wallIndex: 0, offsetAlongWall: 1.5, width: 0.9 }],
      obstacles: [{ type: 'armchair', center: w(3.5, 3), size: { x: 0.8, y: 0.9, z: 0.8 }, yaw: 0 }],
    });
    const layouts = planLayouts(ROOM, BEDROOM, { count: 3, seed: 11, features });
    layouts.forEach((layout) => {
      layout.furniture.filter((i) => i.role !== 'rug').map(footprint).forEach((rect) => {
        features.doorZones.forEach((zone) => expect(overlaps(rect, zone)).toBe(false));
        features.obstacles.forEach((ob) => expect(overlaps(rect, ob)).toBe(false));
      });
      expect(layout.roomFeatures.doorCount).toBe(1);
      expect(layout.roomFeatures.obstacleCount).toBe(1);
    });
  });

  it('keeps tall furniture out of window zones and favours a desk by the window', () => {
    const features = buildRoomFeatures(ROOM, {
      floorPolygon: RECT_SCAN,
      openings: [{ type: 'window', wallIndex: 1, offsetAlongWall: 1, width: 1.4, sillHeight: 0.9 }],
    });
    const layouts = planLayouts(ROOM, BEDROOM, { count: 3, seed: 5, features });
    layouts.forEach((layout) => {
      expect(layout.roomFeatures.windowsBlocked).toBe(0);
      const wardrobe = footprint(layout.furniture.find((i) => i.role === 'wardrobe'));
      features.windowZones.forEach((zone) => expect(overlaps(wardrobe, zone)).toBe(false));
    });
    expect(layouts.some((layout) => layout.roomFeatures.deskNearWindow)).toBe(true);
  });

  it('plans a room scanned at an angle to the world axes', () => {
    // Real scan: ~6.0 m × 7.3 m room turned ~38°, saved with its 8.9 × 9.5 world-axis box.
    const rotatedScan = [
      { x: -1.36, y: 0, z: 2.91 },
      { x: -6.06, y: 0, z: -0.89 },
      { x: -1.62, y: 0, z: -6.63 },
      { x: 2.87, y: 0, z: -3.03 },
    ];
    const room = resolvePlannerRoom({ width: 8.93, length: 9.54, height: 2.6 }, { floorPolygon: rotatedScan });
    expect(room.width).toBeGreaterThan(7.2);
    expect(room.width).toBeLessThan(7.8);
    expect(room.length).toBeGreaterThan(5.7);
    expect(room.length).toBeLessThan(6.5);
    expect(room.height).toBe(2.6);

    const features = buildRoomFeatures(room, {
      floorPolygon: rotatedScan,
      obstacles: [{ type: 'sofa', center: { x: -1.6, z: -1.9 }, size: { x: 1, y: 0.8, z: 1 }, yaw: 38 }],
    });
    expect(features.polygon).not.toBeNull();
    expect(features.obstacles).toHaveLength(1);

    const [layout] = planLayouts(room, BEDROOM, { count: 1, seed: 3, features });
    expect(layout.furniture.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps furniture inside an L-shaped room', () => {
    // 4 × 4 room with the top-right 2 × 2 corner cut away.
    const lScan = [w(0, 0), w(4, 0), w(4, 2), w(2, 2), w(2, 4), w(0, 4)];
    const room = { width: 4, length: 4, height: 2.6 };
    const features = buildRoomFeatures(room, { floorPolygon: lScan });
    expect(features.polygon).not.toBeNull();
    const notch = { x: 2, z: 2, w: 2, d: 2 };
    const layouts = planLayouts(room, BEDROOM.slice(0, 3), { count: 3, seed: 9, features });
    layouts.forEach((layout) => {
      layout.furniture.filter((i) => i.role !== 'rug').map(footprint).forEach((rect) => {
        expect(overlaps(rect, notch)).toBe(false);
      });
    });
  });
});
