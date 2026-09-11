/**
 * Shown when /ar-view is opened but Unity is not embedded in React Native yet.
 * ARDesignScene is developed via Unity Build & Run until RN integration is ready.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '@/components/ui/theme';

const UNITY_STEPS = [
  'Open InteriorDesignViewer in Unity',
  'Set ARDesignScene as the startup scene',
  'File → Build Settings → Android (or iOS)',
  'Build And Run on your device',
];

export function ARViewUnityDevNotice() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="logo-unity" size={40} color={colors.accent} />
      </View>

      <Text style={styles.title}>AR runs in Unity for now</Text>
      <Text style={styles.message}>
        ARDesignScene (room scan, furniture placement, save measurements) is being built
        directly in Unity. React Native embedding comes after Unity features are complete.
      </Text>

      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>Test on device</Text>
        {UNITY_STEPS.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <Text style={styles.stepIndex}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        Saved room measurements from Unity still sync to MongoDB when the backend is running
        on your LAN and you tap Save measurement after confirming a scan.
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={goBack} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>Back to app</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#0F172A',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: spacing.lg,
  },
  stepsCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  stepsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
