/**
 * Maharlika Furniture logo used across splash, auth, and home screens.
 *
 * The PNG seal includes the navy/orange rings. The `circular` prop only controls
 * an extra white round plate + clip around that seal — keep it false so only the
 * logo’s own rings show.
 */

import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { BRAND_LOGO } from '@/constants/branding';

interface AppLogoProps {
  size?: number;
  /**
   * Extra white circular plate + clip around the seal.
   * Leave false (default) so the navy/orange rings from the logo are the only circle.
   */
  circular?: boolean;
  /** Soft drop shadow (usually paired with circular plate). */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function AppLogo({
  size = 120,
  circular = false,
  elevated = false,
  style,
  imageStyle,
}: AppLogoProps) {
  // Only zoom when filling the extra round plate; otherwise show the full seal.
  const zoom = circular ? 1.52 : 1;
  const imageSize = size * zoom;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
        circular && {
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        },
        elevated && styles.elevated,
        style,
      ]}
    >
      <Image
        source={BRAND_LOGO}
        style={[
          styles.image,
          {
            width: imageSize,
            height: imageSize,
          },
          imageStyle,
        ]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Maharlika Furniture and Home Furnishing logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  image: {
    backgroundColor: 'transparent',
  },
  elevated: {
    shadowColor: '#0C295F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
});
