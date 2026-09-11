/**
 * Cold-start splash: logo + tagline (~1.5s), then route into the auth funnel.
 *
 * Flow:
 *   Splash → Onboarding (first launch only) → Login / Sign up → Home
 */

import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/components/ui/theme';
import { AppLogo } from '@/components/ui/AppLogo';
import { BRAND } from '@/constants/branding';
import { ONBOARDING_COMPLETED_KEY } from '@/data/authData';

const SPLASH_DURATION_MS = 1500;

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Promise.all([
          AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY),
          new Promise((resolve) => setTimeout(resolve, SPLASH_DURATION_MS)),
        ]);
      } catch (error) {
        console.warn('[Splash] Error initializing app:', error);
      } finally {
        setIsReady(true);
      }
    };

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    void initializeApp();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    if (!isReady) return;

    const navigate = async () => {
      try {
        const hasOnboarded = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);

        if (hasOnboarded === 'true') {
          router.replace('/login');
        } else {
          router.replace('/onboarding');
        }
      } catch (error) {
        console.warn('[Splash] Navigation error:', error);
        router.replace('/onboarding');
      }
    };

    void navigate();
  }, [isReady, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <AppLogo size={168} circular elevated style={styles.logoContainer} />
        <Animated.View style={[styles.textBlock, { opacity: fadeAnim }]}>
          <Text style={styles.title}>{BRAND.name}</Text>
          <Text style={styles.subtitle}>{BRAND.tagline}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 28,
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: BRAND.colors.navy,
    marginBottom: 8,
    letterSpacing: 0.3,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
    width: '100%',
  },
});
