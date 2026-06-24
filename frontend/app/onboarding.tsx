import { View, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Animated } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: 'Visualize Your Dream Space',
    description: 'Use AR technology to preview furniture and layouts in real time.',
    emoji: '📱',
    color: '#2563EB',
  },
  {
    id: 2,
    title: 'Design Made Easy',
    description: 'Scan your room, generate AI-driven layouts, and customize effortlessly.',
    emoji: '🏠',
    color: '#22C55E',
  },
  {
    id: 3,
    title: 'Save & Share',
    description: 'Export 3D scenes, share with clients, and collaborate in minutes.',
    emoji: '✨',
    color: '#F97316',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const handleNext = async () => {
    if (isNavigating) return;

    if (currentIndex < slides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentIndex + 1),
        animated: true,
      });
    } else {
      // Complete onboarding
      await completeOnboarding();
    }
  };

  const handleSkip = async () => {
    if (isNavigating) return;
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    setIsNavigating(true);
    try {
      // Mark onboarding as completed
      await AsyncStorage.setItem('onboarding_completed', 'true');
      
      // Small delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 300));
      
      router.replace('/login');
    } catch (error) {
      console.warn('[Onboarding] Error saving onboarding state:', error);
      router.replace('/login');
    } finally {
      setIsNavigating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <AppText variant="caption" color="textMuted">
          Skip
        </AppText>
      </TouchableOpacity>

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
            <Animated.View 
              style={[
                styles.emojiContainer, 
                { 
                  borderColor: slide.color,
                  opacity: currentIndex === index ? 1 : 0.6,
                  transform: [{ scale: currentIndex === index ? 1 : 0.9 }],
                }
              ]}
            >
              <AppText variant="h1">{slide.emoji}</AppText>
            </Animated.View>
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
          label={currentIndex === slides.length - 1 ? 'Get started →' : 'Next →'}
          onPress={handleNext}
          disabled={isNavigating}
          loading={isNavigating}
        />
        <View style={styles.helperRow}>
          <AppText variant="caption" color="textMuted">
            Already exploring?
          </AppText>
          <TouchableOpacity onPress={handleSkip} disabled={isNavigating}>
            <AppText variant="caption" color="accent" style={styles.skipLink}>
              Sign in →
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
  skipButton: {
    position: 'absolute',
    top: spacing.xxl,
    right: spacing.xl,
    zIndex: 10,
    padding: spacing.sm,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: getHorizontalPadding(spacing.xl),
    paddingBottom: spacing.xxl * 2,
    gap: spacing.xl,
  },
  emojiContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 4,
  },
  slideContent: {
    gap: spacing.md,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
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
  skipLink: {
    fontWeight: '600',
  },
});
