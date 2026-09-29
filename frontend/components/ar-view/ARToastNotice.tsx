/**
 * Short top-of-screen notice for AR flows (e.g. "Room measurement saved").
 * Non-blocking: rendered inline (no <Modal>) so Unity keeps focus under UaaL.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';

interface ARToastNoticeProps {
  message: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ARToastNotice({ message, icon = 'checkmark-circle' }: ARToastNoticeProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: message ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: message ? 0 : -12,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [message, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          top: Math.max(insets.top, 12) + 64,
          backgroundColor: colors.surfacePrimary,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Ionicons name={icon} size={18} color={colors.success} />
      <Text style={[styles.text, { color: colors.textPrimary }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    zIndex: 1100,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
