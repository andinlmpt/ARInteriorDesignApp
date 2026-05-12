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
    const {
      topTheme,
      alternativeThemes,
      materials,
      decorItems,
      moodScore,
      styleScore,
      roomScore,
      confidenceValue,
      totalAnalyzed,
      processingTimeSeconds,
    } = uiWithResults.resultsData;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        {ui.isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📥 Offline Mode</Text>
          </View>
        )}

        <View style={[styles.header, { backgroundColor: colors.surfacePrimary, borderBottomColor: colors.border }]}>
          <AnimatedButton onPress={selection.resetSelection} hapticType="light">
            <Text style={[styles.backButton, { color: colors.accent }]}>← Start Over</Text>
          </AnimatedButton>
          <FadeInView delay={100}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Your Themes</Text>
          </FadeInView>
          <AnimatedButton
            style={[styles.headerButton, { backgroundColor: colors.surfaceSecondary }, uiWithResults.comparisonMode && { backgroundColor: colors.success }]}
            onPress={() => uiWithResults.setComparisonMode(!uiWithResults.comparisonMode)}
            hapticType="light"
          >
            <Text style={styles.headerButtonText}>👑</Text>
          </AnimatedButton>
        </View>

        {/* Breadcrumb Navigation */}
        <View style={[styles.breadcrumbContainer, { backgroundColor: colors.surfacePrimary }]}>
          <AnimatedButton style={styles.breadcrumbItem} onPress={() => { selection.setStep('room'); selection.resetSelection(); }} hapticType="light">
            <Text style={styles.breadcrumbText}>Room</Text>
          </AnimatedButton>
          <Text style={styles.breadcrumbSeparator}>→</Text>
          <AnimatedButton style={styles.breadcrumbItem} onPress={() => selection.setStep('mood')} hapticType="light">
            <Text style={styles.breadcrumbText}>Mood</Text>
          </AnimatedButton>
          <Text style={styles.breadcrumbSeparator}>→</Text>
          <AnimatedButton style={styles.breadcrumbItem} onPress={() => selection.setStep('style')} hapticType="light">
            <Text style={styles.breadcrumbText}>Style</Text>
          </AnimatedButton>
          <Text style={styles.breadcrumbSeparator}>→</Text>
          <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>Results</Text>
        </View>

        {recommendations.error && (
          <View style={[
            styles.errorBanner,
            recommendations.error.includes('offline') || recommendations.error.includes('backend')
              ? styles.infoBanner
              : null
          ]}>
            <Text style={styles.errorText}>{recommendations.error}</Text>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={uiWithResults.refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
          }
        >
          <View style={styles.content}>
            {/* User Selections Summary */}
            {selection.selectedRoom && selection.selectedMood && selection.selectedStyle && (
              <View style={[styles.userChoicesCard, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
                <Text style={[styles.userChoicesTitle, { color: colors.textSecondary }]}>Your Selections</Text>
                <View style={styles.userChoicesRow}>
                  <View style={[styles.userChoiceBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={styles.userChoiceEmoji}>{ROOM_EMOJIS[selection.selectedRoom]}</Text>
                    <Text style={[styles.userChoiceText, { color: colors.textPrimary }]}>{selection.selectedRoom}</Text>
                  </View>
                  <Text style={[styles.userChoiceArrow, { color: colors.textMuted }]}>→</Text>
                  <View style={[styles.userChoiceBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={styles.userChoiceEmoji}>{MOOD_EMOJIS[selection.selectedMood]}</Text>
                    <Text style={[styles.userChoiceText, { color: colors.textPrimary }]}>{selection.selectedMood}</Text>
                  </View>
                  <Text style={[styles.userChoiceArrow, { color: colors.textMuted }]}>→</Text>
                  <View style={[styles.userChoiceBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={styles.userChoiceEmoji}>{STYLE_EMOJIS[selection.selectedStyle]}</Text>
                    <Text style={[styles.userChoiceText, { color: colors.textPrimary }]}>{selection.selectedStyle}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Stats Dashboard */}
            {uiWithResults.showThemeStats && (
              <View style={styles.statsDashboard}>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>🎯</Text>
                    <Text style={styles.statValue}>{confidenceValue}%</Text>
                    <Text style={styles.statLabel}>Match</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>😊</Text>
                    <Text style={styles.statValue}>{Math.round(moodScore)}</Text>
                    <Text style={styles.statLabel}>Mood</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>🎨</Text>
                    <Text style={styles.statValue}>{Math.round(styleScore)}</Text>
                    <Text style={styles.statLabel}>Style</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statIcon}>🏠</Text>
                    <Text style={styles.statValue}>{Math.round(roomScore)}</Text>
                    <Text style={styles.statLabel}>Room</Text>
                  </View>
                </View>
                <Text style={styles.statsInfo}>✅ Analyzed {totalAnalyzed} themes in {processingTimeSeconds}s</Text>
              </View>
            )}

            {/* Top Theme Card */}
            <View style={[styles.topThemeCard, { backgroundColor: colors.surfacePrimary, borderColor: colors.accent }]}>
              <View style={styles.bestBadge}>
                <Text style={[styles.bestBadgeText, { color: colors.textPrimary }]}>⭐ BEST MATCH</Text>
              </View>

              <Text style={[styles.topThemeTitle, { color: colors.textPrimary }]}>{topTheme?.name ?? 'Unknown Theme'}</Text>
              <Text style={[styles.topThemeDescription, { color: colors.textSecondary }]}>{topTheme?.description ?? 'No description'}</Text>

              <View style={[styles.confidenceContainer, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.confidenceLabel, { color: colors.textPrimary }]}>Match Confidence</Text>
                <Text style={[styles.confidenceValue, { color: colors.accent }]}>{confidenceValue}%</Text>
              </View>

              {/* Color Palette */}
              <View style={styles.colorPaletteSection}>
                <Text style={styles.sectionLabel}>Color Palette</Text>
                <View style={styles.colorPalette}>
                  {colorPaletteMemoized.map((color, idx) => (
                    <ScaleInView key={`${color}-${idx}`} delay={idx * 50}>
                      <AnimatedButton
                        style={[styles.colorSwatch, { backgroundColor: color }]}
                        onPress={() => uiWithResults.copyColorToClipboard(color)}
                        accessibilityLabel={`Color swatch ${idx + 1}: ${color}`}
                        accessibilityRole="button"
                        accessibilityHint="Double tap to copy color code to clipboard"
                        hapticType="light"
                      >
                        <View />
                      </AnimatedButton>
                    </ScaleInView>
                  ))}
                </View>
              </View>

              {/* Materials */}
              {materials.length > 0 && (
                <View style={styles.materialSection}>
                  <Text style={styles.sectionLabel}>Materials</Text>
                  <Text style={styles.materialText}>{materials.join(', ')}</Text>
                </View>
              )}

              {/* Decor Items */}
              {decorItems.length > 0 && (
                <View style={styles.decorSection}>
                  <Text style={styles.sectionLabel}>Decor Items</Text>
                  <Text style={styles.decorText}>{decorItems.slice(0, CONFIG.MAX_DECOR_ITEMS_DISPLAY).join(', ')}</Text>
                </View>
              )}

              {/* Generated Image */}
              {imageGeneration.generatedImages.has(topTheme.id) && (
                <View style={styles.generatedImageContainer}>
                  <Image
                    source={{ uri: imageGeneration.generatedImages.get(topTheme.id)?.imageUrl }}
                    style={styles.generatedImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Actions */}
              <View style={styles.themeActions} accessibilityRole="toolbar">
                <AnimatedButton
                  style={[styles.likeButton, likes.likedThemes.has(topTheme.id) && styles.likeButtonActive]}
                  onPress={() => likes.handleLikeTheme(topTheme.id, topTheme)}
                  accessibilityLabel={likes.likedThemes.has(topTheme.id) ? 'Unlike theme' : 'Like theme'}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to like or unlike this theme"
                  hapticType="light"
                >
                  <Text style={styles.likeButtonText}>
                    {likes.likedThemes.has(topTheme.id) ? '❤️' : '🤍'}
                  </Text>
                </AnimatedButton>

                <AnimatedButton
                  style={[styles.generateImageButton, imageGeneration.isGeneratingImage === topTheme.id && styles.buttonDisabled]}
                  onPress={() => imageGeneration.handleGenerateImage(topTheme)}
                  disabled={imageGeneration.isGeneratingImage === topTheme.id}
                  accessibilityLabel="Generate image"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: imageGeneration.isGeneratingImage === topTheme.id }}
                  accessibilityHint="Double tap to generate an image preview for this theme"
                  hapticType="medium"
                >
                  {imageGeneration.isGeneratingImage === topTheme.id ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.generateImageButtonText}>🖼️ Generate Image</Text>
                  )}
                </AnimatedButton>

                <AnimatedButton
                  style={styles.applyButton}
                  onPress={() => handleApplyTheme(topTheme)}
                  accessibilityLabel="Apply theme to design"
                  accessibilityRole="button"
                  accessibilityHint="Double tap to apply this theme to your design project"
                  hapticType="success"
                >
                  <Text style={styles.applyButtonText}>✨ Apply Theme</Text>
                </AnimatedButton>
              </View>
            </View>

            {/* Custom Design Input Section */}
            <View style={[styles.customDesignSection, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>✨ Create Your Own Design</Text>
              <Text style={[styles.customDesignSubtitle, { color: colors.textSecondary }]}>
                Type your design idea and we'll generate a picture for you!
              </Text>
              <TextInput
                style={[styles.customDesignInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="E.g., A cozy living room with a fireplace, modern furniture, and warm lighting..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={imageGeneration.customDesignText}
                onChangeText={imageGeneration.setCustomDesignText}
                accessibilityLabel="Custom design description input"
                accessibilityHint="Type your design idea here"
              />
              <AnimatedButton
                style={[
                  styles.generateCustomImageButton,
                  { backgroundColor: colors.accent },
                  (imageGeneration.isGeneratingCustomImage || !imageGeneration.customDesignText?.trim()) && styles.buttonDisabled
                ]}
                onPress={() => imageGeneration.handleGenerateCustomDesign()}
                disabled={imageGeneration.isGeneratingCustomImage || !imageGeneration.customDesignText?.trim()}
                accessibilityLabel="Generate image from custom design"
                accessibilityRole="button"
                accessibilityState={{ disabled: imageGeneration.isGeneratingCustomImage || !imageGeneration.customDesignText?.trim() }}
                hapticType="medium"
              >
                {imageGeneration.isGeneratingCustomImage ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.generateCustomImageButtonText}>Generating...</Text>
                  </>
                ) : (
                  <Text style={styles.generateCustomImageButtonText}>🎨 Generate Image</Text>
                )}
              </AnimatedButton>

              {/* Display generated custom image */}
              {imageGeneration.customDesignImage && (
                <View style={styles.customImageContainer}>
                  <Image
                    source={{ uri: imageGeneration.customDesignImage }}
                    style={styles.customGeneratedImage}
                    resizeMode="cover"
                    accessibilityLabel="Generated image from your custom design"
                  />
                  <TouchableOpacity
                    style={styles.removeCustomImageButton}
                    onPress={() => imageGeneration.clearCustomDesignImage()}
                    accessibilityLabel="Remove custom design image"
                    accessibilityRole="button"
                  >
                    <Text style={styles.removeCustomImageButtonText}>✕</Text>
                  </TouchableOpacity>
                  {imageGeneration.customDesignAttribution && (
                    <View style={styles.attributionContainer}>
                      <Text style={styles.attributionText}>
                        Photo by {imageGeneration.customDesignAttribution.photographer || 'Unknown'} on{' '}
                        {imageGeneration.customDesignAttribution.source || 'Pexels'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Alternative Themes */}
            {alternativeThemes.length > 0 && (
              <View style={styles.alternativesSection} accessibilityLabel="Alternative theme recommendations">
                <Text style={styles.sectionTitle}>Alternative Themes</Text>
                <FlatList
                  horizontal
                  data={alternativeThemes}
                  keyExtractor={(item, index) => `${item.id}-${index}`}
                  renderItem={({ item }) => (
                    <AlternativeThemeCard
                      theme={item}
                      comparisonMode={uiWithResults.comparisonMode}
                      isSelected={uiWithResults.selectedThemesForComparison.includes(item.id)}
                      onPress={() => handleApplyTheme(item)}
                      onToggleComparison={() => {
                        const current = uiWithResults.selectedThemesForComparison;
                        if (current.includes(item.id)) {
                          uiWithResults.setSelectedThemesForComparison(current.filter(id => id !== item.id));
                        } else {
                          uiWithResults.setSelectedThemesForComparison([...current, item.id]);
                        }
                      }}
                    />
                  )}
                  showsHorizontalScrollIndicator={false}
                  getItemLayout={(_, index) => ({
                    length: ALTERNATIVE_THEME_ITEM_HEIGHT,
                    offset: ALTERNATIVE_THEME_ITEM_HEIGHT * index,
                    index,
                  })}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                  initialNumToRender={3}
                  accessibilityLabel="Alternative theme recommendations"
                />
              </View>
            )}

            {/* History Section */}
            {filteredHistory.length > 0 && (
              <View style={styles.historySection}>
                <View style={styles.historyHeader}>
                  <Text style={styles.sectionTitle}>Recent Themes</Text>
                  <TouchableOpacity
                    style={styles.historyFilterButton}
                    onPress={() => uiWithResults.setShowHistoryFilters(!uiWithResults.showHistoryFilters)}
                  >
                    <Text style={styles.historyFilterButtonText}>🔍 Filter</Text>
                  </TouchableOpacity>
                </View>

                {uiWithResults.showHistoryFilters && (
                  <View style={styles.historyFilters}>
                    <TextInput
                      style={styles.historySearchInput}
                      placeholder="Search themes..."
                      value={uiWithResults.searchQuery}
                      onChangeText={uiWithResults.setSearchQuery}
                    />
                    <View style={styles.historySortRow}>
                      <Text style={styles.historySortLabel}>Sort:</Text>
                      {(['date', 'confidence', 'likes'] as const).map(sort => (
                        <TouchableOpacity
                          key={sort}
                          style={[styles.historySortChip, uiWithResults.historySortBy === sort && styles.historySortChipActive]}
                          onPress={() => uiWithResults.setHistorySortBy(sort)}
                        >
                          <Text style={styles.historySortChipText}>{sort}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filteredHistory.map((theme, idx) => (
                    <TouchableOpacity
                      key={`${theme.topTheme.id}-${idx}`}
                      style={[
                        styles.historyCard,
                        likes.likedThemes.has(theme.topTheme.id) && styles.historyCardLiked,
                      ]}
                      onPress={() => {
                        recommendations.setRecommendationOutput(theme);
                        selection.setStep('results');
                      }}
                    >
                      <Text style={styles.historyCardTitle}>{theme.topTheme.name}</Text>
                      <Text style={styles.historyCardConfidence}>
                        {getConfidencePercentage(theme.topTheme.confidence)}% match
                      </Text>
                      <View style={styles.historyCardColors}>
                        {getArrayValue(theme.topTheme.colorPalette).slice(0, 3).map((color, cidx) => (
                          <View
                            key={`${color}-${cidx}`}
                            style={[styles.historyColorDot, { backgroundColor: color as string }]}
                          />
                        ))}
                      </View>
                      {likes.likedThemes.has(theme.topTheme.id) && (
                        <Text style={styles.historyLikedBadge}>❤️</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Actions */}
            <SlideInView direction="bottom" delay={200}>
              <View style={styles.resultActions}>
                <AnimatedButton style={styles.retakeButton} onPress={selection.resetSelection} hapticType="medium">
                  <Text style={styles.retakeButtonText}>🔁 Try Different Mood</Text>
                </AnimatedButton>
                <AnimatedButton
                  style={styles.collectionsButton}
                  onPress={() => collections.setShowCollectionsModal(true)}
                  hapticType="light"
                >
                  <Text style={styles.collectionsButtonText}>📁 My Collections</Text>
                </AnimatedButton>
              </View>
            </SlideInView>
          </View>
        </ScrollView>

        {/* Collections Modal */}
        <Modal
          visible={collections.showCollectionsModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Collections</Text>
              <TouchableOpacity onPress={() => collections.setShowCollectionsModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {collections.collections.map(collection => (
                <View key={collection.id} style={styles.collectionCard}>
                  <Text style={styles.collectionName}>{collection.name}</Text>
                  <Text style={styles.collectionCount}>{collection.themes.length} themes</Text>
                  <View style={styles.collectionActions}>
                    <TouchableOpacity
                      onPress={() => collections.addThemeToCollection(topTheme, collection.id)}
                    >
                      <Text style={styles.collectionActionText}>+ Add Current</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => collections.exportCollectionAsPDF(collection)}>
                      <Text style={styles.collectionActionText}>📤 Export</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => collections.deleteCollection(collection.id)}>
                      <Text style={[styles.collectionActionText, styles.deleteText]}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={styles.createCollectionButton}
                onPress={() => collections.setShowCreateCollectionModal(true)}
              >
                <Text style={styles.createCollectionButtonText}>+ Create New Collection</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Create Collection Modal */}
        <Modal
          visible={collections.showCreateCollectionModal}
          animationType="fade"
          transparent
        >
          <View style={styles.createModalOverlay}>
            <View style={styles.createModalContent}>
              <Text style={styles.createModalTitle}>New Collection</Text>
              <TextInput
                style={styles.createModalInput}
                placeholder="Collection name"
                value={collections.newCollectionName}
                onChangeText={collections.setNewCollectionName}
              />
              <TextInput
                style={[styles.createModalInput, styles.createModalInputMultiline]}
                placeholder="Description (optional)"
                value={collections.newCollectionDescription}
                onChangeText={collections.setNewCollectionDescription}
                multiline
              />
              <View style={styles.createModalActions}>
                <TouchableOpacity
                  style={styles.createModalCancel}
                  onPress={() => router.push('/')}
                >
                  <Text style={styles.createModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createModalConfirm}
                  onPress={collections.createCollection}
                  disabled={collections.isSavingCollection}
                >
                  {collections.isSavingCollection ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createModalConfirmText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // =========================================================================
  // SELECTION STEPS (Room, Mood, Style, Budget)
  // =========================================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      {ui.isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📥 Offline Mode</Text>
        </View>
      )}

      <View style={[styles.header, { backgroundColor: colors.surfacePrimary, borderBottomColor: colors.border }]}>
        <AnimatedButton onPress={() => router.push('/')} hapticType="light">
          <Text style={[styles.backButton, { color: colors.accent }]}>← Back</Text>
        </AnimatedButton>
        <FadeInView delay={100}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Theme Finder</Text>
        </FadeInView>
        <AnimatedButton onPress={() => uiWithResults.setShowTutorial(true)} hapticType="light">
          <Text style={styles.helpButton}>❓</Text>
        </AnimatedButton>
      </View>

      {/* Progress Indicator */}
      <View style={[styles.progressContainer, { backgroundColor: colors.surfacePrimary }]}>
        {['room', 'mood', 'style', 'budget'].map((s, idx) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              { backgroundColor: colors.border },
              selection.step === s && { backgroundColor: colors.accent },
              ['room', 'mood', 'style', 'budget'].indexOf(selection.step) > idx && { backgroundColor: colors.success },
            ]}
          />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.content}>
          {/* ROOM SELECTION */}
          {selection.step === 'room' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select Your Room</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>What space are you designing?</Text>
              <View style={styles.optionsGrid}>
                {ROOM_TYPES.map(room => (
                  <OptionCard
                    key={room}
                    value={room}
                    emoji={ROOM_EMOJIS[room]}
                    label={room}
                    isSelected={selection.selectedRoom === room}
                    hasFeedback={selection.selectionFeedback?.type === 'room' && selection.selectionFeedback?.value === room}
                    onPress={() => selection.handleRoomSelect(room)}
                    accessibilityLabel={`Select ${room}`}
                  />
                ))}
              </View>
            </View>
          )}

          {/* MOOD SELECTION */}
          {selection.step === 'mood' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select Your Mood</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>What atmosphere do you want?</Text>
              <View style={styles.optionsGrid}>
                {DESIGN_MOODS.map(mood => (
                  <OptionCard
                    key={mood}
                    value={mood}
                    emoji={MOOD_EMOJIS[mood]}
                    label={mood}
                    isSelected={selection.selectedMood === mood}
                    hasFeedback={selection.selectionFeedback?.type === 'mood' && selection.selectionFeedback?.value === mood}
                    onPress={() => selection.handleMoodSelect(mood)}
                    accessibilityLabel={`Select ${mood} mood`}
                  />
                ))}
              </View>
              <AnimatedButton style={styles.backStepButton} onPress={() => selection.setStep('room')} hapticType="light">
                <Text style={[styles.backStepButtonText, { color: colors.accent }]}>← Change Room</Text>
              </AnimatedButton>
            </View>
          )}

          {/* STYLE SELECTION */}
          {selection.step === 'style' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select Your Style</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>What design style do you prefer?</Text>
              <View style={styles.optionsGrid}>
                {DESIGN_STYLES.map(style => (
                  <OptionCard
                    key={style}
                    value={style}
                    emoji={STYLE_EMOJIS[style]}
                    label={style}
                    isSelected={selection.selectedStyle === style}
                    hasFeedback={selection.selectionFeedback?.type === 'style' && selection.selectionFeedback?.value === style}
                    onPress={() => selection.handleStyleSelect(style)}
                    accessibilityLabel={`Select ${style} style`}
                  />
                ))}
              </View>
              <AnimatedButton style={styles.backStepButton} onPress={() => selection.setStep('mood')} hapticType="light">
                <Text style={[styles.backStepButtonText, { color: colors.accent }]}>← Change Mood</Text>
              </AnimatedButton>
            </View>
          )}

          {/* BUDGET SELECTION */}
          {selection.step === 'budget' && (
            <View style={styles.stepContainer}>
              <BudgetSelector
                selectedBudget={selection.selectedBudget}
                onSelect={handleBudgetSelect}
                disabled={recommendations.isGenerating}
              />
              <AnimatedButton style={styles.backStepButton} onPress={() => selection.setStep('style')} hapticType="light">
                <Text style={[styles.backStepButtonText, { color: colors.accent }]}>← Change Style</Text>
              </AnimatedButton>
            </View>
          )}

          {/* WELCOME STATE */}
          {selection.step === 'welcome' && (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeEmoji}>🎨</Text>
              <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>Find Your Perfect Theme</Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                Answer a few questions about your room, mood, and style preferences to get personalized theme recommendations.
              </Text>
              <SlideInView direction="bottom" delay={300}>
                <AnimatedButton
                  style={[styles.startButton, { backgroundColor: colors.accent }]}
                  onPress={() => selection.setStep('room')}
                  hapticType="success"
                >
                  <Text style={styles.startButtonText}>Get Started</Text>
                </AnimatedButton>
              </SlideInView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Tutorial Modal */}
      {uiWithResults.showTutorial && (
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialModal}>
            <View style={styles.tutorialHeader}>
              <Text style={styles.tutorialTitle}>
                {uiWithResults.getTutorialSteps()[uiWithResults.tutorialStep]?.emoji}{' '}
                {uiWithResults.getTutorialSteps()[uiWithResults.tutorialStep]?.title}
              </Text>
              <TouchableOpacity onPress={() => uiWithResults.setShowTutorial(false)}>
                <Text style={styles.tutorialCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tutorialDescription}>
              {uiWithResults.getTutorialSteps()[uiWithResults.tutorialStep]?.description}
            </Text>
            <View style={styles.tutorialProgress}>
              {uiWithResults.getTutorialSteps().map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tutorialDot,
                    idx === uiWithResults.tutorialStep && styles.tutorialDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.tutorialButtons}>
              {uiWithResults.tutorialStep > 0 && (
                <TouchableOpacity
                  style={styles.tutorialNavButton}
                  onPress={() => uiWithResults.setTutorialStep(uiWithResults.tutorialStep - 1)}
                >
                  <Text style={styles.tutorialNavText}>← Previous</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.tutorialNavButton, styles.tutorialNavButtonPrimary]}
                onPress={() => {
                  if (uiWithResults.tutorialStep < uiWithResults.getTutorialSteps().length - 1) {
                    uiWithResults.setTutorialStep(uiWithResults.tutorialStep + 1);
                  } else {
                    uiWithResults.setShowTutorial(false);
                  }
                }}
              >
                <Text style={styles.tutorialNavText}>
                  {uiWithResults.tutorialStep === uiWithResults.getTutorialSteps().length - 1 ? 'Done' : 'Next →'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: getHorizontalPadding(16),
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    fontSize: 16,
    color: '#6B4CE6',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  helpButton: {
    fontSize: 20,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  headerButtonText: {
    fontSize: 18,
  },
  comparisonButtonActive: {
    backgroundColor: '#34C759',
  },
  offlineBanner: {
    backgroundColor: '#FF9500',
    padding: 8,
    alignItems: 'center',
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#94A3B8',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#334155',
  },
  progressDotActive: {
    backgroundColor: '#6B4CE6',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressDotCompleted: {
    backgroundColor: '#10B981',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  backStepButton: {
    marginTop: 24,
    padding: 12,
  },
  backStepButtonText: {
    fontSize: 16,
    color: '#6B4CE6',
    fontWeight: '600',
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: getHorizontalPadding(20),
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#6B4CE6',
    paddingVertical: 16,
    paddingHorizontal: getHorizontalPadding(48),
    borderRadius: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    gap: 8,
  },
  breadcrumbItem: {
    padding: 4,
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#6B4CE6',
    fontWeight: '600',
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: '#64748B',
  },
  breadcrumbActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    backgroundColor: '#FF3B30',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  infoBanner: {
    backgroundColor: '#FF9500',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  userChoicesCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userChoicesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 12,
    textAlign: 'center',
  },
  userChoicesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userChoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 76, 230, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: getHorizontalPadding(12),
    borderRadius: 16,
    gap: 4,
  },
  userChoiceEmoji: {
    fontSize: 16,
  },
  userChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userChoiceArrow: {
    fontSize: 14,
    color: '#64748B',
  },
  statsDashboard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statCard: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B4CE6',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statsInfo: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  topThemeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6B4CE6',
  },
  bestBadge: {
    position: 'absolute',
    top: -12,
    left: 16,
    backgroundColor: '#FFD700',
    paddingVertical: 4,
    paddingHorizontal: getHorizontalPadding(12),
    borderRadius: 12,
  },
  bestBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  topThemeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 8,
  },
  topThemeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 16,
  },
  confidenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 76, 230, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confidenceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6B4CE6',
  },
  colorPaletteSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  materialSection: {
    marginBottom: 16,
  },
  materialText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  decorSection: {
    marginBottom: 16,
  },
  decorText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  generatedImageContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  generatedImage: {
    width: '100%',
    height: 200,
  },
  themeActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  likeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  likeButtonText: {
    fontSize: 20,
  },
  generateImageButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateImageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#6B4CE6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  alternativesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  historySection: {
    marginBottom: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyFilterButton: {
    backgroundColor: '#6B4CE6',
    paddingHorizontal: getHorizontalPadding(12),
    paddingVertical: 6,
    borderRadius: 8,
  },
  historyFilterButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  historyFilters: {
    marginBottom: 12,
  },
  historySearchInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  historySortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historySortLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  historySortChip: {
    backgroundColor: '#334155',
    paddingHorizontal: getHorizontalPadding(10),
    paddingVertical: 6,
    borderRadius: 12,
  },
  historySortChipActive: {
    backgroundColor: '#6B4CE6',
  },
  historySortChipText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 160,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyCardLiked: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  historyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  historyCardConfidence: {
    fontSize: 12,
    color: '#6B4CE6',
    fontWeight: '600',
    marginBottom: 8,
  },
  historyCardColors: {
    flexDirection: 'row',
    gap: 4,
  },
  historyColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyLikedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 14,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  collectionsButton: {
    flex: 1,
    backgroundColor: '#6B4CE6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  collectionsButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: getHorizontalPadding(16),
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalClose: {
    fontSize: 24,
    color: '#94A3B8',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  collectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  collectionCount: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 12,
  },
  collectionActions: {
    flexDirection: 'row',
    gap: 16,
  },
  collectionActionText: {
    fontSize: 14,
    color: '#6B4CE6',
    fontWeight: '600',
  },
  deleteText: {
    color: '#EF4444',
  },
  createCollectionButton: {
    backgroundColor: '#6B4CE6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createCollectionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createModalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  createModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  createModalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  createModalInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  createModalCancel: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createModalConfirm: {
    flex: 1,
    backgroundColor: '#6B4CE6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createModalConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  tutorialModal: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  tutorialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tutorialTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  tutorialCloseText: {
    fontSize: 24,
    color: '#EF4444',
  },
  tutorialDescription: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 22,
    marginBottom: 20,
  },
  tutorialProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  tutorialDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#334155',
  },
  tutorialDotActive: {
    backgroundColor: '#6B4CE6',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tutorialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  tutorialNavButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  tutorialNavButtonPrimary: {
    backgroundColor: '#6B4CE6',
  },
  tutorialNavText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  customDesignSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customDesignSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
  },
  customDesignInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  generateCustomImageButton: {
    backgroundColor: '#6B4CE6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  generateCustomImageButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customImageContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  customGeneratedImage: {
    width: '100%',
    height: 300,
  },
  removeCustomImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeCustomImageButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  attributionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    paddingHorizontal: getHorizontalPadding(12),
  },
  attributionText: {
    color: '#FFFFFF',
    fontSize: 11,
    textAlign: 'center',
  },
});

// Memoize the component to prevent unnecessary re-renders
export default memo(ThemeRecommendScreen);

