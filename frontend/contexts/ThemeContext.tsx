import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key - unified across the app
export const THEME_STORAGE_KEY = 'settings_darkMode';

// Light theme colors
export const lightColors = {
  background: '#F2F2F7',
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  surfaceTertiary: '#F1F5F9',
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentDark: '#2563EB',
  accentSoft: '#DBEAFE',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  outline: '#CBD5E1',
  overlay: 'rgba(15, 23, 42, 0.85)',
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',
  // Additional colors for home screen compatibility
  card: '#FFFFFF',
  hover: '#E5E5EA',
  line: '#D1D1D6',
  primary: '#000000',
  secondary: '#6E6E73',
  muted: '#AEAEB2',
  green: '#34C759',
  orange: '#FF9500',
  pink: '#FF2D55',
  purple: '#AF52DE',
};

// Dark theme colors
export const darkColors = {
  background: '#111113',
  surfacePrimary: '#1C1C1F',
  surfaceSecondary: '#111113',
  surfaceTertiary: '#252528',
  accent: '#0A84FF',
  accentLight: '#409CFF',
  accentDark: '#0066CC',
  accentSoft: '#0A84FF20',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  textPrimary: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textMuted: '#8E8E93',
  border: '#38383A',
  outline: '#48484A',
  overlay: 'rgba(0, 0, 0, 0.85)',
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',
  // Additional colors for home screen compatibility
  card: '#1C1C1F',
  hover: '#252528',
  line: '#2E2E32',
  primary: '#FFFFFF',
  secondary: '#8E8E93',
  muted: '#48484A',
  green: '#30D158',
  orange: '#FF9F0A',
  pink: '#FF375F',
  purple: '#BF5AF2',
};

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


