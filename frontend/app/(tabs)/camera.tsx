import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';

export default function CameraScreen() {
  const router = useRouter();

  const goToARView = () => {
    router.push('/ar-view');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube-outline" size={64} color={colors.textPrimary} />
        </View>
        <Text style={styles.title}>AR Furniture Placement</Text>
        <Text style={styles.subtitle}>
          ARDesignScene is developed in Unity (Build and Run). React Native integration
          will be enabled once Unity features are complete.
        </Text>

        <TouchableOpacity style={styles.startButton} onPress={goToARView} activeOpacity={0.8}>
          <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.startButtonText}>How to run AR in Unity</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: getHorizontalPadding(spacing.xl * 2),
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: radii.lg,
    backgroundColor: colors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl * 1.5,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: getHorizontalPadding(spacing.xl * 2),
    borderRadius: radii.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

