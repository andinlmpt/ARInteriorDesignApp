/**
 * Planner-style chrome inspired by bathroom layout apps:
 * top price pill, right category rail, bottom tool + undo/redo bar.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FURNITURE_LIBRARY } from '@/data/furnitureLibrary';
import type { FurnitureCategory } from '@/types/ar-view';
import { spacing, radii } from '@/components/ui/theme';

export type PlannerTool = 'place' | 'select' | 'measure';

const CATEGORY_ICONS: { id: FurnitureCategory | 'all'; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', icon: 'home-outline' },
  { id: 'seating', icon: 'bed-outline' },
  { id: 'tables', icon: 'grid-outline' },
  { id: 'storage', icon: 'file-tray-stacked-outline' },
  { id: 'lighting', icon: 'bulb-outline' },
  { id: 'decor', icon: 'flower-outline' },
  { id: 'bedroom', icon: 'moon-outline' },
  { id: 'kitchen', icon: 'restaurant-outline' },
];

interface ARPlannerOverlayProps {
  roomConfirmed: boolean;
  scanProgress: number;
  scanReady: boolean;
  statusMessage: string;
  selectedCategory: FurnitureCategory | 'all';
  selectedLibraryItem: string | null;
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
  roomConfirmed,
  scanProgress,
  scanReady,
  statusMessage,
  selectedCategory,
  selectedLibraryItem,
  placedModelIds,
  canUndo,
  canRedo,
  activeTool,
  libraryOpen,
  onSelectCategory,
  onSelectItem,
  onConfirmScan,
  onRescan,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onRemoveSelected,
  onSetTool,
  onToggleLibrary,
  onBack,
  style,
}: ARPlannerOverlayProps) {
  const insets = useSafeAreaInsets();

  const total = useMemo(() => {
    return placedModelIds.reduce((sum, modelId) => {
      const item = FURNITURE_LIBRARY.find((entry) => entry.id === modelId);
      return sum + (item ? parseFurniturePrice(item.price) : 0);
    }, 0);
  }, [placedModelIds]);

  const filteredItems =
    selectedCategory === 'all'
      ? FURNITURE_LIBRARY
      : FURNITURE_LIBRARY.filter((item) => item.category === selectedCategory);

  return (
    <View style={[styles.root, style]} pointerEvents="box-none">
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.menuButton} onPress={onBack} accessibilityLabel="Go back">
          <Ionicons name="menu" size={20} color="#1C1B19" />
        </TouchableOpacity>

        <View style={styles.pricePill}>
          <Ionicons name="list" size={16} color="#1C1B19" />
          <Text style={styles.priceText}>{formatPlannerTotal(total)}</Text>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={onExport}
            disabled={!roomConfirmed}
            accessibilityLabel="Export layout"
          >
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scan banner */}
      {!roomConfirmed && (
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
        <View style={styles.statusChip} pointerEvents="none">
          <Text style={styles.statusChipText}>{statusMessage}</Text>
        </View>
      )}

      {/* Right category rail */}
      {roomConfirmed && (
        <View style={[styles.sideRail, { top: insets.top + 72 }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sideRailContent}>
            {CATEGORY_ICONS.map((entry) => {
              const active = selectedCategory === entry.id;
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.railButton, active && styles.railButtonActive]}
                  onPress={() => {
                    onSelectCategory(entry.id);
                    if (!libraryOpen) onToggleLibrary();
                  }}
                  accessibilityLabel={`${entry.id} category`}
                >
                  <Ionicons name={entry.icon} size={20} color="#FFFFFF" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Item sheet */}
      {roomConfirmed && libraryOpen && (
        <View style={[styles.itemSheet, { bottom: insets.bottom + 88 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemRow}>
            {filteredItems.map((item) => {
              const selected = selectedLibraryItem === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, selected && styles.itemCardSelected]}
                  onPress={() => onSelectItem(item.id)}
                >
                  <View style={[styles.itemSwatch, { backgroundColor: item.color }]} />
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>{item.price}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
              icon="move-outline"
              active={activeTool === 'select'}
              onPress={() => onSetTool('select')}
              label="Move"
            />
            <ToolButton
              icon="resize-outline"
              active={activeTool === 'measure'}
              onPress={() => onSetTool('measure')}
              label="Measure"
            />
            <ToolButton icon="trash-outline" onPress={onRemoveSelected} label="Delete" />
          </View>

          <View style={styles.toolGroup}>
            <ToolButton icon="arrow-undo" onPress={onUndo} disabled={!canUndo} label="Undo" />
            <ToolButton icon="arrow-redo" onPress={onRedo} disabled={!canRedo} label="Redo" />
            <ToolButton icon="refresh" onPress={onRescan} label="Rescan" />
            <ToolButton icon="close" onPress={onClear} label="Clear" />
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
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.pill,
    paddingLeft: 14,
    paddingVertical: 6,
    paddingRight: 6,
  },
  priceText: {
    color: '#1C1B19',
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
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
  statusChip: {
    position: 'absolute',
    top: 100,
    left: spacing.md,
    right: 72,
    backgroundColor: 'rgba(28,27,25,0.72)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  sideRail: {
    position: 'absolute',
    right: spacing.sm,
    bottom: 120,
    width: 52,
    backgroundColor: '#1C1B19',
    borderRadius: 16,
    paddingVertical: 8,
  },
  sideRailContent: {
    alignItems: 'center',
    gap: 6,
  },
  railButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railButtonActive: {
    backgroundColor: '#374151',
  },
  itemSheet: {
    position: 'absolute',
    left: spacing.sm,
    right: 68,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
  },
  itemRow: {
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  itemCard: {
    width: 110,
    borderRadius: radii.md,
    backgroundColor: '#F3F4F6',
    padding: spacing.sm,
  },
  itemCardSelected: {
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  itemSwatch: {
    height: 44,
    borderRadius: 8,
    marginBottom: 6,
  },
  itemName: {
    color: '#1C1B19',
    fontSize: 12,
    fontWeight: '600',
  },
  itemPrice: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
