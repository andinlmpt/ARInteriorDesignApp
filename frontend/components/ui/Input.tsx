import React from 'react';
import { View, TextInput, TextInputProps, StyleSheet, ViewStyle } from 'react-native';
import { AppText } from './Text';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing, shadows } from './theme';

interface InputProps extends TextInputProps {
  label?: string;
  helper?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helper,
  style,
  containerStyle,
  leftIcon,
  ...rest
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <AppText variant="caption" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      )}
      <View style={styles.inputWrapper}>
        {leftIcon && (
          <View style={styles.iconContainer}>
            {leftIcon}
          </View>
        )}
        <TextInput
          {...rest}
          style={[
            styles.input,
            leftIcon ? styles.inputWithIcon : null,
            {
              borderColor: rest.editable === false ? colors.outline : colors.border,
              backgroundColor: rest.editable === false ? colors.surfaceSecondary : colors.surfacePrimary,
              color: colors.textPrimary,
            },
            style,
          ]}
          placeholderTextColor={colors.textMuted}
        />
      </View>
      {helper && (
        <AppText variant="caption" color="textMuted">
          {helper}
        </AppText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
  },
  iconContainer: {
    position: 'absolute',
    left: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 16,
    ...shadows.sm,
  },
  inputWithIcon: {
    paddingLeft: spacing.lg + 28,
  },
});

export default Input;

