/**
 * Root Layout Component
 * Main app layout with navigation stack and initialization logic
 */

import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

// Google Fonts imports - direct package resolution
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';

// Components
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';

// Theme
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Configuration & Utils
import { ALL_SCREENS } from '@/config/navigation.config';
import { APP_CONFIG } from '@/config/app.config';
import { prepareApp, handleFontError } from '@/utils/appInitialization';
import { NotificationService } from '@/services/NotificationService';
import { initErrorTracking } from '@/services/ErrorTrackingService';

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { colors } = useTheme();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);

  // Load custom fonts using main package exports
  const [fontsLoaded, fontsError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'PlayfairDisplay-Regular': PlayfairDisplay_400Regular,
    'PlayfairDisplay-Medium': PlayfairDisplay_500Medium,
    'PlayfairDisplay-SemiBold': PlayfairDisplay_600SemiBold,
    'PlayfairDisplay-Bold': PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    async function initializeApp() {
      try {
        // Initialize error tracking first
        await initErrorTracking();
        
        // Load critical app data
        await prepareApp();
        
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    }

    // Wait for fonts to load (or fail) before initializing
    if (fontsLoaded !== null) {
      handleFontError(fontsError);
      initializeApp();
    }
  }, [fontsLoaded, fontsError]);

  // Set up notification listeners
  useEffect(() => {
    const cleanup = NotificationService.setupListeners(
      (notification) => {
        // Handle foreground notifications
      },
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'design_recommendation') {
          router.push('/(tabs)');
        } else if (data?.type === 'project_update') {
          router.push('/(tabs)');
        }
      }
    );

    return cleanup;
  }, [router]);

  // Show loading indicator during initialization
  if (fontsLoaded === null || !appReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.surfacePrimary }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={[styles.container, { backgroundColor: colors.surfacePrimary }]}>
        <OfflineBanner />
        <Stack 
          screenOptions={{ 
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: APP_CONFIG.ANIMATION_DURATION,
            contentStyle: { backgroundColor: colors.surfacePrimary },
          }}
        >
          {ALL_SCREENS.map((screen) => (
            <Stack.Screen 
              key={screen.name}
              name={screen.name} 
              options={screen.options} 
            />
          ))}
        </Stack>
      </View>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
