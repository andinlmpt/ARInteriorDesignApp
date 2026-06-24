/**
 * Root Layout Component
 * Main app layout with navigation stack and initialization logic
 * 
 * Configuration files:
 * - Navigation: @/config/navigation.config.ts
 * - App Config: @/config/app.config.ts
 * - Initialization: @/utils/appInitialization.ts
 */

import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

// Components
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';

// Theme
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Configuration & Utils
import { ALL_SCREENS } from '@/config/navigation.config';
import { APP_CONFIG, CUSTOM_FONTS } from '@/config/app.config';
import { prepareApp, handleFontError } from '@/utils/appInitialization';
import { NotificationService } from '@/services/NotificationService';
import { initErrorTracking } from '@/services/ErrorTrackingService';

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { colors } = useTheme();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded, fontsError] = useFonts(CUSTOM_FONTS);

  useEffect(() => {
    async function initializeApp() {
      try {
        // Initialize error tracking first
        await initErrorTracking();
        
        // Load critical app data
        await prepareApp();
        
        // Authentication state is handled by the app routing
        
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
        // Handle notification received while app is in foreground
        // Notification received - can be used for analytics or UI updates
      },
      (response) => {
        // Handle notification tapped
        const data = response.notification.request.content.data;
        
        // Navigate based on notification type
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
          {/* Dynamically render all screens from config */}
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
