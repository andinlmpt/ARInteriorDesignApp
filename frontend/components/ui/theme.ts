import { Platform } from 'react-native';
import { lightPalette, darkPalette } from '@/theme/palette';

// Default light colors (for static imports - prefer useTheme() hook for dynamic theming)
export const colors = { ...lightPalette };
export const darkColors = { ...darkPalette };

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
    shadowColor: '#1F1F1F',
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
