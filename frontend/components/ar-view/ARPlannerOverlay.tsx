/**
 * Planner-style chrome: top back button, furniture sheet, bottom tool + undo/redo bar.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FurnitureCategory, FurnitureLibraryItem } from '@/types/ar-view';
import { formatDimensionSubtitle, isOutOfStock, canPlaceMore, getRemainingPlacements } from '@/utils/furnitureCatalogHelpers';
import { spacing, radii } from '@/components/ui/theme';

export type PlannerTool = 'place' | 'select' | 'measure';

interface ARPlannerOverlayProps {
  catalogItems: FurnitureLibraryItem[];
  catalogLoading?: boolean;
  catalogError?: string | null;
  roomConfirmed: boolean;
  scanModalOpen?: boolean;
  scanProgress: number;
  scanReady: boolean;
  statusMessage: string;
  selectedCategory: FurnitureCategory | 'all';
  selectedLibraryItem: string | null;
  /** Catalog modelId of the currently selected placed piece in Unity (if any). */
  selectedPlacedModelId?: string | null;
  placedModelIds: string[];
  canUndo: boolean;
  canRedo: boolean;
  activeTool: PlannerTool;
  libraryOpen: boolean;
  onSelectCategory: (category: FurnitureCategory | 'all') => void;
  onSelectItem: (itemId: string) => void;
  onConfirmScan: () => void;
  onRescan: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  onSavePhoto?: () => void;
  savingPhoto?: boolean;
  onRemoveSelected: () => void;
  onSetTool: (tool: PlannerTool) => void;
  onToggleLibrary: () => void;
  onBack: () => void;
  style?: StyleProp<ViewStyle>;
}

export function parseFurniturePrice(price: string): number {
  const digits = price.replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : 0;
}

export function formatPlannerTotal(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ARPlannerOverlay({
  catalogItems,
  catalogLoading = false,
  catalogError = null,
  roomConfirmed,
  scanModalOpen = false,
  scanProgress,
  scanReady,
  statusMessage,
  selectedLibraryItem,
  selectedPlacedModelId = null,
  placedModelIds = [],
  canUndo,
  canRedo,
  libraryOpen,
  onSelectItem,
  onConfirmScan,
  onUndo,
  onRedo,
  onRemoveSelected,
  onSavePhoto,
  savingPhoto = false,
  onToggleLibrary,
  onBack,
  style,
}: ARPlannerOverlayProps) {
  const insets = useSafeAreaInsets();

  // Category rail removed — always show the full catalog in the bottom sheet.
  const filteredItems = catalogItems;

  const dimensionFocusId = selectedPlacedModelId || selectedLibraryItem;
  const dimensionItem = dimensionFocusId
    ? catalogItems.find((entry) => entry.id === dimensionFocusId) ?? null
    : null;
  const dimensionLabel = dimensionItem ? formatDimensionSubtitle(dimensionItem) : null;

  return (
    <View style={[styles.root, style]} pointerEvents="box-none">
      {/* Top bar — back only (price pill removed) */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.menuButton} onPress={onBack} accessibilityLabel="Go back">
          <Ionicons name="menu" size={20} color="#1C1B19" />
        </TouchableOpacity>
      </View>

      {/* Scan banner */}
      {!roomConfirmed && !scanModalOpen && (
        <View style={styles.scanCard} pointerEvents="box-none">
          <Text style={styles.scanTitle}>Scanning room</Text>
          <Text style={styles.scanBody}>{statusMessage}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(scanProgress * 100)}%` }]} />
          </View>
          <TouchableOpacity
            style={[styles.confirmButton, !scanReady && styles.confirmButtonDisabled]}
            disabled={!scanReady}
            onPress={onConfirmScan}
          >
            <Text style={styles.confirmButtonText}>
              {scanReady ? 'Confirm room' : 'Keep scanning…'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {roomConfirmed && (
        <View style={styles.statusChipWrap} pointerEvents="none">
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{statusMessage}</Text>
          </View>
        </View>
      )}

      {/* Dimension chip — RN overlay (replaces Unity world-space billboard) */}
      {roomConfirmed && dimensionItem && dimensionLabel ? (
        <View
          style={[
            styles.dimensionChipWrap,
            { bottom: insets.bottom + (libraryOpen ? 210 : 88) },
          ]}
          pointerEvents="none"
        >
          <View style={styles.dimensionChip}>
            <Text style={styles.dimensionChipName} numberOfLines={1}>
              {dimensionItem.name}
            </Text>
            <Text style={styles.dimensionChipDims} numberOfLines={1}>
              {dimensionLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Item sheet */}
      {roomConfirmed && libraryOpen && (
        <View style={[styles.itemSheet, { bottom: insets.bottom + 88 }]} pointerEvents="box-none">
          {catalogLoading ? (
            <View style={styles.catalogState}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.catalogStateText}>Loading catalog…</Text>
            </View>
          ) : catalogError ? (
            <View style={styles.catalogState}>
              <Text style={styles.catalogStateText}>{catalogError}</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.catalogState}>
              <Text style={styles.catalogStateText}>No furniture in this category</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemRow}>
              {filteredItems.map((item, index) => {
                const selected = selectedLibraryItem === item.id;
                const isLast = index === filteredItems.length - 1;
                const placedCount = placedModelIds.filter((id) => id === item.id).length;
                const remaining = getRemainingPlacements(item.quantity, placedCount);
                const outOfStock = isOutOfStock(item.quantity);
                const limitReached = !canPlaceMore(item.quantity, placedCount);
                const locked = outOfStock || limitReached;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      selected && !locked && styles.itemCardSelected,
                      isLast && styles.itemCardLast,
                      locked && styles.itemCardLocked,
                    ]}
                    disabled={locked}
                    onPress={() => {
                      if (!locked) onSelectItem(item.id);
                    }}
                    accessibilityState={{ disabled: locked }}
                    accessibilityLabel={
                      outOfStock
                        ? `${item.name}, out of stock`
                        : limitReached
                          ? `${item.name}, placement limit reached`
                          : remaining != null
                            ? `${item.name}, ${remaining} remaining`
                            : item.name
                    }
                  >
                    <View style={styles.itemMedia}>
                      {item.thumbnail ? (
                        <Image
                          source={{ uri: item.thumbnail }}
                          style={[styles.itemThumbnail, locked && styles.itemMediaDimmed]}
                          resizeMode="contain"
                        />
                      ) : (
                        <View
                          style={[
                            styles.itemSwatch,
                            { backgroundColor: item.color },
                            locked && styles.itemMediaDimmed,
                          ]}
                        />
                      )}
                      {locked ? (
                        <View style={styles.itemLockOverlay} pointerEvents="none">
                          <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.itemName, locked && styles.itemTextMuted]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.itemPrice,
                        outOfStock && styles.itemOutOfStock,
                        limitReached && !outOfStock && styles.itemLimitReached,
                      ]}
                      numberOfLines={1}
                    >
                      {outOfStock
                        ? 'Out of stock'
                        : limitReached
                          ? 'Limit reached'
                          : remaining != null
                            ? `${remaining} left`
                            : item.price || formatDimensionSubtitle(item)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Bottom tools */}
      {roomConfirmed && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.toolGroup}>
            <ToolButton
              icon="cube-outline"
              active={libraryOpen}
              onPress={onToggleLibrary}
              label="Library"
            />
            <ToolButton
              icon="camera-outline"
              onPress={onSavePhoto ?? (() => {})}
              disabled={!onSavePhoto || savingPhoto}
              label="Save photo"
            />
            <ToolButton icon="arrow-undo" onPress={onUndo} disabled={!canUndo} label="Undo" />
            <ToolButton icon="arrow-redo" onPress={onRedo} disabled={!canRedo} label="Redo" />
            <ToolButton icon="trash-outline" onPress={onRemoveSelected} label="Delete" />
          </View>
        </View>
      )}
    </View>
  );
}

function ToolButton({
  icon,
  onPress,
  disabled,
  active,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolButton, active && styles.toolButtonActive, disabled && styles.toolButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={disabled ? '#9CA3AF' : '#1C1B19'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: 100,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  scanTitle: {
    color: '#1C1B19',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  scanBody: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  confirmButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  statusChipWrap: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  statusChip: {
    backgroundColor: 'rgba(20, 24, 32, 0.48)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '78%',
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
  dimensionChipWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  dimensionChip: {
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  dimensionChipName: {
    color: '#1C1B19',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  dimensionChipDims: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  itemSheet: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.md,
  },
  itemCard: {
    width: 118,
    marginRight: spacing.md,
    borderRadius: radii.md,
    backgroundColor: '#F3F4F6',
    padding: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: '#2563EB',
  },
  itemCardLast: {
    marginRight: 0,
  },
  itemCardLocked: {
    opacity: 0.85,
  },
  itemMedia: {
    position: 'relative',
    marginBottom: 8,
  },
  itemSwatch: {
    height: 52,
    borderRadius: 8,
  },
  itemThumbnail: {
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  itemMediaDimmed: {
    opacity: 0.4,
  },
  itemLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: 8,
  },
  catalogState: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  catalogStateText: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
  },
  itemName: {
    color: '#1C1B19',
    fontSize: 12,
    fontWeight: '600',
  },
  itemPrice: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
  },
  itemTextMuted: {
    color: '#6B7280',
  },
  itemOutOfStock: {
    color: '#DC2626',
    fontWeight: '600',
  },
  itemLimitReached: {
    color: '#D97706',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  toolGroup: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    padding: 6,
    gap: 4,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  toolButtonDisabled: {
    opacity: 0.45,
  },
});
