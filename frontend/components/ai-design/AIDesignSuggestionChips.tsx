import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface AIDesignSuggestionChipsProps {
  onSelect: (prompt: string) => void;
}

const SUGGESTIONS = [
  'Modern living room 5×4m with sofa and TV',
  'Small minimalist bedroom, budget-friendly',
  'Home office with a desk next to the window',
];

export function AIDesignSuggestionChips({ onSelect }: AIDesignSuggestionChipsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Try one of these to get started:
      </Text>
      <View style={styles.chipsContainer}>
        {SUGGESTIONS.map((prompt, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => onSelect(prompt)}
          >
            <Text style={[styles.chipText, { color: colors.textPrimary }]}>💡 {prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});
