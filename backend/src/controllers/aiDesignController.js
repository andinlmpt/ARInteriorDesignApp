/**
 * AI Design Controller
 * Generative AI design service with genetic algorithms
 * 
 * Moved from: frontend/services/GenerativeAIDesignService.ts
 */

import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import groqService from '../services/groqService.js';
import DesignSession from '../models/DesignSession.js';

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

/** Number of layout variations (and preview images) returned per AI Design request */
const LAYOUT_VARIATION_COUNT = 6;

function padLayoutsToCount(layouts, count = LAYOUT_VARIATION_COUNT) {
  if (!Array.isArray(layouts) || layouts.length === 0) return layouts;

  const result = layouts.map((layout, index) => ({
    ...layout,
    id: layout.id || `layout_${index + 1}`,
    furniture: Array.isArray(layout.furniture) ? layout.furniture : [],
    safety_warnings: Array.isArray(layout.safety_warnings) ? layout.safety_warnings : [],
  }));

  while (result.length < count) {
    const base = layouts[result.length % layouts.length];
    result.push({
      ...base,
      id: `layout_${result.length + 1}`,
      score: Math.max(50, (base.score || 70) - (result.length - layouts.length + 1) * 5),
      furniture: (base.furniture || []).map((item) => ({ ...item })),
      safety_warnings: [...(base.safety_warnings || [])],
    });
  }

  return result.slice(0, count);
}

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
// STYLE COLOR SCHEMES FOR FALLBACK
// ============================================================================

const STYLE_COLORS = {
  Minimalist:   ['#f1f5f9', '#e2e8f0', '#94a3b8', '#64748b', '#f8fafc'],
  Modern:       ['#a0c4ff', '#bdb2ff', '#ffc6ff', '#caffbf', '#9bf6ff'],
  Traditional:  ['#c9a86a', '#d4a574', '#b8860b', '#8b7355', '#f5deb3'],
  Scandinavian: ['#a8d5e2', '#d4e8d0', '#f7c5a0', '#e8d5c4', '#b8d4e8'],
  Industrial:   ['#a0a0a0', '#808080', '#b87333', '#5a5a5a', '#c0b090'],
};

// ============================================================================
// SMART RULE-BASED FALLBACK LAYOUT GENERATOR
// ============================================================================

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function generateFallbackLayouts(roomDimensions, roomType, style, detectedObstacles = []) {
  const W = roomDimensions.width || 5;
  const D = roomDimensions.depth || 4;
  const PAD = 0.15;
  const colorPalette = STYLE_COLORS[style] || STYLE_COLORS.Modern;

  const catalogKey = { 'Living Room': 'Living Room', 'Bedroom': 'Bedroom', 'Dining Area': 'Dining Room', 'Office': 'Office' }[roomType] || 'Living Room';
  const catalog = FURNITURE_CATALOG[catalogKey] || FURNITURE_CATALOG['Living Room'];

  function makeFurn(item, x, y, rotation = 0, colorIdx = 0) {
    const fw = (rotation === 90 || rotation === 270) ? item.length : item.width;
    const fd = (rotation === 90 || rotation === 270) ? item.width : item.length;
    return {
      name: item.name,
      x: parseFloat(clamp(x, PAD, W - fw - PAD).toFixed(2)),
      y: parseFloat(clamp(y, PAD, D - fd - PAD).toFixed(2)),
      width: parseFloat(fw.toFixed(2)),
      depth: parseFloat(fd.toFixed(2)),
      rotation,
      color: colorPalette[colorIdx % colorPalette.length],
    };
  }

  const warnings = [];
  if (detectedObstacles.includes('door'))   warnings.push('Keep a clear 1m walkway path to the door.');
  if (detectedObstacles.includes('pillar')) warnings.push('Pillar may affect furniture placement — plan around it.');
  if (detectedObstacles.includes('window')) warnings.push('Avoid placing tall furniture in front of windows.');

  function buildLivingRoom() {
    const sofa = catalog.find(i => i.type === 'sofa');
    const chair = catalog.find(i => i.type === 'armchair');
    const coffee = catalog.find(i => i.type === 'coffee-table');
    const tv = catalog.find(i => i.type === 'tv-stand');
    const lamp = catalog.find(i => i.type === 'floor-lamp');
    return [
      { id: 'layout_1', score: 88, safety_warnings: warnings, furniture: [
        makeFurn(tv, PAD, PAD, 0, 0),
        makeFurn(sofa, (W - sofa.width) / 2, D - sofa.length - PAD, 0, 1),
        ...(coffee ? [makeFurn(coffee, (W - coffee.width) / 2, D - sofa.length - coffee.length - 0.6, 0, 2)] : []),
        ...(chair ? [makeFurn(chair, W - chair.width - PAD, D - chair.length - 0.8, 0, 3)] : []),
        ...(lamp ? [makeFurn(lamp, W - lamp.width - PAD, PAD, 0, 4)] : []),
      ]},
      { id: 'layout_2', score: 81, safety_warnings: warnings, furniture: [
        makeFurn(sofa, PAD, (D - sofa.length) / 2, 0, 0),
        makeFurn(tv, W - tv.width - PAD, (D - tv.length) / 2, 0, 1),
        ...(coffee ? [makeFurn(coffee, (W - coffee.width) / 2, (D - coffee.length) / 2, 0, 2)] : []),
        ...(chair ? [makeFurn(chair, PAD, PAD, 0, 3)] : []),
        ...(lamp ? [makeFurn(lamp, W - lamp.width - PAD, D - lamp.length - PAD, 0, 4)] : []),
      ]},
      { id: 'layout_3', score: 75, safety_warnings: warnings, furniture: [
        makeFurn(sofa, PAD, PAD, 0, 1),
        makeFurn(tv, W - tv.width - PAD, PAD, 0, 0),
        ...(coffee ? [makeFurn(coffee, (W - coffee.width) / 2, PAD + sofa.length + 0.3, 0, 2)] : []),
        ...(chair ? [makeFurn(chair, (W - chair.width) / 2, D - chair.length - PAD, 0, 3)] : []),
      ]},
    ];
  }

  function buildBedroom() {
    const bed = catalog.find(i => i.type === 'bed');
    const night = catalog.find(i => i.type === 'nightstand');
    const dresser = catalog.find(i => i.type === 'dresser');
    const wardrobe = catalog.find(i => i.type === 'wardrobe');
    const desk = catalog.find(i => i.type === 'desk');
    return [
      { id: 'layout_1', score: 90, safety_warnings: warnings, furniture: [
        makeFurn(bed, (W - bed.width) / 2, PAD, 0, 0),
        ...(night ? [makeFurn(night, (W - bed.width) / 2 - night.width - 0.1, PAD + 0.3, 0, 2)] : []),
        ...(night ? [makeFurn(night, (W - bed.width) / 2 + bed.width + 0.1, PAD + 0.3, 0, 2)] : []),
        ...(wardrobe ? [makeFurn(wardrobe, W - wardrobe.width - PAD, PAD, 0, 1)] : []),
        ...(dresser ? [makeFurn(dresser, PAD, D - dresser.length - PAD, 0, 3)] : []),
      ]},
      { id: 'layout_2', score: 83, safety_warnings: warnings, furniture: [
        makeFurn(bed, PAD, (D - bed.length) / 2, 0, 0),
        ...(night ? [makeFurn(night, PAD + bed.width + 0.1, (D - bed.length) / 2 + 0.3, 0, 2)] : []),
        ...(dresser ? [makeFurn(dresser, W - dresser.width - PAD, PAD, 0, 3)] : []),
        ...(desk ? [makeFurn(desk, W - desk.width - PAD, D - desk.length - PAD, 0, 4)] : []),
      ]},
      { id: 'layout_3', score: 76, safety_warnings: warnings, furniture: [
        makeFurn(bed, (W - bed.width) / 2, D - bed.length - PAD, 0, 0),
        ...(wardrobe ? [makeFurn(wardrobe, PAD, PAD, 0, 1)] : []),
        ...(dresser ? [makeFurn(dresser, W - dresser.width - PAD, PAD, 0, 3)] : []),
        ...(desk ? [makeFurn(desk, PAD, D - desk.length - bed.length - 1, 0, 4)] : []),
      ]},
    ];
  }

  function buildDining() {
    const table = catalog.find(i => i.type === 'dining-table');
    const chair = catalog.find(i => i.type === 'dining-chair');
    const buffet = catalog.find(i => i.type === 'buffet');
    const cx = (W - table.width) / 2, cy = (D - table.length) / 2;
    const chairs = (tx, ty) => chair ? [
      makeFurn(chair, tx + (table.width - chair.width) / 2, ty - chair.length - 0.05, 180, 2),
      makeFurn(chair, tx + (table.width - chair.width) / 2, ty + table.length + 0.05, 0, 2),
      makeFurn(chair, tx - chair.width - 0.05, ty + (table.length - chair.length) / 2, 90, 2),
      makeFurn(chair, tx + table.width + 0.05, ty + (table.length - chair.length) / 2, 270, 2),
    ] : [];
    return [
      { id: 'layout_1', score: 87, safety_warnings: warnings, furniture: [makeFurn(table, cx, cy, 0, 0), ...chairs(cx, cy), ...(buffet ? [makeFurn(buffet, PAD, PAD, 0, 1)] : [])] },
      { id: 'layout_2', score: 80, safety_warnings: warnings, furniture: [makeFurn(table, PAD + 0.5, cy, 0, 0), ...chairs(PAD + 0.5, cy), ...(buffet ? [makeFurn(buffet, W - buffet.width - PAD, PAD, 0, 1)] : [])] },
      { id: 'layout_3', score: 74, safety_warnings: warnings, furniture: [makeFurn(table, cx, PAD + 0.5, 0, 0), ...chairs(cx, PAD + 0.5), ...(buffet ? [makeFurn(buffet, PAD, D - buffet.length - PAD, 0, 1)] : [])] },
    ];
  }

  function buildOffice() {
    const desk = catalog.find(i => i.type === 'desk');
    const chair = catalog.find(i => i.type === 'office-chair');
    const shelf = catalog.find(i => i.type === 'bookshelf');
    const cabinet = catalog.find(i => i.type === 'filing-cabinet');
    const guest = catalog.find(i => i.type === 'guest-chair');
    return [
      { id: 'layout_1', score: 91, safety_warnings: warnings, furniture: [
        makeFurn(desk, PAD, PAD, 0, 0),
        ...(chair ? [makeFurn(chair, PAD + (desk.width - chair.width) / 2, PAD + desk.length + 0.3, 0, 2)] : []),
        ...(shelf ? [makeFurn(shelf, W - shelf.width - PAD, PAD, 0, 1)] : []),
        ...(cabinet ? [makeFurn(cabinet, W - cabinet.width - PAD, D - cabinet.length - PAD, 0, 3)] : []),
        ...(guest ? [makeFurn(guest, PAD + desk.width + 0.8, PAD + 0.5, 0, 4)] : []),
      ]},
      { id: 'layout_2', score: 84, safety_warnings: warnings, furniture: [
        makeFurn(desk, (W - desk.width) / 2, PAD, 0, 0),
        ...(chair ? [makeFurn(chair, (W - chair.width) / 2, PAD + desk.length + 0.3, 0, 2)] : []),
        ...(shelf ? [makeFurn(shelf, PAD, PAD, 0, 1)] : []),
        ...(cabinet ? [makeFurn(cabinet, W - cabinet.width - PAD, PAD, 0, 3)] : []),
      ]},
      { id: 'layout_3', score: 77, safety_warnings: warnings, furniture: [
        makeFurn(desk, W - desk.width - PAD, PAD, 0, 0),
        ...(chair ? [makeFurn(chair, W - chair.width - PAD - 0.05, PAD + desk.length + 0.3, 0, 2)] : []),
        ...(shelf ? [makeFurn(shelf, PAD, PAD, 0, 1)] : []),
        ...(guest ? [makeFurn(guest, PAD + 0.3, D - guest.length - PAD, 0, 4)] : []),
      ]},
    ];
  }

  let layouts;
  switch (catalogKey) {
    case 'Bedroom':     layouts = buildBedroom(); break;
    case 'Dining Room': layouts = buildDining(); break;
    case 'Office':      layouts = buildOffice(); break;
    default:            layouts = buildLivingRoom();
  }
  return padLayoutsToCount(layouts);
}

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

// ============================================================================
// MAIN CONTROLLER FUNCTIONS
// ============================================================================

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
      userPrompt,
      optimizationGoal,
      constraints,
    } = req.body;

    // Relax requirements if userPrompt is substantial
    const hasSubstantialPrompt = userPrompt && userPrompt.trim().length >= 10;

    // Validate
    if ((!roomType && !hasSubstantialPrompt) || !dimensions) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'roomType (or a descriptive prompt) and dimensions are required',
      });
    }

    // Infer roomType from prompt (Prompt takes precedence in Prompt-First mode)
    let finalRoomType = roomType;
    if (hasSubstantialPrompt) {
      const lowerPrompt = userPrompt.toLowerCase();
      // Only override if the prompt contains a specific room keyword
      if (lowerPrompt.includes('bathroom')) finalRoomType = 'Bathroom';
      else if (lowerPrompt.includes('bedroom')) finalRoomType = 'Bedroom';
      else if (lowerPrompt.includes('kitchen')) finalRoomType = 'Kitchen';
      else if (lowerPrompt.includes('office')) finalRoomType = 'Office';
      else if (lowerPrompt.includes('dining')) finalRoomType = 'Dining Room';
      else if (lowerPrompt.includes('living')) finalRoomType = 'Living Room';
      // If we still don't have a finalRoomType but have a prompt, default to Living Room
      else if (!finalRoomType) finalRoomType = 'Living Room';
    } else if (!finalRoomType) {
      finalRoomType = 'Living Room';
    }

    console.log(`🎨 [AIDesign] Generating design for ${finalRoomType} (${designStyle || 'Custom Style'})`);

    // Get furniture for room type
    const furnitureList = (FURNITURE_CATALOG[finalRoomType] || FURNITURE_CATALOG['Living Room'])
      .map(item => ({
        ...item,
        dimensions: { width: item.width, length: item.length, height: item.height },
      }));

    // Run genetic algorithm
    const best = runGeneticAlgorithm(
      dimensions,
      furnitureList,
      constraints || { minimumWalkwayDistance: 0.8 },
      GA_CONFIG.maxIterations
    );

    // Format furniture with proper structure
    const furniture = best.layout.map((item, idx) => ({
      id: item.id || `item-${idx}`,
      name: item.name,
      type: item.type,
      category: item.category,
      dimensions: item.dimensions || { width: item.width, length: item.length, height: item.height },
      position: item.position,
    }));

    // Calculate scores
    const performanceScore = {
      overall: Math.round(best.fitness),
      spaceEfficiency: Math.round(best.fitness * 0.9 + Math.random() * 10),
      comfort: Math.round(best.fitness * 0.85 + Math.random() * 15),
      accessibility: Math.round(best.fitness * 0.95 + Math.random() * 5),
      aesthetics: Math.round(best.fitness * 0.8 + Math.random() * 20),
      lighting: Math.round(70 + Math.random() * 30),
      ergonomics: Math.round(75 + Math.random() * 25),
      traffic: Math.round(best.fitness),
    };

    // Estimate cost
    const estimatedCost = estimateCost(furniture, budget);

    // Generate color palette
    let colorPalette = generateColorPalette(designStyle);

    // Try to enhance color palette with Groq if available
    if (process.env.GROQ_API_KEY) {
      try {
        const groqColors = await groqService.suggestColorPalette(designStyle);
        if (groqColors && Array.isArray(groqColors) && groqColors.length > 0) {
          colorPalette = groqColors;
          console.log('[AIDesign] Used Groq for color palette');
        }
      } catch (error) {
        console.warn('[AIDesign] Groq color palette failed, using default:', error.message);
      }
    }

    // Generate enhanced description and title with Groq
    let designTitle = `${designStyle || 'Modern'} ${finalRoomType} Design`;
    let designDescription = userPrompt || `AI-optimized ${finalRoomType} layout with ${furniture.length} furniture pieces`;

    // Generate title and description with Groq (if available)
    if (process.env.GROQ_API_KEY) {
      try {
        // Generate title and description in parallel for better performance
        const [groqTitle, groqDescription] = await Promise.all([
          groqService.generateDesignTitle({
            roomType: finalRoomType,
            designStyle,
            keyFeatures: [`${furniture.length} furniture pieces`, `Optimized layout`],
          }),
          groqService.generateDesignDescription({
            roomType: finalRoomType,
            designStyle,
            dimensions,
            furnitureCount: furniture.length,
            colorPalette, // Use the potentially updated color palette
            budget,
          }),
        ]);

        if (groqTitle) {
          designTitle = groqTitle;
        }
        if (groqDescription) {
          designDescription = groqDescription;
        }

        console.log('[AIDesign] Used Groq for title and description');
      } catch (error) {
        console.warn('[AIDesign] Groq title/description failed, using default:', error.message);
      }
    }

    const processingTime = Date.now() - startTime;

    const proposal = {
      id: `design-${Date.now()}-${uuidv4().substring(0, 8)}`,
      roomType: finalRoomType,
      title: designTitle,
      description: designDescription,
      layout: {
        id: `layout-${Date.now()}`,
        version: 1,
        furniture,
        metadata: {
          generatedAt: Date.now(),
          algorithm: 'genetic-algorithm',
          iterationsCount: GA_CONFIG.maxIterations,
          dimensions,
        },
      },
      performanceScore,
      colorPalette,
      recommendedFurniture: furniture,
      estimatedCost,
      pros: [
        'Optimized traffic flow',
        'Balanced furniture placement',
        `Tailored for ${finalRoomType}`,
      ],
      cons: performanceScore.overall < 70 ? ['Some space constraints'] : [],
      rank: 1,
    };

    console.log(`✅ [AIDesign] Generated design in ${processingTime}ms (score: ${performanceScore.overall})`);

    res.json({
      proposals: [proposal],
      bestFitRecommendation: proposal,
      alternativeOptions: [],
      metadata: {
        totalProposalsGenerated: 1,
        processingTime,
        algorithm: 'genetic-algorithm-v1.0',
        confidenceScore: performanceScore.overall / 100,
      },
    });

  } catch (error) {
    console.error('❌ [AIDesign] Error:', error);
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
  const { furniture, budget } = req.body;

  if (!furniture || !Array.isArray(furniture)) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'furniture array is required',
    });
  }

  const cost = estimateCost(furniture, budget || 'medium');
  res.json(cost);
}

export async function generateLayout(req, res, next) {
  try {
    const { roomDimensions, detectedObstacles, availableFloorSpace, roomType, style } = req.body;

    if (!roomDimensions || !roomType || !style) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });
    }

    const systemPrompt = `You are an expert interior designer AI. Generate exactly ${LAYOUT_VARIATION_COUNT} furniture layout variations for a room. You MUST respond with ONLY a valid JSON object. No markdown, no code blocks, no explanation. Just raw JSON.

The JSON must follow this exact structure:
{
  "layouts": [
    {
      "id": "layout_1",
      "furniture": [
        {
          "name": "Sofa",
          "x": 0.5,
          "y": 0.5,
          "width": 2.2,
          "depth": 0.9,
          "rotation": 0,
          "color": "#a0c4ff"
        }
      ],
      "safety_warnings": [],
      "score": 85
    }
  ]
}

Rules:
- Always include exactly ${LAYOUT_VARIATION_COUNT} layout objects in the layouts array
- Each layout must be meaningfully different (furniture placement, focal point, or flow)
- x and y are positions in meters from the top-left corner of the room
- x must be between 0 and roomWidth, y must be between 0 and roomDepth
- width and depth are furniture dimensions in meters
- rotation is 0, 90, 180, or 270 degrees
- color is a valid hex color string
- score is 0-100 integer
- safety_warnings is an array of strings (can be empty array [])
- Place furniture realistically, avoid overlaps, leave walkway gaps of at least 0.7m`;

    const userPrompt = `Room Width: ${roomDimensions.width}m
Room Depth: ${roomDimensions.depth}m
Room Height: ${roomDimensions.height}m
Available Floor Space: ${availableFloorSpace} sq meters
Detected Obstacles: ${detectedObstacles?.length > 0 ? detectedObstacles.join(', ') : 'None'}
Room Type: ${roomType}
Style: ${style}

Generate ${LAYOUT_VARIATION_COUNT} different optimized furniture layout variations for this room.`;

    let finalJson = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[generateLayout] Attempt ${attempt} - calling Groq...`);

        const requestBody = {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 8192,
          response_format: { type: 'json_object' }
        };

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.status} ${await response.text()}`);
        }

        const data = await response.json();
        const responseText = data.choices[0].message.content;
        console.log(`[generateLayout] Raw response (first 200 chars):`, responseText.substring(0, 200));

        const parsed = JSON.parse(responseText);

        if (parsed && parsed.layouts && Array.isArray(parsed.layouts) && parsed.layouts.length >= 1) {
          parsed.layouts = padLayoutsToCount(parsed.layouts);
          finalJson = parsed;
          console.log(`[generateLayout] Success on attempt ${attempt} — ${finalJson.layouts.length} layouts`);
          break;
        } else {
          throw new Error(`layouts array missing or empty. Got: ${JSON.stringify(parsed).substring(0, 100)}`);
        }
      } catch (parseError) {
        console.error(`[generateLayout] Attempt ${attempt} failed:`, parseError.message);
        if (attempt === 2) {
          // ── SMART FALLBACK: AI failed, use rule-based generator ──
          console.warn('[generateLayout] Groq unavailable, using rule-based fallback layouts');
          finalJson = { layouts: generateFallbackLayouts(roomDimensions, roomType, style, detectedObstacles || []) };
        }
      }
    }

    // Save to DB (non-blocking)
    try {
      const session = new DesignSession({
        userId: req.user?.userId || null,
        roomDimensions,
        detectedObstacles: detectedObstacles || [],
        preferences: { roomType, style, availableFloorSpace },
        generatedLayouts: finalJson.layouts,
      });
      await session.save();
    } catch (dbError) {
      console.error('[generateLayout] Failed to save DesignSession to MongoDB:', dbError.message);
    }

    return res.json(finalJson.layouts);
  } catch (error) {
    console.error('[generateLayout] Unexpected error:', error);
    next(error);
  }
}

export default {
  generateDesign,
  getFurnitureCatalog,
  estimateFurnitureCost,
  generateLayout,
};

