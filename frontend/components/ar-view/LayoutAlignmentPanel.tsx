import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';
import type { LayoutAlignmentError, LayoutAlignmentPayload } from '@/types/unity-bridge';

interface LayoutAlignmentPanelProps {
  alignment: LayoutAlignmentPayload;
  planWidth?: number;
  planLength?: number;
  onMarkCorner: () => void;
  onUndo: () => void;
  onBack: () => void;
}

const ERROR_COPY: Record<Exclude<LayoutAlignmentError, ''>, string> = {
  noFloor: 'No floor under the dot yet. Move your phone slowly over the floor.',
  tooClose: 'Those corners are too close. Pick the far end of the same wall.',
  noRoom: 'The room is still loading. Try again in a moment.',
};

function formatMeters(value?: number): string {
  return value && value > 0 ? `${value.toFixed(2)} m` : '—';
}

export function LayoutAlignmentPanel({
  alignment,
  planWidth,
  planLength,
  onMarkCorner,
  onUndo,
  onBack,
}: LayoutAlignmentPanelProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const secondCorner = alignment.step === 1;
  const canMark = alignment.floorDetected;
  const errorText = alignment.error ? ERROR_COPY[alignment.error] : null;

  const title = secondCorner ? 'Now the other corner' : 'Line up the layout with your room';
  const body = secondCorner
    ? 'Aim the dot at the other end of the same wall, where it meets the floor.'
    : 'Stand inside the room. Aim the dot at a floor corner where two walls meet, then tap Mark corner.';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + spacing.md, backgroundColor: colors.surfacePrimary }]}
        onPress={onBack}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>

      <View
        style={[
          styles.card,
          { bottom: insets.bottom + spacing.lg, backgroundColor: colors.surfacePrimary },
        ]}
      >
        <View style={styles.stepRow}>
          {[0, 1].map((index) => (
            <View
              key={index}
              style={[
                styles.stepDot,
                { backgroundColor: index <= alignment.step ? colors.accent : colors.border },
              ]}
            />
          ))}
          <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
            Corner {alignment.step + 1} of 2
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>

        {planWidth && planLength ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Your plan is {planWidth.toFixed(1)} × {planLength.toFixed(1)} m. Any wall works.
          </Text>
        ) : null}

        {secondCorner && alignment.floorDetected ? (
          <View style={[styles.liveChip, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="resize-outline" size={16} color={colors.accent} />
            <Text style={[styles.liveText, { color: colors.textPrimary }]}>
              Wall so far: {formatMeters(alignment.measuredM)}
            </Text>
          </View>
        ) : null}

        {!alignment.floorDetected ? (
          <View style={styles.floorRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.floorText, { color: colors.textSecondary }]}>
              Looking for the floor. Move your phone slowly.
            </Text>
          </View>
        ) : null}

        {errorText ? (
          <Text style={[styles.error, { color: colors.danger }]}>{errorText}</Text>
        ) : null}

        <View style={styles.actions}>
          {secondCorner ? (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.outline }]}
              onPress={onUndo}
              accessibilityLabel="Undo first corner"
            >
              <Ionicons name="arrow-undo-outline" size={18} color={colors.textPrimary} />
              <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>Undo</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.accent, opacity: canMark ? 1 : 0.45 },
            ]}
            onPress={onMarkCorner}
            disabled={!canMark}
            accessibilityLabel={secondCorner ? 'Mark second corner' : 'Mark first corner'}
          >
            <Ionicons name="locate-outline" size={18} color={colors.background} />
            <Text style={[styles.primaryText, { color: colors.background }]}>Mark corner</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  stepLabel: {
    marginLeft: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    marginTop: spacing.sm,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  liveText: {
    marginLeft: spacing.xs,
    fontSize: 13,
    fontWeight: '600',
  },
  floorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  floorText: {
    marginLeft: spacing.sm,
    fontSize: 13,
    flexShrink: 1,
  },
  error: {
    marginTop: spacing.sm,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginRight: spacing.sm,
  },
  secondaryText: {
    marginLeft: spacing.xs,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
  },
  primaryText: {
    marginLeft: spacing.xs,
    fontSize: 15,
    fontWeight: '700',
  },
});
