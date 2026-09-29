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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  /** Optional leading icon in a soft badge. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Visual intent — `danger` uses error red for icon badge (and suits danger actions). */
  variant?: 'default' | 'danger';
  /** Extra content between the message and actions (e.g. a text field). */
  children?: React.ReactNode;
}

export function AppDialog({
  visible,
  title,
  message,
  actions = [{ label: 'OK', onPress: () => {}, tone: 'primary' }],
  onRequestClose,
  dismissOnBackdrop = true,
  icon,
  variant = 'default',
  children,
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

  const iconBadgeBg =
    variant === 'danger' ? `${colors.danger}18` : colors.accentSoft;
  const iconColor = variant === 'danger' ? colors.danger : colors.accent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          {icon ? (
            <View style={[styles.iconBadge, { backgroundColor: iconBadgeBg }]}>
              <Ionicons name={icon} size={28} color={iconColor} />
            </View>
          ) : null}

          <AppText variant="h2" style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </AppText>
          {message ? (
            <AppText variant="body" color="textMuted" style={styles.message}>
              {message}
            </AppText>
          ) : null}

          {children ? <View style={styles.content}>{children}</View> : null}

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
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={[styles.actionLabel, { color: palette.textColor }]}
                  >
                    {action.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
    borderWidth: 0,
    alignItems: 'center',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  content: {
    width: '100%',
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    width: '100%',
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
    paddingHorizontal: spacing.md,
    flex: 1,
  },
  actionBtnFlex: {
    flex: 1,
  },
  actionBtnFull: {
    width: '100%',
    flex: 0,
  },
  actionLabel: {
    fontWeight: '600',
  },
});

export default AppDialog;
