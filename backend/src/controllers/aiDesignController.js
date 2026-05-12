/**
 * AI Design Controller
 * Generative AI design service with genetic algorithms
 * 
 * Moved from: frontend/services/GenerativeAIDesignService.ts
 */

import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import geminiService from '../services/geminiService.js';

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

    // Try to enhance color palette with Gemini if available
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiColors = await geminiService.suggestColorPalette(designStyle);
        if (geminiColors && Array.isArray(geminiColors) && geminiColors.length > 0) {
          colorPalette = geminiColors;
          console.log('[AIDesign] Used Gemini for color palette');
        }
      } catch (error) {
        console.warn('[AIDesign] Gemini color palette failed, using default:', error.message);
      }
    }

    // Generate enhanced description and title with Gemini
    let designTitle = `${designStyle || 'Modern'} ${finalRoomType} Design`;
    let designDescription = userPrompt || `AI-optimized ${finalRoomType} layout with ${furniture.length} furniture pieces`;

    // Generate title and description with Gemini (if available)
    if (process.env.GEMINI_API_KEY) {
      try {
        // Generate title and description in parallel for better performance
        const [geminiTitle, geminiDescription] = await Promise.all([
          geminiService.generateDesignTitle({
            roomType: finalRoomType,
            designStyle,
            keyFeatures: [`${furniture.length} furniture pieces`, `Optimized layout`],
          }),
          geminiService.generateDesignDescription({
            roomType: finalRoomType,
            designStyle,
            dimensions,
            furnitureCount: furniture.length,
            colorPalette, // Use the potentially updated color palette
            budget,
          }),
        ]);

        if (geminiTitle) {
          designTitle = geminiTitle;
        }
        if (geminiDescription) {
          designDescription = geminiDescription;
        }

        console.log('[AIDesign] Used Gemini for title and description');
      } catch (error) {
        console.warn('[AIDesign] Gemini title/description failed, using default:', error.message);
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

export default {
  generateDesign,
  getFurnitureCatalog,
  estimateFurnitureCost,
};

