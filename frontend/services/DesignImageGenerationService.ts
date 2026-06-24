/**
 * Design Image Generation Service
 * 
 * REFACTORED: Now calls backend API instead of direct OpenAI calls
 * Backend logic moved to: backend/src/controllers/imageGenerationController.js
 * 
 * SECURITY: API keys are now stored on the server, not in frontend
 */

import { callApi } from './apiClient';
import type { DesignProposal } from '@/types/ai-design';

export type GeneratedDesignImage = {
  imageUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  generatedAt: number;
  attribution?: {
    photographer?: string;
    photographerUrl?: string;
    source?: string;
  };
};

export interface ImageGenerationPreferences {
  roomType: string;
  style: string;
  colors: string[];
  budget: string;
  quality?: 'standard' | 'hd';
  imageStyle?: 'photorealistic' | 'artistic' | 'blueprint';
  mood?: string;
  materials?: string[];
  imageSize?: '1024x1024' | '1792x1024' | '1024x1792';
  customDesign?: string; // Custom design text from user
}

export interface ImageServiceStatus {
  available: boolean;
  model: string;
  maxPromptLength: number;
  supportedSizes: string[];
  supportedQualities: string[];
}

export class DesignImageGenerationService {
  /**
   * Generate design image via backend API
   * Backend handles OpenAI API calls securely
   */
  async generateDesignImage(
    proposal: DesignProposal,
    preferences: ImageGenerationPreferences
  ): Promise<GeneratedDesignImage> {
    if (!proposal || !preferences) {
      throw new Error('Invalid proposal or preferences provided');
    }

    console.log('[ImageGeneration] Requesting image from backend API...');

    try {
      const response = await callApi<{
        success: boolean;
        imageUrl?: string;
        thumbnailUrl?: string;
        prompt: string;
        generatedAt: number;
        attribution?: {
          photographer?: string;
          photographerUrl?: string;
          source?: string;
        };
        error?: string;
        message?: string;
      }>('/images/generate', {
        method: 'POST',
        body: {
          proposal: {
            id: proposal.id,
            title: proposal.title,
            description: proposal.description,
            colorPalette: proposal.colorPalette,
            layout: proposal.layout,
          },
          preferences: {
            roomType: preferences.roomType,
            style: preferences.style,
            colors: preferences.colors,
            budget: preferences.budget,
            quality: preferences.quality || 'standard',
            imageStyle: preferences.imageStyle || 'photorealistic',
            mood: preferences.mood,
            materials: preferences.materials,
            size: preferences.imageSize || '1024x1024',
            customDesign: preferences.customDesign, // Include custom design text
          },
        },
      });

      if (response.success && response.imageUrl) {
        console.log('[ImageGeneration] ✅ Image received from backend');
        return {
          imageUrl: response.imageUrl,
          thumbnailUrl: response.thumbnailUrl || response.imageUrl,
          prompt: response.prompt,
          generatedAt: response.generatedAt,
          attribution: response.attribution,
        };
      }

      throw new Error(response.message || 'No image returned from API');

    } catch (error: any) {
      console.error('[ImageGeneration] API error:', error);

      // Provide user-friendly error messages
      if (error.message?.includes('503') || error.message?.includes('unavailable')) {
        throw new Error('Image generation service is not available. Please contact administrator.');
      }
      if (error.message?.includes('401') || error.message?.includes('Authentication')) {
        throw new Error('Image generation service authentication failed.');
      }
      if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
        throw new Error('Too many requests. Please try again in a few minutes.');
      }
      if (error.message?.includes('timeout') || error.message?.includes('504')) {
        throw new Error('Image generation timed out. Please try again.');
      }

      throw new Error(error.message || 'Failed to generate image. Please try again.');
    }
  }

  /**
   * Check if image generation service is available
   */
  async checkServiceStatus(): Promise<ImageServiceStatus> {
    try {
      const response = await callApi<ImageServiceStatus>('/images/status', {
        method: 'GET',
      });
      return response;
    } catch (error) {
      console.warn('[ImageGeneration] Failed to check service status:', error);
      return {
        available: false,
        model: 'unknown',
        maxPromptLength: 1000,
        supportedSizes: ['1024x1024'],
        supportedQualities: ['standard'],
      };
    }
  }

  /**
   * Preview generated prompt (for debugging)
   */
  async previewPrompt(
    proposal: Partial<DesignProposal>,
    preferences: Partial<ImageGenerationPreferences>
  ): Promise<{ prompt: string; length: number; truncated: boolean }> {
    try {
      const response = await callApi<{ prompt: string; length: number; truncated: boolean }>(
        '/images/preview-prompt',
        {
          method: 'POST',
          body: { proposal, preferences },
        }
      );
      return response;
    } catch (error) {
      console.warn('[ImageGeneration] Failed to preview prompt:', error);
      return {
        prompt: 'Unable to generate preview',
        length: 0,
        truncated: false,
      };
    }
  }
}

// Export singleton
export const designImageGenerationService = new DesignImageGenerationService();
