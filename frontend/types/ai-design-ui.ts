/**
 * AI Design UI Types
 * Type definitions for the AI Design UI state and props
 */

import type { DesignProposal, GenerativeDesignOutput } from './ai-design';

export type BudgetType = 'low' | 'medium' | 'high' | 'luxury';
export type OptimizationGoal = 'space' | 'comfort' | 'aesthetics' | 'balanced';
export type ImageQuality = 'standard' | 'hd';
export type ImageStyle = 'photorealistic' | 'artistic' | 'blueprint';
export type PhilippineStore = 'ikea-ph' | 'mandaue-foam' | 'our-home' | 'all';
export type SortOption = 'score' | 'cost' | 'date' | 'none';
export type SortOrder = 'asc' | 'desc';

export interface DesignFormState {
  prompt: string;
  selectedStyle: string;
  selectedRoom: string;
  roomWidth: string;
  roomLength: string;
  roomHeight: string;
  budget: BudgetType;
  optimizationGoal: OptimizationGoal;
}

export interface AISuggestions {
  roomType?: string;
  style?: string;
  dimensions?: {
    width: number;
    length: number;
    height: number;
  };
  colors?: string[];
  budget?: string;
}

export interface TrainingStats {
  accuracy: number;
  totalGenerations: number;
}

export interface UsageStats {
  totalGenerations: number;
  favoriteStyle: string;
  favoriteRoom: string;
  averageCost: number;
  totalDesigns: number;
  mostUsedBudget: string;
}

export interface DesignComment {
  id: string;
  text: string;
  author: string;
  timestamp: number;
}

export interface ImageGenerationError {
  designId: string;
  error: string;
}

export interface DesignCache {
  designs: DesignProposal[];
  result: GenerativeDesignOutput;
  timestamp: number;
}

export interface BeforeAfterDesigns {
  before: DesignProposal | null;
  after: DesignProposal;
}

