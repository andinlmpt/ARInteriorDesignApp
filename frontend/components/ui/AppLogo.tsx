/**
 * Maharlika Furniture logo used across splash, auth, and home screens.
 */

import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { BRAND_LOGO } from '@/constants/branding';

interface AppLogoProps {
  size?: number;
  /** Clip to a circle and zoom slightly so the square PNG looks round. */
  circular?: boolean;
  /** Soft shadow for auth / splash headers. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function AppLogo({
  size = 120,
  circular = true,
  elevated = false,
  style,
  imageStyle,
}: AppLogoProps) {
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
  },
  image: {
    backgroundColor: 'transparent',
  },
  elevated: {
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
});
