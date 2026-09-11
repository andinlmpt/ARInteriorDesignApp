/**
 * Soft, rounded dialog — replaces raw system Alert.alert styling.
 */

import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { AppText } from '@/components/ui/Text';
import { radii, spacing, shadows } from '@/components/ui/theme';

export type AppDialogTone = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface AppDialogAction {
  label: string;
  onPress: () => void;
  tone?: AppDialogTone;
}

export interface AppDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  actions?: AppDialogAction[];
  onRequestClose?: () => void;
  /** Dismiss when tapping the dimmed backdrop (default true). */
  dismissOnBackdrop?: boolean;
}

export function AppDialog({
  visible,
  title,
  message,
  actions = [{ label: 'OK', onPress: () => {}, tone: 'primary' }],
  onRequestClose,
  dismissOnBackdrop = true,
}: AppDialogProps) {
  const { colors } = useTheme();

  const handleBackdrop = () => {
    if (!dismissOnBackdrop) return;
    onRequestClose?.();
  };

  const toneStyles = (tone: AppDialogTone = 'primary') => {
    switch (tone) {
      case 'danger':
        return {
          backgroundColor: colors.danger,
          textColor: '#FFFFFF',
        };
      case 'secondary':
        return {
          backgroundColor: colors.accentSoft,
          textColor: colors.accent,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          textColor: colors.textSecondary,
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.accent,
          textColor: '#FFFFFF',
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={handleBackdrop}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />
        <View
          style={[
            styles.card,
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
          <AppText variant="h3" style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </AppText>
          {message ? (
            <AppText variant="body" color="textMuted" style={styles.message}>
              {message}
            </AppText>
          ) : null}

          <View
            style={[
              styles.actions,
              actions.length === 1 && styles.actionsSingle,
              actions.length > 2 && styles.actionsStacked,
            ]}
          >
            {actions.map((action) => {
              const palette = toneStyles(action.tone);
              return (
                <TouchableOpacity
                  key={action.label}
                  style={[
                    styles.actionBtn,
                    actions.length === 2 && styles.actionBtnFlex,
                    actions.length > 2 && styles.actionBtnFull,
                    { backgroundColor: palette.backgroundColor },
                  ]}
                  onPress={action.onPress}
                  activeOpacity={0.85}
                >
                  <AppText
                    variant="subtitle"
                    style={[styles.actionLabel, { color: palette.textColor }]}
                  >
                    {action.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radii.lg,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    // No hard stroke — soft elevation only
    borderWidth: 0,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionsSingle: {
    justifyContent: 'center',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  actionBtn: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  actionBtnFlex: {
    flex: 1,
  },
  actionBtnFull: {
    width: '100%',
  },
  actionLabel: {
    fontWeight: '600',
  },
});

export default AppDialog;
