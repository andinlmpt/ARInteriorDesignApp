/**
 * AI Training Service
 * 
 * REFACTORED: Now calls backend API for ML training and predictions
 * Backend logic moved to: backend/src/controllers/aiTrainingController.js
 */

import { callApi } from './apiClient';
import { getJson, setJson } from '@/utils/storage';

type TrainingStats = {
  accuracy: number;
  totalGenerations: number;
  likedDesigns: number;
  appliedDesigns: number;
  lastTrained: number;
  modelVersion?: string;
};

type UsagePatterns = {
  styleFrequency: Record<string, number>;
  roomTypeFrequency: Record<string, number>;
  budgetFrequency: Record<string, number>;
};

export class AITrainingService {
  private readonly LOCAL_CACHE_KEY = 'aiTrainingCache';

  /**
   * Train model from user data via backend API
   */
  async trainFromUserData(): Promise<void> {
    try {
      // Get local usage data
      const { userPreferenceService } = await import('./UserPreferenceService');
      const prefs = await userPreferenceService.getUserPreferences();

      const usagePatterns: UsagePatterns = {
        styleFrequency: prefs.usagePatterns?.styleFrequency || {},
        roomTypeFrequency: prefs.usagePatterns?.roomTypeFrequency || {},
        budgetFrequency: prefs.usagePatterns?.budgetFrequency || {},
      };

      await callApi('/training/train', {
        method: 'POST',
        body: {
          usagePatterns,
          likedDesigns: prefs.likedDesigns?.length || 0,
          appliedDesigns: prefs.appliedDesigns?.length || 0,
        },
      });

      console.log('✅ [AITraining] Model trained via API');
    } catch (error) {
      console.warn('[AITraining] API training failed, using local cache:', error);
    }
  }

  /**
   * Predict style based on context via backend API
   */
  async predictStyle(context: {
    roomType?: string;
    budget?: string;
    prompt?: string;
  }): Promise<string | null> {
    try {
      const params = new URLSearchParams();
      if (context.roomType) params.append('roomType', context.roomType);
      if (context.budget) params.append('budget', context.budget);
      if (context.prompt) params.append('prompt', context.prompt);

      const response = await callApi<{
        predictedStyle: string | null;
        confidence: number;
        reason?: string;
      }>(`/training/predict/style?${params.toString()}`, { method: 'GET' });

      return response.predictedStyle;
    } catch (error) {
      console.warn('[AITraining] Style prediction API failed:', error);
      return null;
    }
  }

  /**
   * Predict room based on context via backend API
   */
  async predictRoom(context: {
    style?: string;
    prompt?: string;
  }): Promise<string | null> {
    try {
      const params = new URLSearchParams();
      if (context.style) params.append('style', context.style);
      if (context.prompt) params.append('prompt', context.prompt);

      const response = await callApi<{
        predictedRoom: string | null;
        confidence: number;
        reason?: string;
      }>(`/training/predict/room?${params.toString()}`, { method: 'GET' });

      return response.predictedRoom;
    } catch (error) {
      console.warn('[AITraining] Room prediction API failed:', error);
      return null;
    }
  }

  /**
   * Predict colors based on style and budget via backend API
   */
  async predictColors(style: string, budget: string): Promise<string[]> {
    try {
      const response = await callApi<{ colors: string[] }>(
        `/training/predict/colors?style=${encodeURIComponent(style)}&budget=${encodeURIComponent(budget)}`,
        { method: 'GET' }
      );
      return response.colors;
    } catch (error) {
      console.warn('[AITraining] Color prediction API failed:', error);
      // Fallback colors
      const defaultColors: Record<string, string[]> = {
        'Modern': ['#FFFFFF', '#2C3E50', '#ECF0F1', '#3498DB'],
        'Minimalist': ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#424242'],
        'Scandinavian': ['#FFFFFF', '#F0EAD6', '#D4B896', '#A0826D'],
        'Industrial': ['#3C3C3C', '#7F7F7F', '#B87333', '#2F4F4F'],
        'Bohemian': ['#E8D5C4', '#C9A86A', '#8B7355', '#D4AF37'],
        'Traditional': ['#8B4513', '#D2691E', '#F5DEB3', '#800020'],
      };
      return defaultColors[style] || ['#FFFFFF', '#F5F5F5', '#E0E0E0'];
    }
  }

  /**
   * Get optimization goal recommendation via backend API
   */
  async getOptimizationGoal(
    roomType: string,
    style: string
  ): Promise<'space' | 'comfort' | 'aesthetics' | 'balanced'> {
    try {
      const response = await callApi<{
        optimizationGoal: 'space' | 'comfort' | 'aesthetics' | 'balanced';
        source: string;
      }>(
        `/training/optimization-goal?roomType=${encodeURIComponent(roomType)}&style=${encodeURIComponent(style)}`,
        { method: 'GET' }
      );
      return response.optimizationGoal;
    } catch (error) {
      console.warn('[AITraining] Optimization goal API failed:', error);
      const defaults: Record<string, 'space' | 'comfort' | 'aesthetics' | 'balanced'> = {
        'Minimalist': 'space',
        'Modern': 'aesthetics',
        'Scandinavian': 'comfort',
        'Industrial': 'aesthetics',
        'Bohemian': 'aesthetics',
        'Traditional': 'comfort',
      };
      return defaults[style] || 'balanced';
    }
  }

  /**
   * Get training stats via backend API
   */
  async getTrainingStats(): Promise<TrainingStats> {
    try {
      const response = await callApi<TrainingStats>('/training/stats', {
        method: 'GET',
      });
      
      // Ensure accuracy is a number (backend returns 0-100, default is 0-1)
      const accuracy = typeof response.accuracy === 'number' 
        ? response.accuracy 
        : (response.accuracy || 0) * 100;
      
      return {
        ...response,
        accuracy,
        totalGenerations: response.totalGenerations || 0,
        likedDesigns: response.likedDesigns || 0,
        appliedDesigns: response.appliedDesigns || 0,
        lastTrained: response.lastTrained || Date.now(),
      };
    } catch (error) {
      console.warn('[AITraining] Stats API failed, using local cache:', error);
      
      // Return cached or default stats
      const cached = await getJson<TrainingStats | null>(this.LOCAL_CACHE_KEY, null);
      return cached || {
        accuracy: 50, // Default to 50% (0.5 * 100)
        totalGenerations: 0,
        likedDesigns: 0,
        appliedDesigns: 0,
        lastTrained: Date.now(),
      };
    }
  }

  /**
   * Refine model based on success rate via backend API
   */
  async refineModel(): Promise<void> {
    try {
      await callApi('/training/refine', { method: 'POST' });
      console.log('✅ [AITraining] Model refined via API');
    } catch (error) {
      console.warn('[AITraining] Refine API failed:', error);
    }
  }

  /**
   * Reset training data via backend API
   */
  async resetTraining(): Promise<void> {
    try {
      await callApi('/training/reset', { method: 'POST' });
      await setJson(this.LOCAL_CACHE_KEY, null);
      console.log('✅ [AITraining] Training data reset');
    } catch (error) {
      console.warn('[AITraining] Reset API failed:', error);
    }
  }
}

export const aiTrainingService = new AITrainingService();
