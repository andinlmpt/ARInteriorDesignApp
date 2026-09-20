/**
 * Center tab — choose AR Furniture or AR Measurement (plus entry point).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';

type ArMode = 'furniture' | 'measure';

export default function CameraScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  const openAr = (mode: ArMode) => {
    router.push({ pathname: '/ar-view', params: { mode } });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Start new project</Text>
        </View>

        <View style={styles.list}>
          <Pressable
            onPress={() => openAr('furniture')}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="AR Furniture"
          >
            <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="cube-outline" size={28} color={colors.accent} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>AR Furniture</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Place furniture in your room with AR
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => openAr('measure')}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="AR Measurement"
          >
            <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="resize-outline" size={28} color={colors.accent} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>AR Measurement</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Measure rooms with your phone camera
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <TouchableOpacity
          style={styles.savedLink}
          onPress={() => router.push('/room-measurements')}
          accessibilityRole="button"
        >
          <Text style={[styles.savedLinkText, { color: colors.accent }]}>View saved measurements</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  savedLink: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  savedLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
