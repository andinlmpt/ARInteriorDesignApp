/**
 * Planner-style chrome: top back button, furniture sheet, bottom tool + undo/redo bar.
 */

import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  PanResponder,
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
  /** True while the selected catalog GLB is downloading / parsing in Unity. */
  furnitureLoading?: boolean;
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
  /** Omit to hide the top-right Export button (AR Furniture mode). */
  onExport?: () => void;
  onSavePhoto?: () => void;
  savingPhoto?: boolean;
  /** Disable export while Unity/RN is building the 3D file. */
  exportDisabled?: boolean;
  onRemoveSelected: () => void;
  onSetTool: (tool: PlannerTool) => void;
  onToggleLibrary: () => void;
  onBack: () => void;
  /** When true, empty-space drag/pinch is forwarded to Unity planner (UaaL). */
  enablePlannerOrbit?: boolean;
  /** Unified planner pointer — Unity hit-tests furniture vs orbit. */
  onPlannerPointer?: (payload: {
    phase: 'begin' | 'move' | 'end' | 'cancel';
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    dx?: number;
    dy?: number;
    pinch?: number;
    twistDelta?: number;
    fingers?: number;
  }) => void;
  style?: StyleProp<ViewStyle>;
}

export function parseFurniturePrice(price: string | number | undefined | null): number {
  if (typeof price === 'number' && Number.isFinite(price)) return price;
  const digits = String(price ?? '').replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : 0;
}

export function formatPlannerTotal(amount: number, currency: 'PHP' | 'USD' = 'PHP'): string {
  if (currency === 'PHP') {
    return `₱${Math.round(amount).toLocaleString('en-PH')}`;
  }
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function libraryItemPricePhp(item: { pricePhp?: number; price?: string }): number {
  if (typeof item.pricePhp === 'number' && item.pricePhp > 0) return item.pricePhp;
  return parseFurniturePrice(item.price);
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
  furnitureLoading = false,
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
  onExport,
  onRemoveSelected,
  onSavePhoto,
  exportDisabled = false,
  savingPhoto = false,
  onToggleLibrary,
  onBack,
  enablePlannerOrbit = false,
  onPlannerPointer,
  style,
}: ARPlannerOverlayProps) {
  const insets = useSafeAreaInsets();
  const orbitRef = useRef({
    mode: 'none' as 'none' | 'active',
    fingers: 0,
    lastX: 0,
    lastY: 0,
    lastDist: 0,
    lastTwist: 0,
  });

  const orbitPan = useMemo(() => {
    if (!enablePlannerOrbit || !onPlannerPointer) return null;

    type TouchPoint = { pageX: number; pageY: number };

    /** Re-seed baselines so a finger landing / lifting never produces a delta spike. */
    const seed = (touches: readonly TouchPoint[]) => {
      const ref = orbitRef.current;
      ref.fingers = touches.length >= 2 ? 2 : 1;
      if (touches.length >= 2) {
        const [a, b] = touches;
        ref.lastX = (a.pageX + b.pageX) / 2;
        ref.lastY = (a.pageY + b.pageY) / 2;
        ref.lastDist = Math.max(1, Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY));
        ref.lastTwist = Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX);
      } else if (touches.length === 1) {
        ref.lastX = touches[0].pageX;
        ref.lastY = touches[0].pageY;
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        orbitRef.current.mode = 'active';
        if (touches.length >= 2) {
          seed(touches);
          const [a, b] = touches;
          onPlannerPointer({
            phase: 'begin',
            x: a.pageX,
            y: a.pageY,
            x2: b.pageX,
            y2: b.pageY,
            fingers: 2,
            pinch: 1,
            twistDelta: 0,
          });
          return;
        }

        const x = e.nativeEvent.pageX;
        const y = e.nativeEvent.pageY;
        seed([{ pageX: x, pageY: y }]);
        onPlannerPointer({ phase: 'begin', x, y, fingers: 1, dx: 0, dy: 0 });
      },
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        const count = touches.length >= 2 ? 2 : 1;
        if (count !== orbitRef.current.fingers) {
          seed(touches.length > 0 ? touches : [{ pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY }]);
          return;
        }

        if (count === 2) {
          const [a, b] = touches;
          const cx = (a.pageX + b.pageX) / 2;
          const cy = (a.pageY + b.pageY) / 2;
          const dist = Math.max(1, Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY));
          const twist = Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX);
          let twistDeg = ((twist - orbitRef.current.lastTwist) * 180) / Math.PI;
          if (twistDeg > 180) twistDeg -= 360;
          if (twistDeg < -180) twistDeg += 360;
          const pinch = dist / Math.max(1, orbitRef.current.lastDist);
          const moveDx = cx - orbitRef.current.lastX;
          const moveDy = cy - orbitRef.current.lastY;
          orbitRef.current.lastX = cx;
          orbitRef.current.lastY = cy;
          orbitRef.current.lastDist = dist;
          orbitRef.current.lastTwist = twist;
          onPlannerPointer({
            phase: 'move',
            x: a.pageX,
            y: a.pageY,
            x2: b.pageX,
            y2: b.pageY,
            dx: moveDx,
            dy: moveDy,
            pinch,
            twistDelta: twistDeg,
            fingers: 2,
          });
          return;
        }

        const x = e.nativeEvent.pageX;
        const y = e.nativeEvent.pageY;
        const dx = x - orbitRef.current.lastX;
        const dy = y - orbitRef.current.lastY;
        orbitRef.current.lastX = x;
        orbitRef.current.lastY = y;
        onPlannerPointer({ phase: 'move', x, y, dx, dy, fingers: 1, pinch: 1 });
      },
      onPanResponderRelease: () => {
        onPlannerPointer({
          phase: 'end',
          x: orbitRef.current.lastX,
          y: orbitRef.current.lastY,
          fingers: 1,
        });
        orbitRef.current.mode = 'none';
      },
      onPanResponderTerminate: () => {
        onPlannerPointer({
          phase: 'cancel',
          x: orbitRef.current.lastX,
          y: orbitRef.current.lastY,
          fingers: 1,
        });
        orbitRef.current.mode = 'none';
      },
    });
  }, [enablePlannerOrbit, onPlannerPointer]);

  // Category rail removed — always show the full catalog in the bottom sheet.
  const filteredItems = catalogItems;

  const dimensionFocusId = selectedPlacedModelId || selectedLibraryItem;
  const dimensionItem = dimensionFocusId
    ? catalogItems.find((entry) => entry.id === dimensionFocusId) ?? null
    : null;
  const dimensionLabel = dimensionItem ? formatDimensionSubtitle(dimensionItem) : null;

  const chromeBottomInset = insets.bottom + (roomConfirmed ? (libraryOpen ? 210 : 88) : 48);

  return (
    <View style={[styles.root, style]} pointerEvents="box-none">
      {orbitPan ? (
        <View
          style={[styles.orbitPad, { bottom: chromeBottomInset }]}
          {...orbitPan.panHandlers}
        />
      ) : null}

      {/* Top bar — menu (back) + export */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.menuButton} onPress={onBack} accessibilityLabel="Go back">
          <Ionicons name="menu" size={20} color="#1C1B19" />
        </TouchableOpacity>
        {roomConfirmed && onExport ? (
          <TouchableOpacity
            style={[styles.exportTopButton, exportDisabled && styles.exportTopButtonDisabled]}
            onPress={onExport}
            disabled={exportDisabled}
            accessibilityLabel="Export 3D layout"
          >
            <Ionicons name="share-outline" size={18} color="#FFFFFF" />
            <Text style={styles.exportTopButtonText}>Export</Text>
          </TouchableOpacity>
        ) : null}
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
          <View style={[styles.statusChip, furnitureLoading && styles.statusChipLoading]}>
            {furnitureLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.statusChipSpinner} />
            ) : null}
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
        <View
          style={[styles.itemSheet, { bottom: insets.bottom + 88, zIndex: 3 }]}
          pointerEvents="box-none"
        >
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
                const stockLocked = outOfStock || limitReached;
                const locked = stockLocked || furnitureLoading;
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
                        : furnitureLoading
                          ? `${item.name}, loading`
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
                      {stockLocked ? (
                        <View style={styles.itemLockOverlay} pointerEvents="none">
                          <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                        </View>
                      ) : furnitureLoading && selected ? (
                        <View style={styles.itemLockOverlay} pointerEvents="none">
                          <ActivityIndicator size="small" color="#FFFFFF" />
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
                            : (item.pricePhp ? formatPlannerTotal(item.pricePhp, 'PHP') : item.price)
                              || formatDimensionSubtitle(item)}
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
        <View
          style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12), zIndex: 4 }]}
        >
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
  orbitPad: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  exportTopButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#0C295F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  exportTopButtonDisabled: {
    opacity: 0.65,
  },
  exportTopButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 24, 32, 0.48)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '78%',
  },
  statusChipLoading: {
    backgroundColor: 'rgba(37, 99, 235, 0.88)',
  },
  statusChipSpinner: {
    marginRight: 8,
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
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
