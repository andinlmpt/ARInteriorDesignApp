/**
 * Projects — split into AR Furniture (captured photos) and AR Measurement (3D layout exports).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  BackHandler,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/Text';
import { AppDialog, type AppDialogAction, type AppDialogProps } from '@/components/ui/AppDialog';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { projectService } from '@/services/ProjectService';
import type { Project, ProjectArMode } from '@/types/project';
import { BRAND } from '@/constants/branding';
import { buildModelPreviewExportHref } from '@/utils/modelPreviewExport';

/** Legacy projects predate `arMode` — Unity exports belong to AR Measurement. */
function projectCategory(project: Project): ProjectArMode {
  if (project.arMode) return project.arMode;
  return project.source === 'unity-export' ? 'measure' : 'furniture';
}

const CATEGORIES: { key: ProjectArMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'furniture', label: 'AR Furniture', icon: 'cube-outline' },
  { key: 'measure', label: 'AR Measurement', icon: 'resize-outline' },
];

type DialogState = {
  title: string;
  message: string;
  actions: AppDialogAction[];
  icon?: AppDialogProps['icon'];
  variant?: AppDialogProps['variant'];
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [category, setCategory] = useState<ProjectArMode>('furniture');
  const [photoPreview, setPhotoPreview] = useState<{ uri: string; title: string; subtitle: string } | null>(
    null
  );

  const visibleProjects = useMemo(
    () => projects.filter((p) => projectCategory(p) === category),
    [projects, category]
  );

  const closeDialog = useCallback(() => setDialog(null), []);

  const showMessage = useCallback(
    (title: string, message: string, icon: AppDialogProps['icon'] = 'alert-circle-outline') => {
      setDialog({
        title,
        message,
        icon,
        actions: [{ label: 'OK', tone: 'primary', onPress: closeDialog }],
      });
    },
    [closeDialog]
  );

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const list = await projectService.getProjects();
      setProjects(list);
    } catch (error) {
      console.error('[Projects] Failed to load:', error);
      showMessage('Couldn’t load projects', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
    }, [loadProjects])
  );

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    if (!selectMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSelectMode();
      return true;
    });
    return () => sub.remove();
  }, [selectMode, exitSelectMode]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = visibleProjects.length > 0 && selected.size === visibleProjects.length;

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(visibleProjects.map((p) => p.id)));
  };

  const switchCategory = (next: ProjectArMode) => {
    if (next === category) return;
    exitSelectMode();
    setCategory(next);
  };

  const deleteIds = async (ids: string[]) => {
    closeDialog();
    setDeleting(new Set(ids));
    try {
      await projectService.deleteProjects(ids);
      exitSelectMode();
      await loadProjects();
    } catch (error) {
      console.error('[Projects] Failed to delete:', error);
      showMessage(
        ids.length === 1 ? 'Couldn’t delete project' : 'Couldn’t delete projects',
        'Please try again.'
      );
    } finally {
      setDeleting(new Set());
    }
  };

  const confirmDelete = (ids: string[]) => {
    if (ids.length === 0 || deleting.size > 0) return;
    const single = ids.length === 1 ? projects.find((p) => p.id === ids[0]) : undefined;
    setDialog({
      title: single ? 'Delete project?' : `Delete ${ids.length} projects?`,
      message: single
        ? `“${single.name}” will be permanently removed. This can’t be undone.`
        : `These ${ids.length} projects will be permanently removed. This can’t be undone.`,
      icon: 'trash-outline',
      variant: 'danger',
      actions: [
        { label: 'Cancel', tone: 'ghost', onPress: closeDialog },
        { label: 'Delete', tone: 'danger', onPress: () => void deleteIds(ids) },
      ],
    });
  };

  const openProject = (project: Project) => {
    if (projectCategory(project) === 'furniture') {
      const latest = project.photos?.[project.photos.length - 1];
      if (latest) {
        const count = project.photos?.length ?? 1;
        setPhotoPreview({
          uri: latest.uri,
          title: project.name,
          subtitle: `${count} capture${count === 1 ? '' : 's'} · ${formatDate(latest.capturedAt)}`,
        });
        return;
      }
      showMessage(
        project.name,
        'No captures yet. Use the camera button in AR Furniture to add photos to this project.',
        'camera-outline'
      );
      return;
    }

    if (project.source === 'unity-export' && project.unityExport?.path) {
      router.push(
        buildModelPreviewExportHref({
          uri: project.unityExport.path,
          title: project.name || project.unityExport.fileName,
          furnitureCount: project.unityExport.furnitureCount,
          projectId: project.id,
        })
      );
      return;
    }

    showMessage(
      project.name,
      'No 3D layout yet. Tap Export in AR Measurement to add one to this project.',
      'information-circle-outline'
    );
  };

  const handlePress = (project: Project) => {
    if (selectMode) toggleSelected(project.id);
    else openProject(project);
  };

  const handleLongPress = (project: Project) => {
    if (selectMode) return;
    setSelectMode(true);
    setSelected(new Set([project.id]));
  };

  const renderItem = ({ item }: { item: Project }) => {
    const isUnity = item.source === 'unity-export';
    const isFurniture = projectCategory(item) === 'furniture';
    const photoCount = item.photos?.length ?? 0;
    const thumbnail = isFurniture ? item.photos?.[photoCount - 1]?.uri ?? item.thumbnail : undefined;
    const isDeleting = deleting.has(item.id);
    const isSelected = selected.has(item.id);
    const subtitle = isFurniture
      ? `${photoCount > 0 ? `${photoCount} capture${photoCount === 1 ? '' : 's'}` : 'No captures yet'} · ${formatDate(item.updatedAt)}`
      : isUnity
        ? `3D layout · ${item.unityExport?.furnitureCount ?? 0} pieces · ${formatDate(item.updatedAt)}`
        : `Not exported yet · ${formatDate(item.updatedAt)}`;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surfacePrimary,
            borderColor: isSelected ? colors.accent : colors.border,
          },
          isDeleting && styles.cardDeleting,
        ]}
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
        disabled={isDeleting}
        activeOpacity={0.7}
        accessibilityRole={selectMode ? 'checkbox' : 'button'}
        accessibilityState={selectMode ? { checked: isSelected } : undefined}
        accessibilityLabel={item.name}
      >
        {selectMode ? (
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: isSelected ? colors.accent : colors.surfacePrimary,
                borderColor: isSelected ? colors.accent : colors.border,
              },
            ]}
          >
            {isSelected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
          </View>
        ) : null}
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: isUnity ? `${BRAND.colors.orange}18` : `${colors.accent}18` },
            ]}
          >
            <Ionicons
              name={isUnity ? 'cube-outline' : isFurniture ? 'camera-outline' : 'folder-outline'}
              size={22}
              color={isUnity ? BRAND.colors.orange : colors.accent}
            />
          </View>
        )}
        <View style={styles.cardBody}>
          <AppText
            variant="subtitle"
            numberOfLines={1}
            ellipsizeMode="middle"
            style={[styles.cardTitle, { color: colors.textPrimary }]}
          >
            {item.name}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>
        {isDeleting ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : !selectMode ? (
          <TouchableOpacity
            onPress={() => confirmDelete([item.id])}
            hitSlop={10}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={selectMode ? exitSelectMode : () => router.back()}
            activeOpacity={0.7}
            hitSlop={12}
            style={styles.headerSide}
            accessibilityRole="button"
            accessibilityLabel={selectMode ? 'Cancel selection' : 'Go back'}
          >
            <Ionicons name={selectMode ? 'close' : 'chevron-back'} size={24} color={colors.accent} />
          </TouchableOpacity>
          <AppText variant="h2" style={[styles.title, { color: colors.textPrimary }]}>
            {selectMode ? `${selected.size} selected` : 'Projects'}
          </AppText>
          <View style={[styles.headerSide, styles.headerSideEnd]}>
            {visibleProjects.length > 0 ? (
              <TouchableOpacity
                onPress={selectMode ? toggleSelectAll : () => setSelectMode(true)}
                activeOpacity={0.7}
                style={[styles.selectBtn, { borderColor: colors.border, backgroundColor: colors.surfacePrimary }]}
                accessibilityRole="button"
                accessibilityLabel={
                  selectMode ? (allSelected ? 'Deselect all projects' : 'Select all projects') : 'Select projects'
                }
              >
                <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                  {selectMode ? (allSelected ? 'Clear' : 'All') : 'Select'}
                </AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View
          style={[styles.segment, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}
          accessibilityRole="tablist"
        >
          {CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => switchCategory(c.key)}
                activeOpacity={0.85}
                style={[styles.segmentBtn, active && { backgroundColor: colors.accent }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={c.label}
              >
                <Ionicons name={c.icon} size={16} color={active ? '#FFFFFF' : colors.textSecondary} />
                <AppText
                  variant="caption"
                  weight="600"
                  numberOfLines={1}
                  style={{ color: active ? '#FFFFFF' : colors.textSecondary }}
                >
                  {c.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={visibleProjects}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            extraData={{ selectMode, selected, deleting }}
            contentContainerStyle={[styles.list, selectMode && { paddingBottom: 96 + insets.bottom }]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons
                  name={category === 'furniture' ? 'camera-outline' : 'cube-outline'}
                  size={48}
                  color={colors.textMuted}
                />
                <AppText variant="h3" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {category === 'furniture' ? 'No AR Furniture projects yet' : 'No AR Measurement projects yet'}
                </AppText>
                <AppText variant="body" color="textMuted" style={styles.emptyText}>
                  {category === 'furniture'
                    ? 'Tap the camera button in AR Furniture and your captures will appear here.'
                    : 'Export a 3D layout from AR Measurement and it will appear here.'}
                </AppText>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {selectMode ? (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.surfacePrimary,
              borderTopColor: colors.border,
              paddingBottom: spacing.md + insets.bottom,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => confirmDelete([...selected])}
            disabled={selected.size === 0 || deleting.size > 0}
            activeOpacity={0.85}
            style={[
              styles.deleteSelectedBtn,
              { backgroundColor: colors.danger },
              (selected.size === 0 || deleting.size > 0) && styles.deleteSelectedDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${selected.size} selected projects`}
          >
            {deleting.size > 0 ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <AppText variant="subtitle" weight="600" style={styles.deleteSelectedLabel}>
                  {selected.size > 0 ? `Delete (${selected.size})` : 'Delete'}
                </AppText>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <AppDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        actions={dialog?.actions}
        icon={dialog?.icon}
        variant={dialog?.variant}
        onRequestClose={closeDialog}
      />

      <ImageViewerModal
        visible={Boolean(photoPreview)}
        uri={photoPreview?.uri ?? null}
        title={photoPreview?.title}
        subtitle={photoPreview?.subtitle}
        onClose={() => setPhotoPreview(null)}
      />
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
  headerSide: {
    minWidth: 64,
  },
  headerSideEnd: {
    alignItems: 'flex-end',
  },
  selectBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  title: { fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    marginHorizontal: getHorizontalPadding(spacing.lg),
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 40,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
  },
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDeleting: { opacity: 0.5 },
  cardBody: { flex: 1, gap: 2, minWidth: 0 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteSelectedBtn: {
    minHeight: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  deleteSelectedDisabled: { opacity: 0.45 },
  deleteSelectedLabel: { color: '#FFFFFF' },
});
