/**
 * Product card for the Home catalog grid.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { BRAND } from '@/constants/branding';
import type { HomeProduct } from '@/types/home-product';

interface ProductCardProps {
  product: HomeProduct;
  width: number;
  isSaved?: boolean;
  saving?: boolean;
  onPress: (product: HomeProduct) => void;
  onToggleSave?: (product: HomeProduct) => void;
}

export function ProductCard({
  product,
  width,
  isSaved = false,
  saving = false,
  onPress,
  onToggleSave,
}: ProductCardProps) {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [product.id, product.thumbnailUrl]);

  const showImage = Boolean(product.thumbnailUrl) && !imageFailed;

  return (
    <Pressable
      onPress={() => onPress(product)}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: colors.surfacePrimary,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.dimensionLabel}`}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceSecondary }]}>
        {showImage ? (
          <Image
            source={{ uri: product.thumbnailUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
        )}

        {onToggleSave ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              if (!saving) onToggleSave(product);
            }}
            hitSlop={8}
            style={[
              styles.heartBtn,
              { backgroundColor: colors.surfacePrimary },
              saving && styles.heartBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save item'}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={18}
              color={isSaved ? BRAND.colors.orange : colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText
          variant="body"
          weight="600"
          numberOfLines={2}
          style={[styles.name, { color: colors.textPrimary }]}
        >
          {product.name}
        </AppText>
        <AppText
          variant="caption"
          numberOfLines={2}
          style={[styles.dims, { color: colors.textSecondary }]}
        >
          {product.dimensionLabel}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnDisabled: {
    opacity: 0.55,
  },
  body: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
    minHeight: 64,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
  },
  dims: {
    fontSize: 11,
    lineHeight: 15,
  },
});
