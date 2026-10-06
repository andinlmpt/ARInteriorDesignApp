import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';
import type { FurnitureColorOption } from '@/hooks/useLayoutCustomization';
import type { FurnitureLibraryItem } from '@/types/ar-view';

interface FurnitureCustomizePanelProps {
  itemName: string;
  /** Current tint ("#RRGGBB"), empty when the model shows its own colours. */
  activeColorHex: string;
  colorOptions: FurnitureColorOption[];
  replacementOptions: FurnitureLibraryItem[];
  onSelectColor: (hex: string) => void;
  onReplace: (item: FurnitureLibraryItem) => void;
  /** Distance from the screen bottom, above the planner toolbar and size chip. */
  bottomOffset: number;
}

export function FurnitureCustomizePanel({
  itemName,
  activeColorHex,
  colorOptions,
  replacementOptions,
  onSelectColor,
  onReplace,
  bottomOffset,
}: FurnitureCustomizePanelProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showReplace, setShowReplace] = useState(false);
  const activeHex = activeColorHex.toUpperCase();

  useEffect(() => {
    setShowReplace(false);
  }, [itemName]);

  return (
    <View
      style={[
        styles.panel,
        { bottom: insets.bottom + bottomOffset, backgroundColor: colors.surfacePrimary },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {itemName}
        </Text>
        {replacementOptions.length > 0 && (
          <TouchableOpacity
            style={[styles.replaceToggle, { borderColor: colors.outline }]}
            onPress={() => setShowReplace((open) => !open)}
            accessibilityLabel={showReplace ? 'Hide replacements' : 'Replace this piece'}
          >
            <Ionicons
              name={showReplace ? 'close-outline' : 'swap-horizontal-outline'}
              size={16}
              color={colors.accent}
            />
            <Text style={[styles.replaceToggleText, { color: colors.textPrimary }]}>
              {showReplace ? 'Close' : 'Replace'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showReplace ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {replacementOptions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.replaceCard, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => {
                setShowReplace(false);
                onReplace(item);
              }}
              accessibilityLabel={`Replace with ${item.name}`}
            >
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.replaceThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.replaceThumb, styles.thumbFallback]}>
                  <Ionicons name="cube-outline" size={22} color={colors.textMuted} />
                </View>
              )}
              <Text style={[styles.replaceName, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.name}
              </Text>
              {item.price ? (
                <Text style={[styles.replacePrice, { color: colors.textMuted }]}>{item.price}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : colorOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <TouchableOpacity
            style={[
              styles.swatch,
              styles.originalSwatch,
              {
                borderColor: activeHex ? colors.outline : colors.accent,
                backgroundColor: colors.surfaceSecondary,
              },
            ]}
            onPress={() => onSelectColor('')}
            accessibilityLabel="Original colours"
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
          {colorOptions.map((option) => {
            const active = option.hex === activeHex;
            return (
              <TouchableOpacity
                key={option.hex}
                style={[
                  styles.swatch,
                  { backgroundColor: option.hex, borderColor: active ? colors.accent : colors.outline },
                  active && styles.swatchActive,
                ]}
                onPress={() => onSelectColor(option.hex)}
                accessibilityLabel={`Colour ${option.label}`}
              />
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          No colour options for this piece. Drag to move it or tap Replace.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  replaceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  replaceToggleText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    marginRight: spacing.sm,
  },
  swatchActive: {
    borderWidth: 3,
  },
  originalSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceCard: {
    width: 96,
    borderRadius: radii.md,
    padding: 6,
    marginRight: spacing.sm,
  },
  replaceThumb: {
    width: '100%',
    height: 56,
    borderRadius: radii.sm,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceName: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  replacePrice: {
    fontSize: 10,
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
  },
});
