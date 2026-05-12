/**
 * Style Selector Component
 * Allows users to select interior design styles
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import { AppText } from '@/components/ui/Text';

export interface Style {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
}

interface StyleSelectorProps {
  selectedStyleId: string | null;
  onStyleSelect: (style: Style) => void;
  styles?: Style[];
  showSearch?: boolean;
}

// Default styles if not provided
const DEFAULT_STYLES: Style[] = [
  { id: 'modern', name: 'Modern', description: 'Clean lines, minimal decoration', keywords: ['modern', 'contemporary', 'minimalist'] },
  { id: 'contemporary', name: 'Contemporary', description: 'Current trends with eclectic mix', keywords: ['contemporary', 'trendy'] },
  { id: 'minimalist', name: 'Minimalist', description: 'Simplicity and functionality', keywords: ['minimalist', 'simple', 'clean'] },
  { id: 'scandinavian', name: 'Scandinavian', description: 'Light colors, natural materials', keywords: ['scandinavian', 'hygge', 'cozy'] },
  { id: 'industrial', name: 'Industrial', description: 'Raw materials, exposed elements', keywords: ['industrial', 'raw', 'urban'] },
  { id: 'bohemian', name: 'Bohemian', description: 'Eclectic, colorful, artistic', keywords: ['bohemian', 'boho', 'eclectic'] },
  { id: 'traditional', name: 'Traditional', description: 'Classic elegance and comfort', keywords: ['traditional', 'classic'] },
  { id: 'rustic', name: 'Rustic', description: 'Natural, weathered, cozy', keywords: ['rustic', 'country', 'farmhouse'] },
  { id: 'mid-century', name: 'Mid-Century', description: '1950s-60s design with clean lines', keywords: ['mid-century', 'retro'] },
  { id: 'eclectic', name: 'Eclectic', description: 'Mix of styles and periods', keywords: ['eclectic', 'mixed', 'diverse'] },
];

export function StyleSelector({
  selectedStyleId,
  onStyleSelect,
  styles = DEFAULT_STYLES,
  showSearch = false,
}: StyleSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStyles = useMemo(() => {
    if (!searchQuery.trim()) {
      return styles;
    }

    const query = searchQuery.toLowerCase();
    return styles.filter(
      (style) =>
        style.name.toLowerCase().includes(query) ||
        style.description?.toLowerCase().includes(query) ||
        style.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
    );
  }, [styles, searchQuery]);

  return (
    <View style={styles.container}>
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search styles..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredStyles.map((style) => {
          const isSelected = selectedStyleId === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={[
                styles.styleCard,
                isSelected && styles.styleCardSelected,
              ]}
              onPress={() => onStyleSelect(style)}
              activeOpacity={0.7}
            >
              <View style={[styles.styleIndicator, isSelected && styles.styleIndicatorSelected]}>
                {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
              <AppText
                variant="subtitle"
                weight={isSelected ? '700' : '500'}
                style={[
                  styles.styleName,
                  isSelected && styles.styleNameSelected,
                ]}
              >
                {style.name}
              </AppText>
              {style.description && (
                <AppText
                  variant="caption"
                  color="textMuted"
                  style={styles.styleDescription}
                  numberOfLines={2}
                >
                  {style.description}
                </AppText>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  scrollContent: {
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  styleCard: {
    width: 140,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  styleCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfacePrimary,
    ...shadows.md,
  },
  styleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  styleIndicatorSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  styleName: {
    marginBottom: spacing.xs,
  },
  styleNameSelected: {
    color: colors.accent,
  },
  styleDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});
