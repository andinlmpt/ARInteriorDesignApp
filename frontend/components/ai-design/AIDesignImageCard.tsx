import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface AIDesignImageCardProps {
  imageUrl: string;
  prompt: string;
  onSave: () => void;
}

export function AIDesignImageCard({ imageUrl, prompt, onSave }: AIDesignImageCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
      <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      
      <View style={styles.metaContainer}>
        <Text style={[styles.label, { color: colors.textMuted }]}>PROMPT DESCRIPTION</Text>
        <Text style={[styles.promptText, { color: colors.textPrimary }]}>{prompt}</Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}
        onPress={onSave}
      >
        <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
        <Text style={styles.saveButtonText}>Save Design</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8,
    width: '94%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    padding: 12,
  },
  image: {
    width: '100%',
    height: 260,
    borderRadius: 12,
  },
  metaContainer: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
