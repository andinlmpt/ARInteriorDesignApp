/**
 * AR View route — Unity AR on native. Web AR is not supported.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ARViewErrorBoundary } from '@/components/ar-view/ARViewErrorBoundary';
import { ARViewUnityScreen } from '@/components/ar-view/ARViewUnityScreen';
import { colors, spacing, radii } from '@/components/ui/theme';

function ARViewWebUnsupported() {
  const router = useRouter();

  return (
    <View style={webStyles.container}>
      <Ionicons name="phone-portrait-outline" size={48} color={colors.accent} />
      <Text style={webStyles.title}>AR requires the mobile app</Text>
      <Text style={webStyles.message}>
        Furniture placement runs in Unity on iOS and Android. Open this project in the Expo dev
        client on a device to use AR.
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
      {isNative ? <ARViewUnityScreen /> : <ARViewWebUnsupported />}
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
