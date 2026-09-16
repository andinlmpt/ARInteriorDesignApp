/**
 * Bottom sheet for a single admin Products catalog item on Home.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
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
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={[styles.imageWrap, { backgroundColor: colors.surfaceSecondary }]}>
              {showImage ? (
                <Image
                  source={{ uri: product.thumbnailUrl }}
                  style={styles.image}
                  resizeMode="cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
              )}
            </View>

            <View style={styles.headerRow}>
              <View style={styles.titleBlock}>
                <AppText variant="h2" weight="700" style={{ color: colors.textPrimary }}>
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

            <View style={[styles.dimCard, { backgroundColor: colors.surfaceSecondary }]}>
              <AppText
                variant="caption"
                weight="600"
                style={[styles.dimLabel, { color: colors.textSecondary }]}
              >
                Dimensions
              </AppText>
              <AppText variant="subtitle" weight="600" style={{ color: colors.textPrimary }}>
                {product.dimensionLabel}
              </AppText>
              <AppText
                variant="caption"
                style={[styles.dimMeta, { color: colors.textMuted }]}
              >
                {meters}
              </AppText>
              {inches ? (
                <AppText
                  variant="caption"
                  style={[styles.dimMeta, { color: colors.textMuted }]}
                >
                  {inches}
                </AppText>
              ) : null}
            </View>

            {product.availableColors.length > 0 ? (
              <View style={styles.colorsBlock}>
                <AppText
                  variant="caption"
                  weight="600"
                  style={[styles.dimLabel, { color: colors.textSecondary }]}
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
                            backgroundColor: c.startsWith('#') ? c : colors.accent,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <AppText variant="caption" style={{ color: colors.textSecondary }}>
                        {c}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {typeof product.quantity === 'number' ? (
              <AppText variant="caption" style={{ color: colors.textMuted, marginTop: spacing.sm }}>
                Stock: {product.quantity}
              </AppText>
            ) : null}
          </ScrollView>

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
                    size={20}
                    color={isSaved ? BRAND.colors.orange : colors.accent}
                  />
                  <AppText
                    variant="subtitle"
                    weight="700"
                    style={{ color: isSaved ? BRAND.colors.orange : colors.accent }}
                  >
                    {isSaved ? 'Saved' : 'Save'}
                  </AppText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cta, styles.ctaPrimary, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
              onPress={() => onViewInAR(product)}
            >
              <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
              <AppText variant="subtitle" weight="700" style={styles.ctaPrimaryText}>
                View in AR
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
    maxHeight: '88%',
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
    marginBottom: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.sm,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  dimLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  dimMeta: {
    marginTop: 2,
  },
  colorsBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  ctaPrimary: {},
  ctaSecondary: {
    borderWidth: 1,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
  },
});
