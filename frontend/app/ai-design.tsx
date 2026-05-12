/**
 * AI Design Screen - Refactored
 * Clean, modular version using custom hooks and utilities
 * 
 * Original: 5567 lines
 * Refactored: ~500 lines (90% reduction!)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { AnimatedButton, AnimatedCard, FadeInView, SlideInView, ScaleInView } from '@/components/interactive';
import { Image } from 'expo-image';

// Custom Hooks (replaces 40+ useState!)
import { useAIDesignForm } from '@/hooks/useAIDesignForm';
import { useAIDesignGeneration } from '@/hooks/useAIDesignGeneration';
import { useAIDesignUI } from '@/hooks/useAIDesignUI';

// Configuration & Constants
import {
  DESIGN_STYLES,
  ROOM_TYPES,
  BUDGET_OPTIONS,
  OPTIMIZATION_GOALS,
} from '@/config/aiDesign.config';

// Business Logic
// getFurnitureShape - kept for future use in floor plan visualization

// Storage & Utilities
import {
  loadDesignHistory,
  hasSeenTutorial,
} from '@/utils/aiDesignStorage';

// Services
import { ideaAssistantService } from '@/services/IdeaAssistantService';
import { aiTrainingService } from '@/services/AITrainingService';
import { designImageGenerationService } from '@/services/DesignImageGenerationService';

// Types
import type { TrainingStats } from '@/types/ai-design-ui';
import type { DesignProposal } from '@/types/ai-design';

// Theme
import { useTheme } from '@/contexts/ThemeContext';

export default function AIDesignScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, statusBarStyle } = useTheme();

  // Custom hooks replace 40+ useState hooks!
  const form = useAIDesignForm();
  const generation = useAIDesignGeneration();
  const ui = useAIDesignUI();

  // Additional state
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    NetInfo.fetch().then(state => setIsOffline(!state.isConnected));

    return () => unsubscribe();
  }, []);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [history, tutorialSeen, aiStats] = await Promise.all([
          loadDesignHistory(),
          hasSeenTutorial(),
          aiTrainingService.getTrainingStats(),
        ]);

        if (history.length > 0) {
          generation.setDesignHistory(history);
        }

        if (!tutorialSeen) {
          ui.setShowTutorial(true);
        }

        if (aiStats && aiStats.totalGenerations > 0) {
          setTrainingStats({
            accuracy: typeof aiStats.accuracy === 'number' ? aiStats.accuracy : 0,
            totalGenerations: aiStats.totalGenerations || 0,
          });
        }
      } catch (error) {
        console.error('[AIDesign] Failed to load data:', error);
      }
    };

    loadData();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load room dimensions from params
  useEffect(() => {
    if (params.roomWidth) form.setRoomWidth(params.roomWidth as string);
    if (params.roomLength) form.setRoomLength(params.roomLength as string);
    if (params.roomHeight) form.setRoomHeight(params.roomHeight as string);
  }, [params, form]);

  // AI auto-suggestions as user types
  useEffect(() => {
    if (!form.prompt || form.prompt.length < 10) {
      return;
    }

    const timer = setTimeout(async () => {
      const suggestions = await ideaAssistantService.analyzePrompt(form.prompt);

      // Apply suggestions (Always override if AI finds a specific match)
      if (suggestions.roomType) {
        form.setSelectedRoom(suggestions.roomType);
      }
      if (suggestions.style) {
        form.setSelectedStyle(suggestions.style);
      }
    }, 800); // Slightly longer debounce for better stability

    return () => clearTimeout(timer);
  }, [form.prompt]); // Only depend on the prompt text

  // Generate image for design
  const handleGenerateImage = useCallback(async (proposal: DesignProposal) => {
    try {
      ui.setGeneratingImages(prev => ({ ...prev, [proposal.id]: true }));

      // Clear the current image for this proposal to show it's being refreshed
      ui.setDesignImages(prev => {
        const next = { ...prev };
        delete next[proposal.id];
        return next;
      });

      const imageResult = await designImageGenerationService.generateDesignImage(proposal, {
        roomType: proposal.roomType || 'Room',
        style: form.selectedStyle || 'Modern',
        colors: proposal.colorPalette,
        budget: form.budget,
        quality: ui.imageQuality,
        imageStyle: ui.imageStyle,
        customDesign: form.prompt, // Pass user's prompt for better adherence
      });

      if (imageResult.imageUrl) {
        ui.setDesignImages(prev => ({ ...prev, [proposal.id]: imageResult.imageUrl! }));
      }
    } catch (error) {
      console.error(`[AIDesign] Image generation error for ${proposal.id}:`, error);
      Alert.alert('Image Generation Failed', 'Unable to generate image. Please try again.');
    } finally {
      ui.setGeneratingImages(prev => ({ ...prev, [proposal.id]: false }));
    }
  }, [form, ui]);

  // Handle generate with validation
  const handleGenerate = useCallback(async () => {
    const validation = form.validate();
    if (!validation.isValid) {
      Alert.alert('Validation Errors', validation.errors.join('\n'));
      return;
    }

    // Clear stale images before starting new generation
    ui.setDesignImages({});

    const result = await generation.handleGenerate({
      selectedRoom: form.selectedRoom,
      selectedStyle: form.selectedStyle,
      roomWidth: form.roomWidth,
      roomLength: form.roomLength,
      roomHeight: form.roomHeight,
      budget: form.budget,
      optimizationGoal: form.optimizationGoal,
      prompt: form.prompt,
    }, isOffline);

    // Automatically trigger image generation for the primary design
    if (result && result.proposals && result.proposals.length > 0) {
      handleGenerateImage(result.proposals[0]);
    }
  }, [form, generation, isOffline, handleGenerateImage]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const aiStats = await aiTrainingService.getTrainingStats();
      if (aiStats.totalGenerations > 0) {
        setTrainingStats({
          accuracy: aiStats.accuracy,
          totalGenerations: aiStats.totalGenerations,
        });
      }
    } catch (error) {
      console.error('[AIDesign] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Calculate floor plan visualization - kept for future use
  // const calculateFloorPlan = useCallback((design: DesignProposal) => {
  //   const containerWidth = Math.min(320, screenWidth - 80);
  //   const scale = containerWidth / parseFloat(form.roomWidth);

  //   return design.layout.furniture.map((item) => {
  //     const itemWidthPx = item.dimensions.width * scale;
  //     const itemLengthPx = item.dimensions.length * scale;
  //     const xPercent = (item.position.x / parseFloat(form.roomWidth)) * 100;
  //     const zPercent = (item.position.z / parseFloat(form.roomLength)) * 100;
  //     const furnitureShape = getFurnitureShape(item);

  //     return {
  //       ...item,
  //       itemWidthPx,
  //       itemLengthPx,
  //       xPercent,
  //       zPercent,
  //       furnitureShape,
  //     };
  //   });
  // }, [form.roomWidth, form.roomLength, screenWidth]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <FadeInView delay={0}>
          <View style={[styles.header, { backgroundColor: colors.surfacePrimary, borderBottomColor: colors.border }]}>
            <AnimatedButton onPress={() => router.back()} hapticType="light">
              <Text style={[styles.backButton, { color: colors.accent }]}>← Back</Text>
            </AnimatedButton>
            <Text style={[styles.title, { color: colors.textPrimary }]}>AI Design Assistant</Text>
          </View>
        </FadeInView>

        {/* Offline Banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📵 Offline Mode</Text>
          </View>
        )}

        {/* Training Stats */}
        {trainingStats && (
          <View style={[styles.statsCard, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
            <Text style={[styles.statsText, { color: colors.textPrimary }]}>
              🤖 AI Accuracy: {trainingStats.accuracy.toFixed(1)}%
            </Text>
            <Text style={[styles.statsSubtext, { color: colors.textSecondary }]}>
              {trainingStats.totalGenerations} designs generated
            </Text>
          </View>
        )}

        {/* Form Inputs */}
        <View style={[styles.section, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Describe Your Vision</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="E.g., Cozy modern living room with natural light..."
            placeholderTextColor={colors.textMuted}
            value={form.prompt}
            onChangeText={form.setPrompt}
            multiline
            numberOfLines={3}
          />
        </View>


        {/* Style Selection */}
        <View style={[styles.section, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Design Style</Text>
          <View style={styles.optionsGrid}>
            {DESIGN_STYLES.map((style, idx) => (
              <ScaleInView key={style.id} delay={idx * 50}>
                <AnimatedCard
                  style={[
                    styles.optionButton,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    form.selectedStyle === style.name && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => form.setSelectedStyle(style.name)}
                  hapticFeedback={true}
                >
                  <Text style={styles.emoji}>{style.emoji}</Text>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>{style.name}</Text>
                </AnimatedCard>
              </ScaleInView>
            ))}
          </View>
        </View>

        {/* Room Dimensions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Room Dimensions (meters)</Text>
          <View style={styles.dimensionsRow}>
            <View style={styles.dimensionInput}>
              <Text style={styles.label}>Width</Text>
              <TextInput
                style={styles.input}
                value={form.roomWidth}
                onChangeText={form.setRoomWidth}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.dimensionInput}>
              <Text style={styles.label}>Length</Text>
              <TextInput
                style={styles.input}
                value={form.roomLength}
                onChangeText={form.setRoomLength}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.dimensionInput}>
              <Text style={styles.label}>Height</Text>
              <TextInput
                style={styles.input}
                value={form.roomHeight}
                onChangeText={form.setRoomHeight}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Budget Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget</Text>
          <View style={styles.optionsRow}>
            {BUDGET_OPTIONS.map((budgetOption, idx) => (
              <SlideInView key={budgetOption} direction="bottom" delay={idx * 50}>
                <AnimatedButton
                  style={[
                    styles.budgetButton,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    form.budget === budgetOption && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => form.setBudget(budgetOption)}
                  hapticType="light"
                >
                  <Text style={[styles.budgetText, { color: colors.textPrimary }]}>{budgetOption}</Text>
                </AnimatedButton>
              </SlideInView>
            ))}
          </View>
        </View>

        {/* Optimization Goal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optimization Goal</Text>
          <View style={styles.optionsRow}>
            {OPTIMIZATION_GOALS.map((goal, idx) => (
              <SlideInView key={goal} direction="bottom" delay={idx * 50}>
                <AnimatedButton
                  style={[
                    styles.goalButton,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    form.optimizationGoal === goal && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => form.setOptimizationGoal(goal)}
                  hapticType="light"
                >
                  <Text style={[styles.goalText, { color: colors.textPrimary }]}>{goal}</Text>
                </AnimatedButton>
              </SlideInView>
            ))}
          </View>
        </View>

        {/* Generate Button */}
        <SlideInView direction="bottom" delay={300}>
          <AnimatedButton
            style={[
              styles.generateButton,
              { backgroundColor: colors.accent },
              generation.isGenerating && { backgroundColor: colors.textMuted },
            ]}
            onPress={handleGenerate}
            disabled={generation.isGenerating}
            hapticType="success"
          >
            {generation.isGenerating ? (
              <>
                <ActivityIndicator color="#fff" style={styles.buttonSpinner} />
                <Text style={styles.generateButtonText}>Generating...</Text>
              </>
            ) : (
              <Text style={styles.generateButtonText}>✨ Generate Design</Text>
            )}
          </AnimatedButton>
        </SlideInView>

        {/* Validation Errors */}
        {form.validationErrors.length > 0 && (
          <View style={[styles.errorCard, { backgroundColor: colors.danger + '20', borderLeftColor: colors.danger }]}>
            {form.validationErrors.map((error, idx) => (
              <Text key={idx} style={[styles.errorText, { color: colors.danger }]}>• {error}</Text>
            ))}
          </View>
        )}

        {/* Results */}
        {generation.generatedDesigns.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={[styles.resultsTitle, { color: colors.textPrimary }]}>
              Generated Designs ({generation.generatedDesigns.length})
            </Text>

            {generation.generatedDesigns.map((design, index) => (
              <ScaleInView key={design.id} delay={index * 100}>
                <AnimatedCard style={[styles.designCard, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
                  <Text style={[styles.designTitle, { color: colors.textPrimary }]}>
                    {index + 1}. {design.title}
                  </Text>
                  <Text style={[styles.designDescription, { color: colors.textSecondary }]}>{design.description}</Text>

                  {/* Score */}
                  <View style={styles.scoreRow}>
                    <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Performance Score:</Text>
                    <Text style={[styles.scoreValue, { color: colors.accent }]}>
                      {design.performanceScore.overall.toFixed(1)}/100
                    </Text>
                  </View>

                  {/* Cost */}
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, { color: colors.textSecondary }]}>Estimated Cost:</Text>
                    <Text style={[styles.costValue, { color: colors.textPrimary }]}>
                      ${design.estimatedCost.low.toLocaleString()} - $
                      {design.estimatedCost.high.toLocaleString()}
                    </Text>
                  </View>

                  {/* Furniture Count */}
                  <Text style={[styles.furnitureCount, { color: colors.textSecondary }]}>
                    🪑 {design.layout.furniture.length} furniture items
                  </Text>

                  {/* Color Palette */}
                  <View style={styles.colorPalette}>
                    {design.colorPalette.map((color, idx) => (
                      <View
                        key={idx}
                        style={[styles.colorSwatch, { backgroundColor: color }]}
                      />
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={styles.designActions}>
                    <AnimatedButton
                      style={styles.actionButton}
                      onPress={() => ui.toggleFavorite(design.id)}
                      hapticType="light"
                    >
                      <Text style={styles.actionButtonText}>
                        {ui.favoriteDesigns.has(design.id) ? '❤️' : '🤍'} Favorite
                      </Text>
                    </AnimatedButton>

                    <AnimatedButton
                      style={styles.actionButton}
                      onPress={() => handleGenerateImage(design)}
                      disabled={ui.generatingImages[design.id]}
                      hapticType="medium"
                    >
                      {ui.generatingImages[design.id] ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Text style={styles.actionButtonText}>🖼️ Generate Image</Text>
                      )}
                    </AnimatedButton>

                    <AnimatedButton
                      style={styles.actionButton}
                      onPress={() => router.push(`/ar-view?designId=${design.id}`)}
                      hapticType="medium"
                    >
                      <Text style={styles.actionButtonText}>👓 View in AR</Text>
                    </AnimatedButton>
                  </View>

                  {/* Display Generated Image */}
                  {ui.designImages[design.id] && (
                    <View style={styles.imageContainer}>
                      <Text style={styles.imageLabel}>Generated Visualization:</Text>
                      <Image
                        source={{ uri: ui.designImages[design.id] }}
                        style={styles.generatedImage}
                        contentFit="cover"
                        transition={500}
                      />
                    </View>
                  )}
                </AnimatedCard>
              </ScaleInView>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: '#F59E0B',
    padding: 12,
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontWeight: '600',
  },
  statsCard: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statsSubtext: {
    fontSize: 14,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 100,
  },
  optionButtonActive: {
  },
  emoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
  },
  dimensionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  budgetButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  budgetButtonActive: {
  },
  budgetText: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  goalButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  goalButtonActive: {
  },
  goalText: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  generateButton: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
  },
  buttonSpinner: {
    marginRight: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorCard: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  errorText: {
    marginBottom: 4,
  },
  resultsSection: {
    margin: 16,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  designCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  designTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  designDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 14,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  furnitureCount: {
    fontSize: 14,
    marginBottom: 12,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  designActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
  },
  imageContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  generatedImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
});

