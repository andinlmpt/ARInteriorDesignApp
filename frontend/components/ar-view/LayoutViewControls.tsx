import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';

interface LayoutViewControlsProps {
  /** Asks the AI for a fresh layout with the same preferences and swaps it in place. */
  onRegenerate?: () => void;
  regenerating?: boolean;
  /** Opens the step 7 final summary (save floor plan + cost). */
  onFinish?: () => void;
  /**
   * A piece overlaps another or runs through a wall: Finish is greyed out and says "Fix first",
   * and a tap calls {@link onFinishBlocked} (to say what to fix) instead of finishing.
   */
  finishBlocked?: boolean;
  onFinishBlocked?: () => void;
  /**
   * Turns the layout 180° onto the opposite wall. Only after lining up by hand: a wall marked
   * with two corners can match either of two equally long walls.
   */
  onTurnAround?: () => void;
  /** Opens the guide to View in AR. */
  onHelp?: () => void;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function LayoutViewControls({
  onRegenerate,
  regenerating = false,
  onFinish,
  finishBlocked = false,
  onFinishBlocked,
  onTurnAround,
  onHelp,
}: LayoutViewControlsProps) {
  const { colors } = useTheme();

  const actions: {
    key: string;
    icon: IoniconName;
    label: string;
    onPress: () => void;
    busy?: boolean;
    blocked?: boolean;
  }[] = [];
  if (onHelp) {
    actions.push({
      key: 'help',
      icon: 'help-circle-outline',
      label: 'Help',
      onPress: onHelp,
    });
  }
  if (onTurnAround) {
    actions.push({
      key: 'turn',
      icon: 'sync-outline',
      label: 'Turn',
      onPress: onTurnAround,
    });
  }
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
    actions.push(finishBlocked
      ? {
          key: 'finish',
          icon: 'alert-circle-outline',
          label: 'Fix first',
          onPress: onFinishBlocked ?? (() => {}),
          blocked: true,
        }
      : {
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
          style={[
            styles.button,
            { backgroundColor: action.blocked ? colors.surfaceSecondary : colors.surfacePrimary },
          ]}
          onPress={action.onPress}
          disabled={action.busy}
          accessibilityLabel={action.blocked ? 'Finish unavailable: fix the overlapping furniture first' : action.label}
          accessibilityState={action.blocked ? { disabled: true } : undefined}
        >
          {action.busy ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name={action.icon} size={20} color={action.blocked ? colors.danger : colors.accent} />
          )}
          <Text style={[styles.label, { color: action.blocked ? colors.textMuted : colors.textPrimary }]}>
            {action.label}
          </Text>
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
