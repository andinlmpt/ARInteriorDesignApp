import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/components/ui/theme';
import { AUTH_USER_STORAGE_KEY } from '@/data/authData';

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Pre-load critical data
        await Promise.all([
          // Check if user has completed onboarding
          AsyncStorage.getItem('onboarding_completed'),
          // Check authentication
          AsyncStorage.getItem(AUTH_USER_STORAGE_KEY),
          // Small delay for smooth experience
          new Promise(resolve => setTimeout(resolve, 1500)),
        ]);
      } catch (error) {
        console.warn('[Splash] Error initializing app:', error);
      } finally {
        setIsReady(true);
      }
    };

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();

    void initializeApp();
  }, [fadeAnim, rotateAnim, scaleAnim]);

  useEffect(() => {
    if (!isReady) return;

    const navigate = async () => {
      // Additional delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const hasOnboarded = await AsyncStorage.getItem('onboarding_completed');
        const isAuthenticated = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);

        if (!hasOnboarded) {
          router.replace('/onboarding');
        } else {
          // Always go to login as requested, even if previously authenticated
          router.replace('/login');
        }
      } catch (error) {
        console.warn('[Splash] Navigation error:', error);
        router.replace('/onboarding');
      }
    };

    void navigate();
  }, [isReady, router]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { rotate },
            ],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <Animated.View style={styles.logoWrapper}>
            <Text style={styles.logoEmoji}>🏠</Text>
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.title}>AR Interior Design</Text>
          <Text style={styles.subtitle}>Transform Your Space</Text>
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
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  logoWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.accent + '30',
  },
  logoEmoji: {
    fontSize: 80,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
