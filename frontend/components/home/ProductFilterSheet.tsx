/**
 * Product filter bottom sheet for the Home catalog.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import {
  HOME_PRODUCT_CATEGORY_CHIPS,
  type HomeProductCategoryFilter,
} from '@/types/home-product';

export interface ProductFilters {
  category: HomeProductCategoryFilter;
  savedOnly: boolean;
}

interface ProductFilterSheetProps {
  visible: boolean;
  value: ProductFilters;
  onClose: () => void;
  onApply: (next: ProductFilters) => void;
}

export function ProductFilterSheet({
  visible,
  value,
  onClose,
  onApply,
}: ProductFilterSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ProductFilters>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const reset = () => {
    const cleared: ProductFilters = { category: 'all', savedOnly: false };
    setDraft(cleared);
    onApply(cleared);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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

          <View style={styles.headerRow}>
            <AppText variant="h2" weight="700" style={{ color: colors.textPrimary }}>
              Filter
            </AppText>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityLabel="Close filters"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <AppText
            variant="caption"
            weight="600"
            style={[styles.sectionLabel, { color: colors.textSecondary }]}
          >
            Category
          </AppText>
          <View style={styles.chipWrap}>
            {HOME_PRODUCT_CATEGORY_CHIPS.map((chip) => {
              const selected = draft.category === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setDraft((prev) => ({ ...prev, category: chip.id }))}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.accent : colors.surfaceSecondary,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    weight="600"
                    style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}
                  >
                    {chip.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AppText
            variant="caption"
            weight="600"
            style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}
          >
            More
          </AppText>
          <Pressable
            onPress={() => setDraft((prev) => ({ ...prev, savedOnly: !prev.savedOnly }))}
            style={[
              styles.toggleRow,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: draft.savedOnly ? colors.accent : colors.border,
              },
            ]}
          >
            <View style={styles.toggleText}>
              <AppText variant="body" weight="600" style={{ color: colors.textPrimary }}>
                Wishlist only
              </AppText>
              <AppText variant="caption" style={{ color: colors.textMuted }}>
                Show products you’ve saved
              </AppText>
            </View>
            <Ionicons
              name={draft.savedOnly ? 'checkbox' : 'square-outline'}
              size={24}
              color={draft.savedOnly ? colors.accent : colors.textMuted}
            />
          </Pressable>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.footerBtn,
                styles.resetBtn,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
              onPress={reset}
              activeOpacity={0.85}
            >
              <AppText variant="subtitle" weight="700" style={{ color: colors.textSecondary }}>
                Reset
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerBtn, styles.applyBtn, { backgroundColor: colors.accent }]}
              onPress={apply}
              activeOpacity={0.85}
            >
              <AppText variant="subtitle" weight="700" style={{ color: '#FFFFFF' }}>
                Apply
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
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    minHeight: 52,
  },
  resetBtn: {
    borderWidth: 1,
  },
  applyBtn: {},
});
