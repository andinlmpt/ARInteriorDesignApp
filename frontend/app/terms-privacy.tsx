import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import { AppText } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function TermsPrivacyScreen() {
  const router = useRouter();

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
          <Card tone="elevated" padding="lg" style={styles.card}>
            <AppText variant="h2" style={styles.sectionTitle}>
              Terms of Service
            </AppText>
            <AppText variant="body" color="textMuted" style={styles.content}>
              Last updated: {new Date().toLocaleDateString()}
            </AppText>
            <View style={styles.section}>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                By using the AR Interior Design App, you agree to these terms of service. The app provides tools for interior design planning and visualization.
              </AppText>
            </View>
            <View style={styles.section}>
              <AppText variant="subtitle" weight="700" style={styles.subsectionTitle}>
                User Responsibilities
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                • You are responsible for the accuracy of measurements and project data{'\n'}
                • You must not use the app for illegal purposes{'\n'}
                • You must respect intellectual property rights
              </AppText>
            </View>
            <View style={styles.section}>
              <AppText variant="subtitle" weight="700" style={styles.subsectionTitle}>
                Service Availability
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                We strive to maintain service availability but do not guarantee uninterrupted access. The service may be temporarily unavailable for maintenance or updates.
              </AppText>
            </View>
          </Card>

          <Card tone="elevated" padding="lg" style={styles.card}>
            <AppText variant="h2" style={styles.sectionTitle}>
              Privacy Policy
            </AppText>
            <AppText variant="body" color="textMuted" style={styles.content}>
              Last updated: {new Date().toLocaleDateString()}
            </AppText>
            <View style={styles.section}>
              <AppText variant="subtitle" weight="700" style={styles.subsectionTitle}>
                Data Collection
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                We collect information necessary to provide our services, including:
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                • Account information (name, email){'\n'}
                • Project data and designs{'\n'}
                • Usage analytics (anonymous)
              </AppText>
            </View>
            <View style={styles.section}>
              <AppText variant="subtitle" weight="700" style={styles.subsectionTitle}>
                Data Usage
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                Your data is used to:
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                • Provide and improve our services{'\n'}
                • Personalize your experience{'\n'}
                • Analyze app performance (anonymously)
              </AppText>
            </View>
            <View style={styles.section}>
              <AppText variant="subtitle" weight="700" style={styles.subsectionTitle}>
                Data Security
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.
              </AppText>
            </View>
            <View style={styles.section}>
              <AppText variant="subtitle" weight="700" style={styles.subsectionTitle}>
                Your Rights
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                You have the right to:
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.paragraph}>
                • Access your personal data{'\n'}
                • Request data deletion{'\n'}
                • Opt-out of analytics
              </AppText>
            </View>
          </Card>

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
