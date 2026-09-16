/**
 * Projects — saved designs and Unity 3D layout exports.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';
import { projectService } from '@/services/ProjectService';
import type { Project } from '@/types/project';
import { BRAND } from '@/constants/branding';
import { buildModelPreviewExportHref, pickUnityExportGlb } from '@/utils/modelPreviewExport';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const list = await projectService.getProjects();
      setProjects(list);
    } catch (error) {
      console.error('[Projects] Failed to load:', error);
      Alert.alert('Error', 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
    }, [loadProjects])
  );

  const handleDelete = (project: Project) => {
    Alert.alert('Delete project', `Remove “${project.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await projectService.deleteProject(project.id);
          await loadProjects();
        },
      },
    ]);
  };

  const handleImportExport = useCallback(async () => {
    setImporting(true);
    try {
      const result = await pickUnityExportGlb({ saveToProjects: true });
      if ('cancelled' in result) return;
      if ('error' in result) {
        Alert.alert('Could not open file', result.error);
        return;
      }
      await loadProjects();
      router.push(result.href);
    } finally {
      setImporting(false);
    }
  }, [loadProjects, router]);

  const handlePress = (project: Project) => {
    if (project.source === 'unity-export' && project.unityExport?.path) {
      router.push(
        buildModelPreviewExportHref({
          uri: project.unityExport.path,
          title: project.unityExport.fileName || project.name,
          furnitureCount: project.unityExport.furnitureCount,
          projectId: project.id,
        })
      );
      return;
    }

    Alert.alert(project.name, project.description || 'This project has no 3D layout to open.');
  };

  const renderItem = ({ item }: { item: Project }) => {
    const isUnity = item.source === 'unity-export';
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}
        onPress={() => handlePress(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: isUnity ? `${BRAND.colors.orange}18` : `${colors.accent}18` },
          ]}
        >
          <Ionicons
            name={isUnity ? 'cube-outline' : 'folder-outline'}
            size={22}
            color={isUnity ? BRAND.colors.orange : colors.accent}
          />
        </View>
        <View style={styles.cardBody}>
          <AppText variant="subtitle" style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {item.name}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {isUnity
              ? `3D layout · ${item.unityExport?.furnitureCount ?? 0} pieces · ${formatDate(item.updatedAt)}`
              : `${item.roomType}${item.style ? ` · ${item.style}` : ''} · ${formatDate(item.updatedAt)}`}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <AppText variant="h2" style={[styles.title, { color: colors.textPrimary }]}>
            Projects
          </AppText>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => void handleImportExport()}
              activeOpacity={0.7}
              hitSlop={12}
              disabled={importing}
              accessibilityLabel="Import Unity export GLB"
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="download-outline" size={24} color={colors.accent} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
                <AppText variant="h3" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No projects yet
                </AppText>
                <AppText variant="body" color="textMuted" style={styles.emptyText}>
                  From Unity, export and save the .glb to your phone, then tap the download icon
                  above to open it in 3D preview.
                </AppText>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingVertical: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  title: { fontWeight: '700' },
  list: {
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: { marginTop: spacing.md },
  emptyText: { textAlign: 'center', lineHeight: 22 },
});
