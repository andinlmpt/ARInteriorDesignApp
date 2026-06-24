import { Card } from '@/components/ui/Card';
import { AppText } from '@/components/ui/Text';
import { colors, radii, shadows, spacing } from '@/components/ui/theme';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HelpSupportScreen() {
  const router = useRouter();

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@interior.studio?subject=Support Request');
  };

  const handleViewDocs = () => {
    Linking.openURL('https://docs.interior.studio');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <AppText variant="body" color="accent" style={styles.backButton}>Back</AppText>
          </TouchableOpacity>
          <AppText variant="h1" style={styles.title}>Help & Support</AppText>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Card tone="elevated" padding="lg" style={styles.card}>
            <AppText variant="h2" style={styles.cardTitle}>
              Get Help
            </AppText>
            <AppText variant="body" color="textMuted" style={styles.cardDescription}>
              Need assistance? We're here to help you with any questions or issues you may have.
            </AppText>
          </Card>

          <Card tone="elevated" padding="lg" style={styles.card}>
            <AppText variant="subtitle" weight="700" style={styles.sectionTitle}>
              Contact Support
            </AppText>
            <AppText variant="body" color="textMuted" style={styles.sectionDescription}>
              Reach out to our support team via email for personalized assistance.
            </AppText>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleContactSupport}
              activeOpacity={0.8}
            >
              <AppText variant="subtitle" style={styles.actionButtonText} weight="600">
                📧 Email Support
              </AppText>
            </TouchableOpacity>
          </Card>

          <Card tone="elevated" padding="lg" style={styles.card}>
            <AppText variant="subtitle" weight="700" style={styles.sectionTitle}>
              Documentation
            </AppText>
            <AppText variant="body" color="textMuted" style={styles.sectionDescription}>
              Browse our comprehensive documentation and guides.
            </AppText>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleViewDocs}
              activeOpacity={0.8}
            >
              <AppText variant="subtitle" style={styles.actionButtonText} weight="600">
                📖 View Documentation
              </AppText>
            </TouchableOpacity>
          </Card>

          <Card tone="elevated" padding="lg" style={styles.card}>
            <AppText variant="subtitle" weight="700" style={styles.sectionTitle}>
              Frequently Asked Questions
            </AppText>
            <View style={styles.faqSection}>
              <AppText variant="body" style={styles.faqQuestion}>
                How do I create a new project?
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.faqAnswer}>
                Tap the + button in the bottom navigation, then select "By Camera" or "AR View" to start.
              </AppText>
            </View>
            <View style={styles.faqSection}>
              <AppText variant="body" style={styles.faqQuestion}>
                How do I measure a room?
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.faqAnswer}>
                Use the "By Camera" option to scan your room with your device's camera for accurate measurements.
              </AppText>
            </View>
            <View style={styles.faqSection}>
              <AppText variant="body" style={styles.faqQuestion}>
                Can I save my projects?
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.faqAnswer}>
                Yes! All your projects are automatically saved and can be accessed from the "My Projects" tab.
              </AppText>
            </View>
            <View style={styles.faqSection}>
              <AppText variant="body" style={styles.faqQuestion}>
                Are furniture models polygon-based?
              </AppText>
              <AppText variant="body" color="textMuted" style={styles.faqAnswer}>
                Yes, your furniture models are still polygon-based. GLB/GLTF files contain polygon meshes. When loaded, they become THREE.Mesh objects, which are polygon-based. The code processes polygon meshes - the loadGLBModel function loads GLB/GLTF files and processes them as THREE.Mesh objects, and the code traverses meshes and handles geometry (polygon data). If a GLB model doesn't load, the app falls back to procedurally generated furniture using Three.js geometries (BoxGeometry, CylinderGeometry, etc.), which are also polygon-based. Everything is polygon-based. GLB/GLTF is just a file format that stores polygon mesh data. For mobile AR performance, keep polygon counts low (typically under 10,000–20,000 triangles per model for smooth performance).
              </AppText>
            </View>
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
  cardTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  cardDescription: {
    lineHeight: 22,
  },
  sectionTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionButtonText: {
    color: colors.surfacePrimary,
  },
  faqSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqQuestion: {
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  faqAnswer: {
    lineHeight: 22,
  },
});
