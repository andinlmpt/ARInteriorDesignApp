/**
 * AlternativeThemeCard Component
 * Memoized card for alternative theme display
 */

import React, { memo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import type { DesignTheme } from '@/types/theme-recommendation';
import { CONFIG } from '@/config/themeRecommend.config';
import { getConfidencePercentage, getArrayValue } from '@/utils/themeRecommendHelpers';

interface AlternativeThemeCardProps {
  theme: DesignTheme;
  comparisonMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onToggleComparison: () => void;
}

export const AlternativeThemeCard = memo<AlternativeThemeCardProps>(({
  theme,
  comparisonMode,
  isSelected,
  onPress,
  onToggleComparison,
}) => {
  const altConfidence = getConfidencePercentage(theme?.confidence);
  const palette = getArrayValue<string>(theme?.colorPalette).slice(0, CONFIG.MAX_COLOR_SWATCHES);

  return (
    <TouchableOpacity
      style={[
        styles.alternativeCard,
        comparisonMode && isSelected && styles.alternativeCardSelected,
      ]}
      onPress={comparisonMode ? onToggleComparison : onPress}
      accessibilityRole="button"
      accessibilityLabel={`Alternative theme: ${theme.name}, ${altConfidence}% match`}
      accessibilityState={{ selected: isSelected }}
    >
      {comparisonMode && (
        <View style={styles.comparisonCheckbox}>
          <Text style={styles.comparisonCheckboxText}>
            {isSelected ? '✓' : ''}
          </Text>
        </View>
      )}
      <View style={styles.alternativeHeader}>
        <Text style={styles.alternativeName}>{theme?.name ?? 'Unknown Theme'}</Text>
        <Text style={styles.alternativeConfidence}>{altConfidence}%</Text>
      </View>
      <Text style={styles.alternativeDescription}>
        {theme?.description ?? 'No description available.'}
      </Text>
      <View
        style={styles.alternativeColors}
        accessibilityLabel={`Color palette: ${palette.length} colors`}
      >
        {palette.map((color, idx) => (
          <View
            key={`${color}-${idx}`}
            style={[styles.alternativeColorDot, { backgroundColor: color }]}
            accessibilityLabel={`Color ${idx + 1}: ${color}`}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
});

AlternativeThemeCard.displayName = 'AlternativeThemeCard';

const styles = StyleSheet.create({
  alternativeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 240,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    elevation: 2,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }
    ),
  },
  alternativeCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
    backgroundColor: '#F0F8FF',
  },
  alternativeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  alternativeConfidence: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  alternativeDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  alternativeColors: {
    flexDirection: 'row',
    gap: 6,
  },
  alternativeColorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  comparisonCheckbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonCheckboxText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
