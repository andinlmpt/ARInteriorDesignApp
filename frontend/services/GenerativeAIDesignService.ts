/**
 * Generative AI Design Service
 * 
 * REFACTORED: Now calls backend API for design generation
 * Backend logic moved to: backend/src/controllers/aiDesignController.js
 */

import { callApi } from './apiClient';
import type {
  DesignPreferences,
  DesignConstraints,
  FurnitureItem,
  GeneratedLayout,
  LayoutPerformanceScore,
  DesignProposal,
  GenerativeDesignOutput,
  SimulationOptions,
} from '@/types/ai-design';

/**
 * Generative AI Design Service
 * Client for backend AI design API
 */
export class GenerativeAIDesignService {
  /**
   * Generate AI design proposals via backend API
   */
  async generateDesignProposals(
    preferences: DesignPreferences,
    constraints: DesignConstraints,
    options: SimulationOptions
  ): Promise<GenerativeDesignOutput> {
    console.log('🎨 [GenerativeAIDesign] Requesting design from backend API...');

    try {
      const response = await callApi<GenerativeDesignOutput>('/designs/generate', {
        method: 'POST',
        body: {
          roomType: preferences.roomType,
          dimensions: preferences.dimensions,
          designStyle: preferences.designStyle,
          budget: preferences.aestheticPreferences?.budget,
          userPrompt: preferences.userPrompt,
          optimizationGoal: options.optimizationGoal,
          constraints: {
            minimumWalkwayDistance: constraints.minimumWalkwayDistance,
            doorClearance: constraints.doorClearance,
            objectProximityLimits: constraints.objectProximityLimits,
          },
        },
      });

      console.log('✅ [GenerativeAIDesign] Received design from backend');
      return response;

    } catch (error: any) {
      console.warn('[GenerativeAIDesign] API call failed, using fallback:', error);
      
      // Fallback: Generate basic layout locally
      return this.generateFallbackDesign(preferences, constraints, options);
    }
  }

  /**
   * Get furniture catalog for a room type
   */
  async getFurnitureCatalog(roomType: string): Promise<{
    roomType: string;
    furniture: FurnitureItem[];
    total: number;
  }> {
    try {
      const response = await callApi<{
        roomType: string;
        furniture: FurnitureItem[];
        total: number;
      }>(`/designs/furniture/${encodeURIComponent(roomType)}`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      console.warn('[GenerativeAIDesign] Failed to fetch furniture catalog:', error);
      return {
        roomType,
        furniture: [],
        total: 0,
      };
    }
  }

  /**
   * Estimate cost for furniture list
   */
  async estimateCost(
    furniture: FurnitureItem[],
    budget: string = 'medium'
  ): Promise<{ low: number; high: number; average: number }> {
    try {
      const response = await callApi<{ low: number; high: number; average: number }>(
        '/designs/estimate-cost',
        {
          method: 'POST',
          body: { furniture, budget },
        }
      );
      return response;
    } catch (error) {
      console.warn('[GenerativeAIDesign] Failed to estimate cost:', error);
      // Fallback estimation
      const basePerItem = budget === 'luxury' ? 5000 : budget === 'high' ? 2000 : budget === 'low' ? 300 : 800;
      const total = furniture.length * basePerItem;
      return {
        low: Math.round(total * 0.7),
        high: Math.round(total * 1.3),
        average: total,
      };
    }
  }

  /**
   * Fallback design generation if API fails
   */
  private generateFallbackDesign(
    preferences: DesignPreferences,
    constraints: DesignConstraints,
    options: SimulationOptions
  ): GenerativeDesignOutput {
    const { width, length, height } = preferences.dimensions;

    // Create basic furniture placement
    const furniture: FurnitureItem[] = [
      {
        id: 'fallback-1',
        type: 'sofa',
        category: 'seating',
        name: 'Sofa',
        dimensions: { width: 2.0, length: 0.9, height: 0.85 },
        position: { x: width / 2 - 1, y: 0, z: length * 0.7, rotation: 0 },
        properties: {},
        zIndex: 1,
      },
      {
        id: 'fallback-2',
        type: 'table',
        category: 'table',
        name: 'Coffee Table',
        dimensions: { width: 1.0, length: 0.5, height: 0.45 },
        position: { x: width / 2 - 0.5, y: 0, z: length * 0.5, rotation: 0 },
        properties: {},
        zIndex: 2,
      },
    ];

    const layout: GeneratedLayout = {
      id: `fallback-layout-${Date.now()}`,
      version: 1,
      furniture,
      metadata: {
        generatedAt: Date.now(),
        algorithm: 'rule-based',
        iterationsCount: 0,
      },
    };

    const performanceScore: LayoutPerformanceScore = {
      overall: 65,
      spaceEfficiency: 60,
      comfort: 70,
      symmetry: 65,
      accessibility: 70,
      aesthetics: 60,
      functionalFlow: 65,
      lighting: 70,
      ergonomics: 65,
    };

    const proposal: DesignProposal = {
      id: `fallback-design-${Date.now()}`,
      title: `${preferences.designStyle || 'Basic'} ${preferences.roomType} Design`,
      description: 'Basic layout generated offline. Connect to server for optimized designs.',
      layout,
      performanceScore,
      visualization: {
        thumbnail2D: undefined,
        thumbnail3D: undefined,
        renderData: null,
      },
      colorPalette: ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#424242', '#101010'],
      recommendedFurniture: furniture,
      estimatedCost: { low: 1000, mid: 2000, high: 3000 },
      pros: ['Basic layout', 'Works offline'],
      cons: ['Not optimized', 'Limited furniture'],
      rank: 1,
    };

    return {
      proposals: [proposal],
      bestFitRecommendation: proposal,
      alternativeOptions: [],
      metadata: {
        totalProposalsGenerated: 1,
        processingTime: 0,
        algorithm: 'rule-based',
        confidenceScore: 0.5,
      },
      exportData: {
        json: JSON.stringify(proposal),
        structuredData: proposal,
      },
    };
  }
}

// Export singleton
export const generativeAIDesignService = new GenerativeAIDesignService();
