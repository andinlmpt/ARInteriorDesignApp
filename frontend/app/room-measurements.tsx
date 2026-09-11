import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
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

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: hexToRgba(colors.accent, 0.12) }]}>
        <Ionicons name="scan-outline" size={40} color={colors.accent} />
      </View>
      <AppText variant="h3" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        No room scans yet
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.emptyBody}>
        Scan a room in Unity ARDesignScene and save the measurement. Saved scans appear here
        when the backend is running.
      </AppText>
      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: colors.accent }]}
        onPress={() => router.push('/ar-view')}
        activeOpacity={0.85}
      >
        <Ionicons name="logo-unity" size={18} color="#FFFFFF" />
        <AppText variant="subtitle" style={styles.ctaText}>
          Unity AR instructions
        </AppText>
      </TouchableOpacity>
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
          <View style={styles.headerSpacer} />
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
  content: {
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  subtitle: {
    marginBottom: spacing.xs,
  },
  countLabel: {
    marginBottom: spacing.xs,
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
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
