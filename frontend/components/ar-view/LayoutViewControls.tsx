import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';
import type { LayoutViewMode } from '@/types/unity-bridge';

interface LayoutViewControlsProps {
  view: LayoutViewMode;
  onSetView: (view: LayoutViewMode) => void;
  onRealign: () => void;
  onFlip: () => void;
  /** Asks the AI for a fresh layout with the same preferences and swaps it in place. */
  onRegenerate?: () => void;
  regenerating?: boolean;
  /** Opens the step 7 final summary (save floor plan + cost). */
  onFinish?: () => void;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function LayoutViewControls({
  view,
  onSetView,
  onRealign,
  onFlip,
  onRegenerate,
  regenerating = false,
  onFinish,
}: LayoutViewControlsProps) {
  const { colors } = useTheme();
  const isReal = view === 'real';

  const actions: { key: string; icon: IoniconName; label: string; onPress: () => void; busy?: boolean }[] = [
    {
      key: 'view',
      icon: isReal ? 'cube-outline' : 'camera-outline',
      label: isReal ? 'Plan' : 'Real room',
      onPress: () => onSetView(isReal ? 'plan' : 'real'),
    },
    { key: 'realign', icon: 'scan-outline', label: 'Realign', onPress: onRealign },
    { key: 'flip', icon: 'swap-horizontal-outline', label: 'Flip', onPress: onFlip },
  ];
  if (onRegenerate) {
    actions.push({
      key: 'regenerate',
      icon: 'sparkles-outline',
      label: regenerating ? 'Working…' : 'New AI',
      onPress: onRegenerate,
      busy: regenerating,
    });
  }
  if (onFinish) {
    actions.push({
      key: 'finish',
      icon: 'checkmark-done-outline',
      label: 'Finish',
      onPress: onFinish,
    });
  }

  return (
    <View style={styles.column} pointerEvents="box-none">
      {actions.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={[styles.button, { backgroundColor: colors.surfacePrimary }]}
          onPress={action.onPress}
          disabled={action.busy}
          accessibilityLabel={action.label}
        >
          {action.busy ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name={action.icon} size={20} color={colors.accent} />
          )}
          <Text style={[styles.label, { color: colors.textPrimary }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    right: spacing.md,
    top: '34%',
  },
  button: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
});
