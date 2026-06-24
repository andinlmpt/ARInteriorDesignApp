import { Platform } from 'react-native';

// Default light colors (for static imports - prefer useTheme() hook for dynamic theming)
export const colors = {
  background: '#F2F2F7',
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  surfaceTertiary: '#F1F5F9',
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentDark: '#2563EB',
  accentSoft: '#DBEAFE',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  outline: '#CBD5E1',
  overlay: 'rgba(15, 23, 42, 0.85)',
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',
};

// Dark mode colors
export const darkColors = {
  background: '#111113',
  surfacePrimary: '#1C1C1F',
  surfaceSecondary: '#111113',
  surfaceTertiary: '#252528',
  accent: '#0A84FF',
  accentLight: '#409CFF',
  accentDark: '#0066CC',
  accentSoft: '#0A84FF20',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  textPrimary: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textMuted: '#8E8E93',
  border: '#38383A',
  outline: '#48484A',
  overlay: 'rgba(0, 0, 0, 0.85)',
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radii = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const typography = {
  family: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  heading1: {
    fontSize: 34,
    fontWeight: '800' as const,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  heading2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  heading3: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
};

// Cross-platform shadow helper
const createShadow = (
  offsetY: number, 
  blur: number, 
  opacity: number, 
  elevation: number
) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${offsetY}px ${blur}px rgba(0, 0, 0, ${opacity})`,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  };
};

export const shadows = {
  sm: createShadow(1, 2, 0.05, 1),
  md: createShadow(2, 8, 0.08, 3),
  lg: createShadow(4, 16, 0.12, 5),
  xl: createShadow(8, 24, 0.15, 8),
  card: createShadow(4, 20, 0.1, 6),
};
