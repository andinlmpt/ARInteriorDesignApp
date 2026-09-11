/**
 * Centered Maharlika brand title + tagline block.
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { BRAND } from '@/constants/branding';

interface BrandHeaderProps {
  titleColor?: string;
  taglineColor?: string;
  titleStyle?: StyleProp<TextStyle>;
  taglineStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}

export function BrandHeader({
  titleColor = '#1E3A8A',
  taglineColor = '#1E40AF',
  titleStyle,
  taglineStyle,
  style,
}: BrandHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: titleColor }, titleStyle]}>{BRAND.name}</Text>
      <Text style={[styles.tagline, { color: taglineColor }, taglineStyle]}>{BRAND.tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
    alignSelf: 'center',
  },
});
