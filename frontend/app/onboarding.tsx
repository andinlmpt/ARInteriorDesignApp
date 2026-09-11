/**
 * First-launch onboarding — Maharlika Furniture.
 * Shown once after splash; then Login / Sign up → Home.
 */

import { View, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { AppLogo } from '@/components/ui/AppLogo';
import { colors, spacing, radii } from '@/components/ui/theme';
import { BRAND } from '@/constants/branding';
import { ONBOARDING_COMPLETED_KEY } from '@/data/authData';
import { getHorizontalPadding } from '@/utils/responsive';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: 'Browse our collection',
    description:
      'Explore sofas, beds, accent chairs, and more from Maharlika Furniture — curated for every room.',
    icon: 'bed-outline' as const,
    color: BRAND.colors.navy,
  },
  {
    id: 2,
    title: 'Visualize in your space',
    description:
      'Scan your room and place furniture with AR so you can see true scale before you buy.',
    icon: 'scan-outline' as const,
    color: BRAND.colors.orange,
  },
  {
    id: 3,
    title: 'Save & get inspired',
    description:
      'Keep room measurements, save favorites, and use AI design ideas to shape your home.',
    icon: 'heart-outline' as const,
    color: BRAND.colors.olive,
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const goToLogin = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      await new Promise((resolve) => setTimeout(resolve, 200));
      router.replace('/login');
    } catch (error) {
      console.warn('[Onboarding] Error finishing:', error);
      router.replace('/login');
    } finally {
      setIsNavigating(false);
    }
  };

  const handleNext = async () => {
    if (isNavigating) return;

    if (currentIndex < slides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentIndex + 1),
        animated: true,
      });
      return;
    }

    await goToLogin();
  };

  const activeColor = slides[currentIndex]?.color ?? BRAND.colors.navy;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <AppLogo size={44} circular />
        <TouchableOpacity style={styles.skipButton} onPress={goToLogin} disabled={isNavigating}>
          <AppText variant="caption" style={styles.skipText}>
            Skip
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {slides.map((slide, index) => (
          <View key={slide.id} style={[styles.slide, { width }]}>
            <View
              style={[
                styles.iconRing,
                {
                  borderColor: slide.color,
                  backgroundColor: `${slide.color}12`,
                  opacity: currentIndex === index ? 1 : 0.7,
                  transform: [{ scale: currentIndex === index ? 1 : 0.94 }],
                },
              ]}
            >
              <Ionicons name={slide.icon} size={56} color={slide.color} />
            </View>
            <View style={styles.slideContent}>
              <AppText variant="h2" style={[styles.title, { color: slide.color }]}>
                {slide.title}
              </AppText>
              <AppText variant="body" color="textSecondary" style={styles.description}>
                {slide.description}
              </AppText>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.pagination}>
        {slides.map((slide, index) => (
          <View
            key={slide.id}
            style={[
              styles.dot,
              currentIndex === index && [styles.activeDot, { backgroundColor: slide.color }],
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          label={currentIndex === slides.length - 1 ? 'Get started' : 'Next'}
          onPress={handleNext}
          disabled={isNavigating}
          loading={isNavigating}
        />
        <View style={styles.helperRow}>
          <AppText variant="caption" color="textMuted">
            Already a customer?
          </AppText>
          <TouchableOpacity onPress={goToLogin} disabled={isNavigating}>
            <AppText variant="caption" style={[styles.signInLink, { color: activeColor }]}>
              Sign in
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfacePrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xxl,
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    gap: spacing.xl,
  },
  iconRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  slideContent: {
    gap: spacing.md,
    maxWidth: 340,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.outline,
  },
  activeDot: {
    width: 26,
    borderRadius: radii.pill,
  },
  footer: {
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    alignItems: 'center',
  },
  signInLink: {
    fontWeight: '700',
  },
});
