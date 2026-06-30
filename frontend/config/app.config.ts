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
