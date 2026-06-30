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

// ============================================================
// Typography System
// Spec (from design screenshot):
//   App Name (34–40px)       → Playfair Display Bold
//   Screen Title (28–32px)   → Playfair Display SemiBold
//   Section Title (20–22px)  → Inter SemiBold
//   Body Text (16px)         → Inter Regular
//   Small Text (14px)        → Inter Regular
//   Caption (12px)           → Inter Regular
//   Button Text (16px)       → Inter Medium
// ============================================================
export const typography = {
  family: {
    playfairBold:     'PlayfairDisplay-Bold',
    playfairSemiBold: 'PlayfairDisplay-SemiBold',
    playfairMedium:   'PlayfairDisplay-Medium',
    playfairRegular:  'PlayfairDisplay-Regular',
    interBold:        'Inter-Bold',
    interSemiBold:    'Inter-SemiBold',
    interMedium:      'Inter-Medium',
    interRegular:     'Inter-Regular',
  },
  // App Name — 34–40px, Playfair Display Bold
  heading1: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  // Screen Title — 28–32px, Playfair Display SemiBold
  heading2: {
    fontFamily: 'PlayfairDisplay-SemiBold',
    fontSize: 30,
    fontWeight: '600' as const,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  // Section Title — 20–22px, Inter SemiBold
  heading3: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 21,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  // Section subtitle / tab labels — Inter SemiBold
  subtitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  // Body Text — 16px, Inter Regular
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  // Small Text — 14px, Inter Regular
  small: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  // Caption — 12px, Inter Regular
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  // Button Text — 16px, Inter Medium
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    fontWeight: '500' as const,
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
