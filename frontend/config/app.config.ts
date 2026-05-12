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

// Font configuration (add custom fonts here if needed)
export const CUSTOM_FONTS = {
  // Example:
  // 'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  // 'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
};

