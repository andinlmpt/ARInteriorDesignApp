import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import type { DesignTheme } from '@/types/theme-recommendation';

interface ColorPaletteSectionProps {
  colorPalette: string[];
  topTheme: DesignTheme | null;
  favoriteColors: Set<string>;
  copiedColorFeedback: string | null;
  showColorPaletteActions: boolean;
  onToggleActions: () => void;
  onColorPress: (color: string) => void;
  onColorLongPress: (color: string, name: string) => void;
  onSharePalette: (colors: string[]) => void;
  onExportPalette: (colors: string[]) => void;
  onGenerateImageWithColor: (theme: DesignTheme, color: string) => void;
  onShowColorHarmony: (colors: string[]) => void;
  getColorName: (color: string) => string;
  maxColorSwatches: number;
  styles: any;
}

export const ColorPaletteSection: React.FC<ColorPaletteSectionProps> = ({
  colorPalette,
  topTheme,
  favoriteColors,
  copiedColorFeedback,
  showColorPaletteActions,
  onToggleActions,
  onColorPress,
  onColorLongPress,
  onSharePalette,
  onExportPalette,
  onGenerateImageWithColor,
  onShowColorHarmony,
  getColorName,
  maxColorSwatches,
  styles: parentStyles,
}) => {
  return (
    <View style={parentStyles.colorSection}>
      <View style={parentStyles.colorSectionHeader}>
        <Text style={parentStyles.sectionLabel}>🎨 Color Palette</Text>
        <TouchableOpacity
          style={parentStyles.colorPaletteActionsButton}
          onPress={onToggleActions}
          accessibilityRole="button"
          accessibilityLabel="Color palette actions menu"
        >
          <Text style={parentStyles.colorPaletteActionsButtonText}>⋯</Text>
        </TouchableOpacity>
      </View>
      
      {/* Color Palette Actions Menu */}
      {showColorPaletteActions && (
        <View style={parentStyles.colorPaletteActionsMenu}>
          <TouchableOpacity
            style={parentStyles.colorPaletteActionItem}
            onPress={() => {
              onSharePalette(colorPalette);
            }}
            accessibilityRole="button"
            accessibilityLabel="Share color palette"
          >
            <Text style={parentStyles.colorPaletteActionIcon}>📤</Text>
            <Text style={parentStyles.colorPaletteActionText}>Share Palette</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={parentStyles.colorPaletteActionItem}
            onPress={() => {
              onExportPalette(colorPalette);
            }}
            accessibilityRole="button"
            accessibilityLabel="Export color palette as JSON"
          >
            <Text style={parentStyles.colorPaletteActionIcon}>💾</Text>
            <Text style={parentStyles.colorPaletteActionText}>Export as JSON</Text>
          </TouchableOpacity>
          {topTheme && colorPalette.length > 0 && (
            <TouchableOpacity
              style={parentStyles.colorPaletteActionItem}
              onPress={() => {
                onGenerateImageWithColor(topTheme, colorPalette[0]);
              }}
              accessibilityRole="button"
              accessibilityLabel="Generate image with color focus"
            >
              <Text style={parentStyles.colorPaletteActionIcon}>🖼️</Text>
              <Text style={parentStyles.colorPaletteActionText}>Generate Color-Focused Image</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={parentStyles.colorPaletteActionItem}
            onPress={() => {
              onShowColorHarmony(colorPalette);
            }}
            accessibilityRole="button"
            accessibilityLabel="View color harmony analysis"
          >
            <Text style={parentStyles.colorPaletteActionIcon}>🌈</Text>
            <Text style={parentStyles.colorPaletteActionText}>Color Harmony Analysis</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View 
        style={parentStyles.colorPalette}
        accessibilityLabel={`Color palette with ${colorPalette.length} colors`}
      >
        {colorPalette.slice(0, maxColorSwatches).map((color, idx) => {
          const colorName = getColorName(color);
          const isCopied = copiedColorFeedback === color;
          const isFavorite = favoriteColors.has(color);
          return (
            <Pressable
              key={`${color}-${idx}`}
              onPress={() => onColorPress(color)}
              onLongPress={() => onColorLongPress(color, colorName)}
              style={[
                parentStyles.colorSwatchContainer, 
                isCopied && parentStyles.colorSwatchCopied, 
                isFavorite && parentStyles.colorSwatchFavorite
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Color ${idx + 1}: ${colorName}, hex ${color}`}
              accessibilityHint="Tap to copy, long press for details"
              accessibilityState={{ selected: isFavorite }}
            >
              <View style={parentStyles.colorSwatchWrapper}>
                <View 
                  style={[parentStyles.colorSwatch, { backgroundColor: color }]}
                  accessibilityLabel={`Color swatch: ${colorName}`}
                  accessibilityRole="image"
                />
                {isFavorite && (
                  <View style={parentStyles.favoriteBadge}>
                    <Text style={parentStyles.favoriteBadgeText}>⭐</Text>
                  </View>
                )}
              </View>
              <Text style={parentStyles.colorName}>{colorName}</Text>
              {isCopied && (
                <Text 
                  style={parentStyles.copiedIndicator}
                  accessibilityLabel="Copied to clipboard"
                >
                  ✓
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};


