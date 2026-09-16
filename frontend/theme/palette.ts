/**
 * Interior Design App — official color palette
 * Derived from Maharlika logo: Deep Navy + Warm Peach + White
 */

export const lightPalette = {
  background: '#FFFFFF',       // Pure White
  surfacePrimary: '#FFFFFF',   // Cards / elevated surfaces
  surfaceSecondary: '#F4F6FA', // Soft navy-tinted fill
  surfaceTertiary: '#E8ECF3',  // Subtle fills / chips
  accent: '#0C295F',           // Deep Navy — primary brand / CTAs
  accentLight: '#E69868',      // Warm Peach — secondary accent
  accentDark: '#081E47',       // Darker navy — pressed / strong CTA
  accentSoft: '#FDF0E8',       // Soft peach tint — chips, icon pills
  success: '#2F6B4F',
  warning: '#E69868',          // Peach doubles as warm warning
  danger: '#C45C4A',
  textPrimary: '#142338',      // Navy-tinted ink — readable body + brand feel
  textSecondary: '#5A6B85',
  textMuted: '#8A96A8',
  border: '#E8ECF3',
  outline: '#D0D7E4',
  overlay: 'rgba(12, 41, 95, 0.72)',
  gradientStart: '#0C295F',
  gradientEnd: '#E69868',
  // Home screen & legacy keys
  card: '#FFFFFF',
  hover: '#F4F6FA',
  line: '#E8ECF3',
  primary: '#0C295F',
  secondary: '#5A6B85',
  muted: '#8A96A8',
  green: '#2F6B4F',
  orange: '#E69868',
  pink: '#E69868',
  purple: '#0C295F',
} as const;

/** Dark mode — navy-anchored surfaces with peach accents for contrast */
export const darkPalette = {
  background: '#081628',
  surfacePrimary: '#0F2138',
  surfaceSecondary: '#081628',
  surfaceTertiary: '#1A2F4A',
  accent: '#E69868',           // Peach reads clearly on dark navy
  accentLight: '#F0B088',
  accentDark: '#0C295F',
  accentSoft: '#E6986822',
  success: '#4C9B72',
  warning: '#E69868',
  danger: '#E07A6A',
  textPrimary: '#FFFFFF',
  textSecondary: '#B8C4D6',
  textMuted: '#8494AB',
  border: '#1F3350',
  outline: '#2A4160',
  overlay: 'rgba(0, 0, 0, 0.82)',
  gradientStart: '#0C295F',
  gradientEnd: '#E69868',
  card: '#0F2138',
  hover: '#1A2F4A',
  line: '#1F3350',
  primary: '#FFFFFF',
  secondary: '#B8C4D6',
  muted: '#8494AB',
  green: '#4C9B72',
  orange: '#E69868',
  pink: '#F0B088',
  purple: '#5B8FD4',
} as const;

export type AppPalette = typeof lightPalette;

export const lightColors = lightPalette;
export const darkColors = darkPalette;
