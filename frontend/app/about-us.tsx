/**
 * About Us — Maharlika Furniture brand story, mission, and vision.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/Text';
import { AppLogo } from '@/components/ui/AppLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';
import { BRAND } from '@/constants/branding';

const STORY_PARAGRAPHS = [
  'Maharlika Furniture and Home Furnishing was founded out of a deep passion for furniture design and craftsmanship. Its owner, Sir Roberto O. Montances, has always been fascinated by how furniture is built, how it transforms spaces, and how it turns a house into a home. From the beginning, his vision was clear—to create pieces that are not only beautiful and durable but also accessible to the everyday Filipino.',
  'Today, Maharlika Furniture has grown beyond its humble beginnings. The company now proudly serves homes, businesses, and spaces across Luzon and Visayas.',
  'Whether offering ready-made items or custom-built designs, Maharlika remains committed to the same mission that started it all: to deliver high-quality, affordable furniture that reflects Filipino pride and craftsmanship.',
];

const MISSION =
  'To create and deliver furniture that transforms everyday spaces into places of comfort, inspiration, and beauty—through a combination of thoughtful design, exceptional craftsmanship, and dedicated customer care.';

const VISION =
  'To become a recognized leader in the furniture industry, known for both our innovative product designs and our commitment to delivering superior value through retail and manufacturing excellence.';

export default function AboutUsScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <AppText variant="h2" style={[styles.title, { color: colors.textPrimary }]}>
            About Us
          </AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <AppLogo size={96} circular elevated />
            <AppText variant="h2" style={[styles.brandName, { color: BRAND.colors.navy }]}>
              {BRAND.fullName}
            </AppText>
            <AppText variant="body" style={[styles.tagline, { color: '#1E40AF' }]}>
              {BRAND.tagline}
            </AppText>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
            <AppText variant="h3" style={[styles.storyHeadline, { color: BRAND.colors.navy }]}>
              From Passion to Purpose
            </AppText>
            {STORY_PARAGRAPHS.map((paragraph) => (
              <AppText key={paragraph.slice(0, 40)} variant="body" color="textMuted" style={styles.paragraph}>
                {paragraph}
              </AppText>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
            <View style={styles.labelRow}>
              <Ionicons name="flag-outline" size={18} color={BRAND.colors.orange} />
              <AppText variant="subtitle" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Mission
              </AppText>
            </View>
            <AppText variant="body" color="textMuted" style={styles.paragraph}>
              {MISSION}
            </AppText>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
            <View style={styles.labelRow}>
              <Ionicons name="eye-outline" size={18} color={BRAND.colors.navy} />
              <AppText variant="subtitle" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Vision
              </AppText>
            </View>
            <AppText variant="body" color="textMuted" style={styles.paragraph}>
              {VISION}
            </AppText>
          </View>

          <TouchableOpacity
            style={[styles.linkRow, { borderColor: colors.border }]}
            onPress={() => router.push('/terms-privacy')}
            activeOpacity={0.7}
          >
            <AppText variant="body" style={{ color: colors.textPrimary, flex: 1 }}>
              Terms & Privacy
            </AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkRow, { borderColor: colors.border }]}
            onPress={() => Linking.openURL('mailto:hello@maharlikafurniture.com')}
            activeOpacity={0.7}
          >
            <AppText variant="body" style={{ color: colors.textPrimary, flex: 1 }}>
              Contact us
            </AppText>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingVertical: spacing.md,
  },
  title: { fontWeight: '700' },
  headerSpacer: { width: 24 },
  content: {
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  brandBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  brandName: {
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 20,
    paddingHorizontal: spacing.md,
  },
  tagline: { fontWeight: '500', textAlign: 'center' },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  storyHeadline: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: { fontWeight: '700' },
  paragraph: { lineHeight: 24 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    marginTop: spacing.sm,
  },
});
