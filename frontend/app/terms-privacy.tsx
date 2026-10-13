import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import { AppText } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { DEFAULT_LEGAL } from '@/constants/defaultContent';
import { ContentService, type LegalDoc, type LegalKey } from '@/services/ContentService';
import { parseLegalText } from '@/utils/legalText';

const LEGAL_KEYS: LegalKey[] = ['terms', 'privacy'];

/** Built-in text, used when the server can't be reached. */
const FALLBACK: Record<LegalKey, LegalDoc> = {
  terms: { title: 'Terms of Service', body: DEFAULT_LEGAL.terms, isDefault: true, updatedAt: null },
  privacy: { title: 'Privacy Policy', body: DEFAULT_LEGAL.privacy, isDefault: true, updatedAt: null },
};

function LegalBody({ body }: { body: string }) {
  return (
    <>
      {parseLegalText(body).map((block, index) => {
        if (block.type === 'heading') {
          return (
            <AppText key={index} variant="subtitle" weight="700" style={styles.subsectionTitle}>
              {block.text}
            </AppText>
          );
        }
        if (block.type === 'bullets') {
          return (
            <AppText key={index} variant="body" color="textMuted" style={[styles.paragraph, styles.section]}>
              {block.items.map((item) => `• ${item}`).join('\n')}
            </AppText>
          );
        }
        return (
          <AppText key={index} variant="body" color="textMuted" style={styles.paragraph}>
            {block.text}
          </AppText>
        );
      })}
    </>
  );
}

export default function TermsPrivacyScreen() {
  const router = useRouter();
  /** null while loading. Admins edit this text in the web console. */
  const [docs, setDocs] = useState<Record<LegalKey, LegalDoc> | null>(null);

  useEffect(() => {
    let cancelled = false;
    ContentService.getLegal()
      .then((res) => {
        if (!cancelled) setDocs({ terms: res.terms ?? FALLBACK.terms, privacy: res.privacy ?? FALLBACK.privacy });
      })
      .catch(() => {
        if (!cancelled) setDocs(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <AppText variant="body" color="accent" style={styles.backButton}>Back</AppText>
          </TouchableOpacity>
          <AppText variant="h1" style={styles.title}>Terms & Privacy</AppText>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {docs === null ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            LEGAL_KEYS.map((key) => (
              <Card key={key} tone="elevated" padding="lg" style={styles.card}>
                <AppText variant="h2" style={styles.sectionTitle}>
                  {docs[key].title}
                </AppText>
                {docs[key].updatedAt ? (
                  <AppText variant="body" color="textMuted" style={styles.content}>
                    Last updated: {new Date(docs[key].updatedAt as string).toLocaleDateString()}
                  </AppText>
                ) : null}
                <LegalBody body={docs[key].body} />
              </Card>
            ))
          )}

          <Card tone="elevated" padding="lg" style={styles.card}>
            <AppText variant="body" color="textMuted" style={styles.contactInfo}>
              For questions about these terms or privacy policy, please contact us at:{'\n'}
              legal@interior.studio
            </AppText>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    minWidth: 60,
  },
  title: {
    color: colors.textPrimary,
  },
  placeholder: {
    width: 60,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2.5,
    gap: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  content: {
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  section: {
    marginBottom: spacing.lg,
  },
  subsectionTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  paragraph: {
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  contactInfo: {
    lineHeight: 22,
    textAlign: 'center',
  },
});
