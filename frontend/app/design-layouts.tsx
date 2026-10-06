/**
 * Pick among 2–3 AI-generated top-down layouts.
 * View in 3D uses the existing layout-3d screen.
 * View in AR reopens the measured room and applies the chosen proposal.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';
import { FloorPlanPreview } from '@/components/design-flow/FloorPlanPreview';
import { DesignFlowService, designProposalToLegacy } from '@/services/DesignFlowService';
import { loadDesignGeneration } from '@/utils/designFlowStorage';
import { firstParam, formatPhp } from '@/utils/designFlowFormat';
import { UNITY_AR_EMBED_ENABLED } from '@/config/unity-ar.config';
import type { DesignFlowGenerationResult, DesignProposalV2 } from '@/types/design-flow';

export default function DesignLayoutsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
    projectId?: string | string[];
  }>();
  const { colors, statusBarStyle } = useTheme();
  const sessionId = firstParam(params.sessionId);

  const [result, setResult] = useState<DesignFlowGenerationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stored = await loadDesignGeneration();
      if (stored && (!sessionId || !stored.sessionId || stored.sessionId === sessionId)) {
        setResult(stored);
        return;
      }
      if (sessionId) {
        const remote = await DesignFlowService.getSession(sessionId);
        if (remote.proposals.length > 0) {
          setResult(remote);
          return;
        }
      }
      setError('No generated layouts found. Go back and generate again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load layouts.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canViewAr =
    UNITY_AR_EMBED_ENABLED && (Platform.OS === 'ios' || Platform.OS === 'android');

  const open3d = (proposal: DesignProposalV2) => {
    if (!result) return;
    const legacy = designProposalToLegacy(proposal, result.room, result.preferences.roomType);
    router.push({
      pathname: '/layout-3d',
      params: {
        designId: proposal.id,
        designData: JSON.stringify(legacy),
        roomDimensions: JSON.stringify(result.room),
        budgetPhp: String(result.preferences.budgetPhp || ''),
      },
    });
  };

  const openFinal = (proposal: DesignProposalV2) => {
    if (!result) return;
    router.push({
      pathname: '/design-final',
      params: {
        sessionId: result.sessionId || sessionId || '',
        projectId: result.projectId || firstParam(params.projectId) || '',
        proposalId: proposal.id,
      },
    });
  };

  const openAr = (proposal: DesignProposalV2) => {
    if (!result) return;
    router.push({
      pathname: '/ar-view',
      params: {
        mode: 'measure',
        projectId: result.projectId || firstParam(params.projectId) || '',
        flow: 'design',
        applyLayout: '1',
        proposalId: proposal.id,
        measurementId: result.measurementId || '',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/design-preferences'))}
            style={[styles.backBtn, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <AppText variant="h3" style={{ color: colors.textPrimary, flex: 1 }}>
            Possible arrangements
          </AppText>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : error || !result ? (
          <View style={styles.centered}>
            <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
              {error || 'No layouts to show.'}
            </AppText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <AppText variant="caption" color="textMuted" style={{ marginBottom: spacing.md }}>
              {result.preferences.roomType} · {result.preferences.style} · budget {formatPhp(result.preferences.budgetPhp)}
            </AppText>

            {result.proposals.map((proposal, index) => (
              <View
                key={proposal.id}
                style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <AppText variant="subtitle" style={{ color: colors.textPrimary, flex: 1 }}>
                    {proposal.title || `Layout ${index + 1}`}
                  </AppText>
                  {proposal.overBudget ? (
                    <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                      <AppText variant="caption" style={{ color: '#FFFFFF' }}>Over budget</AppText>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                      <AppText variant="caption" style={{ color: colors.accent }}>
                        Score {proposal.score.overall}
                      </AppText>
                    </View>
                  )}
                </View>

                {proposal.description ? (
                  <AppText variant="caption" color="textMuted" numberOfLines={3} style={{ marginBottom: spacing.sm }}>
                    {proposal.description}
                  </AppText>
                ) : null}

                <FloorPlanPreview
                  widthM={result.room.width}
                  lengthM={result.room.length}
                  items={proposal.items}
                />

                <AppText variant="subtitle" style={{ color: colors.textPrimary, marginTop: spacing.md }}>
                  {formatPhp(proposal.totalPhp)}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {proposal.items.length} pieces · walkways {proposal.score.flow}
                  {proposal.score.relations != null ? ` · grouping ${proposal.score.relations}` : ''}
                  {proposal.score.clearance != null ? ` · access ${proposal.score.clearance}` : ''}
                </AppText>

                <View style={styles.priceList}>
                  {proposal.items.map((line) => (
                    <View key={line.instanceId} style={styles.priceRow}>
                      <AppText variant="caption" style={{ color: colors.textSecondary, flex: 1 }} numberOfLines={1}>
                        {line.displayName}
                      </AppText>
                      <AppText variant="caption" weight="600" style={{ color: colors.textPrimary }}>
                        {formatPhp(line.pricePhp || 0)}
                      </AppText>
                    </View>
                  ))}
                </View>

                {(proposal.pros || []).slice(0, 3).map((pro) => (
                  <View key={pro} style={styles.noteRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <AppText variant="caption" style={{ color: colors.textSecondary, flex: 1 }}>{pro}</AppText>
                  </View>
                ))}
                {(proposal.cons || []).map((con) => (
                  <View key={con} style={styles.noteRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.warning} />
                    <AppText variant="caption" style={{ color: colors.textSecondary, flex: 1 }}>{con}</AppText>
                  </View>
                ))}

                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => openFinal(proposal)}
                    style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Finalize ${proposal.title}`}
                  >
                    <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
                    <AppText variant="body" style={{ color: colors.textPrimary }}>
                      Final design
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => open3d(proposal)}
                    style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${proposal.title} in 3D`}
                  >
                    <Ionicons name="cube-outline" size={18} color="#FFFFFF" />
                    <AppText variant="body" weight="600" style={{ color: '#FFFFFF' }}>
                      View in 3D
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openAr(proposal)}
                    disabled={!canViewAr}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: canViewAr ? colors.surfaceSecondary : colors.surfaceTertiary,
                        borderColor: colors.border,
                        borderWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canViewAr }}
                    accessibilityLabel={canViewAr ? `View ${proposal.title} in AR` : 'View in AR requires the Unity device build'}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={18}
                      color={canViewAr ? colors.textPrimary : colors.textMuted}
                    />
                    <AppText variant="body" style={{ color: canViewAr ? colors.textPrimary : colors.textMuted }}>
                      {canViewAr ? 'View in AR' : 'View in AR (device)'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  priceList: {
    marginTop: spacing.sm,
    gap: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionBtn: {
    minHeight: 46,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
