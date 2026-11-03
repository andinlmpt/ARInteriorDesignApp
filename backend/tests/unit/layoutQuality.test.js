/**
 * Layout quality the adviser asked for (2026-10-28, "the generated layout is not the best"):
 * the coffee table in front of the sofa, armchairs facing the seating, nothing standing in front of
 * the sofa, the TV kept in a small room, the main piece centred on a free wall, options that differ,
 * and a fit check that matches where the planner can put a piece.
 */
import { checkRoomFit, planLayouts, planOptions, sameArrangement } from '../../src/services/layoutPlanner.js';
import { buildRoomFeatures, resolvePlannerRoom } from '../../src/services/roomFeatures.js';

const LIVING = [
  { id: 'sofa', type: 'sofa', name: '3-Seater Sofa', width: 2.2, length: 0.9, height: 0.85 },
  { id: 'armchair', type: 'armchair', name: 'Accent Armchair', width: 0.8, length: 0.8, height: 0.9 },
  { id: 'coffee', type: 'coffee-table', name: 'Coffee Table', width: 1.2, length: 0.6, height: 0.45 },
  { id: 'side', type: 'side-table', name: 'Side Table', width: 0.5, length: 0.5, height: 0.55 },
  { id: 'tv', type: 'tv-stand', name: 'TV Console', width: 1.8, length: 0.45, height: 0.5 },
  { id: 'shelf', type: 'bookshelf', name: 'Bookshelf', width: 1.0, length: 0.35, height: 1.8 },
  { id: 'lamp', type: 'floor-lamp', name: 'Floor Lamp', width: 0.4, length: 0.4, height: 1.7 },
  { id: 'rug', type: 'rug', name: 'Area Rug', width: 2.0, length: 3.0, height: 0.02 },
];

const rect = (w, d) => [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: d }, { x: 0, z: d }];
const door = (wallIndex, offsetAlongWall) => ({ type: 'door', wallIndex, offsetAlongWall, width: 0.9, height: 2.1, sillHeight: 0 });
const win = (wallIndex, offsetAlongWall) => ({ type: 'window', wallIndex, offsetAlongWall, width: 1.2, height: 1.2, sillHeight: 0.9 });

function scanned(width, length, openings, obstacles = []) {
  const scan = { floorPolygon: rect(width, length), openings, obstacles };
  const room = resolvePlannerRoom({ width, length, height: 2.7 }, scan);
  return { room, features: buildRoomFeatures(room, scan) };
}

const FRONT = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] };

function placed(item) {
  const turned = item.position.rotation % 180 !== 0;
  const w = turned ? item.length : item.width;
  const d = turned ? item.width : item.length;
  return { x: item.position.x, z: item.position.z, w, d, rot: item.position.rotation, cx: item.position.x + w / 2, cz: item.position.z + d / 2 };
}

/** Where `p` is from the piece's centre: ahead (the way it faces) and across. */
function relative(piece, p) {
  const [fx, fz] = FRONT[piece.rot];
  const dx = p.x - piece.cx;
  const dz = p.z - piece.cz;
  return { ahead: dx * fx + dz * fz, side: Math.abs(dx * fz - dz * fx) };
}

const find = (layout, role) => layout.furniture.filter((i) => i.role === role).map(placed);

function expectCoffeeInFront(layout) {
  const [sofa] = find(layout, 'sofa');
  const [table] = find(layout, 'coffee-table');
  const { ahead, side } = relative(sofa, { x: table.cx, z: table.cz });
  const sofaDepth = sofa.rot % 180 === 0 ? sofa.d : sofa.w;
  const sofaWidth = sofa.rot % 180 === 0 ? sofa.w : sofa.d;
  const tableDepth = sofa.rot % 180 === 0 ? table.d : table.w;
  const gap = ahead - sofaDepth / 2 - tableDepth / 2;
  expect(gap).toBeGreaterThanOrEqual(0.25);
  expect(gap).toBeLessThanOrEqual(0.75);
  expect(side).toBeLessThanOrEqual(sofaWidth * 0.25);
  expect(table.rot % 180).toBe(sofa.rot % 180);
}

describe('layout quality', () => {
  const living45 = scanned(4, 5, [door(0, 0.3), win(2, 1.4)]);
  const small = scanned(3, 3.5, [door(3, 0.2), win(1, 1.0)]);

  it('sets the coffee table in front of the sofa, parallel and centred', () => {
    [living45, small].forEach(({ room, features }) => {
      const [layout] = planOptions(room, [LIVING], { features, seed: 20261029 });
      expectCoffeeInFront(layout.plan);
    });
  });

  it('keeps the TV in a small living room', () => {
    const [layout] = planOptions(small.room, [LIVING], { features: small.features, seed: 20261029 });
    expect(layout.plan.dropped).not.toContain('TV Console');
    expect(find(layout.plan, 'tv-stand')).toHaveLength(1);
  });

  it('turns the armchair towards the seating', () => {
    [living45, small].forEach(({ room, features }) => {
      planOptions(room, [LIVING, LIVING], { features, seed: 20261029 }).forEach(({ plan }) => {
        const [chair] = find(plan, 'armchair');
        const [table] = find(plan, 'coffee-table');
        const { ahead, side } = relative(chair, { x: table.cx, z: table.cz });
        expect(ahead / Math.hypot(ahead, side)).toBeGreaterThanOrEqual(0.3);
      });
    });
  });

  it('keeps lamps and side tables out of the floor in front of the sofa', () => {
    [living45, small].forEach(({ room, features }) => {
      planOptions(room, [LIVING, LIVING], { features, seed: 20261029 }).forEach(({ plan }) => {
        const [sofa] = find(plan, 'sofa');
        [...find(plan, 'lamp'), ...find(plan, 'side-table')].forEach((piece) => {
          const { ahead, side } = relative(sofa, { x: piece.cx, z: piece.cz });
          const sofaDepth = sofa.rot % 180 === 0 ? sofa.d : sofa.w;
          const sofaWidth = sofa.rot % 180 === 0 ? sofa.w : sofa.d;
          const inFront = ahead > sofaDepth / 2 && ahead < sofaDepth / 2 + 1.2 && side < sofaWidth / 2;
          expect(inFront).toBe(false);
        });
      });
    });
  });

  it('centres a lone sofa on a free wall instead of beside a chair in the corner', () => {
    // 3.5 × 2.2 m with a chair out in front of the middle of one long wall.
    const { room, features } = scanned(3.5, 2.2, [], [
      { id: 'chair', type: 'chair', label: 'Chair', center: { x: 1.75, y: 0.45, z: 1.55 }, size: { x: 0.5, y: 0.9, z: 0.5 }, yaw: 0 },
    ]);
    const sofa = { id: 'canada', type: 'sofa', name: 'Canada Sofa', width: 1.99, length: 0.86, height: 0.8 };
    const [option] = planOptions(room, [[sofa]], { features, seed: 20261029 });
    const [placedSofa] = find(option.plan, 'sofa');
    const along = placedSofa.rot % 180 === 0 ? room.width : room.length;
    const centre = placedSofa.rot % 180 === 0 ? placedSofa.cx : placedSofa.cz;
    expect(Math.abs(centre - along / 2)).toBeLessThanOrEqual(0.15 * (along / 2) + 0.01);
    expect(option.plan.pros).toContain('Main piece is centred on its wall');
  });

  it('scores a lone sofa pushed into a corner below a centred one', () => {
    // A 1 m deep alcove: the sofa can only stand along its length. A cabinet takes the right end.
    const room = { width: 3.5, length: 1.0, height: 2.7 };
    const sofa = { id: 'canada', type: 'sofa', name: 'Canada Sofa', width: 1.99, length: 0.86, height: 0.8 };
    const corner = { obstacles: [{ id: 'cabinet', type: 'storage', x: 2.1, z: 0, w: 1.4, d: 1.0 }] };
    const [squeezed] = planLayouts(room, [sofa], { count: 1, seed: 4, features: corner });
    const [free] = planLayouts(room, [sofa], { count: 1, seed: 4 });
    expect(free.score.relations).toBeGreaterThan(squeezed.score.relations);
    expect(squeezed.pros).not.toContain('Main piece is centred on its wall');
    expect(free.pros).toContain('Main piece is centred on its wall');
  });

  it('offers options that look different, and leaves a repeat out', () => {
    const options = planOptions(living45.room, [LIVING, LIVING], { features: living45.features, seed: 20261029 });
    expect(options.length).toBeGreaterThanOrEqual(1);
    if (options.length === 2) expect(sameArrangement(options[0].plan.furniture, options[1].plan.furniture)).toBe(false);
    const best = Math.max(...options.map((o) => o.plan.score.overall));
    options.forEach((o) => expect(o.plan.score.overall).toBeGreaterThanOrEqual(best - 8));
  });

  it('only counts a sofa as fitting when it fits against a wall, as the planner places it', () => {
    // 4 × 4 m with furniture 60 cm deep along every wall: the middle is free, the walls aren't.
    const room = { width: 4, length: 4, height: 2.7 };
    const features = {
      obstacles: [
        { id: 'n', type: 'storage', x: 0, z: 0, w: 4, d: 0.6 },
        { id: 's', type: 'storage', x: 0, z: 3.4, w: 4, d: 0.6 },
        { id: 'w', type: 'storage', x: 0, z: 0.6, w: 0.6, d: 2.8 },
        { id: 'e', type: 'storage', x: 3.4, z: 0.6, w: 0.6, d: 2.8 },
      ],
    };
    const sofa = { name: '3-Seater Sofa', type: 'sofa', width: 2.2, length: 0.9, height: 0.85 };
    expect(checkRoomFit(room, sofa, features)).toEqual({ fits: false, reason: 'no-space' });
    // An armchair can stand out in the room, so it still fits.
    expect(checkRoomFit(room, { name: 'Accent Armchair', width: 0.8, length: 0.8, height: 0.9 }, features).fits).toBe(true);
  });
});
