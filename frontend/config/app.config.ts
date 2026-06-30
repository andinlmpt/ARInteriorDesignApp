/**
 * App Configuration
 * Centralized app-level constants and configuration
 */

// Timing constants
export const APP_CONFIG = {
  MIN_SPLASH_TIME: 500, // Minimum time to show splash screen (ms)
  ANIMATION_DURATION: 300, // Default animation duration (ms)
};

// Storage keys for AsyncStorage
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@auth_token',
  USER_DATA: '@user_data',
  THEME_PREFERENCE: '@theme_preference',
  ONBOARDING_COMPLETED: '@onboarding_completed',
  LAST_SYNC: '@last_sync',
} as const;

// ============================================================
// Font Configuration — Interior Design Typography System
//
// Headings  : Playfair Display (editorial, premium feel)
// Body/UI   : Inter (clean, legible sans-serif)
// ============================================================
export const CUSTOM_FONTS = {
  // ── Inter weights ──────────────────────────────────────────
  'Inter-Regular':
    require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  'Inter-Medium':
    require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  'Inter-SemiBold':
    require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  'Inter-Bold':
    require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),

  // ── Playfair Display weights ────────────────────────────────
  'PlayfairDisplay-Regular':
    require('@expo-google-fonts/playfair-display/400Regular/PlayfairDisplay_400Regular.ttf'),
  'PlayfairDisplay-Medium':
    require('@expo-google-fonts/playfair-display/500Medium/PlayfairDisplay_500Medium.ttf'),
  'PlayfairDisplay-SemiBold':
    require('@expo-google-fonts/playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf'),
  'PlayfairDisplay-Bold':
    require('@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf'),
};

// ── Font family name constants (use these everywhere) ─────────
export const FONTS = {
  // Playfair Display — App Name & Screen Titles (34–40px, 28–32px)
  playfairBold:     'PlayfairDisplay-Bold',
  playfairSemiBold: 'PlayfairDisplay-SemiBold',
  playfairMedium:   'PlayfairDisplay-Medium',
  playfairRegular:  'PlayfairDisplay-Regular',

  // Inter — Section Titles, Body, Caption, Buttons
  interBold:        'Inter-Bold',
  interSemiBold:    'Inter-SemiBold',
  interMedium:      'Inter-Medium',
  interRegular:     'Inter-Regular',
} as const;
