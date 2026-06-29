/**
 * Theme Recommendation Screen (Refactored)
 * 
 * Original: 7098 lines
 * Refactored: ~800 lines
 * 
 * This component now uses custom hooks for state management:
 * - useThemeSelection: Room, mood, style, budget selection
 * - useThemeRecommendations: AI theme generation and caching
 * - useThemeCollections: Collection/mood board management
 * - useThemeLikes: Like/dislike feedback
 * - useThemeUI: UI state, animations, history filtering
 * - useThemeImageGeneration: AI image generation
 * 
 * Sub-components extracted to frontend/components/theme-recommend/
 * Configuration moved to frontend/config/themeRecommend.config.ts
 * Helper functions moved to frontend/utils/themeRecommendHelpers.ts
 * Types moved to frontend/types/theme-recommend-ui.ts
 */

import React, { useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  Image,
  TextInput,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import type { DesignTheme } from '@/types/theme-recommendation';
import { validateThemeData } from '@/types/theme-recommendation';
import { AnimatedButton, AnimatedCard, FadeInView, SlideInView, ScaleInView } from '@/components/interactive';

// Configuration & Constants
import {
  ROOM_TYPES,
  ROOM_EMOJIS,
  DESIGN_MOODS,
  MOOD_EMOJIS,
  DESIGN_STYLES,
  STYLE_EMOJIS,
  CONFIG,
  ALTERNATIVE_THEME_ITEM_HEIGHT,
} from '@/config/themeRecommend.config';

// Custom Hooks
import { useThemeSelection } from '@/hooks/useThemeSelection';
import { useThemeRecommendations } from '@/hooks/useThemeRecommendations';
import { useThemeCollections } from '@/hooks/useThemeCollections';
import { useThemeLikes } from '@/hooks/useThemeLikes';
import { useThemeUI } from '@/hooks/useThemeUI';
import { useThemeImageGeneration } from '@/hooks/useThemeImageGeneration';

// Sub-components
import { OptionCard, AlternativeThemeCard, BudgetSelector } from '@/components/theme-recommend';

// Helpers
import { getConfidencePercentage, getArrayValue } from '@/utils/themeRecommendHelpers';

// Theme
import { useTheme } from '@/contexts/ThemeContext';
import { getHorizontalPadding } from '@/utils/responsive';
import { styles } from './theme-recommend.styles';
import { ThemeRecommendResults } from '@/components/theme-recommend/ThemeRecommendResults';
import { ThemeRecommendSteps } from '@/components/theme-recommend/ThemeRecommendSteps';

/**
 * Theme Recommendation Screen Component
 * IMPROVED: Added memoization, better error handling, accessibility improvements
 */
function ThemeRecommendScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  // =========================================================================
  // HOOKS - State Management
  // =========================================================================

  const selection = useThemeSelection();

  const ui = useThemeUI({
    step: selection.step,
    selectedRoom: selection.selectedRoom,
    selectedMood: selection.selectedMood,
    selectedStyle: selection.selectedStyle,
    recommendationOutput: null, // Will be set from recommendations hook
  });

  const likes = useThemeLikes({
    selectedRoom: selection.selectedRoom,
    selectedMood: selection.selectedMood,
    selectedStyle: selection.selectedStyle,
    isOffline: ui.isOffline,
  });

  const recommendations = useThemeRecommendations({
    isOffline: ui.isOffline,
    likedThemes: likes.likedThemes,
  });

  const collections = useThemeCollections();

  const imageGeneration = useThemeImageGeneration({
    selectedRoom: selection.selectedRoom,
    selectedStyle: selection.selectedStyle,
    selectedBudget: selection.selectedBudget,
  });

  // Re-compute UI with actual recommendation output
  const uiWithResults = useThemeUI({
    step: selection.step,
    selectedRoom: selection.selectedRoom,
    selectedMood: selection.selectedMood,
    selectedStyle: selection.selectedStyle,
    recommendationOutput: recommendations.recommendationOutput,
  });

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleBudgetSelect = useCallback(async (budget: typeof selection.selectedBudget) => {
    if (!budget || !selection.selectedRoom || !selection.selectedMood || !selection.selectedStyle) return;

    await selection.handleBudgetSelect(budget, async () => {
      await recommendations.generateRecommendations(
        selection.selectedRoom!,
        selection.selectedMood!,
        selection.selectedStyle!,
        budget
      );
      selection.setStep('results');
    });
  }, [selection, recommendations]);

  const handleApplyTheme = useCallback(async (theme: DesignTheme) => {
    if (!validateThemeData(theme)) {
      Alert.alert(
        'Error',
        'Invalid theme data. Please try refreshing or selecting a different theme.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    try {
      // Announce to screen readers
      AccessibilityInfo.announceForAccessibility(`Applying theme: ${theme.name}`);

      router.push({
        pathname: '/ai-design',
        params: {
          themeColors: JSON.stringify(theme?.colorPalette ?? []),
          themeName: theme?.name ?? 'Unknown Theme',
        },
      });
    } catch (error) {
      console.error('[ThemeRecommend] Error applying theme:', error);
      Alert.alert(
        'Error',
        'Unable to apply theme. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [router]);

  const handleRefresh = useCallback(async () => {
    uiWithResults.setRefreshing(true);
    try {
      if (selection.step === 'results' && selection.selectedRoom && selection.selectedMood && selection.selectedStyle) {
        await recommendations.generateRecommendations(
          selection.selectedRoom,
          selection.selectedMood,
          selection.selectedStyle,
          selection.selectedBudget || undefined
        );
      }
    } finally {
      uiWithResults.setRefreshing(false);
    }
  }, [selection, recommendations, uiWithResults]);

  // Filtered history - memoized for performance
  const filteredHistory = useMemo(() => {
    if (!recommendations.recentThemes || recommendations.recentThemes.length === 0) {
      return [];
    }
    return uiWithResults.filterAndSortHistory(recommendations.recentThemes, likes.likedThemes);
  }, [recommendations.recentThemes, likes.likedThemes, uiWithResults]);

  // Memoize color palette to prevent unnecessary re-renders
  const colorPaletteMemoized = useMemo(() => {
    if (!uiWithResults.resultsData?.colorPalette) return [];
    return uiWithResults.resultsData.colorPalette.slice(0, CONFIG.MAX_COLOR_SWATCHES);
  }, [uiWithResults.resultsData?.colorPalette]);

  // =========================================================================
  // LOADING STATE
  // =========================================================================

  if (recommendations.isGenerating) {
    return (
      <View style={styles.container}>
        <StatusBar style={statusBarStyle} />
        {ui.isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📥 Offline Mode - Using Cached Data</Text>
          </View>
        )}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Theme Finder</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Analyzing your preferences...</Text>
          <Text style={styles.loadingSubtext}>Finding perfect themes for you</Text>
        </View>
      </View>
    );
  }

  // =========================================================================
  // RESULTS STATE
  // =========================================================================

  if (selection.step === 'results' && uiWithResults.resultsData) {
    return (
      <ThemeRecommendResults
        selection={selection}
        uiWithResults={uiWithResults}
        recommendations={recommendations}
        likes={likes}
        collections={collections}
        imageGeneration={imageGeneration}
        colors={colors}
        statusBarStyle={statusBarStyle}
        handleRefresh={handleRefresh}
        handleApplyTheme={handleApplyTheme}
        filteredHistory={filteredHistory}
        colorPaletteMemoized={colorPaletteMemoized}
        ui={ui}
        router={router}
      />
    );
  }

  // =========================================================================
  // SELECTION STEPS (Room, Mood, Style, Budget)
  // =========================================================================

  return (
    <ThemeRecommendSteps
      selection={selection}
      uiWithResults={uiWithResults}
      recommendations={recommendations}
      ui={ui}
      colors={colors}
      statusBarStyle={statusBarStyle}
      handleBudgetSelect={handleBudgetSelect}
      router={router}
    />
  );
}

// ============================================================================
// STYLES
// ============================================================================
// Styles are now imported from theme-recommend.styles.ts

// Memoize the component to prevent unnecessary re-renders
export default memo(ThemeRecommendScreen);

