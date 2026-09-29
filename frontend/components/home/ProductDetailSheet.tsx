/**
 * Bottom sheet for a single admin Products catalog item on Home.
 * Large image, compact details — fits on one screen without scrolling.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { BRAND } from '@/constants/branding';
import type { HomeProduct } from '@/types/home-product';
import {
  formatHomeProductInches,
  formatHomeProductMeters,
  isOutOfStock,
  resolveAvailableColorHex,
} from '@/utils/furnitureCatalogHelpers';

interface ProductDetailSheetProps {
  product: HomeProduct | null;
  visible: boolean;
  isSaved?: boolean;
  saving?: boolean;
  onClose: () => void;
  onToggleSave: (product: HomeProduct) => void;
  onViewInAR: (product: HomeProduct) => void;
}

function titleCaseCategory(category: string): string {
  if (!category) return 'Other';
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

export function ProductDetailSheet({
  product,
  visible,
  isSaved = false,
  saving = false,
  onClose,
  onToggleSave,
  onViewInAR,
}: ProductDetailSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [imageFailed, setImageFailed] = useState(false);

  if (!product) return null;

  const inches = formatHomeProductInches(product);
  const meters = formatHomeProductMeters(product);
  const showImage = Boolean(product.thumbnailUrl) && !imageFailed;
  const primaryDimension = inches || product.dimensionLabel || meters;
  const secondaryDimension =
    meters && meters.trim().toLowerCase() !== primaryDimension.trim().toLowerCase()
      ? meters
      : null;
  const outOfStock = isOutOfStock(product.quantity);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onShow={() => setImageFailed(false)}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfacePrimary,
              paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={[styles.imageWrap, { backgroundColor: colors.surfaceSecondary }]}>
            {showImage ? (
              <Image
                source={{ uri: product.thumbnailUrl }}
                style={[styles.image, outOfStock && styles.imageDimmed]}
                resizeMode="contain"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Ionicons name="cube-outline" size={56} color={colors.textMuted} />
            )}
            {outOfStock ? (
              <View style={styles.lockOverlay} pointerEvents="none">
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                  <AppText variant="caption" weight="700" style={styles.lockBadgeText}>
                    Out of stock
                  </AppText>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <AppText
                variant="h3"
                weight="700"
                numberOfLines={1}
                style={{ color: colors.textPrimary }}
              >
                {product.name}
              </AppText>
              <View style={[styles.categoryChip, { backgroundColor: colors.accentSoft }]}>
                <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                  {titleCaseCategory(product.category)}
                </AppText>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.detailsCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            {product.availableColors.length > 0 ? (
              <View style={styles.detailBlock}>
                <AppText
                  variant="caption"
                  weight="600"
                  style={[styles.sectionLabel, { color: colors.textSecondary }]}
                >
                  Available colors
                </AppText>
                <View style={styles.colorRow}>
                  {product.availableColors.map((c) => (
                    <View key={c} style={styles.colorItem}>
                      <View
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor: resolveAvailableColorHex(c),
                            borderColor: colors.outline,
                          },
                        ]}
                      />
                      <AppText variant="caption" weight="600" style={{ color: colors.textPrimary }}>
                        {c}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {product.availableColors.length > 0 ? (
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            ) : null}

            <View style={styles.detailBlock}>
              <AppText
                variant="caption"
                weight="600"
                style={[styles.sectionLabel, { color: colors.textSecondary }]}
              >
                Dimensions
              </AppText>
              <AppText variant="body" weight="600" style={{ color: colors.textPrimary }}>
                {primaryDimension}
              </AppText>
              {secondaryDimension ? (
                <AppText variant="caption" style={{ color: colors.textMuted, marginTop: 1 }}>
                  {secondaryDimension}
                </AppText>
              ) : null}
            </View>

            {typeof product.quantity === 'number' ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.stockRow}>
                  <AppText variant="caption" weight="600" style={{ color: colors.textSecondary }}>
                    Stock
                  </AppText>
                  <AppText
                    variant="body"
                    weight="600"
                    style={{ color: outOfStock ? '#DC2626' : colors.textPrimary }}
                  >
                    {outOfStock ? 'Out of stock' : `${product.quantity} available`}
                  </AppText>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.cta,
                styles.ctaSecondary,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.85}
              disabled={saving}
              onPress={() => onToggleSave(product)}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons
                    name={isSaved ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isSaved ? BRAND.colors.orange : colors.accent}
                  />
                  <AppText
                    variant="subtitle"
                    weight="700"
                    style={{ color: isSaved ? BRAND.colors.orange : colors.accent }}
                  >
                    {isSaved ? 'Wishlisted' : 'Wishlist'}
                  </AppText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cta,
                styles.ctaPrimary,
                {
                  backgroundColor: outOfStock ? '#9CA3AF' : colors.accent,
                },
              ]}
              activeOpacity={outOfStock ? 1 : 0.85}
              disabled={outOfStock}
              onPress={() => {
                if (!outOfStock) onViewInAR(product);
              }}
              accessibilityState={{ disabled: outOfStock }}
              accessibilityLabel={outOfStock ? 'Out of stock' : 'View in AR'}
            >
              <Ionicons
                name={outOfStock ? 'lock-closed' : 'scan-outline'}
                size={18}
                color="#FFFFFF"
              />
              <AppText variant="subtitle" weight="700" style={styles.ctaPrimaryText}>
                {outOfStock ? 'Out of stock' : 'View in AR'}
              </AppText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    padding: spacing.md,
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
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 27, 25, 0.82)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  lockBadgeText: {
    color: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCard: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  detailBlock: {
    paddingVertical: 8,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontSize: 11,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: 6,
  },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  ctaPrimary: {},
  ctaSecondary: {
    borderWidth: 1,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
  },
});
