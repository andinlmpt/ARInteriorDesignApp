import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/Text';
import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii, shadows } from '@/components/ui/theme';
import { RoomMeasurementService } from '@/services/RoomMeasurementService';
import type { RoomMeasurementRecord } from '@/types/room-measurement';
import {
  formatFloorArea,
  formatRoomDate,
  formatRoomDimensions,
} from '@/utils/roomMeasurementHelpers';
import { getHorizontalPadding } from '@/utils/responsive';

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function RoomMeasurementsScreen() {
  const router = useRouter();
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

  const startNewMeasurement = useCallback(() => {
    router.push({ pathname: '/ar-view', params: { mode: 'measure' } });
  }, [router]);

  const openRename = useCallback((item: RoomMeasurementRecord) => {
    setRenamingItem(item);
    setRenameValue(item.name || 'Room scan');
    setRenameError(null);
  }, []);

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

    return (
      <View
        key={item.id}
        style={[
          styles.card,
          {
            backgroundColor: colors.surfacePrimary,
            borderColor: colors.border,
          },
          shadows.sm,
        ]}
      >
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
            </AppText>
          </View>
          <TouchableOpacity
            onPress={() => openRename(item)}
            hitSlop={8}
            style={[styles.renameBtn, { backgroundColor: hexToRgba(colors.accent, 0.1) }]}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${item.name || 'room scan'}`}
          >
            <Ionicons name="create-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
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
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: getHorizontalPadding(spacing.xl) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <AppText variant="h2" style={[styles.title, { color: colors.textPrimary }]}>
            Room Measurements
          </AppText>
          <TouchableOpacity
            onPress={startNewMeasurement}
            style={[styles.headerAddBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Start new room measurement"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Screen
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: getHorizontalPadding(spacing.xl) },
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
            Saved sizes from your AR room scans
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
  headerSpacer: {
    width: 40,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  renameBtn: {
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
