/**
 * AR View route — Unity AR embed is opt-in via EXPO_PUBLIC_UNITY_AR_ENABLED.
 * Default: Unity-only development notice (Build & Run in Unity).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ARViewErrorBoundary } from '@/components/ar-view/ARViewErrorBoundary';
import { ARViewUnityDevNotice } from '@/components/ar-view/ARViewUnityDevNotice';
import { ARViewUnityScreen } from '@/components/ar-view/ARViewUnityScreen';
import { UNITY_AR_EMBED_ENABLED } from '@/config/unity-ar.config';
import { colors, spacing, radii } from '@/components/ui/theme';

function ARViewWebUnsupported() {
  const router = useRouter();

  return (
    <View style={webStyles.container}>
      <Ionicons name="phone-portrait-outline" size={48} color={colors.accent} />
      <Text style={webStyles.title}>AR requires a mobile device</Text>
      <Text style={webStyles.message}>
        AR furniture placement is developed in Unity for iOS and Android. Use Unity Build
        &amp; Run on a device, or enable React Native Unity embed when integration is ready.
      </Text>
      <TouchableOpacity
        style={webStyles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={webStyles.backLabel}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ARViewRoute() {
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <ARViewErrorBoundary>
      {!isNative ? (
        <ARViewWebUnsupported />
      ) : UNITY_AR_EMBED_ENABLED ? (
        <ARViewUnityScreen />
      ) : (
        <ARViewUnityDevNotice />
      )}
    </ARViewErrorBoundary>
  );
}

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#0F172A',
  },
  title: {
    marginTop: spacing.lg,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.md,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  backButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  backLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
