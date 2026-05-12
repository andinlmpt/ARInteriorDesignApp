/**
 * Utility to reset theme to light mode
 * Use this if theme gets stuck in dark mode
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_STORAGE_KEY } from '@/contexts/ThemeContext';

export async function resetThemeToLight(): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'false');
    await AsyncStorage.setItem('theme', 'light');
    console.log('[resetTheme] Theme reset to LIGHT mode');
  } catch (error) {
    console.error('[resetTheme] Error resetting theme:', error);
  }
}

export async function getCurrentTheme(): Promise<boolean> {
  try {
    const darkModeSetting = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    const isDark = darkModeSetting === 'true';
    console.log('[getCurrentTheme] Current theme:', isDark ? 'DARK' : 'LIGHT');
    return isDark;
  } catch (error) {
    console.error('[getCurrentTheme] Error getting theme:', error);
    return false; // Default to light
  }
}
