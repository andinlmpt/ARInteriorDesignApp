import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, shadows } from './theme';
import { AppText } from './Text';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onBackPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  leading,
  trailing,
  onBackPress,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.leading}>
        {onBackPress ? (
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.accentSoft }]} onPress={onBackPress}>
            <AppText color="accent" variant="subtitle">
              ←
            </AppText>
          </TouchableOpacity>
        ) : (
          leading
        )}
      </View>
      <View style={styles.center}>
        <AppText variant="h3">{title}</AppText>
        {subtitle && (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        )}
      </View>
      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: 'transparent',
    minHeight: 60,
  },
  leading: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  trailing: {
    width: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});

export default Header;

