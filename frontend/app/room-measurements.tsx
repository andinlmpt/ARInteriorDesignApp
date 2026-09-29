import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { AppText } from '@/components/ui/Text';
import { Screen } from '@/components/ui/Screen';
import { AppDialog } from '@/components/ui/AppDialog';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii, shadows } from '@/components/ui/theme';
import { RoomMeasurementService } from '@/services/RoomMeasurementService';
import { projectService } from '@/services/ProjectService';
import type { RoomMeasurementRecord } from '@/types/room-measurement';
import {
  formatFloorArea,
  formatRoomDate,
  formatRoomDimensions,
} from '@/utils/roomMeasurementHelpers';
import { buildModelPreviewExportHref, toFileUri } from '@/utils/modelPreviewExport';
import { deleteLocalRoomExport, hasLinkedRoomExport } from '@/utils/roomExportStorage';
import { getHorizontalPadding } from '@/utils/responsive';

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function RoomMeasurementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const [measurements, setMeasurements] = useState<RoomMeasurementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricUnits, setMetricUnits] = useState(true);
  const [renamingItem, setRenamingItem] = useState<RoomMeasurementRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
  const [noExportDialog, setNoExportDialog] = useState<{
    roomName: string;
  } | null>(null);
  const [previewErrorDialog, setPreviewErrorDialog] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<RoomMeasurementRecord | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteErrorDialog, setDeleteErrorDialog] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);

  const loadMeasurements = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const units = await AsyncStorage.getItem('settings_metricUnits');
      if (units !== null) setMetricUnits(units === 'true');

      const items = await RoomMeasurementService.getAll();
      setMeasurements(items);
    } catch (err) {
      console.error('[RoomMeasurements] Failed to load:', err);
      setError('Could not load room measurements. Check that the backend is running.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMeasurements();
    }, [loadMeasurements]),
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

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected =
    measurements.length > 0 && selected.size === measurements.length;

  const toggleSelectAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(measurements.map((m) => m.id)));
  }, [allSelected, measurements]);

  const confirmBulkDelete = useCallback((ids: string[]) => {
    if (ids.length === 0 || bulkDeleteSaving || deleteSaving) return;
    setPendingBulkDeleteIds(ids);
  }, [bulkDeleteSaving, deleteSaving]);

  const performBulkDelete = useCallback(async () => {
    if (!pendingBulkDeleteIds?.length || bulkDeleteSaving) return;
    setBulkDeleteSaving(true);
    const ids = pendingBulkDeleteIds;
    setPendingBulkDeleteIds(null);
    try {
      for (const id of ids) {
        const item = measurements.find((m) => m.id === id);
        await RoomMeasurementService.delete(id);
        if (item) {
          await deleteLocalRoomExport(id, item.exportPath);
        }
      }
      setMeasurements((prev) => prev.filter((m) => !ids.includes(m.id)));
      exitSelectMode();
    } catch (err) {
      console.warn('[RoomMeasurements] Bulk delete failed:', err);
      setDeleteErrorDialog('Couldn’t delete the selected rooms. Check your connection and try again.');
    } finally {
      setBulkDeleteSaving(false);
    }
  }, [bulkDeleteSaving, exitSelectMode, measurements, pendingBulkDeleteIds]);

  const startNewMeasurement = useCallback(() => {
    router.push({ pathname: '/ar-view', params: { mode: 'measure' } });
  }, [router]);

  const openRename = useCallback((item: RoomMeasurementRecord) => {
    setRenamingItem(item);
    setRenameValue(item.name || 'Room scan');
    setRenameError(null);
  }, []);

  const confirmDelete = useCallback((item: RoomMeasurementRecord) => {
    if (selectMode) return;
    setDeletingItem(item);
  }, [selectMode]);

  const cancelDelete = useCallback(() => {
    if (deleteSaving) return;
    setDeletingItem(null);
  }, [deleteSaving]);

  const performDelete = useCallback(async () => {
    if (!deletingItem || deleteSaving) return;
    setDeleteSaving(true);
    try {
      await RoomMeasurementService.delete(deletingItem.id);
      await deleteLocalRoomExport(deletingItem.id, deletingItem.exportPath);
      setMeasurements((prev) => prev.filter((m) => m.id !== deletingItem.id));
      setDeletingItem(null);
    } catch (err) {
      console.warn('[RoomMeasurements] Delete failed:', err);
      setDeletingItem(null);
      setDeleteErrorDialog('Couldn’t delete this room. Check your connection and try again.');
    } finally {
      setDeleteSaving(false);
    }
  }, [deleteSaving, deletingItem]);

  const closeRename = useCallback(() => {
    if (renameSaving) return;
    setRenamingItem(null);
    setRenameValue('');
    setRenameError(null);
  }, [renameSaving]);

  const saveRename = useCallback(async () => {
    if (!renamingItem) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      setRenameError('Enter a name for this room.');
      return;
    }
    if (nextName === (renamingItem.name || '').trim()) {
      setRenamingItem(null);
      setRenameValue('');
      setRenameError(null);
      return;
    }

    setRenameSaving(true);
    setRenameError(null);
    try {
      const updated = await RoomMeasurementService.updateName(renamingItem.id, nextName);
      setMeasurements((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, name: updated.name } : m)),
      );
      setRenamingItem(null);
      setRenameValue('');
    } catch (err) {
      console.warn('[RoomMeasurements] Rename failed:', err);
      setRenameError('Couldn’t save the name. Check your connection and try again.');
    } finally {
      setRenameSaving(false);
    }
  }, [renameValue, renamingItem]);

  const openExportPreview = useCallback(
    async (item: RoomMeasurementRecord) => {
      if (previewBusyId) return;

      if (!hasLinkedRoomExport(item)) {
        setNoExportDialog({ roomName: item.name || 'Room scan' });
        return;
      }

      setPreviewBusyId(item.id);
      try {
        let uri = toFileUri(item.exportPath || '');
        let title = item.exportFileName || item.name || 'Exported layout';
        let furnitureCount = item.exportFurnitureCount;
        let projectId = item.projectId || undefined;

        if (uri) {
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists && item.projectId) {
            uri = '';
          }
        }

        if (!uri && item.projectId) {
          try {
            const project = await projectService.getProjectById(item.projectId);
            const exportMeta = project?.unityExport;
            if (exportMeta?.path) {
              uri = toFileUri(exportMeta.path);
              title = exportMeta.fileName || title;
              furnitureCount = exportMeta.furnitureCount;
              projectId = project.id;
            }
          } catch (err) {
            console.warn('[RoomMeasurements] Project lookup for export failed:', err);
          }
        }

        if (!uri) {
          setPreviewErrorDialog(
            'The 3D layout file is no longer on this device. Open Room scan, measure again, then tap Export 3D to re-link it.',
          );
          return;
        }

        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          setPreviewErrorDialog(
            'The exported .glb is missing. Export 3D again from Room scan to restore the preview.',
          );
          return;
        }

        router.push(
          buildModelPreviewExportHref({
            uri,
            title,
            furnitureCount,
            projectId,
          }),
        );
      } catch (err) {
        console.warn('[RoomMeasurements] Preview open failed:', err);
        setPreviewErrorDialog('Could not open the 3D layout. Try exporting again from Room scan.');
      } finally {
        setPreviewBusyId(null);
      }
    },
    [previewBusyId, router],
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: hexToRgba(colors.accent, 0.12) }]}>
        <Ionicons name="scan-outline" size={40} color={colors.accent} />
      </View>
      <AppText variant="h3" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        No room scans yet
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.emptyBody}>
        Scan a room with AR Measurement and save the size. Saved scans appear here when the
        backend is running.
      </AppText>
    </View>
  );

  const renderItem = (item: RoomMeasurementRecord) => {
    const dimensions = formatRoomDimensions(item, metricUnits);
    const area = formatFloorArea(item.floorAreaSqm, metricUnits);
    const scannedAt = formatRoomDate(item.confirmedAt || item.createdAt);
    const corners = item.scanMetadata?.cornerCount ?? item.floorPolygon?.length ?? 0;
    const linked = hasLinkedRoomExport(item);
    const previewBusy = previewBusyId === item.id;
    const isSelected = selected.has(item.id);

    return (
      <Pressable
        key={item.id}
        onPress={selectMode ? () => toggleSelected(item.id) : undefined}
        onLongPress={() => {
          if (selectMode) return;
          setSelectMode(true);
          setSelected(new Set([item.id]));
        }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surfacePrimary,
            borderColor: isSelected ? colors.accent : colors.border,
            opacity: pressed && selectMode ? 0.92 : 1,
          },
          shadows.sm,
        ]}
        accessibilityRole={selectMode ? 'checkbox' : 'button'}
        accessibilityState={selectMode ? { checked: isSelected } : undefined}
        accessibilityLabel={item.name || 'Room scan'}
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
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: hexToRgba(colors.accent, 0.1) }]}>
            <Ionicons name="home-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.cardHeaderText}>
            <AppText variant="subtitle" style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {item.name || 'Room scan'}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {scannedAt}
              {linked ? ' · 3D ready' : ''}
            </AppText>
          </View>
          {!selectMode ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => openExportPreview(item)}
              hitSlop={8}
              disabled={previewBusy}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: hexToRgba(colors.accent, linked ? 0.14 : 0.08),
                  opacity: previewBusy ? 0.6 : linked ? 1 : 0.55,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                linked
                  ? `Preview 3D layout for ${item.name || 'room scan'}`
                  : `No 3D export yet for ${item.name || 'room scan'}`
              }
            >
              {previewBusy ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="cube-outline" size={18} color={colors.accent} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openRename(item)}
              hitSlop={8}
              style={[styles.actionBtn, { backgroundColor: hexToRgba(colors.accent, 0.1) }]}
              accessibilityRole="button"
              accessibilityLabel={`Rename ${item.name || 'room scan'}`}
            >
              <Ionicons name="create-outline" size={18} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              hitSlop={8}
              style={[styles.actionBtn, { backgroundColor: hexToRgba(colors.danger, 0.12) }]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name || 'room scan'}`}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          ) : null}
        </View>

        <View style={[styles.dimensionPill, { backgroundColor: hexToRgba(colors.accent, 0.08) }]}>
          <AppText variant="body" style={{ color: colors.textPrimary, fontWeight: '600' }}>
            {dimensions}
          </AppText>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <AppText variant="caption" color="textMuted">
              Floor area
            </AppText>
            <AppText variant="subtitle" style={{ color: colors.textPrimary }}>
              {area}
            </AppText>
          </View>
          <View style={styles.stat}>
            <AppText variant="caption" color="textMuted">
              Corners
            </AppText>
            <AppText variant="subtitle" style={{ color: colors.textPrimary }}>
              {corners > 0 ? corners : '—'}
            </AppText>
          </View>
          <View style={styles.stat}>
            <AppText variant="caption" color="textMuted">
              Wall height
            </AppText>
            <AppText variant="subtitle" style={{ color: colors.textPrimary }}>
              {metricUnits
                ? `${(item.wallHeight || item.height).toFixed(1)} m`
                : `${((item.wallHeight || item.height) * 3.28084).toFixed(1)} ft`}
            </AppText>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: getHorizontalPadding(spacing.xl) }]}>
          <TouchableOpacity
            onPress={selectMode ? exitSelectMode : () => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={selectMode ? 'Cancel selection' : 'Go back'}
          >
            <Ionicons
              name={selectMode ? 'close' : 'chevron-back'}
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <AppText variant="h2" style={[styles.title, { color: colors.textPrimary }]}>
            {selectMode ? `${selected.size} selected` : 'Room Measurements'}
          </AppText>
          <View style={styles.headerActions}>
            {measurements.length > 0 ? (
              <TouchableOpacity
                onPress={selectMode ? toggleSelectAll : () => setSelectMode(true)}
                activeOpacity={0.7}
                style={[
                  styles.headerAddBtn,
                  {
                    backgroundColor: selectMode
                      ? hexToRgba(colors.accent, 0.22)
                      : colors.accentSoft,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  selectMode
                    ? allSelected
                      ? 'Deselect all rooms'
                      : 'Select all rooms'
                    : 'Select rooms'
                }
              >
                <Ionicons
                  name={
                    selectMode
                      ? allSelected
                        ? 'close-circle-outline'
                        : 'checkmark-done-outline'
                      : 'checkbox-outline'
                  }
                  size={22}
                  color={colors.accent}
                />
              </TouchableOpacity>
            ) : null}
            {!selectMode ? (
              <TouchableOpacity
                onPress={startNewMeasurement}
                style={[styles.headerAddBtn, { backgroundColor: colors.accent }]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Start new room measurement"
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <Screen
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: getHorizontalPadding(spacing.xl) },
            ...(selectMode ? [{ paddingBottom: 96 + insets.bottom }] : []),
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadMeasurements(true)}
              tintColor={colors.accent}
            />
          }
        >
          <AppText variant="body" color="textMuted" style={styles.subtitle}>
            Saved sizes from your AR room scans — preview linked 3D exports anytime
          </AppText>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : error ? (
            <View style={styles.errorWrap}>
              <AppText variant="body" style={{ color: colors.danger, textAlign: 'center' }}>
                {error}
              </AppText>
              <TouchableOpacity
                style={[styles.retryButton, { borderColor: colors.accent }]}
                onPress={() => loadMeasurements()}
              >
                <AppText variant="subtitle" style={{ color: colors.accent }}>
                  Retry
                </AppText>
              </TouchableOpacity>
            </View>
          ) : measurements.length === 0 ? (
            renderEmpty()
          ) : (
            <>
              <AppText variant="caption" color="textMuted" style={styles.countLabel}>
                {measurements.length} saved {measurements.length === 1 ? 'room' : 'rooms'}
              </AppText>
              {measurements.map(renderItem)}
            </>
          )}
        </Screen>

        {selectMode ? (
          <View
            style={[
              styles.selectionBar,
              {
                backgroundColor: colors.surfacePrimary,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => confirmBulkDelete([...selected])}
              disabled={selected.size === 0 || bulkDeleteSaving}
              activeOpacity={0.85}
              style={[
                styles.deleteSelectedBtn,
                { backgroundColor: colors.danger },
                (selected.size === 0 || bulkDeleteSaving) && styles.deleteSelectedDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${selected.size} selected rooms`}
            >
              {bulkDeleteSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <AppText variant="subtitle" weight="600" style={styles.deleteSelectedLabel}>
                  {selected.size > 0 ? `Delete (${selected.size})` : 'Delete'}
                </AppText>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>

      <Modal
        visible={Boolean(renamingItem)}
        transparent
        animationType="fade"
        onRequestClose={closeRename}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.renameOverlay}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeRename} />
          <View
            style={[
              styles.renameCard,
              {
                backgroundColor: colors.surfacePrimary,
                ...Platform.select({
                  ios: shadows.lg,
                  android: { elevation: 8 },
                  default: shadows.md,
                }),
              },
            ]}
          >
            <AppText variant="h3" style={[styles.renameTitle, { color: colors.textPrimary }]}>
              Rename room
            </AppText>
            <AppText variant="body" color="textMuted" style={styles.renameHint}>
              Give this scan a clear name, like Living room or Master bedroom.
            </AppText>
            <TextInput
              value={renameValue}
              onChangeText={(text) => {
                setRenameValue(text);
                if (renameError) setRenameError(null);
              }}
              placeholder="Room name"
              placeholderTextColor={colors.textMuted}
              maxLength={100}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveRename}
              editable={!renameSaving}
              style={[
                styles.renameInput,
                {
                  color: colors.textPrimary,
                  borderColor: renameError ? colors.danger : colors.border,
                  backgroundColor: colors.surfaceSecondary,
                },
              ]}
            />
            {renameError ? (
              <AppText variant="caption" style={{ color: colors.danger, marginTop: spacing.xs }}>
                {renameError}
              </AppText>
            ) : null}
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={[styles.renameActionBtn, { backgroundColor: colors.accentSoft }]}
                onPress={closeRename}
                disabled={renameSaving}
              >
                <AppText variant="subtitle" style={{ color: colors.accent, fontWeight: '600' }}>
                  Cancel
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.renameActionBtn,
                  { backgroundColor: colors.accent, opacity: renameSaving ? 0.7 : 1 },
                ]}
                onPress={saveRename}
                disabled={renameSaving}
              >
                {renameSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <AppText variant="subtitle" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                    Save
                  </AppText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AppDialog
        visible={Boolean(noExportDialog)}
        title="No 3D export yet"
        message={
          noExportDialog
            ? `“${noExportDialog.roomName}” only has size data. Open Room scan, save the room name — the 3D layout is created automatically (or tap Export 3D on the plan).`
            : undefined
        }
        icon="cube-outline"
        onRequestClose={() => setNoExportDialog(null)}
        actions={[
          {
            label: 'Not now',
            tone: 'ghost',
            onPress: () => setNoExportDialog(null),
          },
          {
            label: 'Open Room scan',
            tone: 'primary',
            onPress: () => {
              setNoExportDialog(null);
              startNewMeasurement();
            },
          },
        ]}
      />

      <AppDialog
        visible={Boolean(previewErrorDialog)}
        title="Can’t open layout"
        message={previewErrorDialog || undefined}
        icon="alert-circle-outline"
        variant="danger"
        onRequestClose={() => setPreviewErrorDialog(null)}
        actions={[
          {
            label: 'OK',
            tone: 'primary',
            onPress: () => setPreviewErrorDialog(null),
          },
        ]}
      />

      <AppDialog
        visible={Boolean(deletingItem)}
        title="Delete room?"
        message={
          deletingItem
            ? `Remove “${deletingItem.name || 'Room scan'}” and its linked 3D export from your account? This can’t be undone.`
            : undefined
        }
        icon="trash-outline"
        variant="danger"
        dismissOnBackdrop={!deleteSaving}
        onRequestClose={cancelDelete}
        actions={[
          {
            label: 'Cancel',
            tone: 'ghost',
            onPress: cancelDelete,
          },
          {
            label: deleteSaving ? 'Deleting…' : 'Delete',
            tone: 'danger',
            onPress: () => {
              if (!deleteSaving) void performDelete();
            },
          },
        ]}
      />

      <AppDialog
        visible={Boolean(pendingBulkDeleteIds?.length)}
        title={
          pendingBulkDeleteIds?.length === 1
            ? 'Delete room?'
            : `Delete ${pendingBulkDeleteIds?.length ?? 0} rooms?`
        }
        message={
          pendingBulkDeleteIds?.length === 1
            ? 'Remove this scan and its linked 3D export from your account? This can’t be undone.'
            : `These ${pendingBulkDeleteIds?.length ?? 0} scans and any linked 3D exports will be permanently removed. This can’t be undone.`
        }
        icon="trash-outline"
        variant="danger"
        dismissOnBackdrop={!bulkDeleteSaving}
        onRequestClose={() => {
          if (!bulkDeleteSaving) setPendingBulkDeleteIds(null);
        }}
        actions={[
          {
            label: 'Cancel',
            tone: 'ghost',
            onPress: () => {
              if (!bulkDeleteSaving) setPendingBulkDeleteIds(null);
            },
          },
          {
            label: bulkDeleteSaving ? 'Deleting…' : 'Delete',
            tone: 'danger',
            onPress: () => {
              if (!bulkDeleteSaving) void performBulkDelete();
            },
          },
        ]}
      />

      <AppDialog
        visible={Boolean(deleteErrorDialog)}
        title="Delete failed"
        message={deleteErrorDialog || undefined}
        icon="alert-circle-outline"
        variant="danger"
        onRequestClose={() => setDeleteErrorDialog(null)}
        actions={[
          {
            label: 'OK',
            tone: 'primary',
            onPress: () => setDeleteErrorDialog(null),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  checkbox: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  deleteSelectedBtn: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSelectedDisabled: {
    opacity: 0.45,
  },
  deleteSelectedLabel: {
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  subtitle: {
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  countLabel: {
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  loadingWrap: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
  },
  errorWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimensionPill: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 22,
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  renameCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  renameTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  renameHint: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  renameActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  renameActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
