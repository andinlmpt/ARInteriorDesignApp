/**
 * OptionCard Component
 * Memoized card for room/mood/style selection
 */

import React, { memo } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

interface OptionCardProps {
  value: string;
  emoji: string;
  label: string;
  isSelected: boolean;
  hasFeedback: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

export const OptionCard = memo<OptionCardProps>(({
  value,
  emoji,
  label,
  isSelected,
  hasFeedback,
  onPress,
  accessibilityLabel,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        isSelected && styles.optionCardSelected,
        hasFeedback && styles.optionCardFeedback,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <Text style={styles.optionText}>{label}</Text>
      {isSelected && <Text style={styles.optionCheckmark}>✓</Text>}
    </TouchableOpacity>
  );
});

OptionCard.displayName = 'OptionCard';

const styles = StyleSheet.create({
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    elevation: 2,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }
    ),
  },
  optionCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionCardFeedback: {
    transform: [{ scale: 1.02 }],
    borderColor: '#34C759',
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  optionCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '700',
  },
});

