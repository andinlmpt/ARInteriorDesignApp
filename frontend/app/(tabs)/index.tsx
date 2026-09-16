import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Pressable,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { AnimatedButton, FadeInView, SlideInView } from '@/components/interactive';
import { getHorizontalPadding } from '@/utils/responsive';
import { AppLogo } from '@/components/ui/AppLogo';
import { BRAND } from '@/constants/branding';
import { useFurnitureCatalog } from '@/hooks/useFurnitureCatalog';
import { ProductCard } from '@/components/home/ProductCard';
import { ProductDetailSheet } from '@/components/home/ProductDetailSheet';
import { ProductFilterSheet, type ProductFilters } from '@/components/home/ProductFilterSheet';
import {
  HOME_PRODUCT_CATEGORY_CHIPS,
  type HomeProduct,
} from '@/types/home-product';
import { mapHomeCategoryFilter } from '@/utils/furnitureCatalogHelpers';
import { savedItemsService } from '@/services/SavedItemsService';
import { homeProductToSavedItem } from '@/utils/saveItemHelpers';

const DEFAULT_FILTERS: ProductFilters = { category: 'all', savedOnly: false };

const { width } = Dimensions.get('window');
const getCardWidth = () => {
  const horizontalPadding = getHorizontalPadding(24);
  const gap = 12;
  const availableWidth = width - horizontalPadding * 2;
  const cardWidth = (availableWidth - gap) / 2;
  return Math.max(140, Math.min(180, Math.floor(cardWidth)));
};
const CARD_GAP = 12;
const PRODUCT_CARD_W = getCardWidth();

const Button = ({
  children,
  onPress,
  style,
  activeOpacity = 0.7,
  activeScale = 0.96,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  activeOpacity?: number;
  activeScale?: number;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: activeScale, useNativeDriver: true, speed: 50 }),
      Animated.timing(opacity, { toValue: activeOpacity, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={animateIn} onPressOut={animateOut}>
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors: t, isDark, toggleTheme, statusBarStyle } = useTheme();
  const [showTip, setShowTip] = useState(true);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<HomeProduct | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const { products, loading, error, refresh } = useFurnitureCatalog();

  const loadSavedIds = useCallback(async () => {
    try {
      const items = await savedItemsService.getSavedItemsByType('furniture');
      setSavedIds(new Set(items.map((item) => item.id)));
    } catch (err) {
      console.warn('[Home] Failed to load saved furniture:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSavedIds();
    }, [loadSavedIds]),
  );

  useEffect(() => {
    AsyncStorage.getItem('hideTip').then((v) => v === 'true' && setShowTip(false));
  }, []);

  const dismissTip = useCallback(async () => {
    setShowTip(false);
    await AsyncStorage.setItem('hideTip', 'true');
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), loadSavedIds()]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, loadSavedIds]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (filters.category !== 'all' && mapHomeCategoryFilter(p.category) !== filters.category) {
        return false;
      }
      if (filters.savedOnly && !savedIds.has(p.id)) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.dimensionLabel.toLowerCase().includes(q) ||
        p.availableColors.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [products, filters, searchQuery, savedIds]);

  const filtersActive =
    filters.category !== 'all' || filters.savedOnly;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.category !== 'all') {
      const chip = HOME_PRODUCT_CATEGORY_CHIPS.find((c) => c.id === filters.category);
      if (chip) parts.push(chip.label);
    }
    if (filters.savedOnly) parts.push('Saved');
    return parts.join(' · ');
  }, [filters]);

  const handleToggleSave = useCallback(async (product: HomeProduct) => {
    if (savingId) return;
    setSavingId(product.id);
    const currentlySaved = savedIds.has(product.id);

    try {
      if (currentlySaved) {
        await savedItemsService.removeSavedItem(product.id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      } else {
        await savedItemsService.saveItem(homeProductToSavedItem(product));
        setSavedIds((prev) => new Set(prev).add(product.id));
      }
    } catch (err) {
      console.warn('[Home] Failed to toggle save:', err);
      Alert.alert(
        'Couldn’t update saved items',
        'Check that you’re signed in and the backend is running.',
      );
    } finally {
      setSavingId(null);
    }
  }, [savedIds, savingId]);

  const handleViewInAR = useCallback(
    (product: HomeProduct) => {
      setSelectedProduct(null);
      router.push({
        pathname: '/ar-view',
        params: { furniture: product.id },
      });
    },
    [router],
  );

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }
        >
          {/* Header with Branding */}
          <View style={styles.header}>
            <FadeInView delay={100}>
              <View style={styles.brandingSection}>
                <AppLogo size={52} circular={false} elevated={false} style={styles.logoContainer} />
                <View style={styles.brandingText}>
                  <View style={styles.titleRow}>
                    <AppText variant="h2" weight="700" style={[styles.appName, { color: t.textPrimary }]}>
                      {BRAND.name}
                    </AppText>
                    <View style={styles.headerActions}>
                      <Button onPress={toggleTheme} activeScale={0.9}>
                        <View style={[styles.headerBtn, { backgroundColor: t.surfacePrimary }]}>
                          <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={t.textSecondary} />
                        </View>
                      </Button>
                      <Button activeScale={0.9}>
                        <View style={[styles.headerBtn, { backgroundColor: t.surfacePrimary }]}>
                          <Ionicons name="notifications-outline" size={20} color={t.textSecondary} />
                          <View style={[styles.dot, { backgroundColor: t.accent }]} />
                        </View>
                      </Button>
                    </View>
                  </View>
                  <AppText variant="caption" style={[styles.appTagline, { color: t.textSecondary }]}>
                    {BRAND.tagline}
                  </AppText>
                </View>
              </View>
            </FadeInView>
          </View>

          {/* Products from Admin */}
          <View style={styles.productsSection}>
            <View style={styles.sectionRow}>
              <AppText variant="h2" weight="700" style={[styles.sectionTitleInline, { color: t.textPrimary }]}>
                Products
              </AppText>
            </View>

            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchBar,
                  {
                    backgroundColor: t.surfaceSecondary,
                    borderColor: t.border,
                  },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={t.textMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search products…"
                  placeholderTextColor={t.textMuted}
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                  accessibilityLabel="Search products"
                />
                {searchQuery.length > 0 ? (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    hitSlop={8}
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle" size={18} color={t.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={() => setFilterOpen(true)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: filtersActive ? t.accent : t.surfaceSecondary,
                    borderColor: filtersActive ? t.accent : t.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Filter products"
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={filtersActive ? '#FFFFFF' : t.textSecondary}
                />
                {filtersActive ? <View style={[styles.filterDot, { backgroundColor: BRAND.colors.orange }]} /> : null}
              </Pressable>
            </View>

            {filtersActive ? (
              <View style={styles.activeFilterRow}>
                <View style={[styles.activeFilterChip, { backgroundColor: t.accentSoft }]}>
                  <Ionicons name="funnel-outline" size={14} color={t.accent} />
                  <AppText variant="caption" weight="600" style={{ color: t.accent }}>
                    {filterSummary}
                  </AppText>
                </View>
                <Pressable onPress={() => setFilters(DEFAULT_FILTERS)} hitSlop={8}>
                  <AppText variant="caption" weight="600" style={{ color: t.textSecondary }}>
                    Clear
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            {loading && products.length === 0 ? (
              <View style={styles.stateBlock}>
                <ActivityIndicator size="large" color={t.accent} />
                <AppText variant="body" style={{ color: t.textSecondary, marginTop: spacing.md }}>
                  Loading products…
                </AppText>
              </View>
            ) : error && products.length === 0 ? (
              <View style={[styles.stateBlock, { backgroundColor: t.surfacePrimary }]}>
                <Ionicons name="cloud-offline-outline" size={36} color={t.textMuted} />
                <AppText
                  variant="body"
                  weight="600"
                  style={{ color: t.textPrimary, marginTop: spacing.sm, textAlign: 'center' }}
                >
                  Couldn’t load products
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: t.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}
                >
                  {error}
                </AppText>
                <TouchableRetry onPress={() => void refresh()} color={t.accent} />
              </View>
            ) : filteredProducts.length === 0 ? (
              <View style={[styles.stateBlock, { backgroundColor: t.surfacePrimary }]}>
                <Ionicons
                  name={searchQuery.trim() || filtersActive ? 'search-outline' : 'cube-outline'}
                  size={40}
                  color={t.textMuted}
                />
                <AppText
                  variant="body"
                  weight="600"
                  style={{ color: t.textPrimary, marginTop: spacing.sm, textAlign: 'center' }}
                >
                  {searchQuery.trim() || filtersActive ? 'No matching products' : 'No products yet'}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: t.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}
                >
                  {searchQuery.trim() || filtersActive
                    ? 'Try another search or clear your filters.'
                    : 'Add furniture in Admin → Products, then pull to refresh.'}
                </AppText>
              </View>
            ) : (
              <View style={styles.productsGrid}>
                {filteredProducts.map((product, index) => (
                  <View
                    key={product.id}
                    style={[
                      styles.productCell,
                      index % 2 === 0 ? styles.productCellLeft : styles.productCellRight,
                    ]}
                  >
                    <ProductCard
                      product={product}
                      width={PRODUCT_CARD_W}
                      isSaved={savedIds.has(product.id)}
                      saving={savingId === product.id}
                      onPress={setSelectedProduct}
                      onToggleSave={handleToggleSave}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Pro Tip */}
          {showTip && (
            <SlideInView direction="bottom" delay={400}>
              <View style={[styles.tip, { backgroundColor: t.surfacePrimary }]}>
                <View style={[styles.tipIconContainer, { backgroundColor: t.accentSoft }]}>
                  <Ionicons name="bulb-outline" size={22} color={t.accent} />
                </View>
                <View style={styles.tipText}>
                  <AppText variant="subtitle" weight="600" style={[styles.tipTitle, { color: t.textPrimary }]}>
                    Pro Tip
                  </AppText>
                  <AppText variant="body" style={[styles.tipDesc, { color: t.textSecondary }]}>
                    Tap a product for dimensions, save it, or view it in AR
                  </AppText>
                </View>
                <AnimatedButton onPress={dismissTip} hapticType="light">
                  <View style={[styles.tipClose, { backgroundColor: t.surfaceSecondary }]}>
                    <Ionicons name="close" size={16} color={t.textSecondary} />
                  </View>
                </AnimatedButton>
              </View>
            </SlideInView>
          )}
        </ScrollView>
      </SafeAreaView>

      <ProductDetailSheet
        product={selectedProduct}
        visible={!!selectedProduct}
        isSaved={selectedProduct ? savedIds.has(selectedProduct.id) : false}
        saving={selectedProduct ? savingId === selectedProduct.id : false}
        onClose={() => setSelectedProduct(null)}
        onToggleSave={handleToggleSave}
        onViewInAR={handleViewInAR}
      />

      <ProductFilterSheet
        visible={filterOpen}
        value={filters}
        onClose={() => setFilterOpen(false)}
        onApply={setFilters}
      />
    </View>
  );
}

function TouchableRetry({ onPress, color }: { onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.retryBtn, { borderColor: color }]}
      accessibilityRole="button"
      accessibilityLabel="Retry loading products"
    >
      <AppText variant="caption" weight="600" style={{ color }}>
        Retry
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingBottom: spacing.xxl * 3.5,
    paddingTop: spacing.md,
  },

  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  brandingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  logoContainer: {
    marginRight: spacing.xs,
  },
  brandingText: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  appName: {
    fontSize: 20,
    letterSpacing: 0.3,
  },
  appTagline: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  sectionTitleInline: {
    marginBottom: 0,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },

  productsSection: {
    marginBottom: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginHorizontal: spacing.xs,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginHorizontal: spacing.xs,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  productCell: {
    marginBottom: 0,
  },
  productCellLeft: {
    marginRight: CARD_GAP,
  },
  productCellRight: {
    marginRight: 0,
  },
  stateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    minHeight: 160,
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },

  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    gap: spacing.xs,
  },
  tipTitle: {
    marginBottom: spacing.xs,
  },
  tipDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  tipClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
