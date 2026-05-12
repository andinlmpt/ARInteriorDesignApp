/**
 * App Initialization Utilities
 * Handles app startup tasks like loading cached data, checking auth, etc.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG, STORAGE_KEYS } from '@/config/app.config';

interface AppInitResult {
  isAuthenticated: boolean;
  userData: any | null;
  themePreference: string | null;
}

/**
 * Prepare app by loading critical data
 * This runs before the splash screen is hidden
 */
export async function prepareApp(): Promise<AppInitResult> {
  try {
    // Load critical app data in parallel
    const [authToken, userDataStr, themePreference] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE),
      // Minimum splash time for better UX
      new Promise(resolve => setTimeout(resolve, APP_CONFIG.MIN_SPLASH_TIME)),
    ]);

    // Parse user data
    let userData = null;
    if (userDataStr) {
      try {
        userData = JSON.parse(userDataStr);
      } catch (e) {
        console.warn('Failed to parse user data:', e);
      }
    }

    // Return initialization result
    return {
      isAuthenticated: !!authToken,
      userData,
      themePreference,
    };
  } catch (error) {
    console.error('Error preparing app:', error);
    // Return safe defaults on error
    return {
      isAuthenticated: false,
      userData: null,
      themePreference: null,
    };
  }
}

/**
 * Handle font loading errors gracefully
 */
export function handleFontError(error: Error | null): void {
  if (error) {
    console.warn('Fonts failed to load, continuing with system fonts:', error);
    // TODO: Log to analytics/error tracking service
  }
}

/**
 * Clear all app data (useful for logout or reset)
 */
export async function clearAppData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    console.log('App data cleared successfully');
  } catch (error) {
    console.error('Error clearing app data:', error);
  }
}

/**
 * Check if onboarding has been completed
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    return completed === 'true';
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
}

/**
 * Mark onboarding as completed
 */
export async function setOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
  } catch (error) {
    console.error('Error setting onboarding status:', error);
  }
}

