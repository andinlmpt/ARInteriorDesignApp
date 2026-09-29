import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { Screen } from '@/components/ui/Screen';
import { AppDialog, type AppDialogAction } from '@/components/ui/AppDialog';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { savedItemsService, type SavedItem } from '@/services/SavedItemsService';
import { FadeInView, SlideInView } from '@/components/interactive';
import { getHorizontalPadding } from '@/utils/responsive';
import { BRAND } from '@/constants/branding';
import { formatArPhotoDisplayName, isArPhotoFileName } from '@/utils/arPhotoNaming';

type DialogState = {
  title: string;
  message: string;
  actions: AppDialogAction[];
};

type PreviewState = {
  uri: string;
  title: string;
  subtitle?: string;
};

function displayTitleForItem(item: SavedItem): string {
  const metaSource = item.metadata?.source;
  if (
    metaSource === 'unity-ar-photo' ||
    item.type === 'design' && isArPhotoFileName(item.name)
  ) {
    return formatArPhotoDisplayName(item.name, item.savedAt);
  }
  return item.name;
}

function typeLabel(type: SavedItem['type']): string {
  switch (type) {
    case 'furniture':
      return 'Product';
    case 'design':
      return 'Design';
    case 'theme':
      return 'Theme';
    case 'project':
      return 'Project';
    default:
      return 'Wishlist';
  }
}

export default function SavedScreen() {
  const { colors, statusBarStyle } = useTheme();
  const router = useRouter();
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const closeDialog = () => setDialog(null);
  const closePreview = () => setPreview(null);

  const showDialog = (title: string, message: string, actions?: AppDialogAction[]) => {
    setDialog({
      title,
      message,
      actions: actions ?? [{ label: 'OK', tone: 'primary', onPress: closeDialog }],
    });
  };

  const toggleMultiSelect = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (itemId: string) => {
    const next = new Set(selectedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelectedItems(next);
  };

  const selectAll = () => setSelectedItems(new Set(savedItems.map((item) => item.id)));
  const deselectAll = () => setSelectedItems(new Set());

  const loadSavedItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = await savedItemsService.getSavedItems();
      setSavedItems(items);
    } catch (error) {
      console.error('[SavedScreen] Failed to load saved items:', error);
      showDialog('Couldn’t load your wishlist', 'Check that you’re signed in and the backend is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const initializeAndLoad = async () => {
        try {
          const { initializeSavedItems } = await import('@/utils/initializeSavedItems');
          await initializeSavedItems();
        } catch (error) {
          console.warn('[SavedScreen] Failed to initialize sample items:', error);
        }
        await loadSavedItems();
      };
      void initializeAndLoad();
    }, [loadSavedItems]),
  );

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) return;

    showDialog(
      'Delete items',
      `Remove ${selectedItems.size} item${selectedItems.size === 1 ? '' : 's'} from your wishlist?`,
      [
        { label: 'Cancel', tone: 'ghost', onPress: closeDialog },
        {
          label: 'Delete',
          tone: 'danger',
          onPress: async () => {
            closeDialog();
            try {
              const idsToDelete = Array.from(selectedItems);
              const deletedCount = await savedItemsService.removeSavedItems(idsToDelete);
              if (deletedCount > 0) {
                await loadSavedItems();
                setSelectedItems(new Set());
                if (idsToDelete.length === savedItems.length) {
                  setMultiSelectMode(false);
                }
              }
            } catch (error) {
              console.error('[SavedScreen] Failed to delete items:', error);
              showDialog('Couldn’t delete', 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleItemPress = (item: SavedItem) => {
    if (multiSelectMode) {
      toggleItemSelection(item.id);
      return;
    }

    if (item.imageUrl) {
      setPreview({
        uri: item.imageUrl,
        title: displayTitleForItem(item),
        subtitle: item.description || typeLabel(item.type),
      });
      return;
    }

    if (item.type === 'project') {
      router.push('/projects');
    } else if (item.type === 'theme') {
      router.push(`/explore?id=${item.id}`);
    } else {
      showDialog(item.name, item.description || item.price || 'Wishlist item');
    }
  };

  const handleUnsaveItem = (itemId: string) => {
    showDialog(
      'Remove item',
      'Remove this from your wishlist?',
      [
        { label: 'Cancel', tone: 'ghost', onPress: closeDialog },
        {
          label: 'Remove',
          tone: 'danger',
          onPress: async () => {
            closeDialog();
            if (removingId) return;
            setRemovingId(itemId);
            try {
              const success = await savedItemsService.removeSavedItem(itemId);
              if (success) await loadSavedItems();
            } catch (error) {
              console.error('[SavedScreen] Failed to unsave item:', error);
              showDialog('Couldn’t remove item', 'Please try again.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surfaceSecondary }]} edges={['top']}>
        <Screen contentContainerStyle={styles.screenContent}>
          <FadeInView delay={80}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <AppText variant="h2" weight="700" style={[styles.title, { color: colors.textPrimary }]}>
                  Wishlist
                </AppText>
                <AppText variant="caption" style={{ color: colors.textSecondary }}>
                  Products and designs you’ve kept
                </AppText>
              </View>
              <Pressable
                onPress={toggleMultiSelect}
                style={[
                  styles.selectBtn,
                  {
                    backgroundColor: multiSelectMode ? colors.accent : colors.surfaceSecondary,
                    borderColor: multiSelectMode ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={multiSelectMode ? 'Cancel selection' : 'Select items'}
              >
                <AppText
                  variant="caption"
                  weight="600"
                  style={{ color: multiSelectMode ? '#FFFFFF' : colors.textSecondary }}
                >
                  {multiSelectMode ? 'Cancel' : 'Select'}
                </AppText>
              </Pressable>
            </View>
          </FadeInView>

          {multiSelectMode ? (
            <View style={[styles.multiSelectToolbar, { borderBottomColor: colors.border }]}>
              <AppText variant="caption" style={{ color: colors.textSecondary }}>
                {selectedItems.size} selected
              </AppText>
              <View style={styles.bulkActions}>
                {selectedItems.size > 0 ? (
                  <TouchableOpacity onPress={deselectAll} hitSlop={8}>
                    <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                      Clear
                    </AppText>
                  </TouchableOpacity>
                ) : null}
                {selectedItems.size < savedItems.length ? (
                  <TouchableOpacity onPress={selectAll} hitSlop={8}>
                    <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                      All
                    </AppText>
                  </TouchableOpacity>
                ) : null}
                {selectedItems.size > 0 ? (
                  <Pressable
                    onPress={handleDeleteSelected}
                    style={[styles.trashBtn, { backgroundColor: colors.accentSoft }]}
                    accessibilityLabel="Delete selected"
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {isLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator size="large" color={colors.accent} />
              <AppText variant="body" style={{ color: colors.textSecondary, marginTop: spacing.md }}>
                Loading your wishlist…
              </AppText>
            </View>
          ) : savedItems.length === 0 ? (
            <View style={styles.stateBlock}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="heart-outline" size={36} color={BRAND.colors.orange} />
              </View>
              <AppText variant="subtitle" weight="600" style={{ color: colors.textPrimary }}>
                Your wishlist is empty
              </AppText>
              <AppText
                variant="body"
                style={{ color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl }}
              >
                Tap the heart on a product to keep it here.
              </AppText>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {savedItems.map((item, index) => {
                const isSelected = selectedItems.has(item.id);
                const iconName = (item.iconName as keyof typeof Ionicons.glyphMap) || 'cube-outline';
                const isRemoving = removingId === item.id;

                return (
                  <SlideInView key={item.id} direction="up" delay={Math.min(index * 40, 240)}>
                    <Pressable
                      onPress={() => handleItemPress(item)}
                      style={[
                        styles.savedCard,
                        {
                          backgroundColor: colors.surfacePrimary,
                          borderColor: isSelected ? colors.accent : colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                    >
                      {multiSelectMode ? (
                        <View
                          style={[
                            styles.checkbox,
                            {
                              backgroundColor: isSelected ? colors.accent : colors.surfacePrimary,
                              borderColor: isSelected ? colors.accent : colors.border,
                            },
                          ]}
                        >
                          {isSelected ? (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          ) : null}
                        </View>
                      ) : null}

                      <View style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]}>
                        {item.imageUrl ? (
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.thumbImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons name={iconName} size={28} color={colors.accent} />
                        )}
                      </View>

                      <View style={styles.itemInfo}>
                        <View style={[styles.typeChip, { backgroundColor: colors.accentSoft }]}>
                          <AppText variant="caption" weight="600" style={{ color: colors.accent, fontSize: 11 }}>
                            {typeLabel(item.type)}
                          </AppText>
                        </View>
                        <AppText
                          variant="body"
                          weight="600"
                          numberOfLines={2}
                          style={{ color: colors.textPrimary }}
                        >
                          {displayTitleForItem(item)}
                        </AppText>
                        {item.description || item.price ? (
                          <AppText
                            variant="caption"
                            numberOfLines={2}
                            style={{ color: colors.textSecondary }}
                          >
                            {item.description || item.price}
                          </AppText>
                        ) : null}
                      </View>

                      {!multiSelectMode ? (
                        <Pressable
                          onPress={() => handleUnsaveItem(item.id)}
                          hitSlop={8}
                          disabled={isRemoving}
                          style={[
                            styles.heartBtn,
                            {
                              backgroundColor: colors.surfacePrimary,
                              opacity: isRemoving ? 0.55 : 1,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Remove from wishlist"
                        >
                          <Ionicons name="heart" size={18} color={BRAND.colors.orange} />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  </SlideInView>
                );
              })}
            </View>
          )}
        </Screen>
      </SafeAreaView>

      <AppDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        actions={dialog?.actions}
        onRequestClose={closeDialog}
      />

      <ImageViewerModal
        visible={Boolean(preview)}
        uri={preview?.uri ?? null}
        title={preview?.title}
        subtitle={preview?.subtitle}
        onClose={closePreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: getHorizontalPadding(24),
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2.5,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    letterSpacing: 0.2,
  },
  selectBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  multiSelectToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsList: {
    gap: spacing.md,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
    minHeight: 64,
    justifyContent: 'center',
  },
  typeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
