/**
 * Theme Recommendation Service
 * 
 * IMPROVED: Added retry logic, request deduplication, better error handling
 * Backend logic: backend/src/controllers/themeController.js
 */

import { callApi } from './apiClient';
import type {
  UserThemePreferences,
  ThemeRecommendationOutput,
  ThemeFeedback,
  UserThemeHistory,
  MaterialType,
  LightingType,
} from '@/types/theme-recommendation';

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableErrors: string[];
}

/**
 * Theme Recommendation Service
 * Client for backend theme recommendation API with retry logic and caching
 */
export class ThemeRecommendationService {
  private userHistory: UserThemeHistory = {
    viewedThemes: [],
    likedThemes: [],
    dislikedThemes: [],
    appliedThemes: [],
    preferredColors: [],
    preferredMaterials: [],
    preferredMoods: [],
    lastUpdated: Date.now(),
  };

  private pendingRequests = new Map<string, Promise<ThemeRecommendationOutput>>();

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    retryableErrors: ['timeout', 'network', 'connection', 'ECONNREFUSED', 'ETIMEDOUT'],
  };

  /**
   * Get request cache key for deduplication
   */
  private getRequestKey(preferences: UserThemePreferences): string {
    return `${preferences.roomType}-${preferences.desiredMood}-${preferences.stylePreference}-${preferences.budgetRange || 'none'}`;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const errorMsg = error.message.toLowerCase();
    return this.retryConfig.retryableErrors.some(retryable => errorMsg.includes(retryable.toLowerCase()));
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry API call with exponential backoff
   */
  private async retryApiCall<T>(
    apiCall: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await apiCall();
    } catch (error) {
      const isConnectionError = error instanceof Error && 
        (error.message.includes('connection') || 
         error.message.includes('refused') || 
         error.message.includes('network') ||
         error.message.includes('fetch failed') ||
         error.message.includes('ERR_CONNECTION_REFUSED'));
      
      // Don't retry if max retries reached or error is not retryable
      if (attempt >= this.retryConfig.maxRetries || !this.isRetryableError(error)) {
        // Only log if it's not a connection error (connection errors are expected and handled by fallback)
        if (!isConnectionError) {
          console.warn(`⚠️ [ThemeRecommendationService] Max retries reached or non-retryable error:`, error);
        }
        throw error;
      }

      // For connection errors, suppress retry logs (they're noisy when backend is down)
      if (!isConnectionError) {
        const delay = this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⚠️ [ThemeRecommendationService] Retry attempt ${attempt}/${this.retryConfig.maxRetries} after ${delay}ms`);
        await this.sleep(delay);
      } else {
        // For connection errors, still retry but don't log (reduce console noise)
        const delay = this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
      
      return this.retryApiCall(apiCall, attempt + 1);
    }
  }

  /**
   * Get theme recommendations from backend API with retry logic
   */
  async getThemeRecommendations(request: {
    preferences: UserThemePreferences;
    filterOptions?: {
      priceRange?: string;
      includeStyles?: string[];
      excludeStyles?: string[];
    };
    userHistory?: UserThemeHistory;
  }): Promise<ThemeRecommendationOutput> {
    console.log('🎨 Fetching theme recommendations from API...', request.preferences);

    // Check for pending request (deduplication)
    const requestKey = this.getRequestKey(request.preferences);
    if (this.pendingRequests.has(requestKey)) {
      console.log('⏳ [ThemeRecommendationService] Request already in progress, reusing...');
      try {
        return await this.pendingRequests.get(requestKey)!;
      } catch (error) {
        // If pending request failed, continue with new request
        this.pendingRequests.delete(requestKey);
      }
    }

    // Create new request promise
    const requestPromise = this.retryApiCall(async () => {
      try {
        // Build query params
        const params = new URLSearchParams({
          room_type: request.preferences.roomType,
          mood: request.preferences.desiredMood,
          style: request.preferences.stylePreference,
        });

        if (request.preferences.budgetRange) {
          params.append('budget', request.preferences.budgetRange);
        }

        if (request.preferences.colorPreferences?.length) {
          params.append('colors', request.preferences.colorPreferences.join(','));
        }

        if (request.userHistory || this.userHistory.likedThemes.length > 0) {
          params.append('user_history', JSON.stringify(request.userHistory || this.userHistory));
        }

        // Call backend API
        const response = await callApi<ThemeRecommendationOutput>(
          `/themes/recommendations?${params.toString()}`,
          { method: 'GET' }
        );

        console.log('✅ [ThemeRecommendationService] Received theme recommendations from API');
        return response;

      } catch (error) {
        // Check if it's a connection error - these will be handled by fallback, so don't log as error
        const isConnectionError = error instanceof Error && 
          (error.message.includes('connection') || 
           error.message.includes('refused') || 
           error.message.includes('network') ||
           error.message.includes('fetch failed') ||
           error.message.includes('ERR_CONNECTION_REFUSED') ||
           error.message.includes('Failed to fetch'));
        
        // Only log non-connection errors - connection errors are expected and handled by fallback
        if (!isConnectionError) {
          console.error('❌ [ThemeRecommendationService] API call failed (non-connection error):', error);
        }
        // Re-throw so retryApiCall can handle it
        throw error;
      }
    });

    // Store pending request
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const response = await requestPromise;
      this.pendingRequests.delete(requestKey);
      return response;
    } catch (error) {
      this.pendingRequests.delete(requestKey);
      
      // Check if it's a connection error (backend not running)
      const isConnectionError = error instanceof Error && 
        (error.message.includes('connection') || 
         error.message.includes('refused') || 
         error.message.includes('network') ||
         error.message.includes('fetch failed') ||
         error.message.includes('ERR_CONNECTION_REFUSED'));
      
      // Fallback: Return a basic theme if API fails after all retries
      // Log quietly for connection errors (expected when backend is down)
      if (isConnectionError) {
        // Only log once on first request to reduce console noise
        if (!this.pendingRequests.has(requestKey)) {
          console.log('📦 [ThemeRecommendationService] Backend unavailable, using offline fallback recommendations');
        }
      } else {
        console.warn('⚠️ [ThemeRecommendationService] Using fallback recommendation after all retries failed');
      }
      return this.getFallbackRecommendation(request.preferences);
    }
  }

  /**
   * Record user feedback via backend API
   */
  async recordFeedback(feedback: ThemeFeedback): Promise<void> {
    console.log('📝 Recording theme feedback:', feedback);

    // Update local history
    switch (feedback.action) {
      case 'like':
        if (!this.userHistory.likedThemes.includes(feedback.themeId)) {
          this.userHistory.likedThemes.push(feedback.themeId);
        }
        break;
      case 'dislike':
        if (!this.userHistory.dislikedThemes.includes(feedback.themeId)) {
          this.userHistory.dislikedThemes.push(feedback.themeId);
        }
        break;
      case 'apply':
        if (!this.userHistory.appliedThemes.includes(feedback.themeId)) {
          this.userHistory.appliedThemes.push(feedback.themeId);
        }
        break;
    }
    this.userHistory.lastUpdated = Date.now();

    // Send to backend
    try {
      await callApi('/themes/feedback', {
        method: 'POST',
        body: feedback,
      });
    } catch (error) {
      console.warn('Failed to record feedback on server:', error);
      // Continue - local state is updated
    }
  }

  /**
   * Get user history
   */
  getUserHistory(): UserThemeHistory {
    return { ...this.userHistory };
  }

  /**
   * Clear user history
   */
  clearUserHistory(): void {
    this.userHistory = {
      viewedThemes: [],
      likedThemes: [],
      dislikedThemes: [],
      appliedThemes: [],
      preferredColors: [],
      preferredMaterials: [],
      preferredMoods: [],
      lastUpdated: Date.now(),
    };
  }

  /**
   * Fallback recommendation if API fails
   * Made public so hooks can access it directly if needed
   */
  getFallbackRecommendation(preferences: UserThemePreferences): ThemeRecommendationOutput {
    const fallbackTheme = {
      id: `fallback-${Date.now()}`,
      name: `${preferences.stylePreference} ${preferences.desiredMood} Theme`,
      description: `A ${preferences.desiredMood.toLowerCase()} ${preferences.stylePreference.toLowerCase()} design for your ${preferences.roomType.toLowerCase()}`,
      confidence: 0.75,
      colorPalette: ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#424242', '#101010'],
      colors: {
        primary: ['#FFFFFF', '#F5F5F5'],
        secondary: ['#E0E0E0', '#424242'],
        accent: ['#101010'],
        neutral: ['#FFFFFF', '#F5F5F5', '#E8E8E8'],
      },
      materials: ['wood', 'fabric', 'metal'] as MaterialType[],
      textures: ['Smooth', 'Natural'],
      lighting: 'natural daylight' as LightingType,
      furnitureStyle: preferences.stylePreference,
      decorItems: ['Plants', 'Art', 'Textiles'],
      patterns: ['Solid', 'Geometric'],
      suitableFor: {
        roomTypes: [preferences.roomType],
        moods: [preferences.desiredMood],
        styles: [preferences.stylePreference],
      },
      moodScore: 75,
      styleScore: 75,
      roomScore: 75,
      userRating: 4.0,
      likes: 50,
      dislikes: 5,
    };

    return {
      roomType: preferences.roomType,
      userPreferences: preferences,
      recommendedThemes: [fallbackTheme],
      topTheme: fallbackTheme,
      alternativeThemes: [],
      metadata: {
        sessionId: `fallback-session-${Date.now()}`,
        totalThemesAnalyzed: 1,
        processingTime: 0,
        mlModel: 'fallback-v1.0',
        confidenceLevel: 'low',
        recommendationDate: Date.now(),
      },
      insights: {
        reasonForRecommendation: 'This is an offline recommendation. Start the backend server for AI-powered recommendations.',
        keyMatchingFactors: [preferences.roomType, preferences.desiredMood, preferences.stylePreference],
        styleAlignment: 75,
      },
    };
  }
}

// Export singleton
export const themeRecommendationService = new ThemeRecommendationService();
