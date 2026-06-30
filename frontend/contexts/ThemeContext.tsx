import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightPalette, darkPalette } from '@/theme/palette';

// Storage key - unified across the app
export const THEME_STORAGE_KEY = 'settings_darkMode';

export const lightColors = lightPalette;
export const darkColors = darkPalette;

export type ThemeColors = typeof lightColors;

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => Promise<void>;
  setDarkMode: (value: boolean) => Promise<void>;
  statusBarStyle: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  // Load theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Check both storage keys for backwards compatibility
        const darkModeSetting = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        const legacyTheme = await AsyncStorage.getItem('theme');
        
        if (darkModeSetting !== null) {
          const shouldBeDark = darkModeSetting === 'true';
          console.log('[ThemeContext] Loading theme from storage:', shouldBeDark ? 'DARK' : 'LIGHT');
          setIsDark(shouldBeDark);
        } else if (legacyTheme !== null) {
          // Migrate from old storage key
          const isDarkMode = legacyTheme === 'dark';
          console.log('[ThemeContext] Loading theme from legacy storage:', isDarkMode ? 'DARK' : 'LIGHT');
          setIsDark(isDarkMode);
          await AsyncStorage.setItem(THEME_STORAGE_KEY, String(isDarkMode));
        } else {
          // Default to light mode if no preference is saved
          console.log('[ThemeContext] No saved theme, defaulting to LIGHT');
          setIsDark(false);
        }
      } catch (error) {
        console.warn('[ThemeContext] Error loading theme:', error);
        // Default to light mode on error
        setIsDark(false);
      }
    };

    loadTheme();
  }, []);

  const setDarkMode = useCallback(async (value: boolean) => {
    try {
      console.log('[ThemeContext] Setting theme to:', value ? 'DARK' : 'LIGHT');
      setIsDark(value);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, String(value));
      // Also update legacy key for backwards compatibility with home screen
      await AsyncStorage.setItem('theme', value ? 'dark' : 'light');
      console.log('[ThemeContext] Theme saved successfully');
    } catch (error) {
      console.error('[ThemeContext] Error saving theme:', error);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    await setDarkMode(!isDark);
  }, [isDark, setDarkMode]);

  const value = useMemo(() => ({
    isDark,
    colors: isDark ? darkColors : lightColors,
    toggleTheme,
    setDarkMode,
    statusBarStyle: isDark ? 'light' as const : 'dark' as const,
  }), [isDark, toggleTheme, setDarkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;


