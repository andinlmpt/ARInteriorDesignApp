/**
 * VisionSpace logo mark (the framed cube) used across splash, auth, and home screens.
 *
 * The `circular` prop only adds a white round plate + clip around the mark — keep it
 * false to show the mark on its own.
 */

import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { BRAND_LOGO } from '@/constants/branding';

interface AppLogoProps {
  size?: number;
  /**
   * Extra white circular plate + clip around the mark.
   * Leave false (default) to show the mark on its own.
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
  // Only zoom when filling the extra round plate; otherwise show the whole mark.
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
        accessibilityLabel="VisionSpace logo"
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
