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

  const handlePress = (project: Project) => {
    if (project.source === 'unity-export' && project.unityExport) {
      const kb = Math.round(project.unityExport.byteLength / 1024);
      Alert.alert(
        project.name,
        [
          `Unity 3D layout export`,
          `File: ${project.unityExport.fileName}`,
          `Size: ${kb} KB`,
          `Furniture: ${project.unityExport.furnitureCount}`,
          `Room meshes: ${project.unityExport.roomMeshCount}`,
          `Saved: ${formatDate(project.unityExport.exportedAt)}`,
        ].join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    router.push(`/create-project?id=${project.id}`);
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
          <TouchableOpacity
            onPress={() => router.push('/create-project')}
            activeOpacity={0.7}
            hitSlop={12}
          >
            <Ionicons name="add" size={26} color={colors.accent} />
          </TouchableOpacity>
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
                  Export a 3D layout from Unity AR, or create a project with +.
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
