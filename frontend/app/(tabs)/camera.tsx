/**
 * Center tab — choose AR Furniture or AR Measurement (plus entry point).
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { UNITY_AR_EMBED_ENABLED } from '@/config/unity-ar.config';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { AppDialog } from '@/components/ui/AppDialog';
import { getHorizontalPadding } from '@/utils/responsive';
import { projectService } from '@/services/ProjectService';
import type { ProjectArMode } from '@/types/project';

const MAX_PROJECT_NAME = 50;

export default function CameraScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [pendingMode, setPendingMode] = useState<ProjectArMode | null>(null);
  const [starting, setStarting] = useState(false);

  // Returning from AR (or re-entering the tab) must not reopen the name dialog.
  useFocusEffect(
    useCallback(() => {
      setNameModalVisible(false);
      setPendingMode(null);
      setStarting(false);
    }, [])
  );

  const startProject = useCallback(
    async (name: string, mode: ProjectArMode) => {
      if (starting) return;
      setStarting(true);
      try {
        const project = await projectService.createProject({ name, arMode: mode });
        if (mode === 'design') {
          const canScan =
            UNITY_AR_EMBED_ENABLED && (Platform.OS === 'ios' || Platform.OS === 'android');
          router.push(
            canScan
              ? {
                  pathname: '/ar-view',
                  params: { mode: 'measure', projectId: project.id, flow: 'design' },
                }
              : {
                  pathname: '/design-preferences',
                  params: { projectId: project.id, flow: 'design' },
                },
          );
          return;
        }
        router.push({ pathname: '/ar-view', params: { mode, projectId: project.id } });
      } catch (err) {
        setStarting(false);
        setPendingMode(mode);
        setNameDraft(name);
        setNameError(err instanceof Error ? err.message : 'Could not create the project.');
        setNameModalVisible(true);
      }
    },
    [router, starting]
  );

  const openAr = (mode: ProjectArMode) => {
    setPendingMode(mode);
    setNameDraft('');
    setNameError(null);
    setNameModalVisible(true);
  };

  const confirmName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError('Please enter a project name.');
      return;
    }
    if (!pendingMode) return;
    const mode = pendingMode;
    setNameModalVisible(false);
    setNameError(null);
    setPendingMode(null);
    void startProject(trimmed, mode);
  };

  const cancelName = () => {
    setNameModalVisible(false);
    setPendingMode(null);
    setNameError(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Start new project</Text>
        </View>

        <View style={styles.list}>
          <Pressable
            onPress={() => openAr('furniture')}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="AR Furniture"
          >
            <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="cube-outline" size={28} color={colors.accent} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>AR Furniture</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Place furniture in your room with AR
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => openAr('measure')}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="AR Measurement"
          >
            <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="resize-outline" size={28} color={colors.accent} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>AR Measurement</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Measure rooms with your phone camera
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => openAr('design')}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Design a room"
          >
            <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="color-wand-outline" size={28} color={colors.accent} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Design a room</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Scan, set a budget, and generate layout options
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <TouchableOpacity
          style={styles.savedLink}
          onPress={() => router.push('/room-measurements')}
          accessibilityRole="button"
        >
          <Text style={[styles.savedLinkText, { color: colors.accent }]}>View saved measurements</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <AppDialog
        visible={nameModalVisible}
        title="Name your project"
        message="You'll find it under this name in Projects."
        icon="folder-open-outline"
        onRequestClose={cancelName}
        dismissOnBackdrop={false}
        actions={[
          { label: 'Cancel', tone: 'ghost', onPress: cancelName },
          { label: 'Continue', tone: 'primary', onPress: confirmName },
        ]}
      >
        <TextInput
          value={nameDraft}
          onChangeText={(text) => {
            setNameDraft(text);
            if (nameError) setNameError(null);
          }}
          placeholder="e.g. Living room makeover"
          placeholderTextColor={colors.textMuted}
          maxLength={MAX_PROJECT_NAME}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={confirmName}
          style={[
            styles.nameInput,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surfaceSecondary,
              borderColor: nameError ? colors.danger : colors.border,
            },
          ]}
          accessibilityLabel="Project name"
        />
        {nameError ? (
          <Text style={[styles.nameErrorText, { color: colors.danger }]}>{nameError}</Text>
        ) : null}
      </AppDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  nameInput: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  nameErrorText: {
    marginTop: spacing.xs,
    fontSize: 13,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  savedLink: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  savedLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
