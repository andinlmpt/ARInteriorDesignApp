/**
 * AI Design Controller
 * Generative AI design service with genetic algorithms
 * 
 * Moved from: frontend/services/GenerativeAIDesignService.ts
 */

import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import DesignSession from '../models/DesignSession.js';
import Furniture from '../models/Furniture.js';
import { mockPricePhp } from '../utils/furnitureMockPricing.js';
import mongoose from 'mongoose';
import RoomMeasurement from '../models/RoomMeasurement.js';
import { planLayouts } from '../services/layoutPlanner.js';
import { buildRoomFeatures, resolvePlannerRoom } from '../services/roomFeatures.js';
import {
  buildCatalogLayoutSets,
  estimateFurnitureCostPhp,
  sumCatalogPricePhp,
} from '../services/catalogLayoutSelector.js';

dotenv.config();

// ============================================================================
// GENETIC ALGORITHM CONFIGURATION
// ============================================================================

const GA_CONFIG = {
  populationSize: 20,
  maxIterations: 100,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  eliteCount: 3,
};

// ============================================================================
// FURNITURE DATABASE
// ============================================================================

const FURNITURE_CATALOG = {
  'Living Room': [
    { type: 'sofa', name: '3-Seater Sofa', width: 2.2, length: 0.9, height: 0.85, category: 'seating' },
    { type: 'armchair', name: 'Accent Armchair', width: 0.8, length: 0.8, height: 0.9, category: 'seating' },
    { type: 'coffee-table', name: 'Coffee Table', width: 1.2, length: 0.6, height: 0.45, category: 'table' },
    { type: 'side-table', name: 'Side Table', width: 0.5, length: 0.5, height: 0.55, category: 'table' },
    { type: 'tv-stand', name: 'TV Console', width: 1.8, length: 0.45, height: 0.5, category: 'storage' },
    { type: 'bookshelf', name: 'Bookshelf', width: 1.0, length: 0.35, height: 1.8, category: 'storage' },
    { type: 'floor-lamp', name: 'Floor Lamp', width: 0.4, length: 0.4, height: 1.7, category: 'lighting' },
    { type: 'rug', name: 'Area Rug', width: 2.5, length: 3.5, height: 0.02, category: 'decor' },
  ],
  'Bedroom': [
    { type: 'bed', name: 'Queen Bed', width: 1.6, length: 2.1, height: 0.5, category: 'bed' },
    { type: 'nightstand', name: 'Nightstand', width: 0.5, length: 0.4, height: 0.55, category: 'table' },
    { type: 'dresser', name: 'Dresser', width: 1.4, length: 0.5, height: 0.8, category: 'storage' },
    { type: 'wardrobe', name: 'Wardrobe', width: 1.8, length: 0.6, height: 2.2, category: 'storage' },
    { type: 'desk', name: 'Writing Desk', width: 1.2, length: 0.6, height: 0.75, category: 'table' },
    { type: 'chair', name: 'Desk Chair', width: 0.5, length: 0.5, height: 0.9, category: 'seating' },
  ],
  'Office': [
    { type: 'desk', name: 'Office Desk', width: 1.6, length: 0.8, height: 0.75, category: 'table' },
    { type: 'office-chair', name: 'Ergonomic Chair', width: 0.65, length: 0.65, height: 1.2, category: 'seating' },
    { type: 'bookshelf', name: 'Office Bookshelf', width: 1.2, length: 0.35, height: 2.0, category: 'storage' },
    { type: 'filing-cabinet', name: 'Filing Cabinet', width: 0.5, length: 0.6, height: 0.7, category: 'storage' },
    { type: 'guest-chair', name: 'Guest Chair', width: 0.6, length: 0.6, height: 0.85, category: 'seating' },
  ],
  'Kitchen': [
    { type: 'dining-table', name: 'Dining Table', width: 1.4, length: 0.9, height: 0.75, category: 'table' },
    { type: 'dining-chair', name: 'Dining Chair', width: 0.45, length: 0.5, height: 0.9, category: 'seating' },
    { type: 'kitchen-island', name: 'Kitchen Island', width: 1.2, length: 0.8, height: 0.9, category: 'storage' },
    { type: 'bar-stool', name: 'Bar Stool', width: 0.4, length: 0.4, height: 0.75, category: 'seating' },
  ],
  'Dining Room': [
    { type: 'dining-table', name: 'Dining Table', width: 1.8, length: 1.0, height: 0.75, category: 'table' },
    { type: 'dining-chair', name: 'Dining Chair', width: 0.45, length: 0.5, height: 0.9, category: 'seating' },
    { type: 'buffet', name: 'Buffet Cabinet', width: 1.6, length: 0.5, height: 0.85, category: 'storage' },
    { type: 'china-cabinet', name: 'China Cabinet', width: 1.2, length: 0.45, height: 1.8, category: 'storage' },
  ],
};

// ============================================================================
// COST ESTIMATION
// ============================================================================

const PRICE_RANGES = {
  low: { sofa: [500, 1200], bed: [400, 900], desk: [200, 500], chair: [100, 300], table: [150, 400], storage: [200, 600], lighting: [50, 200], decor: [50, 200] },
  medium: { sofa: [1200, 3000], bed: [900, 2500], desk: [500, 1200], chair: [300, 800], table: [400, 1000], storage: [600, 1500], lighting: [200, 600], decor: [200, 600] },
  high: { sofa: [3000, 8000], bed: [2500, 6000], desk: [1200, 3000], chair: [800, 2000], table: [1000, 3000], storage: [1500, 4000], lighting: [600, 2000], decor: [600, 2000] },
  luxury: { sofa: [8000, 25000], bed: [6000, 20000], desk: [3000, 10000], chair: [2000, 8000], table: [3000, 12000], storage: [4000, 15000], lighting: [2000, 8000], decor: [2000, 8000] },
};

function estimateCost(furniture, budget = 'medium') {
  const ranges = PRICE_RANGES[budget] || PRICE_RANGES.medium;
  let low = 0;
  let high = 0;

  furniture.forEach(item => {
    const category = item.category || 'decor';
    const range = ranges[category] || ranges.decor;
    low += range[0];
    high += range[1];
  });

  return { low, high, average: Math.round((low + high) / 2) };
}

// ============================================================================
// GENETIC ALGORITHM ENGINE
// ============================================================================

function createInitialPopulation(roomDimensions, furnitureList, populationSize) {
  const population = [];

  for (let i = 0; i < populationSize; i++) {
    const layout = furnitureList.map((item, idx) => ({
      ...item,
      id: `furniture-${idx}-${uuidv4().substring(0, 8)}`,
      position: {
        x: Math.random() * (roomDimensions.width - item.width),
        y: 0,
        z: Math.random() * (roomDimensions.length - item.length),
        rotation: Math.floor(Math.random() * 4) * 90,
      },
    }));
    population.push(layout);
  }

  return population;
}

function calculateFitness(layout, roomDimensions, constraints) {
  let fitness = 100;

  // Check collisions
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      if (checkCollision(layout[i], layout[j])) {
        fitness -= 20;
      }
    }
  }

  // Check boundary violations
  layout.forEach(item => {
    const pos = item.position;
    const dims = item.dimensions || item;

    if (pos.x < 0 || pos.x + dims.width > roomDimensions.width) {
      fitness -= 10;
    }
    if (pos.z < 0 || pos.z + dims.length > roomDimensions.length) {
      fitness -= 10;
    }
  });

  // Check walkway clearance
  if (constraints?.minimumWalkwayDistance) {
    const clearance = calculateMinimumClearance(layout);
    if (clearance < constraints.minimumWalkwayDistance) {
      fitness -= 15;
    }
  }

  // Bonus for good flow
  fitness += calculateFlowScore(layout, roomDimensions) * 0.2;

  // Bonus for symmetry
  fitness += calculateSymmetryScore(layout, roomDimensions) * 0.1;

  return Math.max(0, Math.min(100, fitness));
}

function checkCollision(item1, item2) {
  const pos1 = item1.position;
  const pos2 = item2.position;
  const dims1 = item1.dimensions || item1;
  const dims2 = item2.dimensions || item2;

  return !(
    pos1.x + dims1.width < pos2.x ||
    pos2.x + dims2.width < pos1.x ||
    pos1.z + dims1.length < pos2.z ||
    pos2.z + dims2.length < pos1.z
  );
}

function calculateMinimumClearance(layout) {
  let minClearance = Infinity;

  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const dist = calculateDistance(layout[i], layout[j]);
      if (dist < minClearance) {
        minClearance = dist;
      }
    }
  }

  return minClearance === Infinity ? 2.0 : minClearance;
}

function calculateDistance(item1, item2) {
  const center1 = {
    x: item1.position.x + (item1.dimensions?.width || item1.width) / 2,
    z: item1.position.z + (item1.dimensions?.length || item1.length) / 2,
  };
  const center2 = {
    x: item2.position.x + (item2.dimensions?.width || item2.width) / 2,
    z: item2.position.z + (item2.dimensions?.length || item2.length) / 2,
  };
  return Math.sqrt(Math.pow(center1.x - center2.x, 2) + Math.pow(center1.z - center2.z, 2));
}

function calculateFlowScore(layout, roomDimensions) {
  // Simple flow score based on furniture not blocking center
  const centerX = roomDimensions.width / 2;
  const centerZ = roomDimensions.length / 2;
  let blockedCenter = 0;

  layout.forEach(item => {
    const pos = item.position;
    const dims = item.dimensions || item;
    if (pos.x < centerX && pos.x + dims.width > centerX &&
      pos.z < centerZ && pos.z + dims.length > centerZ) {
      blockedCenter++;
    }
  });

  return Math.max(0, 100 - blockedCenter * 20);
}

function calculateSymmetryScore(layout, roomDimensions) {
  const centerX = roomDimensions.width / 2;
  let symmetryScore = 0;

  layout.forEach(item => {
    const pos = item.position;
    const dims = item.dimensions || item;
    const itemCenterX = pos.x + dims.width / 2;
    const deviation = Math.abs(itemCenterX - centerX);
    symmetryScore += Math.max(0, 1 - deviation / (roomDimensions.width / 2));
  });

  return (symmetryScore / layout.length) * 100;
}

function crossover(parent1, parent2) {
  const crossoverPoint = Math.floor(Math.random() * parent1.length);
  const child = [];

  for (let i = 0; i < parent1.length; i++) {
    if (i < crossoverPoint) {
      child.push({ ...parent1[i] });
    } else {
      child.push({
        ...parent1[i],
        position: { ...parent2[i].position },
      });
    }
  }

  return child;
}

function mutate(layout, roomDimensions, mutationRate) {
  return layout.map(item => {
    if (Math.random() < mutationRate) {
      const dims = item.dimensions || item;
      return {
        ...item,
        position: {
          x: Math.max(0, Math.min(roomDimensions.width - dims.width, item.position.x + (Math.random() - 0.5) * 0.5)),
          y: 0,
          z: Math.max(0, Math.min(roomDimensions.length - dims.length, item.position.z + (Math.random() - 0.5) * 0.5)),
          rotation: Math.random() < 0.3 ? Math.floor(Math.random() * 4) * 90 : item.position.rotation,
        },
      };
    }
    return item;
  });
}

function runGeneticAlgorithm(roomDimensions, furnitureList, constraints, iterations = 50) {
  let population = createInitialPopulation(roomDimensions, furnitureList, GA_CONFIG.populationSize);

  for (let gen = 0; gen < iterations; gen++) {
    // Calculate fitness for all
    const scored = population.map(layout => ({
      layout,
      fitness: calculateFitness(layout, roomDimensions, constraints),
    }));

    // Sort by fitness
    scored.sort((a, b) => b.fitness - a.fitness);

    // Keep elite
    const newPopulation = scored.slice(0, GA_CONFIG.eliteCount).map(s => s.layout);

    // Generate new population
    while (newPopulation.length < GA_CONFIG.populationSize) {
      const parent1 = scored[Math.floor(Math.random() * Math.min(5, scored.length))].layout;
      const parent2 = scored[Math.floor(Math.random() * Math.min(5, scored.length))].layout;

      let child = crossover(parent1, parent2);
      child = mutate(child, roomDimensions, GA_CONFIG.mutationRate);
      newPopulation.push(child);
    }

    population = newPopulation;
  }

  // Return best layout
  const finalScored = population.map(layout => ({
    layout,
    fitness: calculateFitness(layout, roomDimensions, constraints),
  }));
  finalScored.sort((a, b) => b.fitness - a.fitness);

  return finalScored[0];
}

// ============================================================================
// COLOR PALETTE GENERATION
// ============================================================================

const STYLE_PALETTES = {
  'Modern': ['#FFFFFF', '#F5F5F5', '#333333', '#007AFF', '#E0E0E0'],
  'Scandinavian': ['#F5F5F5', '#E8E8E8', '#D4C5B9', '#A8956B', '#6B8E91'],
  'Industrial': ['#3C3C3C', '#7F7F7F', '#B87333', '#2F4F4F', '#DAA520'],
  'Bohemian': ['#E8DED2', '#C9A86A', '#8B7355', '#D4AF37', '#9B59B6'],
  'Minimalist': ['#FFFFFF', '#F0F0F0', '#CCCCCC', '#333333', '#666666'],
  'Traditional': ['#8B4513', '#D2691E', '#F5DEB3', '#CD853F', '#FFFFFF'],
  'Contemporary': ['#2C2C2C', '#4A4A4A', '#007AFF', '#FFFFFF', '#F5F5F5'],
  'Rustic': ['#8B4513', '#D2691E', '#F5DEB3', '#228B22', '#654321'],
  'Mid-Century': ['#E07B53', '#2C5F2D', '#D4A574', '#F5E6C8', '#4A4A4A'],
  'Eclectic': ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#9B59B6'],
};

function generateColorPalette(style) {
  return STYLE_PALETTES[style] || STYLE_PALETTES['Modern'];
}

const PHP_PRICE_RANGES = {
  seating: [2500, 18000],
  sofa: [12000, 35000],
  bed: [8000, 28000],
  table: [2500, 15000],
  desk: [3500, 14000],
  storage: [4000, 20000],
  lighting: [800, 5000],
  decor: [500, 4000],
  chair: [1200, 8000],
  other: [1500, 8000],
};

const DESIGN_LAYOUT_COUNT = 2;
/** Anchor walls tried per option before accepting a layout that matches an earlier option. */
const WALL_VARIANTS = 4;

/**
 * Two layouts look the same to a user when the same pieces face the same walls;
 * sliding a piece along its wall is not a different option.
 */
function sameArrangement(a, b) {
  const signature = (items) => items
    .map((item) => `${item.catalogId}@${((Number(item.position?.rotation) || 0) % 360 + 360) % 360}`)
    .sort()
    .join('|');
  return signature(a) === signature(b);
}

function inferCatalogType(value) {
  const v = String(value || '').toLowerCase();
  if (/\b(bed|beds|mattress)\b/.test(v)) return 'bed';
  if (/\b(desk|study)\b/.test(v)) return 'desk';
  if (/\b(sofa|couch|sectional)\b/.test(v)) return 'sofa';
  if (/\b(wardrobe|armoire)\b/.test(v)) return 'wardrobe';
  if (/\b(dining[- ]?table)\b/.test(v)) return 'dining-table';
  if (/\b(chair|stool)\b/.test(v)) return 'chair';
  return v.replace(/\s+/g, '-');
}

function phpRangeForItem(item) {
  const keys = [item.category, item.type, inferCatalogType(item.name), 'other'];
  for (const key of keys) {
    if (key && PHP_PRICE_RANGES[key]) return PHP_PRICE_RANGES[key];
  }
  return PHP_PRICE_RANGES.other;
}

function estimateCostPhp(furniture) {
  const catalogTotal = sumCatalogPricePhp(furniture);
  if (catalogTotal > 0) return catalogTotal;
  let total = 0;
  furniture.forEach((item) => {
    if (Number.isFinite(item.pricePhp) && item.pricePhp > 0) {
      total += item.pricePhp;
      return;
    }
    const range = phpRangeForItem(item);
    const mid = Math.round((range[0] + range[1]) / 2);
    item.pricePhp = mid;
    total += mid;
  });
  return total;
}

function catalogIdFromPlacedItem(item) {
  return item.catalogId || String(item.id || '').replace(/-v\d+-\d+$/, '');
}

function normalizeRoomDimensions(dimensions = {}) {
  const width = Number(dimensions.width) || 4;
  const length = Number(dimensions.length) || Number(dimensions.depth) || 5;
  const height = Number(dimensions.height) || 2.7;
  return { width, length, height };
}

function mapFurnitureForGa(item, index) {
  const width = Number(item.width) || Number(item.dimensions?.width) || 1;
  const length = Number(item.length) || Number(item.depth) || Number(item.dimensions?.length) || 0.8;
  const height = Number(item.height) || Number(item.dimensions?.height) || 0.8;
  return {
    ...item,
    id: item.id || item.type || `item-${index}`,
    type: item.type || inferCatalogType(item.name || item.category),
    name: item.name || item.displayName || item.type || 'Furniture',
    width,
    length,
    height,
    dimensions: { width, length, height },
    category: item.category || 'other',
    glbUrl: item.glbUrl || '',
    pricePhp: Number(item.pricePhp) || 0,
  };
}

function ensureRequiredFurniture(list, requiredItemIds = [], requiredCategories = []) {
  const result = [...list];
  const wantedTypes = [
    ...requiredItemIds.map(inferCatalogType),
    ...requiredCategories.map(inferCatalogType),
  ].filter(Boolean);

  wantedTypes.forEach((type) => {
    const already = result.some(
      (item) => inferCatalogType(item.type) === type || inferCatalogType(item.name) === type,
    );
    if (already) return;
    const fromAll = Object.values(FURNITURE_CATALOG)
      .flat()
      .find((item) => inferCatalogType(item.type) === type || inferCatalogType(item.name) === type);
    if (fromAll) result.push(mapFurnitureForGa(fromAll, result.length));
  });

  return result;
}

async function resolveFurnitureList(roomType, requiredItemIds = [], requiredCategories = []) {
  const catalogKey = {
    'Living Room': 'Living Room',
    Bedroom: 'Bedroom',
    'Dining Area': 'Dining Room',
    'Dining Room': 'Dining Room',
    Office: 'Office',
    Kitchen: 'Kitchen',
  }[roomType] || 'Living Room';

  let list = (FURNITURE_CATALOG[catalogKey] || FURNITURE_CATALOG['Living Room']).map(mapFurnitureForGa);

  if (requiredItemIds.length > 0) {
    try {
      const docs = await Furniture.find({ id: { $in: requiredItemIds }, active: { $ne: false } }).lean();
      docs.forEach((doc, index) => {
        const mapped = mapFurnitureForGa(
          {
            id: doc.id,
            type: inferCatalogType(doc.category || doc.displayName),
            name: doc.displayName,
            width: doc.width,
            length: doc.depth,
            height: doc.height,
            category: doc.category || 'other',
            glbUrl: doc.glbUrl,
            pricePhp: mockPricePhp(doc),
          },
          list.length + index,
        );
        const existing = list.findIndex((item) => inferCatalogType(item.type) === mapped.type);
        if (existing >= 0) list[existing] = mapped;
        else list.push(mapped);
      });
    } catch (error) {
      console.warn('[AIDesign] Could not load required catalog items:', error.message);
    }
  }

  return ensureRequiredFurniture(list, requiredItemIds, requiredCategories);
}

function toLayoutItems(furniture, colorPalette = []) {
  return furniture.map((item, idx) => {
    const dims = item.dimensions || item;
    return {
      instanceId: item.instanceId || item.placementId || `${item.catalogId || item.id || `item-${idx}`}-${idx}`,
      furnitureId: item.catalogId || item.id || item.type || `item-${idx}`,
      displayName: item.name,
      glbUrl: item.glbUrl || '',
      category: item.category || 'other',
      width: dims.width,
      height: dims.height,
      depth: dims.length,
      localPosition: {
        x: item.position?.x ?? 0,
        y: item.position?.y ?? 0,
        z: item.position?.z ?? 0,
      },
      rotationY: item.position?.rotation ?? 0,
      color: colorPalette[idx % colorPalette.length],
      pricePhp: Number(item.pricePhp) || 0,
      role: item.role || '',
    };
  });
}

function buildProposal({
  furniture,
  roomType,
  designStyle,
  dimensions,
  budgetPhp,
  title,
  description,
  colorPalette,
  fitness,
  scoreBreakdown,
  pros,
  cons,
  rank,
  optimization,
}) {
  const totalPhp = estimateCostPhp(furniture);
  const usdCost = estimateCost(furniture, 'medium');
  const performanceScore = scoreBreakdown
    ? {
      overall: scoreBreakdown.overall,
      spaceEfficiency: scoreBreakdown.space,
      comfort: scoreBreakdown.relations,
      accessibility: scoreBreakdown.clearance,
      aesthetics: Math.round((scoreBreakdown.balance + scoreBreakdown.wall) / 2),
      lighting: Math.round(72 + (rank * 3) % 20),
      ergonomics: scoreBreakdown.relations,
      traffic: scoreBreakdown.flow,
      functionalFlow: scoreBreakdown.flow,
      symmetry: scoreBreakdown.balance,
    }
    : {
      overall: Math.round(fitness),
      spaceEfficiency: Math.round(Math.min(100, fitness * 0.9 + 8)),
      comfort: Math.round(Math.min(100, fitness * 0.85 + 10)),
      accessibility: Math.round(Math.min(100, fitness * 0.95 + 4)),
      aesthetics: Math.round(Math.min(100, fitness * 0.8 + 12)),
      lighting: Math.round(72 + (rank * 3) % 20),
      ergonomics: Math.round(74 + (rank * 5) % 18),
      traffic: Math.round(fitness),
      functionalFlow: Math.round(Math.min(100, fitness * 0.88 + 6)),
      symmetry: Math.round(Math.min(100, fitness * 0.7 + 15)),
    };
  const budgetFit = budgetPhp > 0
    ? Math.max(0, Math.min(100, Math.round((1 - Math.max(0, totalPhp - budgetPhp) / budgetPhp) * 100)))
    : 100;

  return {
    id: `design-${Date.now()}-${uuidv4().substring(0, 8)}`,
    roomType,
    title,
    description,
    layout: {
      id: `layout-${Date.now()}-${rank}`,
      version: 1,
      furniture,
      metadata: {
        generatedAt: Date.now(),
        algorithm: optimization?.applied ? 'catalog-layout-planner-v1+guideline-annealing' : 'catalog-layout-planner-v1',
        iterationsCount: optimization?.iterations ?? GA_CONFIG.maxIterations,
        dimensions,
      },
    },
    performanceScore,
    colorPalette,
    recommendedFurniture: furniture,
    estimatedCost: {
      low: usdCost.low,
      mid: usdCost.average,
      high: usdCost.high,
      totalPhp,
      currency: 'PHP',
    },
    totalPhp,
    overBudget: budgetPhp > 0 && totalPhp > budgetPhp,
    items: toLayoutItems(furniture, colorPalette),
    score: {
      overall: performanceScore.overall,
      space: performanceScore.spaceEfficiency,
      flow: performanceScore.functionalFlow,
      budgetFit,
      ...(scoreBreakdown ? {
        clearance: scoreBreakdown.clearance,
        relations: scoreBreakdown.relations,
        wall: scoreBreakdown.wall,
        balance: scoreBreakdown.balance,
      } : {}),
    },
    pros: pros || ['Optimized traffic flow', 'Balanced furniture placement', `Tailored for ${roomType}`],
    cons: [
      ...(cons || (performanceScore.overall < 70 ? ['Some space constraints'] : [])),
      ...(budgetPhp > 0 && totalPhp > budgetPhp
        ? [`Over budget by ₱${Math.round(totalPhp - budgetPhp).toLocaleString('en-PH')}`]
        : []),
    ],
    rank,
    optimization: optimization || null,
  };
}

// ============================================================================
// MAIN CONTROLLER FUNCTIONS
// ============================================================================

/**
 * Scan data for the layout planner: the saved measurement (doors, windows, existing
 * furniture, outline) with request-body values taking precedence.
 */
async function loadRoomScan({ measurementId, floorPolygon, openings, obstacles }) {
  let saved = null;
  if (measurementId && mongoose.isValidObjectId(measurementId) && mongoose.connection.readyState === 1) {
    try {
      saved = await RoomMeasurement.findById(measurementId)
        .select('floorPolygon openings obstacles')
        .lean();
    } catch (error) {
      console.warn('[AIDesign] Could not load room measurement:', error.message);
    }
  }
  const pick = (body, stored) => (Array.isArray(body) && body.length > 0 ? body : stored || []);
  return {
    floorPolygon: pick(floorPolygon, saved?.floorPolygon),
    openings: pick(openings, saved?.openings),
    obstacles: pick(obstacles, saved?.obstacles),
  };
}

/**
 * Generate AI design proposals
 */
export async function generateDesign(req, res, next) {
  try {
    const startTime = Date.now();
    const {
      roomType,
      dimensions,
      designStyle,
      budget,
      budgetPhp,
      userPrompt,
      optimizationGoal,
      constraints,
      measurementId,
      projectId,
      requiredItemIds,
      requiredCategories,
      floorPolygon,
      openings,
      obstacles,
      notes,
      variationCount,
    } = req.body;

    const hasSubstantialPrompt = userPrompt && userPrompt.trim().length >= 10;

    if ((!roomType && !hasSubstantialPrompt) || !dimensions) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'roomType (or a descriptive prompt) and dimensions are required',
      });
    }

    let finalRoomType = roomType;
    if (hasSubstantialPrompt) {
      const lowerPrompt = userPrompt.toLowerCase();
      if (lowerPrompt.includes('bathroom')) finalRoomType = 'Bathroom';
      else if (lowerPrompt.includes('bedroom')) finalRoomType = 'Bedroom';
      else if (lowerPrompt.includes('kitchen')) finalRoomType = 'Kitchen';
      else if (lowerPrompt.includes('office')) finalRoomType = 'Office';
      else if (lowerPrompt.includes('dining')) finalRoomType = 'Dining Room';
      else if (lowerPrompt.includes('living')) finalRoomType = 'Living Room';
      else if (!finalRoomType) finalRoomType = 'Living Room';
    } else if (!finalRoomType) {
      finalRoomType = 'Living Room';
    }

    const style = designStyle || 'Modern';
    let roomDims = normalizeRoomDimensions(dimensions);
    // Same limits as finalizeDesign.
    if (![roomDims.width, roomDims.length, roomDims.height].every(value => Number.isFinite(value) && value > 0)
        || roomDims.width > 50 || roomDims.length > 50 || roomDims.height > 10) {
      return res.status(400).json({ error: 'room dimensions must be positive numbers within supported limits' });
    }
    const requestedLayouts = Math.min(DESIGN_LAYOUT_COUNT, Math.max(1, Number(variationCount) || DESIGN_LAYOUT_COUNT));
    const parsedBudgetPhp = Number(budgetPhp);
    const budgetValue = Number.isFinite(parsedBudgetPhp) && parsedBudgetPhp > 0 ? parsedBudgetPhp : 0;

    console.log(`🎨 [AIDesign] Generating ${requestedLayouts} layouts for ${finalRoomType} (${style})`);

    const requiredIds = Array.isArray(requiredItemIds) ? requiredItemIds : [];
    const { sets: catalogSets, meta: selectionMeta, poolSize } = await buildCatalogLayoutSets({
      roomType: finalRoomType,
      style,
      budgetPhp: budgetValue,
      requiredItemIds: requiredIds,
      variationCount: requestedLayouts,
    });

    if (catalogSets.length === 0) {
      return res.status(422).json({
        error: 'No catalog furniture',
        message: `No priced in-stock items match ${finalRoomType}. Add products in admin or adjust room/budget.`,
        poolSize,
      });
    }

    const roomScan = await loadRoomScan({ measurementId, floorPolygon, openings, obstacles });
    roomDims = resolvePlannerRoom(roomDims, roomScan);
    const roomFeatures = buildRoomFeatures(roomDims, roomScan);
    const detectedObstacles = [
      ...roomFeatures.doorZones.map(() => 'door'),
      ...roomFeatures.windowZones.map(() => 'window'),
      ...roomFeatures.obstacles.map((o) => o.type),
    ];

    const scoredLayouts = [];
    for (let variant = 0; variant < catalogSets.length; variant += 1) {
      // Start each option on a different anchor wall; move on to the next wall while the
      // layout repeats an earlier option. The optimizer can pull every start back to the same
      // arrangement, so later passes keep the planner's unrefined layout for each wall.
      // If every try repeats, the last one is kept.
      let plan = null;
      for (let attempt = 0; attempt < WALL_VARIANTS * 3; attempt += 1) {
        const wall = attempt % WALL_VARIANTS;
        [plan] = planLayouts(roomDims, catalogSets[variant], {
          count: 1,
          firstVariant: (variant + wall) % WALL_VARIANTS,
          seed: startTime + variant * 7919 + attempt * 104729,
          features: roomFeatures,
          optimize: attempt < WALL_VARIANTS,
        });
        const placed = (plan?.furniture || []).map((item) => ({
          catalogId: catalogIdFromPlacedItem(item),
          position: item.position,
        }));
        if (!scoredLayouts.some((entry) => sameArrangement(entry.furniture, placed))) break;
      }
      if (!plan) continue;
      const meta = selectionMeta[variant] || {};
      // Guideline scores describe placed furniture; with nothing placed they are vacuous.
      const empty = plan.furniture.length === 0;
      if (empty) {
        const area = roomDims.width * roomDims.length;
        plan.score = { ...plan.score, overall: 0 };
        plan.pros = [];
        plan.cons = [
          `No catalog furniture fits this ${area.toFixed(1)} m² room — rescan a larger area`,
          ...(plan.cons || []).filter((line) => line.startsWith('Could not fit')),
        ];
      }
      scoredLayouts.push({
        furniture: plan.furniture.map((item) => {
          const catalogId = catalogIdFromPlacedItem(item);
          return {
            instanceId: item.id,
            id: catalogId,
            catalogId,
            name: item.name,
            type: item.type || item.category,
            role: item.role,
            category: item.category,
            glbUrl: item.glbUrl || '',
            pricePhp: Number(item.pricePhp) || 0,
            dimensions: item.dimensions,
            position: item.position,
          };
        }),
        fitness: plan.score.overall,
        scoreBreakdown: plan.score,
        pros: plan.pros,
        cons: [
          ...(plan.cons || []),
          ...(meta.overBudget ? [`Catalog total exceeds ₱${budgetValue.toLocaleString('en-PH')} budget`] : []),
        ],
        selectionOverBudget: Boolean(meta.overBudget),
        optimization: plan.optimization,
      });
    }

    const colorPalette = generateColorPalette(style);

    const designTitle = `${style} ${finalRoomType} Design`;
    const designDescription = userPrompt
      || notes
      || `AI-optimized ${finalRoomType} layout with ${scoredLayouts[0]?.furniture.length || 0} furniture pieces`;

    const optionLabels = ['A', 'B', 'C'];
    const proposals = scoredLayouts.map((entry, index) => buildProposal({
      furniture: entry.furniture,
      roomType: finalRoomType,
      designStyle: style,
      dimensions: roomDims,
      budgetPhp: budgetValue,
      title: `${designTitle} — Option ${optionLabels[index] || index + 1}`,
      description: designDescription,
      colorPalette,
      fitness: entry.fitness,
      scoreBreakdown: entry.scoreBreakdown,
      pros: entry.pros,
      cons: entry.cons,
      rank: index + 1,
      optimization: entry.optimization,
    }));

    proposals.sort((a, b) => b.score.overall - a.score.overall);
    proposals.forEach((proposal, index) => {
      proposal.rank = index + 1;
      // Label after sorting so the best layout is always Option A.
      proposal.title = `${designTitle} — Option ${optionLabels[index] || index + 1}`;
    });

    const processingTime = Date.now() - startTime;
    let sessionId;

    try {
      const rawUserId = req.user?.userId || req.user?.id;
      const userId = typeof rawUserId === 'string' && /^[a-fA-F0-9]{24}$/.test(rawUserId)
        ? rawUserId
        : null;
      const session = new DesignSession({
        userId,
        projectId: projectId || '',
        measurementId: measurementId || '',
        roomDimensions: {
          width: roomDims.width,
          height: roomDims.height,
          depth: roomDims.length,
        },
        floorPolygon: roomScan.floorPolygon,
        detectedObstacles,
        preferences: {
          roomType: finalRoomType,
          style,
          availableFloorSpace: roomDims.width * roomDims.length,
          budgetPhp: budgetValue,
          requiredItemIds: Array.isArray(requiredItemIds) ? requiredItemIds : [],
          requiredCategories: Array.isArray(requiredCategories) ? requiredCategories : [],
          notes: notes || userPrompt || '',
        },
        generatedLayouts: proposals.map((p) => p.layout),
        proposals,
        status: 'generated',
      });
      await session.save();
      sessionId = String(session._id);
    } catch (dbError) {
      console.error('[AIDesign] Failed to save DesignSession:', dbError.message);
    }

    console.log(`✅ [AIDesign] Generated ${proposals.length} layouts in ${processingTime}ms`);

    res.json({
      sessionId,
      measurementId: measurementId || '',
      projectId: projectId || '',
      roomDimensions: {
        width: roomDims.width,
        height: roomDims.height,
        depth: roomDims.length,
      },
      proposals,
      bestFitRecommendation: proposals[0],
      alternativeOptions: proposals.slice(1),
      metadata: {
        totalProposalsGenerated: proposals.length,
        processingTime,
        algorithm: 'catalog-layout-planner-v1',
        confidenceScore: (proposals[0]?.score.overall || 0) / 100,
        optimizationGoal: optimizationGoal || 'balanced',
      },
    });
  } catch (error) {
    console.error('❌ [AIDesign] Error:', error);
    next(error);
  }
}

export async function getDesignSession(req, res, next) {
  try {
    const session = await DesignSession.findById(req.params.id).lean();
    if (!session) {
      return res.status(404).json({ error: 'Design session not found' });
    }
    if (session.userId && String(session.userId) !== String(req.user?.userId || req.user?.id || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const proposals = Array.isArray(session.proposals) && session.proposals.length > 0
      ? session.proposals
      : session.generatedLayouts || [];

    const finalLayout = session.finalLayout?.items?.length
      ? {
          proposalId: session.finalLayout.proposalId || session.selectedProposalId || '',
          title: session.finalLayout.title || '',
          items: session.finalLayout.items,
          totalPhp: session.finalLayout.totalPhp || 0,
          updatedAt: session.finalLayout.updatedAt
            ? new Date(session.finalLayout.updatedAt).getTime()
            : Date.now(),
          sessionId: String(session._id),
          projectId: session.projectId || '',
          measurementId: session.measurementId || '',
          room: {
            width: session.roomDimensions?.width || 0,
            length: session.roomDimensions?.depth || 0,
            height: session.roomDimensions?.height || 0,
          },
        }
      : null;

    res.json({
      sessionId: String(session._id),
      measurementId: session.measurementId || '',
      projectId: session.projectId || '',
      roomDimensions: session.roomDimensions,
      preferences: session.preferences,
      proposals,
      selectedProposalId: session.selectedProposalId || '',
      status: session.status || 'generated',
      finalLayout,
      finalizedAt: session.finalizedAt ? new Date(session.finalizedAt).getTime() : undefined,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save the customized layout from AR (step 7) onto a design session.
 */
export async function finalizeDesign(req, res, next) {
  try {
    const {
      sessionId,
      proposalId,
      projectId,
      measurementId,
      room,
      items,
      totalPhp,
      title,
      preferences,
    } = req.body || {};

    if (!proposalId || typeof proposalId !== 'string') {
      return res.status(400).json({ error: 'proposalId is required' });
    }
    if (!room || typeof room !== 'object') {
      return res.status(400).json({ error: 'room dimensions are required' });
    }
    const width = Number(room.width);
    const length = Number(room.length);
    const height = Number(room.height);
    if (![width, length, height].every(value => Number.isFinite(value) && value > 0)
        || width > 50 || length > 50 || height > 10) {
      return res.status(400).json({ error: 'room dimensions must be positive numbers within supported limits' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one furniture item is required' });
    }
    if (items.some(item => !item || !Number.isFinite(Number(item.pricePhp)) || Number(item.pricePhp) < 0)) {
      return res.status(400).json({ error: 'Furniture prices must be non-negative numbers' });
    }

    const computedTotal = items.reduce(
      (sum, item) => sum + (Number(item?.pricePhp) || 0),
      0,
    );
    // Customization can change the furniture list; derive its estimate instead of
    // persisting a stale total supplied by the previous proposal.
    const finalTotal = computedTotal;
    const finalTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'My design';

    const finalLayout = {
      proposalId,
      title: finalTitle,
      items,
      totalPhp: finalTotal,
      updatedAt: new Date(),
    };

    const rawUserId = req.user?.userId || req.user?.id;
    const userId =
      typeof rawUserId === 'string' && /^[a-fA-F0-9]{24}$/.test(rawUserId) ? rawUserId : null;

    let session = null;
    if (typeof sessionId === 'string' && /^[a-fA-F0-9]{24}$/.test(sessionId)) {
      session = await DesignSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Design session not found' });
      }
      if (session.userId && String(session.userId) !== String(rawUserId || '')) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (!session) {
      const prefs = preferences && typeof preferences === 'object'
        ? preferences
        : {
            roomType: 'Living Room',
            style: 'Modern',
            budgetPhp: 0,
            requiredItemIds: [],
            requiredCategories: [],
          };
      session = new DesignSession({
        userId,
        projectId: projectId || '',
        measurementId: measurementId || '',
        roomDimensions: { width, height, depth: length },
        preferences: prefs,
        proposals: [],
        status: 'finalized',
      });
    }

    if (projectId) session.projectId = String(projectId);
    if (measurementId) session.measurementId = String(measurementId);
    if (userId && !session.userId) session.userId = userId;

    session.selectedProposalId = proposalId;
    session.finalLayout = finalLayout;
    session.status = 'finalized';
    session.finalizedAt = new Date();
    session.roomDimensions = { width, height, depth: length };

    await session.save();

    const responseLayout = {
      proposalId,
      title: finalTitle,
      items,
      totalPhp: finalTotal,
      updatedAt: finalLayout.updatedAt.getTime(),
      sessionId: String(session._id),
      projectId: session.projectId || '',
      measurementId: session.measurementId || '',
      room: { width, length, height },
    };

    res.json({
      sessionId: String(session._id),
      status: 'finalized',
      projectId: session.projectId || '',
      measurementId: session.measurementId || '',
      roomDimensions: session.roomDimensions,
      preferences: session.preferences,
      finalLayout: responseLayout,
      finalizedAt: session.finalizedAt.getTime(),
    });
  } catch (error) {
    console.error('[AIDesign] finalizeDesign error:', error);
    next(error);
  }
}

/**
 * Get furniture catalog for a room type
 */
export async function getFurnitureCatalog(req, res) {
  const { roomType } = req.params;
  const catalog = FURNITURE_CATALOG[roomType] || FURNITURE_CATALOG['Living Room'];

  res.json({
    roomType: roomType || 'Living Room',
    furniture: catalog,
    total: catalog.length,
  });
}

/**
 * Estimate cost for furniture list
 */
export async function estimateFurnitureCost(req, res) {
  const { furniture, budget, budgetPhp, includeBuffer = true } = req.body;

  if (!furniture || !Array.isArray(furniture)) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'furniture array is required',
    });
  }

  const phpCost = estimateFurnitureCostPhp(furniture, { buffer: includeBuffer ? 0.1 : 0 });
  const parsedBudgetPhp = Number(budgetPhp);
  const budgetValue = Number.isFinite(parsedBudgetPhp) && parsedBudgetPhp > 0 ? parsedBudgetPhp : 0;

  res.json({
    ...phpCost,
    totalPhp: includeBuffer ? phpCost.totalPhp : phpCost.subtotalPhp,
    overBudget: budgetValue > 0 && phpCost.subtotalPhp > budgetValue,
    budgetPhp: budgetValue,
    legacy: estimateCost(furniture, budget || 'medium'),
  });
}

export default {
  generateDesign,
  getDesignSession,
  finalizeDesign,
  getFurnitureCatalog,
  estimateFurnitureCost,
};

