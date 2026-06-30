import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import FloorPlan2D from '../FloorPlan2D';
import { ChatGeneratedLayout } from '../../types/ai-design-chat';

interface AIDesignLayoutCardProps {
  layouts: ChatGeneratedLayout[];
  dimensions: { width: number; depth: number; height: number };
  generatedImages: Record<string, string>;
  isGeneratingImage: Record<string, boolean>;
  onOpenARView: (layout: ChatGeneratedLayout) => void;
  onSaveDesign: (layout: ChatGeneratedLayout) => void;
  onGenerateImage: (layout: ChatGeneratedLayout) => void;
}

export function AIDesignLayoutCard({
  layouts,
  dimensions,
  generatedImages,
  isGeneratingImage,
  onOpenARView,
  onSaveDesign,
  onGenerateImage,
}: AIDesignLayoutCardProps) {
  const { colors } = useTheme();
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(0);

  const activeLayout = layouts[activeLayoutIndex];
  if (!activeLayout) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          💡 Layout {activeLayoutIndex + 1} of {layouts.length}
        </Text>
        <View style={[styles.scoreBadge, { backgroundColor: colors.accent }]}>
          <Text style={styles.scoreBadgeText}>Score {activeLayout.score}</Text>
        </View>
      </View>

      {/* 2D Interactive floor plan */}
      <View style={[styles.floorplanWrapper, { borderColor: colors.border }]}>
        <FloorPlan2D
          roomDimensions={{
            width: dimensions.width,
            depth: dimensions.depth,
            height: dimensions.height,
          }}
          furniture={activeLayout.furniture}
          obstacles={[]}
        />
      </View>

      {/* Preview thumbnails for all layouts */}
      {layouts.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewScroll}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
        >
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
                    <Text style={{ color: colors.textMuted, fontSize: 10 }}>Option {idx + 1}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 3D Photorealistic Render */}
      <View style={styles.renderContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3D Render Preview</Text>
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
                  Rendering with Hugging Face FLUX...
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.placeholderText, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Need a visual render of this layout?
                </Text>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.accent }]}
                  onPress={() => onGenerateImage(activeLayout)}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>🎨 Generate 3D Render</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* Safety Warnings if any */}
      {activeLayout.safety_warnings && activeLayout.safety_warnings.length > 0 && (
        <View style={[styles.warningCard, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.warningTitle, { color: '#E74C3C' }]}>
            ⚠️ Design Warnings
          </Text>
          {activeLayout.safety_warnings.map((warn, i) => (
            <Text key={i} style={[styles.warningText, { color: colors.textSecondary }]}>
              • {warn}
            </Text>
          ))}
        </View>
      )}

      {/* Main Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}
          onPress={() => onSaveDesign(activeLayout)}
        >
          <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
          <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>Save Design</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 8,
    width: '94%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  scoreBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  floorplanWrapper: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  previewScroll: {
    marginBottom: 12,
  },
  previewThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
  previewThumbImage: {
    width: '100%',
    height: '100%',
  },
  previewThumbPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  renderContainer: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  generatedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  imagePlaceholder: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  placeholderText: {
    fontSize: 12,
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  warningCard: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 11,
    lineHeight: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  saveButtonText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
