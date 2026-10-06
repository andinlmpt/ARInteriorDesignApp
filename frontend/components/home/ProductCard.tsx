/**
 * Product card for the Home catalog grid.
 * Expects normalized square thumbnails (see backend normalize-furniture-thumbnails).
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { BRAND } from '@/constants/branding';
import { formatHomeProductCategoryLabel, type HomeProduct } from '@/types/home-product';
import { formatPhp } from '@/utils/designFlowFormat';
import { isOutOfStock } from '@/utils/furnitureCatalogHelpers';

const HEART_OFFSET = 10;
const BODY_MIN_HEIGHT = 88;

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
  const outOfStock = isOutOfStock(product.quantity);

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
          opacity: pressed ? 0.92 : outOfStock ? 0.88 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatHomeProductCategoryLabel(product.category)}${
        product.pricePhp ? `, ${formatPhp(product.pricePhp)}` : ''
      }, ${product.dimensionLabel}${outOfStock ? ', out of stock' : ''}`}
    >
      <View
        style={[
          styles.imageFrame,
          { backgroundColor: colors.surfaceSecondary ?? '#F2F3F7' },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: product.thumbnailUrl }}
            style={[styles.image, outOfStock && styles.imageDimmed]}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
        )}
        {outOfStock ? (
          <View style={styles.lockOverlay} pointerEvents="none">
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
              <AppText variant="caption" weight="700" style={styles.lockBadgeText}>
                Out of stock
              </AppText>
            </View>
          </View>
        ) : null}
      </View>

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

      <View style={styles.body}>
        <AppText
          variant="body"
          weight="600"
          numberOfLines={2}
          style={[styles.name, { color: colors.textPrimary }]}
        >
          {product.name}
        </AppText>
        <View style={styles.metaRow}>
          <View style={[styles.categoryChip, { backgroundColor: colors.accentSoft }]}>
            <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
              {formatHomeProductCategoryLabel(product.category)}
            </AppText>
          </View>
          {product.pricePhp ? (
            <AppText variant="caption" weight="700" style={{ color: colors.textPrimary }}>
              {formatPhp(product.pricePhp)}
            </AppText>
          ) : null}
        </View>
        <AppText
          variant="caption"
          numberOfLines={1}
          style={[styles.dims, { color: outOfStock ? '#DC2626' : colors.textSecondary }]}
        >
          {outOfStock ? 'Out of stock' : product.dimensionLabel}
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
    position: 'relative',
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageDimmed: {
    opacity: 0.45,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(28, 27, 25, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  lockBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  heartBtn: {
    position: 'absolute',
    top: HEART_OFFSET,
    right: HEART_OFFSET,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heartBtnDisabled: {
    opacity: 0.55,
  },
  body: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    minHeight: BODY_MIN_HEIGHT,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
    minHeight: 36,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  dims: {
    fontSize: 11,
    lineHeight: 15,
  },
});
