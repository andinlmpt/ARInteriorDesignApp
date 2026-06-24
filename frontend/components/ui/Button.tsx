import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme, ThemeColors } from '@/contexts/ThemeContext';
import { radii, spacing, shadows } from './theme';
import { AppText } from './Text';

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'default' | 'small';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  tone = 'primary',
  size = 'default',
  loading = false,
  disabled,
  iconLeft,
  iconRight,
  style,
  ...rest
}) => {
  const { colors } = useTheme();

  const toneConfig: Record<ButtonTone, { background: string; border: string; text: string; textColorKey: keyof ThemeColors }> = {
    primary: {
      background: colors.accent,
      border: colors.accent,
      text: '#FFFFFF',
      textColorKey: 'surfacePrimary',
    },
    secondary: {
      background: colors.accentSoft,
      border: 'transparent',
      text: colors.accent,
      textColorKey: 'accent',
    },
    ghost: {
      background: 'transparent',
      border: colors.border,
      text: colors.textPrimary,
      textColorKey: 'textPrimary',
    },
    danger: {
      background: colors.danger,
      border: colors.danger,
      text: '#FFFFFF',
      textColorKey: 'surfacePrimary',
    },
  };

  const palette = toneConfig[tone];
  const height = size === 'default' ? 54 : 44;

  return (
    <TouchableOpacity
      {...rest}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          height,
          opacity: disabled ? 0.65 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {iconLeft}
          <AppText
            variant="subtitle"
            color={palette.textColorKey}
            style={{ color: palette.text }}
          >
            {label}
          </AppText>
          {iconRight}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
    ...shadows.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});

export default Button;

