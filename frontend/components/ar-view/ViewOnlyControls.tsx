import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';

interface ViewOnlyControlsProps {
  loading: boolean;
  onBack: () => void;
  onHelp: () => void;
  /** Turns the layout onto the opposite wall; only after lining up by hand. */
  onTurnAround?: () => void;
}

/** AR for looking at a saved design: nothing here can change it. */
export function ViewOnlyControls({ loading, onBack, onHelp, onTurnAround }: ViewOnlyControlsProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const top = insets.top + spacing.md;
  const round = [styles.round, { top, backgroundColor: colors.surfacePrimary }];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity style={[round, styles.left]} onPress={onBack} accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity style={[round, styles.right]} onPress={onHelp} accessibilityLabel="How View in AR works">
        <Ionicons name="help-circle-outline" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={[styles.bottom, { bottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        {onTurnAround ? (
          <TouchableOpacity
            style={[styles.pill, styles.turn, { backgroundColor: colors.surfacePrimary }]}
            onPress={onTurnAround}
            accessibilityLabel="Turn the layout around"
          >
            <Ionicons name="sync-outline" size={18} color={colors.accent} />
            <Text style={[styles.pillText, { color: colors.accent }]}>Turn</Text>
          </TouchableOpacity>
        ) : null}
        <View style={[styles.pill, { backgroundColor: colors.surfacePrimary }]}>
          <Text style={[styles.pillText, { color: colors.textPrimary }]}>
            {loading ? 'Placing your design…' : 'Viewing your saved design'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  round: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: {
    left: spacing.lg,
  },
  right: {
    right: spacing.lg,
  },
  bottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turn: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
