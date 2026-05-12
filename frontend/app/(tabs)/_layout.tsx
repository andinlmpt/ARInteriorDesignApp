import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { radii, spacing } from '@/components/ui/theme';

// Helper function to convert hex color to rgba with opacity
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfacePrimary,
          borderTopWidth: 0,
          height: 64 + (Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10), // Base height + safe area
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10,

          paddingTop: spacing.sm,
          elevation: 8,
          ...(Platform.OS === 'web'
            ? { boxShadow: isDark ? '0px -2px 8px rgba(0, 0, 0, 0.3)' : '0px -2px 8px rgba(0, 0, 0, 0.05)' }
            : { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 8 }
          ),
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: spacing.xs - 2,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginTop: spacing.xs,
        },
        tabBarItemStyle: {
          paddingVertical: spacing.xs,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: hexToRgba(colors.accent, 0.1) }] : null}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused, size }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: hexToRgba(colors.accent, 0.1) }] : null}>
              <Ionicons
                name={focused ? 'search' : 'search-outline'}
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'AR View',
          tabBarIcon: ({ color, focused, size }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: hexToRgba(colors.accent, 0.1) }] : null}>
              <Ionicons
                name={focused ? 'cube' : 'cube-outline'}
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, focused, size }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: hexToRgba(colors.accent, 0.1) }] : null}>
              <Ionicons
                name={focused ? 'bookmark' : 'bookmark-outline'}
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused, size }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: hexToRgba(colors.accent, 0.1) }] : null}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    borderRadius: radii.sm,
    padding: spacing.xs,
    marginTop: -spacing.xs,
  },
});
