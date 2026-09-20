/**
 * Help & Contact — phone, email, and FAQs in one place.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';
import { BRAND } from '@/constants/branding';

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do I start designing?',
    answer: 'Use the + tab — AR Furniture or AR Measurement — to begin.',
  },
  {
    question: 'How do I measure a room?',
    answer:
      'Open AR Measurement from the + tab and follow the on-screen guides to scan and confirm your room size.',
  },
  {
    question: 'Can I save my projects?',
    answer:
      'Yes. Export a layout from AR Furniture and it will appear under Profile → Projects. Photos you save also show up in the Saved tab.',
  },
  {
    question: 'How do I save an AR photo?',
    answer:
      'After placing furniture, tap the camera button on the bottom toolbar. The photo is saved to your gallery and the Saved tab.',
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  const callPhone = () => {
    void Linking.openURL(`tel:${BRAND.contact.phoneTel}`);
  };

  const sendEmail = () => {
    void Linking.openURL(
      `mailto:${BRAND.contact.email}?subject=${encodeURIComponent(`${BRAND.name} inquiry`)}`
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <AppText variant="h2" style={[styles.title, { color: colors.textPrimary }]}>
            Help & Contact
          </AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppText variant="body" style={{ color: colors.textSecondary, lineHeight: 22 }}>
            Questions about the app or your order? Reach Maharlika Furniture directly, or browse the
            FAQs below.
          </AppText>

          <AppText
            variant="subtitle"
            weight="700"
            style={[styles.sectionLabel, { color: colors.textPrimary }]}
          >
            Contact
          </AppText>

          <Pressable
            onPress={callPhone}
            style={({ pressed }) => [
              styles.contactCard,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Call ${BRAND.contact.phoneDisplay}`}
          >
            <View style={[styles.iconBadge, { backgroundColor: `${BRAND.colors.orange}22` }]}>
              <Ionicons name="call-outline" size={22} color={BRAND.colors.orange} />
            </View>
            <View style={styles.cardCopy}>
              <AppText variant="caption" weight="600" style={{ color: colors.textMuted }}>
                Phone
              </AppText>
              <AppText variant="subtitle" weight="700" style={{ color: colors.textPrimary }}>
                {BRAND.contact.phoneDisplay}
              </AppText>
              <AppText variant="caption" style={{ color: colors.accent, marginTop: 2 }}>
                Tap to call
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={sendEmail}
            style={({ pressed }) => [
              styles.contactCard,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Email ${BRAND.contact.email}`}
          >
            <View style={[styles.iconBadge, { backgroundColor: `${BRAND.colors.navy}14` }]}>
              <Ionicons name="mail-outline" size={22} color={BRAND.colors.navy} />
            </View>
            <View style={styles.cardCopy}>
              <AppText variant="caption" weight="600" style={{ color: colors.textMuted }}>
                Email
              </AppText>
              <AppText
                variant="subtitle"
                weight="700"
                style={{ color: colors.textPrimary }}
                numberOfLines={2}
              >
                {BRAND.contact.email}
              </AppText>
              <AppText variant="caption" style={{ color: colors.accent, marginTop: 2 }}>
                Tap to send an email
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <AppText
            variant="subtitle"
            weight="700"
            style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: spacing.sm }]}
          >
            Frequently asked questions
          </AppText>

          <View
            style={[
              styles.faqCard,
              { backgroundColor: colors.surfacePrimary, borderColor: colors.border },
            ]}
          >
            {FAQS.map((faq, index) => (
              <View
                key={faq.question}
                style={[
                  styles.faqSection,
                  index < FAQS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <AppText variant="body" weight="600" style={{ color: colors.textPrimary }}>
                  {faq.question}
                </AppText>
                <AppText
                  variant="body"
                  style={{ color: colors.textSecondary, lineHeight: 22, marginTop: spacing.xs }}
                >
                  {faq.answer}
                </AppText>
              </View>
            ))}
          </View>
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
  sectionLabel: {
    marginTop: spacing.xs,
  },
  contactCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  faqCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  faqSection: {
    paddingVertical: spacing.md,
  },
});
