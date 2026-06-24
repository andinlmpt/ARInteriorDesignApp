import { useEffect, useState } from 'react';
import { useRouter, Redirect } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '@/components/ui/theme';

/**
 * Home Screen
 * Acts as a redirect/landing screen that routes to the main app
 */
export default function Home() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    // Small delay for smooth transition, then redirect to tabs
    const timer = setTimeout(() => {
      setIsRedirecting(false);
      // @ts-ignore - Navigate to tabs (Expo Router typing issue)
      router.replace('/(tabs)');
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  if (isRedirecting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Redirect will happen via router.replace above
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfacePrimary,
  },
});
