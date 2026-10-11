import { optimizeLayout } from '../../src/services/layoutOptimizer.js';
import { planLayouts } from '../../src/services/layoutPlanner.js';
import { insidePolygon } from '../../src/utils/roomGeometry.js';

const ROOM = { width: 4, length: 4.5, height: 2.7 };

const ITEMS = [
  { id: 'bed', role: 'bed', name: 'Queen Bed', width: 1.6, length: 2.1, height: 0.5 },
  { id: 'night', role: 'nightstand', name: 'Nightstand', width: 0.5, length: 0.4, height: 0.55 },
  { id: 'wardrobe', role: 'wardrobe', name: 'Wardrobe', width: 1.8, length: 0.6, height: 2.2 },
  { id: 'desk', role: 'desk', name: 'Writing Desk', width: 1.2, length: 0.6, height: 0.75 },
  { id: 'chair', role: 'chair', name: 'Desk Chair', width: 0.5, length: 0.5, height: 0.9 },
];

// Everything bunched in the middle of the room, facing random ways
const POOR = [
  { x: 1.2, z: 1.2, rot: 90 },
  { x: 1.0, z: 3.5, rot: 0 },
  { x: 1.0, z: 0.4, rot: 180 },
  { x: 2.4, z: 3.6, rot: 270 },
  { x: 3.2, z: 2.0, rot: 0 },
];

const DOOR = { x: 3.0, z: 0, w: 0.9, d: 0.9 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(item, pose) {
  const rotated = pose.rot % 180 !== 0;
  return { x: pose.x, z: pose.z, w: rotated ? item.length : item.width, d: rotated ? item.width : item.length };
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const d = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
  return w > 0 && d > 0 ? w * d : 0;
}

function optimize(extra = {}) {
  return optimizeLayout({
    room: ROOM,
    items: ITEMS,
    poses: POOR,
    rng: mulberry32(7),
    iterations: 1500,
    timeBudgetMs: 5000,
    ...extra,
  });
}

const passed = (result, rule) => result.after.checks.find((c) => c.rule === rule)?.passed;

describe('layoutOptimizer', () => {
  it('turns a poor arrangement into a valid, lower-cost one', () => {
    const result = optimize({ features: { doorZones: [DOOR] } });
    expect(result.improved).toBe(true);
    expect(result.after.feasible).toBe(true);
    expect(result.after.cost).toBeLessThan(result.before.cost);

    const rects = ITEMS.map((item, i) => rect(item, result.poses[i]));
    rects.forEach((r, i) => {
      expect(r.x).toBeGreaterThanOrEqual(-1e-6);
      expect(r.z).toBeGreaterThanOrEqual(-1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(ROOM.width + 1e-6);
      expect(r.z + r.d).toBeLessThanOrEqual(ROOM.length + 1e-6);
      expect(overlapArea(r, DOOR)).toBe(0);
      for (let j = i + 1; j < rects.length; j += 1) expect(overlapArea(r, rects[j])).toBe(0);
    });
  });

  it('follows the interior design guidelines', () => {
    const result = optimize({ features: { doorZones: [DOOR] } });
    expect(passed(result, 'Queen Bed against a wall')).toBe(true);
    expect(passed(result, 'Wardrobe against a wall')).toBe(true);
    expect(passed(result, 'Nightstand beside Queen Bed')).toBe(true);
    expect(passed(result, 'Door swing kept clear')).toBe(true);
    expect(passed(result, 'Walkable path to every piece')).toBe(true);
    expect(result.after.passed / result.after.checks.length).toBeGreaterThanOrEqual(0.8);
  });

  it('scores a guideline-following layout below a poor one', () => {
    const good = [
      { x: 1.2, z: 0.05, rot: 0 },
      { x: 2.85, z: 0.05, rot: 0 },
      { x: 3.35, z: 2.4, rot: 270 },
      { x: 0.05, z: 2.6, rot: 90 },
      { x: 0.7, z: 2.95, rot: 270 },
    ];
    const goodCost = optimizeLayout({ room: ROOM, items: ITEMS, poses: good, rng: mulberry32(1), iterations: 0 }).before.cost;
    const poorCost = optimizeLayout({ room: ROOM, items: ITEMS, poses: POOR, rng: mulberry32(1), iterations: 0 }).before.cost;
    expect(goodCost).toBeLessThan(poorCost);
  });

  it('keeps clear of existing furniture', () => {
    const pillar = { x: 1.8, z: 1.8, w: 0.4, d: 0.4 };
    const result = optimize({ features: { obstacles: [pillar] } });
    expect(result.after.feasible).toBe(true);
    ITEMS.forEach((item, i) => expect(overlapArea(rect(item, result.poses[i]), pillar)).toBe(0));
  });

  it('keeps furniture inside an L-shaped outline', () => {
    const polygon = [
      { x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 2.5 }, { x: 2.5, z: 2.5 }, { x: 2.5, z: 4.5 }, { x: 0, z: 4.5 },
    ];
    const items = ITEMS.filter((item) => item.id !== 'desk' && item.id !== 'chair');
    const result = optimizeLayout({
      room: ROOM, items, poses: POOR.slice(0, 3), rng: mulberry32(3), iterations: 1500, timeBudgetMs: 5000,
      features: { polygon },
    });
    expect(result.after.feasible).toBe(true);
    items.forEach((item, i) => expect(insidePolygon(rect(item, result.poses[i]), polygon)).toBe(true));
  });

  it('keeps the starting layout when nothing better is found', () => {
    const result = optimize({ iterations: 0 });
    expect(result.improved).toBe(false);
    expect(result.poses).toBe(POOR);
  });
});

describe('layoutPlanner with the optimizer', () => {
  const BEDROOM = ITEMS.map(({ role, ...item }) => ({ ...item, type: role }));

  it('reports the rule checks for every layout', () => {
    const layouts = planLayouts(ROOM, BEDROOM, { count: 3, seed: 4, features: { doorZones: [DOOR] } });
    layouts.forEach((layout) => {
      expect(layout.optimization.algorithm).toBe('guideline-annealing');
      expect(layout.optimization.rulesTotal).toBe(layout.optimization.checks.length);
      expect(layout.optimization.checks.every((c) => typeof c.rule === 'string' && typeof c.passed === 'boolean')).toBe(true);
    });
  });

  it('never lowers the planner score', () => {
    for (let seed = 1; seed <= 4; seed += 1) {
      const base = planLayouts(ROOM, BEDROOM, { count: 3, seed, optimize: false });
      const refined = planLayouts(ROOM, BEDROOM, { count: 3, seed });
      refined.forEach((layout, i) => expect(layout.score.overall).toBeGreaterThanOrEqual(base[i].score.overall));
    }
  });

  it('can be switched off', () => {
    const [layout] = planLayouts(ROOM, BEDROOM, { count: 1, seed: 2, optimize: false });
    expect(layout.optimization).toBeNull();
  });
});
