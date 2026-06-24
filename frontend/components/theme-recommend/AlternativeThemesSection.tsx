import React from 'react';
import { View, Text, FlatList } from 'react-native';
import type { DesignTheme } from '@/types/theme-recommendation';
import { AlternativeThemeCard } from './AlternativeThemeCard';

interface AlternativeThemesSectionProps {
  alternativeThemes: DesignTheme[];
  comparisonMode: boolean;
  selectedThemesForComparison: string[];
  onThemePress: (theme: DesignTheme) => void;
  onToggleComparison: (themeId: string) => void;
  onApplyTheme: (theme: DesignTheme) => void;
  styles: any;
  itemHeight?: number;
}

export const AlternativeThemesSection: React.FC<AlternativeThemesSectionProps> = ({
  alternativeThemes,
  comparisonMode,
  selectedThemesForComparison,
  onThemePress,
  onToggleComparison,
  onApplyTheme,
  styles: parentStyles,
  itemHeight = 150,
}) => {
  if (alternativeThemes.length === 0) {
    return null;
  }

  return (
    <View style={parentStyles.alternativesSection}>
      <Text style={parentStyles.alternativesTitle}>🎯 Other Great Options</Text>
      {alternativeThemes.length > 10 ? (
        <FlatList
          data={alternativeThemes}
          keyExtractor={(item) => item.id}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={5}
          windowSize={5}
          getItemLayout={(data, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          renderItem={({ item: theme }) => {
            const isSelected = selectedThemesForComparison.includes(theme.id);
            return (
              <AlternativeThemeCard
                theme={theme}
                comparisonMode={comparisonMode}
                isSelected={isSelected}
                onPress={() => onThemePress(theme)}
                onToggleComparison={() => onToggleComparison(theme.id)}
              />
            );
          }}
          scrollEnabled={false}
        />
      ) : (
        <FlatList
          data={alternativeThemes}
          keyExtractor={(item) => item.id}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={5}
          windowSize={5}
          getItemLayout={(data, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          renderItem={({ item: theme }) => {
            const isSelected = selectedThemesForComparison.includes(theme.id);
            return (
              <AlternativeThemeCard
                theme={theme}
                comparisonMode={comparisonMode}
                isSelected={isSelected}
                onPress={() => onApplyTheme(theme)}
                onToggleComparison={() => onToggleComparison(theme.id)}
              />
            );
          }}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};


