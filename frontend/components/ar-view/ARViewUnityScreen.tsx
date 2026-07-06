/**
 * AR View — Unity AR Foundation (ARFurniture scene).
 * Native Android/iOS only. Uses @azesmway/react-native-unity + InteriorDesignViewer/Assets/Scenes/ARFurniture.unity
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { UnityARViewer, type UnityARViewerHandle } from '@/components/UnityARViewer';
import { ARFurnitureLibrary } from '@/components/ar-view/ARFurnitureLibrary';
import { mapFurnitureIdToUnity } from '@/config/unity-furniture-map';
import type { FurnitureCategory } from '@/types/ar-view';
import { colors, spacing, radii } from '@/components/ui/theme';

const UNITY_READY_TIMEOUT_MS = 15000;

export function ARViewUnityScreen() {
  const router = useRouter();
  const unityRef = useRef<UnityARViewerHandle>(null);

  const [selectedCategory, setSelectedCategory] = useState<FurnitureCategory | 'all'>('all');
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<string | null>(null);
  const [unityReady, setUnityReady] = useState(false);
  const [unityTimedOut, setUnityTimedOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading Unity AR…');
  const [libraryVisible, setLibraryVisible] = useState(true);
  const [lastPlacedName, setLastPlacedName] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!unityReady) {
        setUnityTimedOut(true);
        setStatusMessage('Unity AR did not start. Export ARFurniture and rebuild the dev client.');
      }
    }, UNITY_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [unityReady]);

  const handleUnityReady = useCallback(() => {
    setUnityReady(true);
    setUnityTimedOut(false);
    setStatusMessage('Point at the floor, then tap to place furniture');
  }, []);

  const handleSelectItem = useCallback(
    (itemId: string) => {
      setSelectedLibraryItem(itemId);
      setLastPlacedName(null);
      const unityId = mapFurnitureIdToUnity(itemId);
      unityRef.current?.selectFurniture(unityId);
      setStatusMessage('Tap the floor to place');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    []
  );

  const handleFurniturePlaced = useCallback((instanceName: string) => {
    setLastPlacedName(instanceName);
    setStatusMessage('Furniture placed');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const handleClear = useCallback(() => {
    unityRef.current?.clearFurniture();
    setLastPlacedName(null);
    setStatusMessage('Cleared. Select furniture and tap the floor.');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <UnityARViewer
        ref={unityRef}
        style={styles.unityLayer}
        onUnityReady={handleUnityReady}
        onFurniturePlaced={handleFurniturePlaced}
      />

      {!unityReady && !unityTimedOut && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Starting ARFurniture scene…</Text>
        </View>
      )}

      {unityTimedOut && (
        <View style={styles.setupBanner}>
          <Ionicons name="construct-outline" size={22} color="#FFFFFF" style={styles.setupIcon} />
          <Text style={styles.setupTitle}>Unity export required</Text>
          <Text style={styles.setupText}>
            In Unity: export ARFurniture to frontend/unity/builds/android, then run npx expo
            prebuild and rebuild your dev client (see docs/UNITY_AR_SETUP_INTERIORDESIGNVIEWER.md).
          </Text>
        </View>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.accent} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setLibraryVisible((v) => !v)}
            accessibilityLabel={libraryVisible ? 'Hide furniture library' : 'Show furniture library'}
          >
            <Ionicons
              name={libraryVisible ? 'chevron-down' : 'chevron-up'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleClear}
            disabled={!unityReady}
            accessibilityLabel="Clear placed furniture"
          >
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusBar} pointerEvents="none">
        <Text style={styles.statusText}>{statusMessage}</Text>
        {lastPlacedName ? (
          <Text style={styles.statusSubtext}>Instance: {lastPlacedName}</Text>
        ) : null}
      </View>

      <ARFurnitureLibrary
        visible={libraryVisible && unityReady}
        selectedCategory={selectedCategory}
        selectedLibraryItem={selectedLibraryItem}
        onSelectCategory={setSelectedCategory}
        onSelectItem={handleSelectItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  unityLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  loadingText: {
    marginTop: spacing.md,
    color: '#FFFFFF',
    fontSize: 16,
  },
  setupBanner: {
    position: 'absolute',
    top: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(127, 29, 29, 0.92)',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  setupIcon: {
    marginBottom: spacing.xs,
  },
  setupTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  setupText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  topBar: {
    position: 'absolute',
    top: 48,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  backLabel: {
    marginLeft: spacing.xs,
    color: colors.accent,
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBar: {
    position: 'absolute',
    top: 108,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  statusSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
});
