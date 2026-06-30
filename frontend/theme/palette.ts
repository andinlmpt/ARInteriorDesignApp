/**
 * Interior Design App — official color palette
 * Reference: Warm Ivory + Muted Sage + Natural Sand (minimalist interior aesthetic)
 */

export const lightPalette = {
  background: '#FAF9F7',       // Warm Ivory
  surfacePrimary: '#FFFFFF',   // Pure White — cards
  surfaceSecondary: '#F2F1EE', // Soft Linen
  surfaceTertiary: '#E6E4E1',  // Mist Gray — subtle fills
  accent: '#7A8F7B',         // Muted Sage — primary
  accentLight: '#CDB9A6',    // Natural Sand — secondary accent
  accentDark: '#617364',      // Deep Sage — pressed / strong CTA
  accentSoft: '#F0EBE4',      // Sand tint — chips, icon pills
  success: '#6F8B62',         // Moss Green
  warning: '#D7B26A',         // Soft Gold
  danger: '#C77A6A',          // Muted Clay
  textPrimary: '#1F1F1F',     // Soft Black
  textSecondary: '#7A7A78',   // Stone Gray
  textMuted: '#9A9A98',
  border: '#E6E4E1',          // Mist Gray
  outline: '#D4D2CF',
  overlay: 'rgba(31, 31, 31, 0.72)',
  gradientStart: '#7A8F7B',
  gradientEnd: '#617364',
  // Home screen & legacy keys
  card: '#FFFFFF',
  hover: '#F2F1EE',
  line: '#E6E4E1',
  primary: '#1F1F1F',
  secondary: '#7A7A78',
  muted: '#9A9A98',
  green: '#6F8B62',
  orange: '#D7B26A',
  pink: '#CDB9A6',
  purple: '#7A8F7B',
} as const;

/** Warm dark mode — derived from the same sage/linen family */
export const darkPalette = {
  background: '#1C1B19',
  surfacePrimary: '#262422',
  surfaceSecondary: '#1C1B19',
  surfaceTertiary: '#2E2C28',
  accent: '#9AAD9B',
  accentLight: '#CDB9A6',
  accentDark: '#7A8F7B',
  accentSoft: '#9AAD9B18',
  success: '#7FA872',
  warning: '#E0C07E',
  danger: '#D49084',
  textPrimary: '#FAF9F7',
  textSecondary: '#B8B6B2',
  textMuted: '#8A8885',
  border: '#3A3835',
  outline: '#4A4844',
  overlay: 'rgba(0, 0, 0, 0.82)',
  gradientStart: '#9AAD9B',
  gradientEnd: '#617364',
  card: '#262422',
  hover: '#2E2C28',
  line: '#3A3835',
  primary: '#FAF9F7',
  secondary: '#B8B6B2',
  muted: '#8A8885',
  green: '#7FA872',
  orange: '#E0C07E',
  pink: '#CDB9A6',
  purple: '#9AAD9B',
} as const;

export type AppPalette = typeof lightPalette;

export const lightColors = lightPalette;
export const darkColors = darkPalette;
