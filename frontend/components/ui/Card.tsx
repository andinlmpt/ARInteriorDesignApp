import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing, shadows } from './theme';

interface CardProps extends ViewProps {
  padding?: keyof typeof spacing;
  tone?: 'default' | 'soft' | 'elevated';
  footer?: React.ReactNode;
  header?: React.ReactNode;
}

export const Card: React.FC<React.PropsWithChildren<CardProps>> = ({
  padding = 'xl',
  tone = 'default',
  children,
  footer,
  header,
  style,
  ...rest
}) => {
  const { colors } = useTheme();

  const toneMap = {
    default: {
      background: colors.surfacePrimary,
      border: colors.outline,
    },
    soft: {
      background: colors.surfaceSecondary,
      border: colors.outline,
    },
    elevated: {
      background: colors.surfacePrimary,
      border: 'transparent',
    },
  };

  const toneStyle = toneMap[tone];

  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          padding: spacing[padding],
          backgroundColor: toneStyle.background,
          borderColor: toneStyle.border,
        },
        tone === 'elevated' ? shadows.card : null,
        style,
      ]}
    >
      {header && <View style={[styles.section, styles.header, { borderBottomColor: colors.outline }]}>{header}</View>}
      <View style={styles.section}>{children}</View>
      {footer && <View style={[styles.section, styles.footer, { borderTopColor: colors.outline }]}>{footer}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radii.lg,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  section: {
    gap: spacing.sm,
  },
  header: {
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default Card;

