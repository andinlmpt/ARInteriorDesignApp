/**
 * Filters the "Required furniture" choices on the design preferences screen
 * by room type and remaining ₱ budget. Style is a soft preference (sort only).
 */

import type { DesignRequiredItem } from '@/types/design-flow';

function isOutOfStock(quantity?: number | null): boolean {
  return typeof quantity === 'number' && Number.isFinite(quantity) && quantity <= 0;
}

export interface RequiredFurnitureFilter {
  roomType: string;
  style: string;
  budgetPhp: number;
  selectedIds: string[];
}

export interface RequiredFurnitureResult {
  /** Selected items plus unselected matches that still fit the remaining budget. */
  visible: DesignRequiredItem[];
  selectedTotalPhp: number;
  remainingPhp: number;
  /** In-room pieces hidden only because they exceed the remaining budget. */
  hiddenOverBudget: number;
  overBudget: boolean;
}

export function matchesRoom(item: DesignRequiredItem, roomType: string): boolean {
  if (!roomType) return true;
  if (!item.rooms || item.rooms.length === 0) return true;
  return item.rooms.includes(roomType);
}

export function matchesStyle(item: DesignRequiredItem, style: string): boolean {
  if (!style) return true;
  if (!item.styles || item.styles.length === 0) return true;
  return item.styles.includes(style);
}

/** @deprecated Use matchesRoom + matchesStyle separately. */
export function matchesRoomAndStyle(item: DesignRequiredItem, roomType: string, style: string): boolean {
  return matchesRoom(item, roomType) && matchesStyle(item, style);
}

export function filterRequiredFurniture(
  options: DesignRequiredItem[],
  { roomType, style, budgetPhp, selectedIds }: RequiredFurnitureFilter,
): RequiredFurnitureResult {
  const selected = options.filter((item) => selectedIds.includes(item.id));
  const selectedTotalPhp = selected.reduce((sum, item) => sum + (item.pricePhp ?? 0), 0);
  const remainingPhp = budgetPhp - selectedTotalPhp;

  let hiddenOverBudget = 0;

  const applyFilters = (requireRoom: boolean) =>
    options
      .filter((item) => {
        if (selectedIds.includes(item.id)) return true;
        if (requireRoom && !matchesRoom(item, roomType)) return false;
        if (isOutOfStock(item.quantity)) return false;
        const price = item.pricePhp ?? 0;
        if (price > 0 && price > remainingPhp) {
          if (requireRoom || matchesRoom(item, roomType)) {
            hiddenOverBudget += 1;
          }
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const roomDiff = Number(matchesRoom(b, roomType)) - Number(matchesRoom(a, roomType));
        if (roomDiff !== 0) return roomDiff;
        const styleDiff = Number(matchesStyle(b, style)) - Number(matchesStyle(a, style));
        if (styleDiff !== 0) return styleDiff;
        return (a.pricePhp ?? 0) - (b.pricePhp ?? 0);
      });

  let visible = applyFilters(Boolean(roomType));
  const selectableCount = visible.filter((item) => !selectedIds.includes(item.id)).length;
  if (roomType && selectableCount === 0) {
    hiddenOverBudget = 0;
    visible = applyFilters(false);
  }

  return {
    visible,
    selectedTotalPhp,
    remainingPhp,
    hiddenOverBudget,
    overBudget: remainingPhp < 0,
  };
}
