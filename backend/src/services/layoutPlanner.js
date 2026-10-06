/**
 * Layout Planner
 * Rule-guided furniture arrangement for the design flow.
 *
 * Coordinates are room-local metres: x runs along the room width, z along its length.
 * A placed item's position is the min corner of its rotated footprint.
 * rotation (degrees): 0 faces +z, 90 faces +x, 180 faces -z, 270 faces -x.
 */

const PAD = 0.05;
const WALKWAY = 0.6;
const GRID_CELL = 0.2;
const ATTEMPTS_PER_LAYOUT = 30;
const WALL_ORDER = ['north', 'west', 'south', 'east'];
const WALL_ROTATION = { north: 0, west: 90, south: 180, east: 270 };
const OPPOSITE_WALL = { north: 'south', south: 'north', west: 'east', east: 'west' };

const WALL_HUG_ROLES = new Set(['bed', 'sofa', 'desk', 'wardrobe', 'dresser', 'storage']);
const NEEDS_FRONT_ROLES = new Set(['bed', 'sofa', 'tv-stand', 'desk', 'wardrobe', 'dresser', 'storage']);
const SEATING_ROLES = new Set(['sofa', 'armchair', 'bed', 'desk', 'chair']);
const PRIMARY_ROLES = ['bed', 'sofa', 'dining-table', 'island', 'desk'];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function classifyFurniture(item) {
  const text = `${item.type || ''} ${item.name || ''} ${item.category || ''}`.toLowerCase();
  if (/\brug\b|carpet/.test(text)) return 'rug';
  if (/night ?stand|bedside/.test(text)) return 'nightstand';
  if (/coffee/.test(text)) return 'coffee-table';
  if (/side[- ]?table|end[- ]?table/.test(text)) return 'side-table';
  if (/\btv\b|\btv-|television|media console/.test(text)) return 'tv-stand';
  if (/dining[- ]?table/.test(text)) return 'dining-table';
  if (/dining[- ]?chair/.test(text)) return 'dining-chair';
  if (/island/.test(text)) return 'island';
  if (/stool/.test(text)) return 'stool';
  if (/sofa|couch|sectional|loveseat/.test(text)) return 'sofa';
  if (/\bbeds?\b|mattress/.test(text)) return 'bed';
  if (/armchair|accent chair|lounge chair/.test(text)) return 'armchair';
  if (/office[- ]?chair|desk[- ]?chair|ergonomic/.test(text)) return 'desk-chair';
  if (/desk|study[- ]?table|work[- ]?table/.test(text)) return 'desk';
  if (/guest/.test(text)) return 'chair';
  if (/lamp|lighting|\blight\b/.test(text)) return 'lamp';
  if (/wardrobe|armoire|closet/.test(text)) return 'wardrobe';
  if (/dresser|chest of drawers/.test(text)) return 'dresser';
  if (/shelf|bookcase|cabinet|buffet|storage|console|sideboard/.test(text)) return 'storage';
  if (/chair|seat/.test(text)) return 'chair';
  if (/table/.test(text)) return 'table';
  return 'other';
}

function footprint(item, rot) {
  return rot % 180 === 0
    ? { w: item.width, d: item.length }
    : { w: item.length, d: item.width };
}

function rectsOverlap(a, b, tolerance = 0.001) {
  return a.x < b.x + b.w - tolerance
    && b.x < a.x + a.w - tolerance
    && a.z < b.z + b.d - tolerance
    && b.z < a.z + a.d - tolerance;
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const d = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
  return w > 0 && d > 0 ? w * d : 0;
}

function rectGap(a, b) {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dz = Math.max(0, b.z - (a.z + a.d), a.z - (b.z + b.d));
  return Math.sqrt(dx * dx + dz * dz);
}

function rectCenter(r) {
  return { x: r.x + r.w / 2, z: r.z + r.d / 2 };
}

function insideRoom(r, room) {
  return r.x >= -0.001 && r.z >= -0.001 && r.x + r.w <= room.width + 0.001 && r.z + r.d <= room.length + 0.001;
}

function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Rect lies inside a (possibly concave) outline: all corners inside, no outline corner poking in. */
function insidePolygon(r, polygon) {
  if (!polygon) return true;
  const inset = 0.01;
  const corners = [
    { x: r.x + inset, z: r.z + inset },
    { x: r.x + r.w - inset, z: r.z + inset },
    { x: r.x + r.w - inset, z: r.z + r.d - inset },
    { x: r.x + inset, z: r.z + r.d - inset },
  ];
  if (!corners.every((c) => pointInPolygon(c, polygon))) return false;
  return !polygon.some((v) => v.x > r.x + inset && v.x < r.x + r.w - inset && v.z > r.z + inset && v.z < r.z + r.d - inset);
}

const NO_FEATURES = { polygon: null, doorZones: [], windowZones: [], obstacles: [] };

function normalizeFeatures(features) {
  if (!features) return NO_FEATURES;
  const rects = (list) => (Array.isArray(list) ? list.filter((r) => r && r.w > 0 && r.d > 0) : []);
  const polygon = Array.isArray(features.polygon) && features.polygon.length >= 3 ? features.polygon : null;
  return {
    polygon,
    doorZones: rects(features.doorZones),
    windowZones: rects(features.windowZones),
    obstacles: rects(features.obstacles),
  };
}

function blocksWindow(item, zone) {
  return item.entry.item.height > zone.maxHeight && rectsOverlap(item.rect, zone);
}

function frontZone(rect, rot, depth = WALKWAY) {
  switch (((rot % 360) + 360) % 360) {
    case 0: return { x: rect.x, z: rect.z + rect.d, w: rect.w, d: depth };
    case 180: return { x: rect.x, z: rect.z - depth, w: rect.w, d: depth };
    case 90: return { x: rect.x + rect.w, z: rect.z, w: depth, d: rect.d };
    default: return { x: rect.x - depth, z: rect.z, w: depth, d: rect.d };
  }
}

// ----------------------------------------------------------------------------
// Groups: furniture that belongs together, built in a local frame where the
// group's back edge is v = 0 and its front faces +v.
// ----------------------------------------------------------------------------

function member(entry, u, v, rot) {
  const fp = footprint(entry.item, rot);
  return { entry, u, v, rot, lw: fp.w, ld: fp.d };
}

function finalizeGroup(group) {
  const minU = Math.min(...group.members.map((m) => m.u));
  const minV = Math.min(...group.members.map((m) => m.v));
  group.members.forEach((m) => {
    m.u -= minU;
    m.v -= minV;
  });
  group.gw = Math.max(...group.members.map((m) => m.u + m.lw));
  group.gd = Math.max(...group.members.map((m) => m.v + m.ld));
  group.needsFront = group.members.some((m) => NEEDS_FRONT_ROLES.has(m.entry.role));
  return group;
}

function buildGroups(entries) {
  const pool = [...entries];
  const take = (role) => {
    const idx = pool.findIndex((e) => e.role === role);
    return idx >= 0 ? pool.splice(idx, 1)[0] : null;
  };
  const takeAll = (role) => {
    const found = pool.filter((e) => e.role === role);
    found.forEach((e) => pool.splice(pool.indexOf(e), 1));
    return found;
  };

  const groups = [];

  let bed;
  while ((bed = take('bed'))) {
    const b = bed.item;
    const members = [member(bed, 0, 0, 0)];
    const stands = [take('nightstand'), take('nightstand')].filter(Boolean);
    if (stands[0]) members.push(member(stands[0], -stands[0].item.width - 0.05, 0, 0));
    if (stands[1]) members.push(member(stands[1], b.width + 0.05, 0, 0));
    groups.push(finalizeGroup({ key: `bed-${bed.id}`, kind: 'wall', primaryRole: 'bed', members }));
  }

  let sofa;
  while ((sofa = take('sofa'))) {
    const s = sofa.item;
    const members = [member(sofa, 0, 0, 0)];
    const coffee = take('coffee-table');
    let tableCenterV = s.length + 0.6;
    let tableRightU = s.width / 2;
    if (coffee) {
      const c = coffee.item;
      const v = s.length + 0.45;
      members.push(member(coffee, (s.width - c.width) / 2, v, 0));
      tableCenterV = v + c.length / 2;
      tableRightU = (s.width + c.width) / 2;
    }
    const side = take('side-table');
    if (side) members.push(member(side, s.width + 0.05, 0, 0));
    const lamp = take('lamp');
    if (lamp) members.push(member(lamp, -lamp.item.width - 0.1, 0, 0));
    const arm = take('armchair');
    if (arm) {
      const fp = footprint(arm.item, 270);
      members.push(member(arm, tableRightU + 0.45, Math.max(s.length + 0.3, tableCenterV - fp.d / 2), 270));
    }
    groups.push(finalizeGroup({ key: `sofa-${sofa.id}`, kind: 'wall', primaryRole: 'sofa', members }));
  }

  let desk;
  while ((desk = take('desk'))) {
    const d = desk.item;
    const members = [member(desk, 0, 0, 0)];
    const chair = take('desk-chair') || take('chair');
    if (chair) members.push(member(chair, (d.width - chair.item.width) / 2, d.length + 0.05, 180));
    groups.push(finalizeGroup({ key: `desk-${desk.id}`, kind: 'wall', primaryRole: 'desk', members }));
  }

  let table;
  while ((table = take('dining-table'))) {
    const t = table.item;
    const members = [member(table, 0, 0, 0)];
    const chairs = takeAll('dining-chair');
    const perSide = chairs.length >= 5 ? 2 : 1;
    const seats = [];
    for (let i = 0; i < perSide; i += 1) {
      const frac = perSide === 1 ? 0.5 : (i + 1) / (perSide + 1);
      seats.push({ side: 'front', frac }, { side: 'back', frac });
    }
    seats.push({ side: 'left' }, { side: 'right' });
    chairs.slice(0, seats.length).forEach((chair, i) => {
      const seat = seats[i];
      const c = chair.item;
      if (seat.side === 'front') members.push(member(chair, t.width * seat.frac - c.width / 2, -c.length - 0.05, 0));
      else if (seat.side === 'back') members.push(member(chair, t.width * seat.frac - c.width / 2, t.length + 0.05, 180));
      else {
        const rot = seat.side === 'left' ? 90 : 270;
        const fp = footprint(c, rot);
        const u = seat.side === 'left' ? -fp.w - 0.05 : t.width + 0.05;
        members.push(member(chair, u, t.length / 2 - fp.d / 2, rot));
      }
    });
    chairs.slice(seats.length).forEach((extra) => pool.push(extra));
    groups.push(finalizeGroup({ key: `dining-${table.id}`, kind: 'center', primaryRole: 'dining-table', members }));
  }

  let island;
  while ((island = take('island'))) {
    const isl = island.item;
    const members = [member(island, 0, 0, 0)];
    const stools = takeAll('stool');
    stools.forEach((stool, i) => {
      const u = ((i + 1) * isl.width) / (stools.length + 1) - stool.item.width / 2;
      members.push(member(stool, u, isl.length + 0.05, 180));
    });
    groups.push(finalizeGroup({ key: `island-${island.id}`, kind: 'center', primaryRole: 'island', members }));
  }

  pool
    .filter((e) => e.role !== 'rug')
    .forEach((entry) => {
      groups.push(finalizeGroup({ key: `single-${entry.id}`, kind: 'wall', primaryRole: entry.role, members: [member(entry, 0, 0, 0)] }));
    });

  const rugs = pool.filter((e) => e.role === 'rug');
  return { groups, rugs };
}

function groupPriority(group) {
  const primaryIndex = PRIMARY_ROLES.indexOf(group.primaryRole);
  const base = primaryIndex >= 0 ? 1000 - primaryIndex * 50 : 0;
  return base + group.gw * group.gd * 10;
}

// ----------------------------------------------------------------------------
// Frame transforms: local (u, v) -> world rects
// ----------------------------------------------------------------------------

function transformRect(local, frame) {
  const { rot, ox, oz, gw, gd } = frame;
  switch (rot) {
    case 0: return { x: ox + local.u, z: oz + local.v, w: local.lw, d: local.ld };
    case 180: return { x: ox + gw - local.u - local.lw, z: oz + gd - local.v - local.ld, w: local.lw, d: local.ld };
    case 90: return { x: ox + local.v, z: oz + gw - local.u - local.lw, w: local.ld, d: local.lw };
    default: return { x: ox + gd - local.v - local.ld, z: oz + local.u, w: local.ld, d: local.lw };
  }
}

function placeGroup(group, frame) {
  const items = group.members.map((m) => ({
    entry: m.entry,
    groupKey: group.key,
    rect: transformRect(m, frame),
    rotation: (m.rot + frame.rot) % 360,
  }));
  const zones = [];
  if (group.kind === 'wall' && group.needsFront) {
    zones.push(transformRect({ u: 0, v: group.gd, lw: group.gw, ld: WALKWAY }, frame));
  } else if (group.kind === 'center') {
    const bounds = transformRect({ u: 0, v: 0, lw: group.gw, ld: group.gd }, frame);
    zones.push({ x: bounds.x - WALKWAY, z: bounds.z - WALKWAY, w: bounds.w + 2 * WALKWAY, d: bounds.d + 2 * WALKWAY });
  }
  return { group, frame, items, zones };
}

function wallFrames(group, room) {
  const frames = [];
  WALL_ORDER.forEach((wall) => {
    const horizontal = wall === 'north' || wall === 'south';
    const along = horizontal ? room.width : room.length;
    const depthAvail = horizontal ? room.length : room.width;
    if (group.gw + 2 * PAD > along || group.gd + 2 * PAD > depthAvail) return;
    const maxOff = along - PAD - group.gw;
    const offsets = new Set([PAD, maxOff, (along - group.gw) / 2]);
    for (let off = PAD; off < maxOff; off += 0.25) offsets.add(off);
    offsets.forEach((off) => {
      const base = { rot: WALL_ROTATION[wall], gw: group.gw, gd: group.gd, wall, offset: off, along };
      if (wall === 'north') frames.push({ ...base, ox: off, oz: PAD });
      else if (wall === 'south') frames.push({ ...base, ox: off, oz: room.length - PAD - group.gd });
      else if (wall === 'west') frames.push({ ...base, ox: PAD, oz: off });
      else frames.push({ ...base, ox: room.width - PAD - group.gd, oz: off });
    });
  });
  return frames;
}

function centerFrames(group, room) {
  const frames = [];
  [0, 90].forEach((rot) => {
    const bw = rot === 0 ? group.gw : group.gd;
    const bd = rot === 0 ? group.gd : group.gw;
    for (let ox = PAD; ox + bw <= room.width - PAD; ox += 0.25) {
      for (let oz = PAD; oz + bd <= room.length - PAD; oz += 0.25) {
        frames.push({ rot, ox, oz, gw: group.gw, gd: group.gd, wall: null });
      }
    }
  });
  return frames;
}

function isValidPlacement(candidate, placed, room, strict, features = NO_FEATURES) {
  for (const item of candidate.items) {
    if (!insideRoom(item.rect, room)) return false;
    if (!insidePolygon(item.rect, features.polygon)) return false;
    if (features.obstacles.some((o) => rectsOverlap(item.rect, o))) return false;
    if (features.doorZones.some((z) => rectsOverlap(item.rect, z))) return false;
    if (strict && features.windowZones.some((z) => blocksWindow(item, z))) return false;
    for (const other of placed) {
      if (other.items.some((o) => rectsOverlap(item.rect, o.rect))) return false;
      if (strict && other.zones.some((z) => rectsOverlap(item.rect, z))) return false;
    }
  }
  if (strict) {
    for (const zone of candidate.zones) {
      for (const other of placed) {
        if (other.items.some((o) => rectsOverlap(zone, o.rect))) return false;
      }
      if (features.obstacles.some((o) => rectsOverlap(zone, o))) return false;
    }
  }
  return true;
}

function groupBoundsCenter(candidate) {
  const xs = candidate.items.flatMap((i) => [i.rect.x, i.rect.x + i.rect.w]);
  const zs = candidate.items.flatMap((i) => [i.rect.z, i.rect.z + i.rect.d]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
}

function heuristicScore(candidate, placed, room, ctx, rng) {
  const { group, frame } = candidate;
  let score = rng() * 12;
  const center = groupBoundsCenter(candidate);

  if (group === ctx.primaryGroup) {
    if (frame.wall && frame.wall === ctx.preferredWall) score += 50;
    if (frame.wall) {
      const alongCenter = frame.offset + group.gw / 2;
      score += 15 * (1 - Math.abs(alongCenter - frame.along / 2) / (frame.along / 2));
    } else {
      // Shift centre pieces away from the preferred wall so each option leaves room on a different side.
      const shift = { north: [0, 1], south: [0, -1], west: [1, 0], east: [-1, 0] }[ctx.preferredWall] || [0, 0];
      const targetX = room.width / 2 + shift[0] * room.width * 0.12 * Math.min(1, ctx.variant);
      const targetZ = room.length / 2 + shift[1] * room.length * 0.12 * Math.min(1, ctx.variant);
      const half = Math.hypot(room.width, room.length) / 2;
      score += 30 * (1 - Math.hypot(center.x - targetX, center.z - targetZ) / half);
      if (ctx.variant % 2 === 1) score += frame.rot === 0 ? 8 : 0;
      else score += frame.rot === 90 ? 8 : 0;
    }
  }

  if (ctx.primaryGroup?.kind === 'center' && group !== ctx.primaryGroup && frame.wall === ctx.preferredWall) {
    score += 25;
  }

  if (group.primaryRole === 'tv-stand' && frame.facingSofa) score += 45;
  if (group.primaryRole === 'tv-stand' && ctx.sofaPlacement?.frame.wall && frame.wall) {
    const sofaFrame = ctx.sofaPlacement.frame;
    if (frame.wall === OPPOSITE_WALL[sofaFrame.wall]) {
      const sofaRect = ctx.sofaPlacement.items[0].rect;
      const viewing = rectGap(candidate.items[0].rect, sofaRect);
      score += viewing <= 4.5 ? 40 : 5;
      const sofaCenter = groupBoundsCenter(ctx.sofaPlacement);
      const horizontal = frame.wall === 'north' || frame.wall === 'south';
      const offset = horizontal ? Math.abs(center.x - sofaCenter.x) : Math.abs(center.z - sofaCenter.z);
      score += 20 * (1 - Math.min(1, offset / frame.along));
    }
  }

  const tall = group.members.some((m) => m.entry.item.height > 1.5);
  if ((tall || group.primaryRole === 'lamp') && frame.wall) {
    const nearEnd = frame.offset <= PAD + 0.3 || frame.offset + group.gw >= frame.along - PAD - 0.3;
    if (nearEnd) score += 10;
  }

  if (group.primaryRole === 'desk' && frame.wall && frame.wall !== ctx.primaryPlacement?.frame.wall) score += 10;

  const windows = ctx.features.windowZones;
  if (windows.length > 0) {
    const windowGap = Math.min(...windows.map((z) => rectGap(candidate.items[0].rect, z)));
    if (group.primaryRole === 'desk') score += 25 * (1 - Math.min(1, windowGap / 1.5));
    if (group.primaryRole === 'tv-stand' && windowGap < 0.1) score -= 15;
    if (group.primaryRole === 'bed' && windowGap < 0.1) score -= 10;
  }

  if (group.primaryRole === 'nightstand' && ctx.bedPlacement) {
    const bedRect = ctx.bedPlacement.items[0].rect;
    score += 30 * (1 - Math.min(1, rectGap(candidate.items[0].rect, bedRect) / 2));
  }

  if (group.primaryRole === 'lamp' || group.primaryRole === 'side-table' || group.primaryRole === 'armchair') {
    const seating = placed.flatMap((p) => p.items).filter((i) => SEATING_ROLES.has(i.entry.role));
    if (seating.length > 0) {
      const nearest = Math.min(...seating.map((s) => rectGap(candidate.items[0].rect, s.rect)));
      score += 20 * (1 - Math.min(1, nearest / 2));
    }
  }

  if (placed.length > 0) {
    const nearestGroup = Math.min(...placed.map((p) => {
      const c = groupBoundsCenter(p);
      return Math.hypot(c.x - center.x, c.z - center.z);
    }));
    score += 5 * Math.min(1, nearestGroup / 2);
  }

  return score;
}

function facingSofaCandidates(group, sofaPlacement) {
  const tvMember = group.members[0];
  const sofaMember = sofaPlacement.group.members.find((m) => m.entry.role === 'sofa');
  if (!sofaMember) return [];
  const sofaFrame = sofaPlacement.frame;
  return [2.4, 2.8, 3.2].map((viewing) => {
    const local = {
      u: sofaMember.u + (sofaMember.lw - tvMember.lw) / 2,
      v: sofaMember.v + sofaMember.ld + viewing,
      lw: tvMember.lw,
      ld: tvMember.ld,
    };
    const rect = transformRect(local, sofaFrame);
    const rotation = (sofaFrame.rot + 180) % 360;
    return {
      group,
      frame: { ...sofaFrame, wall: null, facingSofa: true },
      items: [{ entry: tvMember.entry, groupKey: group.key, rect, rotation }],
      zones: [frontZone(rect, rotation)],
    };
  });
}

function placeRugs(rugs, placedItems, room, primaryPlacement) {
  return rugs.map((rug) => {
    const coffee = placedItems.find((i) => i.entry.role === 'coffee-table');
    const anchorRect = coffee?.rect || primaryPlacement?.items[0]?.rect;
    const target = anchorRect ? rectCenter(anchorRect) : { x: room.width / 2, z: room.length / 2 };
    const rot = primaryPlacement?.frame?.rot === 90 || primaryPlacement?.frame?.rot === 270 ? 0 : 90;
    const fp = footprint(rug.item, rot);
    const w = Math.min(fp.w, room.width - 2 * PAD);
    const d = Math.min(fp.d, room.length - 2 * PAD);
    const rect = {
      x: clamp(target.x - w / 2, PAD, room.width - PAD - w),
      z: clamp(target.z - d / 2, PAD, room.length - PAD - d),
      w,
      d,
    };
    return { entry: rug, groupKey: `rug-${rug.id}`, rect, rotation: rot };
  });
}

// ----------------------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------------------

function polygonArea(polygon) {
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area) / 2;
}

function scoreLayout(items, room, features = NO_FEATURES) {
  const solid = items.filter((i) => i.entry.role !== 'rug');
  const floorArea = features.polygon ? Math.max(0.5, polygonArea(features.polygon)) : room.width * room.length;
  const fixedRects = features.obstacles;

  let overlaps = 0;
  let outside = 0;
  for (let i = 0; i < solid.length; i += 1) {
    if (!insideRoom(solid[i].rect, room) || !insidePolygon(solid[i].rect, features.polygon)) outside += 1;
    for (let j = i + 1; j < solid.length; j += 1) {
      if (overlapArea(solid[i].rect, solid[j].rect) > 0.005) overlaps += 1;
    }
  }
  const fit = Math.max(0, 100 - overlaps * 35 - outside * 25);

  // Walkable grid: a cell is walkable when a 60 cm wide person fits there.
  const half = WALKWAY / 2;
  const cols = Math.max(1, Math.floor(room.width / GRID_CELL));
  const rows = Math.max(1, Math.floor(room.length / GRID_CELL));
  const walkable = new Array(cols * rows).fill(false);
  let walkableCount = 0;
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const cx = (c + 0.5) * GRID_CELL;
      const cz = (r + 0.5) * GRID_CELL;
      if (cx < half || cz < half || cx > room.width - half || cz > room.length - half) continue;
      if (features.polygon && !pointInPolygon({ x: cx, z: cz }, features.polygon)) continue;
      const near = (rect) => {
        const dx = Math.max(rect.x - cx, 0, cx - (rect.x + rect.w));
        const dz = Math.max(rect.z - cz, 0, cz - (rect.z + rect.d));
        return Math.hypot(dx, dz) < half;
      };
      const blocked = solid.some((item) => near(item.rect)) || fixedRects.some(near);
      if (!blocked) {
        walkable[c * rows + r] = true;
        walkableCount += 1;
      }
    }
  }

  const component = new Int32Array(cols * rows).fill(-1);
  let largestId = -1;
  let largestSize = 0;
  let nextId = 0;
  for (let start = 0; start < walkable.length; start += 1) {
    if (!walkable[start] || component[start] !== -1) continue;
    const stack = [start];
    component[start] = nextId;
    let size = 0;
    while (stack.length > 0) {
      const idx = stack.pop();
      size += 1;
      const c = Math.floor(idx / rows);
      const r = idx % rows;
      const neighbors = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
      for (const [nc, nr] of neighbors) {
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const nIdx = nc * rows + nr;
        if (walkable[nIdx] && component[nIdx] === -1) {
          component[nIdx] = nextId;
          stack.push(nIdx);
        }
      }
    }
    if (size > largestSize) {
      largestSize = size;
      largestId = nextId;
    }
    nextId += 1;
  }

  const connectivity = walkableCount > 0 ? largestSize / walkableCount : 0;
  const coverage = Math.min(1, walkableCount / (cols * rows) / 0.35);
  const flow = Math.round(100 * (0.7 * connectivity + 0.3 * coverage));

  const reachable = (zone) => {
    const c0 = Math.max(0, Math.floor((zone.x - GRID_CELL) / GRID_CELL));
    const c1 = Math.min(cols - 1, Math.floor((zone.x + zone.w + GRID_CELL) / GRID_CELL));
    const r0 = Math.max(0, Math.floor((zone.z - GRID_CELL) / GRID_CELL));
    const r1 = Math.min(rows - 1, Math.floor((zone.z + zone.d + GRID_CELL) / GRID_CELL));
    for (let c = c0; c <= c1; c += 1) {
      for (let r = r0; r <= r1; r += 1) {
        if (component[c * rows + r] === largestId && largestId >= 0) return true;
      }
    }
    return false;
  };

  const frontItems = solid.filter((i) => NEEDS_FRONT_ROLES.has(i.entry.role));
  let frontFree = 0;
  let frontReachable = 0;
  frontItems.forEach((item) => {
    const zone = frontZone(item.rect, item.rotation);
    const blocked = !insideRoom(zone, room)
      || solid.some((o) => o !== item && o.groupKey !== item.groupKey && rectsOverlap(zone, o.rect))
      || fixedRects.some((o) => rectsOverlap(zone, o));
    if (!blocked) frontFree += 1;
    if (reachable(zone)) frontReachable += 1;
  });
  const frontClearance = frontItems.length > 0
    ? Math.round(100 * (0.5 * (frontFree / frontItems.length) + 0.5 * (frontReachable / frontItems.length)))
    : 100;

  // A door counts as accessible when nothing sits in its swing zone and it joins the main walkway.
  const doors = features.doorZones;
  const doorsOk = doors.filter((zone) => !solid.some((o) => rectsOverlap(zone, o.rect)) && reachable(zone)).length;
  const doorAccess = doors.length > 0 ? Math.round((100 * doorsOk) / doors.length) : 100;
  const clearance = doors.length > 0 ? Math.round(0.7 * frontClearance + 0.3 * doorAccess) : frontClearance;

  const windowsBlocked = features.windowZones.filter((zone) => solid.some((item) => blocksWindow(item, zone))).length;
  const deskNearWindow = features.windowZones.length > 0 && solid
    .filter((i) => i.entry.role === 'desk')
    .some((desk) => features.windowZones.some((zone) => rectGap(desk.rect, zone) <= 0.6));

  const byRole = (role) => solid.filter((i) => i.entry.role === role);
  const relationResults = [];
  const nearest = (item, roles) => {
    const others = solid.filter((o) => roles.includes(o.entry.role) && o !== item);
    if (others.length === 0) return null;
    return Math.min(...others.map((o) => rectGap(item.rect, o.rect)));
  };

  byRole('nightstand').forEach((n) => {
    const gap = nearest(n, ['bed']);
    if (gap != null) relationResults.push({ key: 'nightstand', ok: gap <= 0.15 ? 1 : gap <= 0.6 ? 0.5 : 0 });
  });
  byRole('coffee-table').forEach((t) => {
    const gap = nearest(t, ['sofa']);
    if (gap != null) relationResults.push({ key: 'coffee', ok: gap >= 0.3 && gap <= 0.7 ? 1 : gap <= 1.2 ? 0.5 : 0 });
  });
  const sofas = byRole('sofa');
  byRole('tv-stand').forEach((tv) => {
    if (sofas.length === 0) return;
    const sofa = sofas[0];
    const facing = Math.abs(((tv.rotation - sofa.rotation) % 360 + 360) % 360 - 180) < 1;
    const tc = rectCenter(tv.rect);
    const sc = rectCenter(sofa.rect);
    const axisOffset = sofa.rotation % 180 === 0 ? Math.abs(tc.x - sc.x) : Math.abs(tc.z - sc.z);
    const distance = Math.hypot(tc.x - sc.x, tc.z - sc.z);
    let ok = facing ? 0.6 + 0.4 * (1 - Math.min(1, axisOffset / 1.5)) : 0.2;
    if (distance < 1.8 || distance > 5.5) ok *= 0.6;
    relationResults.push({ key: 'tv', ok });
  });
  byRole('desk-chair').concat(byRole('chair')).forEach((ch) => {
    const gap = nearest(ch, ['desk']);
    if (gap != null) relationResults.push({ key: 'desk-chair', ok: gap <= 0.2 ? 1 : gap <= 1 ? 0.4 : 0 });
  });
  byRole('dining-chair').forEach((ch) => {
    const gap = nearest(ch, ['dining-table', 'table']);
    if (gap != null) relationResults.push({ key: 'dining', ok: gap <= 0.2 ? 1 : 0 });
  });
  byRole('stool').forEach((st) => {
    const gap = nearest(st, ['island', 'table']);
    if (gap != null) relationResults.push({ key: 'stool', ok: gap <= 0.2 ? 1 : 0 });
  });
  byRole('armchair').forEach((a) => {
    const gap = nearest(a, ['sofa', 'coffee-table']);
    if (gap != null) relationResults.push({ key: 'armchair', ok: gap <= 1.2 ? 1 : gap <= 2.5 ? 0.5 : 0 });
  });
  byRole('side-table').forEach((s) => {
    const gap = nearest(s, ['sofa', 'armchair', 'bed']);
    if (gap != null) relationResults.push({ key: 'side-table', ok: gap <= 0.2 ? 1 : gap <= 0.8 ? 0.5 : 0 });
  });
  byRole('lamp').forEach((l) => {
    const gap = nearest(l, ['sofa', 'armchair', 'bed', 'desk']);
    if (gap != null) relationResults.push({ key: 'lamp', ok: gap <= 0.6 ? 1 : gap <= 1.5 ? 0.5 : 0 });
  });
  const relations = relationResults.length > 0
    ? Math.round((100 * relationResults.reduce((sum, r) => sum + r.ok, 0)) / relationResults.length)
    : 100;

  const wallItems = solid.filter((i) => WALL_HUG_ROLES.has(i.entry.role));
  const touchesWall = (r) => r.x <= PAD + 0.05 || r.z <= PAD + 0.05
    || r.x + r.w >= room.width - PAD - 0.05 || r.z + r.d >= room.length - PAD - 0.05;
  const wall = wallItems.length > 0
    ? Math.round((100 * wallItems.filter((i) => touchesWall(i.rect)).length) / wallItems.length)
    : 100;

  let weightSum = 0;
  let cx = 0;
  let cz = 0;
  solid.forEach((item) => {
    const weight = item.rect.w * item.rect.d * Math.max(0.3, item.entry.item.height);
    const c = rectCenter(item.rect);
    weightSum += weight;
    cx += c.x * weight;
    cz += c.z * weight;
  });
  const halfDiag = Math.hypot(room.width, room.length) / 2;
  const balance = weightSum > 0
    ? Math.round(clamp(100 - (Math.hypot(cx / weightSum - room.width / 2, cz / weightSum - room.length / 2) / halfDiag) * 120, 0, 100))
    : 100;

  const occupied = (solid.reduce((sum, item) => sum + item.rect.w * item.rect.d, 0)
    + fixedRects.reduce((sum, rect) => sum + rect.w * rect.d, 0)) / floorArea;
  let space;
  if (occupied < 0.2) space = 40 + 60 * (occupied / 0.2);
  else if (occupied <= 0.45) space = 100;
  else space = 100 - (occupied - 0.45) * 200;
  space = Math.round(clamp(space, 0, 100));

  const weighted = 0.15 * fit + 0.2 * flow + 0.15 * clearance + 0.25 * relations + 0.1 * wall + 0.1 * balance + 0.05 * space;
  const overall = Math.round(fit < 100 ? Math.min(fit, weighted) : weighted);

  return {
    overall,
    fit,
    flow,
    clearance,
    relations,
    wall,
    balance,
    space,
    occupancy: occupied,
    relationResults,
    features: {
      doorCount: doors.length,
      doorAccess,
      windowCount: features.windowZones.length,
      windowsBlocked,
      deskNearWindow,
      obstacleCount: fixedRects.length,
    },
  };
}

function describeLayout(score, dropped) {
  const pros = [];
  const cons = [];
  const relationOk = (key) => score.relationResults.filter((r) => r.key === key).every((r) => r.ok >= 0.9)
    && score.relationResults.some((r) => r.key === key);

  if (relationOk('nightstand')) pros.push('Nightstand sits right beside the bed');
  if (relationOk('coffee')) pros.push('Coffee table is within reach of the sofa');
  if (relationOk('tv')) pros.push('TV faces the sofa at a comfortable distance');
  if (relationOk('desk-chair')) pros.push('Chair is pulled up to the desk');
  if (relationOk('dining')) pros.push('Chairs are arranged around the dining table');
  if (score.wall >= 90) pros.push('Large pieces sit against the walls');
  if (score.flow >= 80) pros.push('Clear 60 cm walkways connect the room');
  if (score.balance >= 70) pros.push('Furniture weight is spread evenly');
  const f = score.features;
  if (f.doorCount > 0 && f.doorAccess === 100) pros.push(f.doorCount > 1 ? 'Doorways are kept clear' : 'Doorway is kept clear');
  if (f.windowCount > 0 && f.windowsBlocked === 0) pros.push('Windows stay unblocked for daylight');
  if (f.deskNearWindow) pros.push('Desk gets natural light from the window');
  if (f.obstacleCount > 0) pros.push('Works around your existing furniture');

  if (score.flow < 60) cons.push('Walkways are tight or broken up');
  if (score.clearance < 70) cons.push('Some pieces lack 60 cm of space in front');
  if (score.relationResults.some((r) => r.key === 'tv' && r.ok < 0.6)) cons.push('TV is not facing the sofa');
  if (score.occupancy < 0.1) cons.push('Room feels sparse for this much floor space');
  if (score.occupancy > 0.5) cons.push('Room feels crowded');
  if (f.doorCount > 0 && f.doorAccess < 100) cons.push('A doorway is hard to reach from the main walkway');
  if (f.windowsBlocked > 0) cons.push('Tall furniture partly blocks a window');
  if (dropped.length > 0) cons.push(`Could not fit: ${dropped.join(', ')}`);

  return { pros, cons };
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

function expandQuantities(entries) {
  const result = [...entries];
  const hasRole = (role) => result.some((e) => e.role === role);
  const cloneUntil = (role, count) => {
    const existing = result.filter((e) => e.role === role);
    if (existing.length === 0) return;
    for (let i = existing.length; i < count; i += 1) {
      const base = existing[0];
      result.push({ ...base, id: `${base.id}-${i + 1}`, item: { ...base.item } });
    }
  };
  if (hasRole('dining-table')) cloneUntil('dining-chair', 4);
  if (hasRole('island')) cloneUntil('stool', 2);
  return result;
}

function planSingle(groups, rugs, room, preferredWall, variant, seed, features) {
  const rng = mulberry32(seed);
  const ordered = [...groups].sort((a, b) => groupPriority(b) - groupPriority(a));
  const ctx = {
    preferredWall,
    variant,
    features,
    primaryGroup: ordered.find((g) => PRIMARY_ROLES.includes(g.primaryRole)) || ordered[0],
    primaryPlacement: null,
    sofaPlacement: null,
    bedPlacement: null,
  };
  const placed = [];
  const dropped = [];

  ordered.forEach((group) => {
    const frames = group.kind === 'center' ? centerFrames(group, room) : wallFrames(group, room);
    const candidates = frames.map((frame) => placeGroup(group, frame));
    if (group.primaryRole === 'tv-stand' && ctx.sofaPlacement) {
      candidates.push(...facingSofaCandidates(group, ctx.sofaPlacement));
    }
    let valid = candidates.filter((c) => isValidPlacement(c, placed, room, true, features));
    if (valid.length === 0) valid = candidates.filter((c) => isValidPlacement(c, placed, room, false, features));
    if (valid.length === 0) {
      group.members.forEach((m) => dropped.push(m.entry.item.name));
      return;
    }
    let best = valid[0];
    let bestScore = -Infinity;
    valid.forEach((candidate) => {
      const s = heuristicScore(candidate, placed, room, ctx, rng);
      if (s > bestScore) {
        bestScore = s;
        best = candidate;
      }
    });
    placed.push(best);
    if (group === ctx.primaryGroup) ctx.primaryPlacement = best;
    if (group.primaryRole === 'sofa' && !ctx.sofaPlacement) ctx.sofaPlacement = best;
    if (group.primaryRole === 'bed' && !ctx.bedPlacement) ctx.bedPlacement = best;
  });

  const placedItems = placed.flatMap((p) => p.items);
  const rugItems = placeRugs(rugs, placedItems, room, ctx.primaryPlacement);
  const items = [...rugItems, ...placedItems];
  return { items, dropped, score: scoreLayout(items, room, features), primaryWall: ctx.primaryPlacement?.frame.wall || null };
}

/**
 * Plan `count` distinct layouts for a room.
 * @param {{width:number,length:number,height:number}} room
 * @param {Array<{id:string,name:string,type?:string,category?:string,width:number,length:number,height:number}>} furniture
 * @param {{count?:number, seed?:number, features?:{polygon?:Array<{x:number,z:number}>, doorZones?:Array, windowZones?:Array, obstacles?:Array}}} [options]
 *   features are room-local: doorZones are kept fully clear, windowZones reject furniture taller
 *   than zone.maxHeight, obstacles are existing furniture footprints.
 */
export function planLayouts(room, furniture, options = {}) {
  const count = Math.max(1, options.count || 3);
  const baseSeed = options.seed ?? Date.now();
  const features = normalizeFeatures(options.features);

  const entries = expandQuantities(
    furniture.map((item, index) => ({
      id: String(item.id || item.type || `item-${index}`),
      role: classifyFurniture(item),
      item,
    })),
  );

  const results = [];
  for (let variant = 0; variant < count; variant += 1) {
    const preferredWall = WALL_ORDER[variant % WALL_ORDER.length];
    let best = null;
    for (let attempt = 0; attempt < ATTEMPTS_PER_LAYOUT; attempt += 1) {
      const { groups, rugs } = buildGroups(entries);
      const plan = planSingle(groups, rugs, room, preferredWall, variant, baseSeed + variant * 1000 + attempt, features);
      if (!best || plan.score.overall > best.score.overall) best = plan;
    }
    results.push(best);
  }

  return results.map((plan, variant) => {
    const counters = new Map();
    const placedFurniture = plan.items.map((placedItem) => {
      const { entry, rect, rotation } = placedItem;
      const n = (counters.get(entry.id) || 0) + 1;
      counters.set(entry.id, n);
      const isRug = entry.role === 'rug';
      const rotatedSwap = rotation % 180 !== 0;
      const width = isRug ? (rotatedSwap ? rect.d : rect.w) : entry.item.width;
      const length = isRug ? (rotatedSwap ? rect.w : rect.d) : entry.item.length;
      return {
        ...entry.item,
        id: `${entry.id}-v${variant + 1}-${n}`,
        role: entry.role,
        width,
        length,
        dimensions: { width, length, height: entry.item.height },
        position: { x: round2(rect.x), y: 0, z: round2(rect.z), rotation },
      };
    });
    const { pros, cons } = describeLayout(plan.score, plan.dropped);
    const { relationResults, occupancy, features: featureStats, ...score } = plan.score;
    return {
      furniture: placedFurniture,
      score,
      pros,
      cons,
      dropped: plan.dropped,
      primaryWall: plan.primaryWall,
      roomFeatures: featureStats,
    };
  });
}

export default { planLayouts, classifyFurniture };
