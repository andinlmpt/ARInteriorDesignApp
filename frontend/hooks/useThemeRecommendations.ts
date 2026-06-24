/**
 * useThemeRecommendations Hook
 * Manages theme recommendation generation and caching
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeRecommendationService } from '@/services/ThemeRecommendationService';
import type {
  RoomType,
  DesignMood,
  DesignStyle,
  ThemeRecommendationOutput,
} from '@/types/theme-recommendation';
import { validateThemeData } from '@/types/theme-recommendation';
import type { BudgetValue } from '@/config/themeRecommend.config';
import {
  CONFIG,
  STORAGE_KEYS,
  ERROR_MESSAGES,
} from '@/config/themeRecommend.config';
import { handleError } from '@/utils/themeRecommendHelpers';

interface UseThemeRecommendationsProps {
  isOffline: boolean;
  likedThemes: Set<string>;
}

interface UseThemeRecommendationsReturn {
  isGenerating: boolean;
  recommendationOutput: ThemeRecommendationOutput | null;
  recentThemes: ThemeRecommendationOutput[];
  historyLoaded: boolean;
  error: string | null;
  cachedRecommendations: Map<string, ThemeRecommendationOutput>;
  generateRecommendations: (
    room: RoomType,
    mood: DesignMood,
    style: DesignStyle,
    budget?: BudgetValue
  ) => Promise<void>;
  loadHistoryFromStorage: () => Promise<void>;
  setRecommendationOutput: (output: ThemeRecommendationOutput | null) => void;
  setError: (error: string | null) => void;
}

export function useThemeRecommendations({
  isOffline,
  likedThemes,
}: UseThemeRecommendationsProps): UseThemeRecommendationsReturn {
  const isMountedRef = useRef(true);
  const recommendationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendationOutput, setRecommendationOutput] = useState<ThemeRecommendationOutput | null>(null);
  const [recentThemes, setRecentThemes] = useState<ThemeRecommendationOutput[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedRecommendations, setCachedRecommendations] = useState<Map<string, ThemeRecommendationOutput>>(new Map());

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (recommendationTimeoutRef.current) {
        clearTimeout(recommendationTimeoutRef.current);
      }
    };
  }, []);

  // Load cache on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHE);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const cacheMap = new Map<string, ThemeRecommendationOutput>();
            Object.entries(parsed).forEach(([key, value]) => {
              if (value && typeof value === 'object' && 'topTheme' in value &&
                  validateThemeData((value as ThemeRecommendationOutput).topTheme)) {
                cacheMap.set(key, value as ThemeRecommendationOutput);
              }
            });
            setCachedRecommendations(cacheMap);
          }
        }
      } catch (err) {
        console.error('[ThemeRecommend] Failed to load cache:', err);
      }
    };
    void loadCache();
  }, []);

  // Persist history
  const persistHistory = useCallback(async (historyToPersist: ThemeRecommendationOutput[]) => {
    if (!isMountedRef.current) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(historyToPersist));
    } catch (err) {
      console.error('[ThemeRecommend] Failed to persist history:', err);
    }
  }, []);

  // Load history
  const loadHistoryFromStorage = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!stored) {
        if (isMountedRef.current) {
          setRecentThemes([]);
          setHistoryLoaded(true);
        }
        return;
      }

      const parsed = JSON.parse(stored) as ThemeRecommendationOutput[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validThemes = parsed.filter(
          (theme): theme is ThemeRecommendationOutput =>
            theme?.topTheme != null && validateThemeData(theme.topTheme)
        );
        if (isMountedRef.current) {
          setRecentThemes(validThemes.slice(-CONFIG.MAX_HISTORY_ITEMS));
        }
      } else {
        if (isMountedRef.current) {
          setRecentThemes([]);
        }
      }
    } catch (err) {
      console.error('[ThemeRecommend] Failed to load history:', err);
      if (isMountedRef.current) {
        setRecentThemes([]);
      }
    } finally {
      if (isMountedRef.current) {
        setHistoryLoaded(true);
      }
    }
  }, []);

  // Load history on mount
  useEffect(() => {
    void loadHistoryFromStorage();
  }, [loadHistoryFromStorage]);

  // Persist history when it changes
  useEffect(() => {
    if (!historyLoaded || recentThemes.length === 0) return;
    void persistHistory(recentThemes);
  }, [historyLoaded, persistHistory, recentThemes]);

  // Generate recommendations
  const generateRecommendations = useCallback(async (
    room: RoomType,
    mood: DesignMood,
    style: DesignStyle,
    budget?: BudgetValue
  ) => {
    if (!isMountedRef.current) return;

    setIsGenerating(true);
    setError(null);

    const cacheKey = `${room}-${mood}-${style}`;

    // Check cache first
    if (isOffline || cachedRecommendations.has(cacheKey)) {
      const cached = cachedRecommendations.get(cacheKey);
      if (cached) {
        console.log('📦 Using cached recommendations');
        setRecommendationOutput(cached);
        setIsGenerating(false);
        return;
      }

      if (isOffline) {
        setError('No cached recommendations available. Please connect to the internet.');
        setIsGenerating(false);
        return;
      }
    }

    try {
      console.log('🎨 Generating theme recommendations...', { room, mood, style, budget });

      // The service's getThemeRecommendations always returns a result (either API or fallback)
      // It never throws - it catches all errors and returns fallback
      const output = await themeRecommendationService.getThemeRecommendations({
        preferences: {
          roomType: room,
          desiredMood: mood,
          stylePreference: style,
          budgetRange: budget || undefined,
        },
        filterOptions: budget ? { priceRange: budget } : undefined,
      });

      if (!isMountedRef.current) return;

      if (!output?.topTheme || !validateThemeData(output.topTheme)) {
        // If service returns invalid data, use fallback directly
        console.warn('⚠️ [useThemeRecommendations] Invalid output from service, using fallback');
        const fallbackOutput = themeRecommendationService.getFallbackRecommendation({
          roomType: room,
          desiredMood: mood,
          stylePreference: style,
          budgetRange: budget || undefined,
        });
        setRecommendationOutput(fallbackOutput);
        setError('Using offline recommendations. Start backend server for AI recommendations.');
        
        // Save fallback and update history (reused code)
        const newCache = new Map(cachedRecommendations);
        newCache.set(cacheKey, fallbackOutput);
        setCachedRecommendations(newCache);
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(Object.fromEntries(newCache)));
        } catch (cacheError) {
          console.error('[ThemeRecommend] Failed to save cache:', cacheError);
        }
        setRecentThemes((prev) => {
          const combined = [...prev, fallbackOutput];
          const seen = new Set<string>();
          const deduped: ThemeRecommendationOutput[] = [];
          for (let i = combined.length - 1; i >= 0; i -= 1) {
            const item = combined[i];
            if (!item?.topTheme?.id) continue;
            const key = item.metadata?.sessionId ?? item.topTheme.id;
            if (!seen.has(key)) {
              deduped.unshift(item);
              seen.add(key);
            }
          }
          return deduped.slice(-CONFIG.MAX_HISTORY_ITEMS);
        });
        return; // Exit early
      }

      setRecommendationOutput(output);

      // Check if this is a fallback recommendation (based on metadata)
      const isFallback = output.metadata?.mlModel === 'fallback-v1.0' || 
                         output.metadata?.mlModel === 'offline-fallback' ||
                         output.insights?.reasonForRecommendation?.toLowerCase().includes('fallback') ||
                         output.insights?.reasonForRecommendation?.toLowerCase().includes('offline');
      
      if (isFallback) {
        // Show informational banner instead of error
        setError('Using offline recommendations. Start backend server for AI recommendations.');
      } else {
        // Clear any previous errors if we got a valid API response
        setError(null);
      }

      // Save to cache
      const newCache = new Map(cachedRecommendations);
      newCache.set(cacheKey, output);
      setCachedRecommendations(newCache);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(Object.fromEntries(newCache)));
      } catch (cacheError) {
        console.error('[ThemeRecommend] Failed to save cache:', cacheError);
      }

      // Update history
      setRecentThemes((prev) => {
        const combined = [...prev, output];
        const seen = new Set<string>();
        const deduped: ThemeRecommendationOutput[] = [];

        for (let i = combined.length - 1; i >= 0; i -= 1) {
          const item = combined[i];
          if (!item?.topTheme?.id) continue;
          const key = item.metadata?.sessionId ?? item.topTheme.id;
          if (!seen.has(key)) {
            deduped.unshift(item);
            seen.add(key);
          }
        }

        return deduped.slice(-CONFIG.MAX_HISTORY_ITEMS);
      });

    } catch (err) {
      if (!isMountedRef.current) return;

      // The service should never throw (it always returns fallback), but just in case...
      console.error('❌ [useThemeRecommendations] Unexpected error (service should have returned fallback):', err);
      
      // Use fallback directly as last resort
      const fallbackOutput = themeRecommendationService.getFallbackRecommendation({
        roomType: room,
        desiredMood: mood,
        stylePreference: style,
        budgetRange: budget || undefined,
      });
      setRecommendationOutput(fallbackOutput);
      
      // Show informational message (not an error alert)
      setError('Using offline recommendations. Start backend server for AI recommendations.');
      
      // Save fallback to cache
      const newCache = new Map(cachedRecommendations);
      newCache.set(cacheKey, fallbackOutput);
      setCachedRecommendations(newCache);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(Object.fromEntries(newCache)));
      } catch (cacheError) {
        console.error('[ThemeRecommend] Failed to save cache:', cacheError);
      }
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  }, [isOffline, cachedRecommendations]);

  return {
    isGenerating,
    recommendationOutput,
    recentThemes,
    historyLoaded,
    error,
    cachedRecommendations,
    generateRecommendations,
    loadHistoryFromStorage,
    setRecommendationOutput,
    setError,
  };
}
