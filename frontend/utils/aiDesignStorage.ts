/**
 * AI Design Storage Utilities
 * Business logic for persisting and retrieving design data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DesignProposal } from '@/types/ai-design';
import type { DesignFormState, DesignCache, UsageStats } from '@/types/ai-design-ui';
import { STORAGE_KEYS, TIMINGS } from '@/config/aiDesign.config';

/**
 * Save design form state with retry logic
 */
export async function saveDesignState(state: DesignFormState): Promise<boolean> {
  try {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const stateString = JSON.stringify(state);
        
        if (stateString.length > 100000) {
          console.warn('[AIDesign] Large state detected, consider optimization');
        }

        await AsyncStorage.setItem(STORAGE_KEYS.DESIGN_STATE, stateString);
        return true;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, TIMINGS.STATE_PERSISTENCE_RETRY_DELAY * attempts));
      }
    }
    return false;
  } catch (error) {
    console.error('[AIDesign] State persistence failed:', error);
    return false;
  }
}

/**
 * Load design form state
 */
export async function loadDesignState(): Promise<DesignFormState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.DESIGN_STATE);
    if (raw) {
      return JSON.parse(raw);
    }
    return null;
  } catch (error) {
    console.warn('[AIDesign] Failed to load state:', error);
    return null;
  }
}

/**
 * Save design cache
 */
export async function saveDesignCache(cacheMap: Map<string, DesignCache>): Promise<void> {
  try {
    const cacheObject = Object.fromEntries(cacheMap);
    await AsyncStorage.setItem(STORAGE_KEYS.DESIGN_CACHE, JSON.stringify(cacheObject));
  } catch (error) {
    console.warn('[AIDesign] Failed to save cache:', error);
  }
}

/**
 * Load design cache
 */
export async function loadDesignCache(): Promise<Map<string, DesignCache>> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.DESIGN_CACHE);
    if (cached) {
      const parsed = JSON.parse(cached);
      const cacheMap = new Map<string, DesignCache>();
      Object.entries(parsed).forEach(([key, value]: [string, any]) => {
        cacheMap.set(key, value);
      });
      return cacheMap;
    }
    return new Map();
  } catch (error) {
    console.warn('[AIDesign] Failed to load cache:', error);
    return new Map();
  }
}

/**
 * Save design history
 */
export async function saveDesignHistory(designs: DesignProposal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DESIGN_HISTORY, JSON.stringify(designs));
  } catch (error) {
    console.warn('[AIDesign] Failed to save history:', error);
  }
}

/**
 * Load design history
 */
export async function loadDesignHistory(): Promise<DesignProposal[]> {
  try {
    const historyData = await AsyncStorage.getItem(STORAGE_KEYS.DESIGN_HISTORY);
    if (historyData) {
      return JSON.parse(historyData);
    }
    return [];
  } catch (error) {
    console.warn('[AIDesign] Failed to load history:', error);
    return [];
  }
}

/**
 * Save favorites
 */
export async function saveFavorites(favorites: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DESIGN_FAVORITES, JSON.stringify(Array.from(favorites)));
  } catch (error) {
    console.warn('[AIDesign] Failed to save favorites:', error);
  }
}

/**
 * Load favorites
 */
export async function loadFavorites(): Promise<Set<string>> {
  try {
    const favoritesData = await AsyncStorage.getItem(STORAGE_KEYS.DESIGN_FAVORITES);
    if (favoritesData) {
      return new Set(JSON.parse(favoritesData));
    }
    return new Set();
  } catch (error) {
    console.warn('[AIDesign] Failed to load favorites:', error);
    return new Set();
  }
}

/**
 * Save usage statistics
 */
export async function saveUsageStats(stats: UsageStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USAGE_STATS, JSON.stringify(stats));
  } catch (error) {
    console.warn('[AIDesign] Failed to save usage stats:', error);
  }
}

/**
 * Load usage statistics
 */
export async function loadUsageStats(): Promise<UsageStats | null> {
  try {
    const statsData = await AsyncStorage.getItem(STORAGE_KEYS.USAGE_STATS);
    if (statsData) {
      return JSON.parse(statsData);
    }
    return null;
  } catch (error) {
    console.warn('[AIDesign] Failed to load usage stats:', error);
    return null;
  }
}

/**
 * Check if tutorial has been seen
 */
export async function hasSeenTutorial(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(STORAGE_KEYS.TUTORIAL_SEEN);
    return seen === 'true';
  } catch (error) {
    console.warn('[AIDesign] Failed to check tutorial status:', error);
    return false;
  }
}

/**
 * Mark tutorial as seen
 */
export async function markTutorialSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_SEEN, 'true');
  } catch (error) {
    console.warn('[AIDesign] Failed to mark tutorial as seen:', error);
  }
}

