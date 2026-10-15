/**
 * AR View route — Unity AR embed is opt-in via EXPO_PUBLIC_UNITY_AR_ENABLED.
 * Default: Unity-only development notice (Build & Run in Unity).
 * Only "Design a room" (flow=design) uses AR; anything else goes back to the tabs.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ARViewErrorBoundary } from '@/components/ar-view/ARViewErrorBoundary';
import { ARViewUnityDevNotice } from '@/components/ar-view/ARViewUnityDevNotice';
import { ARViewUnityScreen } from '@/components/ar-view/ARViewUnityScreen';
import { UNITY_AR_EMBED_ENABLED } from '@/config/unity-ar.config';
import { colors, spacing, radii } from '@/components/ui/theme';

function ARViewWebUnsupported() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    flow?: string | string[];
    projectId?: string | string[];
  }>();
  const flow = Array.isArray(params.flow) ? params.flow[0] : params.flow;
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  return (
    <View style={webStyles.container}>
      <Ionicons name="phone-portrait-outline" size={48} color={colors.accent} />
      <Text style={webStyles.title}>AR requires a mobile device</Text>
      <Text style={webStyles.message}>
        Room scanning and AR layouts run in Unity on iOS and Android. Open the app on a
        phone to scan your room.
      </Text>
      {flow === 'design' ? (
        <TouchableOpacity
          style={webStyles.backButton}
          onPress={() =>
            router.replace({
              pathname: '/design-preferences',
              params: { projectId: projectId || '', flow: 'design' },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Continue to design preferences"
        >
          <Text style={webStyles.backLabel}>Continue to preferences</Text>
        </TouchableOpacity>
      ) : null}
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
  const params = useLocalSearchParams<{ flow?: string | string[] }>();
  const flow = Array.isArray(params.flow) ? params.flow[0] : params.flow;

  // AR Furniture / AR Measurement were removed; old links land back on the tabs.
  if (flow !== 'design') {
    return <Redirect href="/(tabs)" />;
  }

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
