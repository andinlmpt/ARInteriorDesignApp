import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { BudgetOption } from './types';

interface BudgetSelectionViewProps {
  selectedBudget: 'low' | 'medium' | 'high' | 'luxury' | null;
  onSelect: (budget: 'low' | 'medium' | 'high' | 'luxury') => void;
  onBack: () => void;
  budgetOptions: BudgetOption[];
  styles: any; // Pass styles from parent
}

export const BudgetSelectionView: React.FC<BudgetSelectionViewProps> = ({
  selectedBudget,
  onSelect,
  onBack,
  budgetOptions,
  styles: parentStyles,
}) => {
  return (
    <View style={parentStyles.container} accessibilityLabel="Budget selection screen">
      <StatusBar style="dark" />
      <View style={parentStyles.header}>
        <TouchableOpacity 
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to style selection"
        >
          <Text style={parentStyles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={parentStyles.title} accessibilityRole="header">Theme Finder</Text>
        <View style={parentStyles.placeholder} />
      </View>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={parentStyles.scrollContent}
      >
        <View style={parentStyles.stepContainer}>
          <Text style={parentStyles.stepTitle}>💰 {"What's Your Budget?"}</Text>
          <Text style={parentStyles.stepDescription}>
            Select your budget range to get recommendations that fit your budget
          </Text>

          <View style={parentStyles.optionsGrid}>
            {budgetOptions.map((budget) => (
              <TouchableOpacity
                key={budget.value}
                style={[
                  parentStyles.optionCard,
                  selectedBudget === budget.value && parentStyles.optionCardSelected,
                ]}
                onPress={() => onSelect(budget.value)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${budget.label} budget: ${budget.range}`}
                accessibilityState={{ selected: selectedBudget === budget.value }}
              >
                <Text style={parentStyles.optionEmoji}>{budget.emoji}</Text>
                <Text style={parentStyles.optionText}>{budget.label}</Text>
                {selectedBudget === budget.value && (
                  <Text style={parentStyles.optionCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Budget Info Cards */}
          <View style={parentStyles.budgetInfoContainer}>
            {budgetOptions.map((budget) => (
              selectedBudget === budget.value && (
                <View key={budget.value} style={parentStyles.budgetInfoCard}>
                  <Text style={parentStyles.budgetInfoTitle}>{budget.emoji} {budget.label}</Text>
                  <Text style={parentStyles.budgetInfoRange}>{budget.range}</Text>
                  <Text style={parentStyles.budgetInfoDescription}>{budget.description}</Text>
                </View>
              )
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};


