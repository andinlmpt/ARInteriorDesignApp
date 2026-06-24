/**
 * AI Design Business Logic
 * Core business logic for design generation and processing
 */

import type { DesignProposal, GenerativeDesignOutput } from '@/types/ai-design';
import type { BudgetType, OptimizationGoal } from '@/types/ai-design-ui';
import { generativeAIDesignService } from '@/services/GenerativeAIDesignService';
import { userPreferenceService } from '@/services/UserPreferenceService';
import { aiTrainingService } from '@/services/AITrainingService';

export interface DesignGenerationParams {
  selectedRoom: string;
  selectedStyle: string;
  roomWidth: number;
  roomLength: number;
  roomHeight: number;
  budget: BudgetType;
  optimizationGoal: OptimizationGoal;
  prompt?: string;
}

/**
 * Generate design proposals using AI service
 */
export async function generateDesignProposals(
  params: DesignGenerationParams
): Promise<GenerativeDesignOutput> {
  const { selectedRoom, selectedStyle, roomWidth, roomLength, roomHeight, budget, optimizationGoal, prompt } = params;

  // Create design preferences
  const preferences = {
    layoutType: 'room' as const,
    roomType: selectedRoom,
    designStyle: selectedStyle,
    dimensions: { 
      width: roomWidth, 
      length: roomLength, 
      height: roomHeight 
    },
    aestheticPreferences: {
      budget,
      lighting: 'natural' as const,
    },
    functionalRequirements: [],
    userPrompt: prompt || '',
  };

  // Create constraints
  const constraints = {
    minimumWalkwayDistance: 0.9,
    doorClearance: 0.8,
    windowZones: [],
    lightingZones: [
      {
        type: 'natural' as const,
        position: { x: roomWidth / 2, y: roomLength },
        radius: 2.0,
      },
    ],
    objectProximityLimits: {
      minDistanceBetweenFurniture: 0.6,
      minDistanceFromWalls: 0.3,
      minDistanceFromDoors: 0.5,
    },
    fixedObstacles: [],
    ergonomics: {
      seatHeightRange: [0.4, 0.5] as [number, number],
      tableHeightRange: [0.7, 0.76] as [number, number],
      reachDistance: 0.7,
    },
    accessibility: {
      wheelchairAccessible: false,
      clearanceWidth: 0.9,
    },
  };

  // Create simulation options
  const options = {
    generateMultipleVariations: true,
    numberOfVariations: 3,
    enableInteractivePreview: false,
    enable3DRendering: false,
    optimizationGoal,
    constraintWeights: {
      ergonomics: 0.25,
      accessibility: 0.25,
      symmetry: 0.25,
      spaceEfficiency: 0.25,
    },
  };

  console.log('🎨 Generating design with preferences:', preferences);

  // Generate designs using AI service
  const result = await generativeAIDesignService.generateDesignProposals(
    preferences,
    constraints,
    options
  );

  console.log('✅ Generation complete:', result.metadata);

  return result;
}

/**
 * Track user usage for machine learning
 */
export async function trackUserBehavior(
  selectedRoom: string,
  selectedStyle: string,
  budget: BudgetType
): Promise<void> {
  await userPreferenceService.trackUsage(selectedRoom, selectedStyle, budget);
  await userPreferenceService.learnFromFeedback();
}

/**
 * Train AI model from user data
 */
export async function trainAIModel(): Promise<void> {
  await aiTrainingService.trainFromUserData();
  await aiTrainingService.refineModel();
}

/**
 * Get furniture color for visualization
 */
export function getFurnitureColor(category: string): string {
  const colors: Record<string, string> = {
    seating: '#3498DB',
    table: '#2ECC71',
    storage: '#9B59B6',
    decor: '#F39C12',
    lighting: '#E67E22',
    other: '#95A5A6',
  };
  return colors[category] || '#95A5A6';
}

/**
 * Get furniture shape style for visualization
 */
export function getFurnitureShape(item: any) {
  const name = item.name?.toLowerCase() || '';
  const category = item.category;

  if (name.includes('bed') || name.includes('sofa') || category === 'seating') {
    return { borderRadius: 4, backgroundColor: getFurnitureColor(category) };
  }
  if (name.includes('table') || category === 'table') {
    return { borderRadius: 8, backgroundColor: getFurnitureColor(category) };
  }
  if (name.includes('cabinet') || name.includes('shelf') || category === 'storage') {
    return { borderRadius: 2, backgroundColor: getFurnitureColor(category) };
  }
  return { borderRadius: 4, backgroundColor: getFurnitureColor(category) };
}

/**
 * Calculate similarity score between designs
 */
export function calculateDesignSimilarity(design1: DesignProposal, design2: DesignProposal): number {
  let score = 0;
  const maxScore = 5;

  // Compare style
  if (design1.colorPalette.some(c => design2.colorPalette.includes(c))) score++;

  // Compare cost range
  const cost1 = (design1.estimatedCost.low + design1.estimatedCost.high) / 2;
  const cost2 = (design2.estimatedCost.low + design2.estimatedCost.high) / 2;
  const costDiff = Math.abs(cost1 - cost2) / Math.max(cost1, cost2);
  if (costDiff < 0.2) score++;

  // Compare furniture count (furniture is inside layout)
  const furniture1 = design1.layout?.furniture || [];
  const furniture2 = design2.layout?.furniture || [];
  const countDiff = Math.abs(furniture1.length - furniture2.length);
  if (countDiff <= 2) score++;

  // Compare common furniture types
  const types1 = new Set(furniture1.map(f => f.category));
  const types2 = new Set(furniture2.map(f => f.category));
  const commonTypes = Array.from(types1).filter(t => types2.has(t)).length;
  if (commonTypes >= 3) score++;

  // Compare overall performance score
  const score1 = design1.performanceScore?.overall || 0;
  const score2 = design2.performanceScore?.overall || 0;
  if (Math.abs(score1 - score2) < 10) score++;

  return score / maxScore;
}

/**
 * Find similar designs
 */
export function findSimilarDesigns(
  target: DesignProposal,
  allDesigns: DesignProposal[],
  threshold: number = 0.5,
  limit: number = 3
): DesignProposal[] {
  return allDesigns
    .filter(d => d.id !== target.id)
    .map(d => ({
      design: d,
      similarity: calculateDesignSimilarity(target, d),
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => item.design);
}

