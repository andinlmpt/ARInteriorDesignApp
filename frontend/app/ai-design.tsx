import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { callApi } from '@/services/apiClient';
import { DesignImageGenerationService } from '@/services/DesignImageGenerationService';
import FloorPlan2D, { FurnitureItem } from '@/components/FloorPlan2D';
import { useTheme } from '@/contexts/ThemeContext';
import { LAYOUT_VARIATION_COUNT } from '@/config/aiDesign.config';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedLayout {
  id: string;
  furniture: FurnitureItem[];
  safety_warnings: string[];
  score: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const OBSTACLE_OPTIONS = [
  { label: '🚪 Door', value: 'door' },
  { label: '🪟 Window', value: 'window' },
  { label: '🏛️ Pillar', value: 'pillar' },
  { label: '🪜 Column', value: 'column' },
  { label: '🚿 Bathroom Fixtures', value: 'bathroom fixtures' },
  { label: '🍳 Kitchen Counter', value: 'kitchen counter' },
  { label: '🗄️ Built-in Wardrobe', value: 'built-in wardrobe' },
  { label: '🔥 Fireplace', value: 'fireplace' },
];

const ROOM_TYPES = ['Bedroom', 'Living Room', 'Dining Area', 'Office'];
const STYLE_OPTIONS = ['Minimalist', 'Modern', 'Traditional', 'Scandinavian', 'Industrial'];

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AIDesignModule() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  // Step: 1=Room Input, 2=Preferences, 3=Loading, 4=Results
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Step 1: Room Dimensions ──
  const [widthInput, setWidthInput] = useState('');
  const [depthInput, setDepthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [selectedObstacles, setSelectedObstacles] = useState<string[]>([]);

  // ── Step 2: Preferences ──
  const [roomType, setRoomType] = useState('');
  const [style, setStyle] = useState('');

  // ── Step 4: Results ──
  const [layouts, setLayouts] = useState<GeneratedLayout[]>([]);
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<string, boolean>>({});

  // ── Shimmer animation ──
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    if (step === 3) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withTiming(0.3, { duration: 900 })
        ),
        -1,
        true
      );
    }
  }, [step]);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // ── Computed values ──
  const roomWidth = parseFloat(widthInput) || 0;
  const roomDepth = parseFloat(depthInput) || 0;
  const roomHeight = parseFloat(heightInput) || 0;
  const availableFloorSpace = parseFloat((roomWidth * roomDepth * 0.75).toFixed(1));
  const isStep1Valid = roomWidth > 0 && roomDepth > 0 && roomHeight > 0;
  const isStep2Valid = roomType !== '' && style !== '';

  // ── Toggle obstacle ──
  const toggleObstacle = useCallback((value: string) => {
    setSelectedObstacles(prev =>
      prev.includes(value) ? prev.filter(o => o !== value) : [...prev, value]
    );
  }, []);

  // ── Generate Layouts ──
  const handleGenerate = async () => {
    setStep(3);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await callApi<GeneratedLayout[]>('/design/generate', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: {
          roomDimensions: { width: roomWidth, height: roomHeight, depth: roomDepth },
          detectedObstacles: selectedObstacles,
          availableFloorSpace,
          roomType,
          style,
        },
      });

      if (response && response.length > 0) {
        setLayouts(response);
        setActiveLayoutIndex(0);
        setStep(4);
      } else {
        throw new Error('No layouts returned');
      }
    } catch (error) {
      console.error('Failed to generate design:', error);
      Alert.alert('Generation Failed', 'Could not connect to the AI. Make sure your backend is running and the API keys are set.');
      setStep(2);
    }
  };

  // ── Generate Image for Layout ──
  const handleGenerateImage = async (layout: GeneratedLayout) => {
    setIsGeneratingImage(prev => ({ ...prev, [layout.id]: true }));
    try {
      const imageService = new DesignImageGenerationService();
      
      const proposal = {
        id: layout.id,
        title: `${style} ${roomType}`,
        description: `A ${style} design for a ${roomWidth}x${roomDepth}m ${roomType}.`,
        layout: layout
      };

      const preferences = {
        roomType,
        style,
        colors: [],
        budget: 'medium',
        quality: 'standard' as const,
        imageStyle: 'photorealistic' as const,
      };

      const result = await imageService.generateDesignImage(proposal, preferences);

      if (result && result.imageUrl) {
        setGeneratedImages(prev => ({ ...prev, [layout.id]: result.imageUrl! }));
      } else {
        throw new Error('Image generation failed or returned no URL');
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      Alert.alert('Image Generation Failed', 'Could not generate the 3D render at this time.');
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [layout.id]: false }));
    }
  };

  // ── Generate preview images for all layouts when results load ──
  useEffect(() => {
    if (step !== 4 || layouts.length === 0) return;

    layouts.forEach((layout) => {
      if (!generatedImages[layout.id] && !isGeneratingImage[layout.id]) {
        handleGenerateImage(layout);
      }
    });
  }, [step, layouts]);

  // ─── Render: Step 1 — Room Measurement Input ──────────────────────────────────

  const renderStep1 = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Hero */}
      <View style={styles.heroContainer}>
        <Text style={styles.heroEmoji}>📐</Text>
        <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Room Measurements</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Measure your room with a tape measure and enter the values below.
        </Text>
      </View>

      {/* Dimensions Card */}
      <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Room Dimensions</Text>

        <View style={styles.dimensionRow}>
          <View style={styles.dimensionField}>
            <Text style={[styles.dimensionLabel, { color: colors.textSecondary }]}>Width (m)</Text>
            <TextInput
              style={[styles.dimensionInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={widthInput}
              onChangeText={setWidthInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 4.5"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Text style={[styles.dimensionSeparator, { color: colors.textSecondary }]}>×</Text>
          <View style={styles.dimensionField}>
            <Text style={[styles.dimensionLabel, { color: colors.textSecondary }]}>Depth (m)</Text>
            <TextInput
              style={[styles.dimensionInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={depthInput}
              onChangeText={setDepthInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 3.8"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <Text style={[styles.dimensionSeparator, { color: colors.textSecondary }]}>×</Text>
          <View style={styles.dimensionField}>
            <Text style={[styles.dimensionLabel, { color: colors.textSecondary }]}>Height (m)</Text>
            <TextInput
              style={[styles.dimensionInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={heightInput}
              onChangeText={setHeightInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 2.7"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Auto-calculated floor space */}
        {isStep1Valid && (
          <View style={[styles.computedRow, { backgroundColor: colors.background }]}>
            <Text style={[styles.computedLabel, { color: colors.textSecondary }]}>Usable floor space</Text>
            <Text style={[styles.computedValue, { color: colors.accent }]}>{availableFloorSpace} m²</Text>
          </View>
        )}
      </View>

      {/* Obstacles Card */}
      <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Obstacles & Fixed Features</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
          Select everything that is permanently in or on your room walls.
        </Text>
        <View style={styles.obstacleGrid}>
          {OBSTACLE_OPTIONS.map(opt => {
            const selected = selectedObstacles.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.obstacleChip,
                  { borderColor: selected ? colors.accent : colors.border },
                  selected && { backgroundColor: colors.accent },
                ]}
                onPress={() => toggleObstacle(opt.value)}
              >
                <Text style={[styles.obstacleChipText, { color: selected ? '#fff' : colors.textPrimary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !isStep1Valid && styles.primaryButtonDisabled]}
        disabled={!isStep1Valid}
        onPress={() => setStep(2)}
      >
        <Text style={styles.primaryButtonText}>Next: Set Preferences →</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );

  // ─── Render: Step 2 — Preferences ─────────────────────────────────────────────

  const renderStep2 = () => (
    <>
      {/* Room Summary Banner */}
      <View style={[styles.summaryBanner, { backgroundColor: colors.accent }]}>
        <Text style={styles.summaryBannerText}>
          📐 {roomWidth}m × {roomDepth}m × {roomHeight}m  ·  {availableFloorSpace} m²  ·  {selectedObstacles.length} obstacle{selectedObstacles.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={() => setStep(1)}>
          <Text style={styles.summaryBannerEdit}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Design Preferences</Text>

        <Text style={[styles.label, { color: colors.textPrimary }]}>Room Type</Text>
        <View style={styles.chipRow}>
          {ROOM_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.chip,
                { borderColor: roomType === type ? colors.accent : colors.border },
                roomType === type && { backgroundColor: colors.accent },
              ]}
              onPress={() => setRoomType(type)}
            >
              <Text style={[styles.chipText, { color: roomType === type ? '#fff' : colors.textPrimary }]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textPrimary }]}>Style Preference</Text>
        <View style={styles.chipRow}>
          {STYLE_OPTIONS.map(sty => (
            <TouchableOpacity
              key={sty}
              style={[
                styles.chip,
                { borderColor: style === sty ? colors.accent : colors.border },
                style === sty && { backgroundColor: colors.accent },
              ]}
              onPress={() => setStyle(sty)}
            >
              <Text style={[styles.chipText, { color: style === sty ? '#fff' : colors.textPrimary }]}>
                {sty}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !isStep2Valid && styles.primaryButtonDisabled, { marginTop: 24 }]}
          disabled={!isStep2Valid}
          onPress={handleGenerate}
        >
          <Text style={styles.primaryButtonText}>✨ Generate Layout</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ─── Render: Step 3 — Loading Shimmer ─────────────────────────────────────────

  const renderStep3 = () => (
    <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
      <View style={styles.shimmerOrb}>
        <Text style={{ fontSize: 48 }}>🏠</Text>
      </View>
      <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 24 }} />
      <Text style={[styles.shimmerTitle, { color: colors.textPrimary }]}>Designing your space…</Text>
      <Text style={[styles.shimmerSubtitle, { color: colors.textSecondary }]}>
        AI is generating {LAYOUT_VARIATION_COUNT} optimized furniture layouts for your {roomWidth}m × {roomDepth}m room
      </Text>
    </Animated.View>
  );

  // ─── Render: Step 4 — Results ──────────────────────────────────────────────────

  const renderStep4 = () => {
    if (layouts.length === 0) return null;
    const activeLayout = layouts[activeLayoutIndex];

    return (
      <View>
        {/* Summary Banner */}
        <View style={[styles.summaryBanner, { backgroundColor: colors.accent }]}>
          <Text style={styles.summaryBannerText}>
            {roomType}  ·  {style}  ·  {roomWidth}m × {roomDepth}m
          </Text>
          <TouchableOpacity onPress={() => { setStep(2); }}>
            <Text style={styles.summaryBannerEdit}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Layout Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {layouts.map((layout, idx) => (
            <TouchableOpacity
              key={layout.id}
              style={[styles.tab, activeLayoutIndex === idx && styles.tabActive]}
              onPress={() => setActiveLayoutIndex(idx)}
            >
              <Text style={[styles.tabText, activeLayoutIndex === idx && styles.tabTextActive]}>
                Layout {idx + 1}
              </Text>
              <View style={[styles.scoreBadge, { backgroundColor: layout.score >= 80 ? '#10b981' : layout.score >= 60 ? '#f59e0b' : '#ef4444' }]}>
                <Text style={styles.scoreBadgeText}>{layout.score}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 2D Floor Plan */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top-Down Blueprint</Text>
        <FloorPlan2D
          roomDimensions={{ width: roomWidth, height: roomHeight, depth: roomDepth }}
          furniture={activeLayout.furniture}
          obstacles={selectedObstacles}
        />

        {/* Preview thumbnails for all layouts */}
        {layouts.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {layouts.map((layout, idx) => (
              <TouchableOpacity
                key={`preview-${layout.id}`}
                style={[
                  styles.previewThumb,
                  { borderColor: activeLayoutIndex === idx ? colors.accent : colors.border },
                ]}
                onPress={() => setActiveLayoutIndex(idx)}
              >
                {generatedImages[layout.id] ? (
                  <Image source={{ uri: generatedImages[layout.id] }} style={styles.previewThumbImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.previewThumbPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                    {isGeneratingImage[layout.id] ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Layout {idx + 1}</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 3D Photorealistic Render */}
        <View style={styles.renderContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: 0 }]}>3D Photorealistic Render</Text>
          
          {generatedImages[activeLayout.id] ? (
            <Image 
              source={{ uri: generatedImages[activeLayout.id] }} 
              style={styles.generatedImage} 
              resizeMode="cover" 
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              {isGeneratingImage[activeLayout.id] ? (
                <>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={[styles.placeholderText, { color: colors.textSecondary, marginTop: 12 }]}>
                    Generating 3D Render with Hugging Face...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.placeholderText, { color: colors.textSecondary, marginBottom: 16 }]}>
                    Want to see what this layout looks like in real life?
                  </Text>
                  <TouchableOpacity 
                    style={styles.secondaryButton}
                    onPress={() => handleGenerateImage(activeLayout)}
                  >
                    <Text style={styles.secondaryButtonText}>🎨 Generate 3D Render</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Safety Warnings */}
        {activeLayout.safety_warnings && activeLayout.safety_warnings.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Safety Warnings</Text>
            {activeLayout.safety_warnings.map((w, i) => (
              <Text key={i} style={styles.warningText}>• {w}</Text>
            ))}
          </View>
        )}

        {/* Regenerate */}
        <TouchableOpacity style={[styles.primaryButton, { margin: 16 }]} onPress={() => setStep(2)}>
          <Text style={styles.primaryButtonText}>🔄 Regenerate</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surfacePrimary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backButton, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Design</Text>
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map(s => (
            <View
              key={s}
              style={[
                styles.stepDot,
                { backgroundColor: step >= s ? colors.accent : colors.border },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </View>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: { fontSize: 16, fontWeight: '500', minWidth: 60 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  stepIndicator: { flexDirection: 'row', gap: 6, minWidth: 60, justifyContent: 'flex-end' },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  content: { paddingBottom: 48 },

  // Hero
  heroContainer: { alignItems: 'center', paddingTop: 32, paddingBottom: 8, paddingHorizontal: 24 },
  heroEmoji: { fontSize: 56, marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Card
  card: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, marginBottom: 14, lineHeight: 18 },

  // Dimensions
  dimensionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  dimensionField: { flex: 1 },
  dimensionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  dimensionInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  dimensionSeparator: { fontSize: 18, fontWeight: '300', marginBottom: 10 },
  computedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  computedLabel: { fontSize: 14 },
  computedValue: { fontSize: 18, fontWeight: '700' },

  // Obstacles
  obstacleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  obstacleChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  obstacleChipText: { fontSize: 13, fontWeight: '600' },

  // Summary Banner
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  summaryBannerText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  summaryBannerEdit: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginLeft: 12 },

  // Chips
  label: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipText: { fontSize: 14, fontWeight: '600' },

  // Primary Button
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // New Image Generation Styles
  renderContainer: { marginHorizontal: 16, marginTop: 24, marginBottom: 8 },
  generatedImage: { width: '100%', height: 250, borderRadius: 12, marginTop: 8 },
  imagePlaceholder: { width: '100%', height: 200, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginTop: 8, padding: 16 },
  placeholderText: { textAlign: 'center', fontSize: 14 },
  secondaryButton: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  secondaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Shimmer
  shimmerContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  shimmerOrb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerTitle: { fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  shimmerSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Results Tabs
  tabsScroll: { marginTop: 16, marginBottom: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    marginRight: 10,
  },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontWeight: '700', color: '#475569' },
  tabTextActive: { color: '#fff' },
  scoreBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  scoreBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  previewScroll: { marginTop: 8, marginBottom: 4 },
  previewThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  previewThumbImage: { width: '100%', height: '100%' },
  previewThumbPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: { fontSize: 17, fontWeight: '700', marginLeft: 16, marginTop: 8, marginBottom: 4 },

  // Warning Card
  warningCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#f87171',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
  },
  warningTitle: { color: '#dc2626', fontWeight: '700', fontSize: 15, marginBottom: 8 },
  warningText: { color: '#b91c1c', fontSize: 14, marginBottom: 4, lineHeight: 20 },

  // Furniture Legend
  furnitureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  furnitureColorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  furnitureName: { flex: 1, fontSize: 14, fontWeight: '500' },
  furnitureDims: { fontSize: 13 },
});
