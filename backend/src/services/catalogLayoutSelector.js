/**
 * Picks real MongoDB catalog SKUs for layout planning (Phase 3).
 * Hard: requiredItemIds always included. Soft: style match. Budget: greedy fill, never silent clip.
 */

import Furniture from '../models/Furniture.js';
import { classifyFurniture } from './layoutPlanner.js';
import { mockPricePhp, mockStyles, suitableRooms } from '../utils/furnitureMockPricing.js';

const ROOM_ROLE_SLOTS = {
  'Living Room': ['sofa', 'coffee-table', 'tv-stand', 'rug', 'lamp', 'bookshelf'],
  Bedroom: ['bed', 'nightstand', 'wardrobe', 'desk', 'chair', 'dresser', 'rug'],
  'Dining Room': ['dining-table', 'dining-chair', 'storage'],
  Office: ['desk', 'chair', 'bookshelf', 'storage'],
  Kitchen: ['dining-table', 'dining-chair', 'storage', 'island', 'stool'],
  Bathroom: ['storage'],
};

const ROLE_ALIASES = {
  'dining-table': ['dining-table', 'table'],
  'dining-chair': ['dining-chair', 'chair', 'desk-chair'],
  'office-chair': ['office-chair', 'desk-chair', 'chair'],
  chair: ['chair', 'desk-chair', 'dining-chair', 'armchair'],
  lamp: ['lamp'],
  'coffee-table': ['coffee-table', 'side-table', 'table'],
  nightstand: ['nightstand', 'side-table', 'table'],
  bookshelf: ['bookshelf', 'storage'],
  storage: ['storage', 'wardrobe', 'dresser', 'bookshelf'],
};

function normalizeRoomType(roomType) {
  const key = String(roomType || '').trim();
  if (key === 'Dining Area') return 'Dining Room';
  return key || 'Living Room';
}

function getRoomTypes(doc) {
  if (Array.isArray(doc.roomTypes) && doc.roomTypes.length > 0) return doc.roomTypes;
  if (Array.isArray(doc.rooms) && doc.rooms.length > 0) return doc.rooms;
  return suitableRooms({ ...doc, category: doc.category || 'other' });
}

function getStyles(doc) {
  if (Array.isArray(doc.styles) && doc.styles.length > 0) return doc.styles;
  return mockStyles(doc);
}

function resolvePricePhp(doc) {
  const stored = Number(doc.pricePhp);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return mockPricePhp(doc);
}

function inStock(doc) {
  const q = Number(doc.quantity);
  if (!Number.isFinite(q)) return true;
  return q > 0;
}

export function mapDocToPlannerItem(doc) {
  const pricePhp = resolvePricePhp(doc);
  return {
    id: doc.id,
    catalogId: doc.id,
    type: doc.category,
    name: doc.displayName,
    category: doc.category || 'other',
    glbUrl: doc.glbUrl || '',
    pricePhp,
    width: Number(doc.width) || 1,
    length: Number(doc.depth) || 0.8,
    height: Number(doc.height) || 0.8,
    dimensions: {
      width: Number(doc.width) || 1,
      length: Number(doc.depth) || 0.8,
      height: Number(doc.height) || 0.8,
    },
    styles: getStyles(doc),
    roomTypes: getRoomTypes(doc),
  };
}

export function isCatalogEligible(doc, roomType, { requireStock = true } = {}) {
  if (doc.active === false) return false;
  if (requireStock && !inStock(doc)) return false;
  const pricePhp = resolvePricePhp(doc);
  if (pricePhp <= 0) return false;
  const rooms = getRoomTypes(doc);
  if (rooms.length > 0 && !rooms.includes(roomType)) return false;
  return true;
}

function styleScore(item, style) {
  if (!style) return 0;
  return item.styles?.includes(style) ? 10 : 0;
}

function roleOfItem(item) {
  return classifyFurniture(item);
}

function matchesRole(item, slotRole) {
  const role = roleOfItem(item);
  const aliases = ROLE_ALIASES[slotRole] || [slotRole];
  return aliases.includes(role);
}

function rankCandidates(candidates, style, variantIndex) {
  return [...candidates].sort((a, b) => {
    const styleDiff = styleScore(b, style) - styleScore(a, style);
    if (styleDiff !== 0) return styleDiff;
    const priceDiff = a.pricePhp - b.pricePhp;
    if (priceDiff !== 0) return priceDiff;
    return a.id.localeCompare(b.id);
  });
}

function pickForRole(pool, slotRole, style, variantIndex, usedIds) {
  const candidates = pool.filter(
    (item) => !usedIds.has(item.catalogId) && matchesRole(item, slotRole),
  );
  if (candidates.length === 0) return null;
  const ranked = rankCandidates(candidates, style, variantIndex);
  const pickIndex = Math.min(variantIndex, ranked.length - 1);
  return ranked[pickIndex];
}

/**
 * Build one furniture list (catalog SKUs) for a layout variant.
 */
export function selectCatalogFurnitureSet(pool, {
  roomType,
  style,
  budgetPhp = 0,
  requiredItemIds = [],
  variantIndex = 0,
}) {
  const normalizedRoom = normalizeRoomType(roomType);
  const usedIds = new Set();
  const selected = [];

  const requiredIds = [...new Set((requiredItemIds || []).map((id) => String(id).trim().toLowerCase()).filter(Boolean))];
  requiredIds.forEach((reqId) => {
    const fromPool = pool.find((item) => item.catalogId === reqId);
    if (fromPool && !usedIds.has(reqId)) {
      usedIds.add(reqId);
      selected.push(fromPool);
      return;
    }
    const forced = pool.find((item) => item.catalogId === reqId);
    if (forced) {
      usedIds.add(reqId);
      selected.push(forced);
    }
  });

  const slots = ROOM_ROLE_SLOTS[normalizedRoom] || ROOM_ROLE_SLOTS['Living Room'];
  slots.forEach((slotRole) => {
    if (selected.some((item) => matchesRole(item, slotRole))) return;
    const pick = pickForRole(pool, slotRole, style, variantIndex, usedIds);
    if (!pick) return;
    usedIds.add(pick.catalogId);
    selected.push(pick);
  });

  let runningTotal = selected.reduce((sum, item) => sum + item.pricePhp, 0);
  const budget = budgetPhp > 0 ? budgetPhp : Infinity;

  if (runningTotal > budget) {
    return {
      furniture: selected,
      totalPhp: runningTotal,
      overBudget: true,
      withinBudget: false,
    };
  }

  const optionalPool = rankCandidates(
    pool.filter((item) => !usedIds.has(item.catalogId)),
    style,
    variantIndex,
  );

  optionalPool.forEach((item) => {
    if (runningTotal + item.pricePhp > budget) return;
    usedIds.add(item.catalogId);
    selected.push(item);
    runningTotal += item.pricePhp;
  });

  return {
    furniture: selected,
    totalPhp: runningTotal,
    overBudget: budgetPhp > 0 && runningTotal > budgetPhp,
    withinBudget: !(budgetPhp > 0 && runningTotal > budgetPhp),
  };
}

/**
 * If over budget, rebuild using the cheapest valid set that still includes required SKUs.
 */
export function selectCheapestValidSet(pool, options) {
  const requiredIds = [...new Set((options.requiredItemIds || []).map((id) => String(id).toLowerCase()))];
  const requiredItems = requiredIds
    .map((id) => pool.find((item) => item.catalogId === id))
    .filter(Boolean);

  const requiredCost = requiredItems.reduce((sum, item) => sum + item.pricePhp, 0);
  const budget = options.budgetPhp > 0 ? options.budgetPhp : Infinity;

  const byRole = new Map();
  pool.forEach((item) => {
    const role = roleOfItem(item);
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push(item);
  });
  byRole.forEach((list, role) => {
    byRole.set(role, rankCandidates(list, options.style, 0));
  });

  const normalizedRoom = normalizeRoomType(options.roomType);
  const slots = ROOM_ROLE_SLOTS[normalizedRoom] || ROOM_ROLE_SLOTS['Living Room'];
  const usedIds = new Set(requiredItems.map((item) => item.catalogId));
  const selected = [...requiredItems];
  let total = requiredCost;

  slots.forEach((slotRole) => {
    if (selected.some((item) => matchesRole(item, slotRole))) return;
    const aliases = ROLE_ALIASES[slotRole] || [slotRole];
    let pick = null;
    aliases.some((alias) => {
      const list = byRole.get(alias) || [];
      pick = list.find((item) => !usedIds.has(item.catalogId));
      return Boolean(pick);
    });
    if (!pick) return;
    if (total + pick.pricePhp > budget && budget !== Infinity) return;
    usedIds.add(pick.catalogId);
    selected.push(pick);
    total += pick.pricePhp;
  });

  return {
    furniture: selected,
    totalPhp: total,
    overBudget: options.budgetPhp > 0 && total > options.budgetPhp,
    withinBudget: !(options.budgetPhp > 0 && total > options.budgetPhp),
  };
}

export async function loadEligibleCatalogPool(roomType, { requireStock = true } = {}) {
  const normalizedRoom = normalizeRoomType(roomType);
  const docs = await Furniture.find({ active: { $ne: false } }).lean();
  const mapped = docs.map(mapDocToPlannerItem);
  let eligible = docs
    .map((doc, index) => ({ doc, item: mapped[index] }))
    .filter(({ doc }) => isCatalogEligible(doc, normalizedRoom, { requireStock }))
    .map(({ item }) => item);

  if (eligible.length === 0 && docs.length > 0) {
    eligible = docs
      .map((doc, index) => ({ doc, item: mapped[index] }))
      .filter(({ doc }) => doc.active !== false && resolvePricePhp(doc) > 0)
      .map(({ item }) => item);
  }

  return eligible;
}

async function ensureRequiredInPool(pool, requiredItemIds = []) {
  const ids = [...new Set(requiredItemIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean))];
  const missing = ids.filter((id) => !pool.some((item) => item.catalogId === id));
  if (missing.length === 0) return pool;
  const docs = await Furniture.find({ id: { $in: missing } }).lean();
  const extra = docs.map(mapDocToPlannerItem);
  return [...pool, ...extra.filter((item) => !pool.some((p) => p.catalogId === item.catalogId))];
}

export async function buildCatalogLayoutSets({
  roomType,
  style,
  budgetPhp = 0,
  requiredItemIds = [],
  variationCount = 3,
}) {
  let pool = await loadEligibleCatalogPool(roomType);
  pool = await ensureRequiredInPool(pool, requiredItemIds);
  const sets = [];
  const meta = [];

  for (let variant = 0; variant < variationCount; variant += 1) {
    let selection = selectCatalogFurnitureSet(pool, {
      roomType,
      style,
      budgetPhp,
      requiredItemIds,
      variantIndex: variant,
    });

    if (selection.overBudget && budgetPhp > 0) {
      const cheapest = selectCheapestValidSet(pool, {
        roomType,
        style,
        budgetPhp,
        requiredItemIds,
      });
      if (cheapest.furniture.length > 0) {
        selection = { ...cheapest, usedCheapestFallback: true };
      }
    }

    if (selection.furniture.length === 0) {
      continue;
    }

    sets.push(selection.furniture);
    meta.push({
      totalPhp: selection.totalPhp,
      overBudget: selection.overBudget,
      withinBudget: selection.withinBudget,
    });
  }

  if (sets.length === 0 && pool.length > 0) {
    const fallback = selectCheapestValidSet(pool, {
      roomType,
      style,
      budgetPhp: 0,
      requiredItemIds,
    });
    if (fallback.furniture.length > 0) {
      sets.push(fallback.furniture);
      meta.push({
        totalPhp: fallback.totalPhp,
        overBudget: budgetPhp > 0 && fallback.totalPhp > budgetPhp,
        withinBudget: false,
      });
    }
  }

  return { sets, meta, poolSize: pool.length };
}

export function sumCatalogPricePhp(furniture) {
  return furniture.reduce((sum, item) => sum + (Number(item.pricePhp) || 0), 0);
}

export function estimateFurnitureCostPhp(furniture, { buffer = 0.1 } = {}) {
  const subtotalPhp = sumCatalogPricePhp(furniture);
  const bufferPhp = Math.round(subtotalPhp * buffer);
  return {
    subtotalPhp,
    bufferPhp,
    totalPhp: subtotalPhp + bufferPhp,
    currency: 'PHP',
  };
}

export default {
  buildCatalogLayoutSets,
  loadEligibleCatalogPool,
  selectCatalogFurnitureSet,
  mapDocToPlannerItem,
  sumCatalogPricePhp,
  estimateFurnitureCostPhp,
};
