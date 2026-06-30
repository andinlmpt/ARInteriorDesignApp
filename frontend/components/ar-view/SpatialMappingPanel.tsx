import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import { useSpatialMappingScan } from '@/hooks/useSpatialMappingScan';

const PREVIEW_SIZE = 260;
const WORLD_SPAN = 10; // meters
const PREVIEW_SCALE = PREVIEW_SIZE / WORLD_SPAN;

const clamp = (v: number) => Math.max(0, Math.min(PREVIEW_SIZE - 1, v));
function project(x: number, z: number) {
  return {
    px: clamp(PREVIEW_SIZE / 2 + x * PREVIEW_SCALE),
    pz: clamp(PREVIEW_SIZE / 2 + z * PREVIEW_SCALE),
  };
}

function Dot({ px, pz, size = 3, color = '#38bdf8', opacity = 0.85 }: { px: number; pz: number; size?: number; color?: string; opacity?: number }) {
  return (
    <View style={{ position: 'absolute', left: px - size / 2, top: pz - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />
  );
}

function StateBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <AppText style={[styles.badgeLabel, { color }]}>{label}</AppText>
      <AppText style={styles.badgeValue}>{value}</AppText>
    </View>
  );
}

interface SpatialMappingPanelProps {
  visible?: boolean;
  onClose?: () => void;
}

export function SpatialMappingPanel({ visible = true, onClose }: SpatialMappingPanelProps) {
  const {
    isScanning,
    scanComplete,
    scanProgress,
    currentStage,
    scanStats,
    error,
    scanResult,
    startScan,
    resetScan,
  } = useSpatialMappingScan();

  const handleToggle = useCallback(() => {
    if (isScanning) {
      resetScan();
    } else {
      startScan(); // Pass an imageUri if required by your implementation, or it defaults to placeholder
    }
  }, [isScanning, startScan, resetScan]);

  const gridDots = useMemo(() => {
    const dots: React.ReactNode[] = [];
    const step = PREVIEW_SCALE;
    for (let gx = 0; gx <= WORLD_SPAN; gx++) {
      for (let gz = 0; gz <= WORLD_SPAN; gz++) {
        dots.push(
          <View key={`g-${gx}-${gz}`} style={{ position: 'absolute', left: gx * step - 0.5, top: gz * step - 0.5, width: 1, height: 1, backgroundColor: '#1e3a5f' }} />
        );
      }
    }
    return dots;
  }, []);

  const planesDots = useMemo(() => {
    if (!scanResult?.planes) return null;
    const dots: React.ReactNode[] = [];
    scanResult.planes.forEach((plane, i) => {
      plane.points.forEach((pt, j) => {
        const { px, pz } = project(pt.x, pt.z);
        const color = plane.type === 'horizontal' ? '#38bdf8' : '#f43f5e';
        dots.push(<Dot key={`p-${i}-${j}`} px={px} pz={pz} size={3} color={color} opacity={0.7} />);
      });
    });
    return dots;
  }, [scanResult]);

  const obstaclesDots = useMemo(() => {
    if (!scanResult?.roomData?.obstacles) return null;
    const dots: React.ReactNode[] = [];
    scanResult.roomData.obstacles.forEach((obs, i) => {
      const { px, pz } = project(obs.coordinates.x, obs.coordinates.z);
      dots.push(<Dot key={`o-${i}`} px={px} pz={pz} size={5} color="#eab308" opacity={0.9} />);
    });
    return dots;
  }, [scanResult]);

  if (!visible) return null;

  const trackingColor = isScanning ? colors.warning : (scanComplete ? colors.success : colors.textSecondary);
  const mappingColor = isScanning ? colors.success : (scanComplete ? colors.success : colors.danger);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="scan-outline" size={20} color={colors.accent} />
          <AppText style={styles.title}>Room Scanner</AppText>
        </View>
        <View style={styles.headerRight}>
          <AppText style={styles.fps}>{isScanning ? 'SCANNING' : (scanComplete ? 'READY' : 'IDLE')}</AppText>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.badgeRow}>
          <StateBadge label="Status" value={isScanning ? 'ACTIVE' : (scanComplete ? 'DONE' : 'IDLE')} color={trackingColor} />
          <StateBadge label="Confidence" value={`${Math.round(scanStats.confidence * 100)}%`} color={mappingColor} />
        </View>

        <View style={styles.previewContainer}>
          <View style={styles.svgCanvas}>
            {gridDots}
            {planesDots}
            {obstaclesDots}
            <Dot px={PREVIEW_SIZE / 2} pz={PREVIEW_SIZE / 2} size={8} color="#3b82f6" opacity={0.95} />
            <AppText style={styles.canvasLabel}>SPATIAL MAP</AppText>
          </View>
          {isScanning && <View style={styles.recordingDot} />}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <AppText style={styles.statValue}>{scanStats.planesDetected}</AppText>
            <AppText style={styles.statLabel}>Planes</AppText>
          </View>
          <View style={styles.statItem}>
            <AppText style={styles.statValue}>{scanStats.obstaclesFound}</AppText>
            <AppText style={styles.statLabel}>Obstacles</AppText>
          </View>
          <View style={styles.statItem}>
            <AppText style={styles.statValue}>{isScanning ? `${scanProgress.toFixed(0)}%` : (scanComplete ? '100%' : '0%')}</AppText>
            <AppText style={styles.statLabel}>Progress</AppText>
          </View>
          <View style={styles.statItem}>
            <AppText style={styles.statValue}>{(scanStats.processingTime / 1000).toFixed(1)}s</AppText>
            <AppText style={styles.statLabel}>Time</AppText>
          </View>
        </View>

        <View style={styles.helpBox}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <AppText style={styles.helpText}>
            {isScanning 
              ? `Scanning... ${currentStage.message}`
              : (scanComplete ? "Scan complete. You can now place furniture in the mapped room." : "Press Start to begin analyzing the room layout and dimensions.")}
          </AppText>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <AppText style={styles.errorText}>{error}</AppText>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.toggleBtn, isScanning ? styles.toggleBtnStop : styles.toggleBtnStart]}
          onPress={handleToggle}
        >
          {isScanning ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name={scanComplete ? 'refresh-circle' : 'play-circle'} size={22} color="#fff" />}
          <AppText style={styles.toggleBtnText}>
            {isScanning ? 'Cancel Scan' : (scanComplete ? 'Rescan Room' : 'Start Scanning')}
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10, 15, 30, 0.97)', borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, maxHeight: 680, ...shadows.lg, borderTopWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(59,130,246,0.12)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.3 },
  fps: { fontSize: 12, color: colors.accent, fontWeight: '600', fontVariant: ['tabular-nums'] },
  closeBtn: { padding: spacing.xs },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  badge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1 },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  badgeValue: { fontSize: 9, color: colors.textSecondary, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  previewContainer: { alignItems: 'center', position: 'relative' },
  svgCanvas: { width: PREVIEW_SIZE, height: PREVIEW_SIZE, backgroundColor: 'rgba(8,14,28,0.95)', borderRadius: radii.md, overflow: 'hidden' },
  canvasLabel: { position: 'absolute', top: 6, left: 8, fontSize: 9, color: '#475569', fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  recordingDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, shadowColor: colors.danger, shadowOpacity: 0.8, shadowRadius: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: radii.md, padding: spacing.md },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  helpBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: radii.sm, padding: spacing.sm, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' },
  helpText: { flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: radii.sm, padding: spacing.sm, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  errorText: { flex: 1, fontSize: 11, color: colors.danger, lineHeight: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(59,130,246,0.12)' },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radii.md, ...shadows.md },
  toggleBtnStart: { backgroundColor: '#2563eb' },
  toggleBtnStop: { backgroundColor: '#dc2626' },
  toggleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
});
