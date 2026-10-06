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

const DESIGN_LAYOUT_COUNT = 3;

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
        algorithm: 'catalog-layout-planner-v1',
        iterationsCount: GA_CONFIG.maxIterations,
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
    const requestedLayouts = Math.min(3, Math.max(2, Number(variationCount) || DESIGN_LAYOUT_COUNT));
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
      const [plan] = planLayouts(roomDims, catalogSets[variant], {
        count: 1,
        seed: startTime + variant * 7919,
        features: roomFeatures,
      });
      if (!plan) continue;
      const meta = selectionMeta[variant] || {};
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
      });
    }

    let colorPalette = generateColorPalette(style);
    if (process.env.GROQ_API_KEY) {
      try {
        const groqColors = await groqService.suggestColorPalette(style);
        if (groqColors && Array.isArray(groqColors) && groqColors.length > 0) {
          colorPalette = groqColors;
        }
      } catch (error) {
        console.warn('[AIDesign] Groq color palette failed, using default:', error.message);
      }
    }

    let designTitle = `${style} ${finalRoomType} Design`;
    let designDescription = userPrompt
      || notes
      || `AI-optimized ${finalRoomType} layout with ${scoredLayouts[0]?.furniture.length || 0} furniture pieces`;

    if (process.env.GROQ_API_KEY) {
      try {
        const [groqTitle, groqDescription] = await Promise.all([
          groqService.generateDesignTitle({
            roomType: finalRoomType,
            designStyle: style,
            keyFeatures: [`${scoredLayouts[0]?.furniture.length || 0} furniture pieces`, 'Optimized layout'],
          }),
          groqService.generateDesignDescription({
            roomType: finalRoomType,
            designStyle: style,
            dimensions: roomDims,
            furnitureCount: scoredLayouts[0]?.furniture.length || 0,
            colorPalette,
            budget: budget || (budgetValue ? `₱${budgetValue}` : 'medium'),
          }),
        ]);
        if (groqTitle) designTitle = groqTitle;
        if (groqDescription) designDescription = groqDescription;
      } catch (error) {
        console.warn('[AIDesign] Groq title/description failed, using default:', error.message);
      }
    }

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
    }));

    proposals.sort((a, b) => b.score.overall - a.score.overall);
    proposals.forEach((proposal, index) => {
      proposal.rank = index + 1;
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
    if (!Number.isFinite(width) || !Number.isFinite(length) || !Number.isFinite(height)) {
      return res.status(400).json({ error: 'room width, length and height must be numbers' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one furniture item is required' });
    }

    const computedTotal = items.reduce(
      (sum, item) => sum + (Number(item?.pricePhp) || 0),
      0,
    );
    const finalTotal = Number.isFinite(Number(totalPhp)) ? Number(totalPhp) : computedTotal;
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
    if (!session.roomDimensions?.width) {
      session.roomDimensions = { width, height, depth: length };
    }

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
          model: groqService.getActiveModel(),
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
  getDesignSession,
  finalizeDesign,
  getFurnitureCatalog,
  estimateFurnitureCost,
  generateLayout,
};

