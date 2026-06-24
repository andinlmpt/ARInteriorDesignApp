/**
 * AR Furniture Library Component
 * Displays the furniture library panel for selecting items to place
 */

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { FurnitureCategory } from '@/types/ar-view';
import { FURNITURE_LIBRARY } from '@/data/furnitureLibrary';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import { AppText } from '@/components/ui/Text';

interface ARFurnitureLibraryProps {
  selectedCategory: FurnitureCategory | 'all';
  selectedLibraryItem: string | null;
  onSelectCategory: (category: FurnitureCategory | 'all') => void;
  onSelectItem: (itemId: string) => void;
  visible?: boolean;
}

export function ARFurnitureLibrary({
  selectedCategory,
  selectedLibraryItem,
  onSelectCategory,
  onSelectItem,
  visible = true,
}: ARFurnitureLibraryProps) {
  if (!visible) return null;

  const categories: (FurnitureCategory | 'all')[] = [
    'all',
    'seating',
    'tables',
    'storage',
    'lighting',
    'decor',
    'bedroom',
    'kitchen',
  ];

  const filteredItems = selectedCategory === 'all'
    ? FURNITURE_LIBRARY
    : FURNITURE_LIBRARY.filter(item => item.category === selectedCategory);

  return (
    <View style={styles.container}>
      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive,
            ]}
            onPress={() => onSelectCategory(category)}
          >
            <AppText style={[
              styles.categoryText,
              selectedCategory === category && styles.categoryTextActive,
            ]}>
              {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Furniture Items */}
      <ScrollView 
        style={styles.itemsScroll}
        contentContainerStyle={styles.itemsContent}
      >
        {filteredItems.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.itemCard,
              selectedLibraryItem === item.id && styles.itemCardSelected,
            ]}
            onPress={() => onSelectItem(item.id)}
          >
            <View style={[styles.itemColor, { backgroundColor: item.color }]} />
            <View style={styles.itemInfo}>
              <AppText style={styles.itemName}>{item.name}</AppText>
              <AppText style={styles.itemPrice}>{item.price}</AppText>
              <AppText style={styles.itemSize}>
                {item.dimensions.width.toFixed(1)}m × {item.dimensions.length.toFixed(1)}m
              </AppText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: 400,
    ...shadows.lg,
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  categoryButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: colors.accent,
  },
  categoryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: colors.accent,
  },
  itemsScroll: {
    flex: 1,
  },
  itemsContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  itemColor: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    marginRight: spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  itemPrice: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemSize: {
    fontSize: 10,
    color: colors.textSecondary,
  },
});


