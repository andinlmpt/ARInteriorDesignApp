import React from 'react';
import { View, ViewProps, StyleSheet, ScrollView, ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from './theme';

interface ScreenProps extends ViewProps {
  scrollable?: boolean;
  contentContainerStyle?: ViewProps['style'];
  footer?: React.ReactNode;
}

export const Screen: React.FC<React.PropsWithChildren<ScreenProps>> = ({
  scrollable = true,
  children,
  style,
  contentContainerStyle,
  footer,
  ...rest
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (scrollable) {
    return (
      <ScrollView
        {...(rest as ScrollViewProps)}
        style={[styles.base, { backgroundColor: colors.surfaceSecondary }, style]}
        contentContainerStyle={[
          styles.content, 
          {
            paddingBottom: Math.max(spacing.xxl * 2, insets.bottom + spacing.xl),
          },
          contentContainerStyle
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
        {footer && <View style={styles.footer}>{footer}</View>}
      </ScrollView>
    );
  }

  return (
    <View 
      {...rest} 
      style={[
        styles.base, 
        styles.content, 
        { backgroundColor: colors.surfaceSecondary },
        {
          paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg),
        },
        style
      ]}
    >
      {children}
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.xl,
  },
  footer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
});

export default Screen;

