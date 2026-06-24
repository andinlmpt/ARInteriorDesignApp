/**
 * BudgetSelector Component
 * Budget selection cards
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { BudgetValue } from '@/config/themeRecommend.config';
import { BUDGET_OPTIONS } from '@/config/themeRecommend.config';

interface BudgetSelectorProps {
  selectedBudget: BudgetValue | null;
  onSelect: (budget: BudgetValue) => void;
  disabled?: boolean;
}

export function BudgetSelector({
  selectedBudget,
  onSelect,
  disabled = false,
}: BudgetSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Budget</Text>
      <Text style={styles.subtitle}>This helps us recommend items in your price range</Text>
      
      <View style={styles.optionsGrid}>
        {BUDGET_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.budgetCard,
              selectedBudget === option.value && styles.budgetCardSelected,
              disabled && styles.budgetCardDisabled,
            ]}
            onPress={() => onSelect(option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${option.label}: ${option.range}. ${option.description}`}
            accessibilityState={{ selected: selectedBudget === option.value }}
          >
            <Text style={styles.budgetEmoji}>{option.emoji}</Text>
            <Text style={styles.budgetLabel}>{option.label}</Text>
            <Text style={styles.budgetRange}>{option.range}</Text>
            <Text style={styles.budgetDescription}>{option.description}</Text>
            {selectedBudget === option.value && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    elevation: 2,
    position: 'relative',
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }
    ),
  },
  budgetCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  budgetCardDisabled: {
    opacity: 0.5,
  },
  budgetEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  budgetRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  budgetDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  selectedBadge: {
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
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

