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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Android often reports insets.bottom as 0 with gesture/3-button nav — keep a floor so labels clear the system bar.
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 0);
  const tabBarContentHeight = 56;
  const tabBarHeight = tabBarContentHeight + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfacePrimary,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: spacing.sm,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: colors.background,
        },
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
          title: 'New',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.plusTab,
                {
                  backgroundColor: focused ? colors.accent : colors.accentDark,
                },
              ]}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Wishlist',
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
  plusTab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
});
