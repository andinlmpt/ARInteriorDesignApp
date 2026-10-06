import { describe, it, expect } from '@jest/globals';
import { filterRequiredFurniture } from '@/utils/designRequiredFurniture';
import type { DesignRequiredItem } from '@/types/design-flow';

const catalog: DesignRequiredItem[] = [
  { id: 'sofa-a', label: 'Sofa A', category: 'sofa', pricePhp: 18999, styles: ['Modern'], rooms: ['Living Room'] },
  { id: 'sofa-b', label: 'Sofa B', category: 'sofa', pricePhp: 32999, styles: ['Modern'], rooms: ['Living Room'] },
  { id: 'sofa-c', label: 'Sofa C', category: 'sofa', pricePhp: 12999, styles: ['Rustic'], rooms: ['Living Room'] },
  { id: 'bed-a', label: 'Bed A', category: 'beds', pricePhp: 9999, styles: ['Modern'], rooms: ['Bedroom'] },
  { id: 'chair-a', label: 'Chair A', category: 'chair', pricePhp: 2499, styles: ['Modern'], rooms: ['Living Room', 'Bedroom'] },
];

describe('filterRequiredFurniture', () => {
  it('lists room matches within budget; style sorts matches first', () => {
    const result = filterRequiredFurniture(catalog, {
      roomType: 'Living Room',
      style: 'Modern',
      budgetPhp: 30000,
      selectedIds: [],
    });
    expect(result.visible.map((item) => item.id)).toEqual(['chair-a', 'sofa-a', 'sofa-c']);
    expect(result.hiddenOverBudget).toBe(1);
  });

  it('shrinks the choices as the remaining budget is used up', () => {
    const result = filterRequiredFurniture(catalog, {
      roomType: 'Living Room',
      style: 'Modern',
      budgetPhp: 20000,
      selectedIds: ['sofa-a'],
    });
    expect(result.selectedTotalPhp).toBe(18999);
    expect(result.remainingPhp).toBe(1001);
    expect(result.visible.map((item) => item.id)).toEqual(['sofa-a']);
    expect(result.overBudget).toBe(false);
  });

  it('keeps selected items visible and flags over budget when the budget drops', () => {
    const result = filterRequiredFurniture(catalog, {
      roomType: 'Living Room',
      style: 'Modern',
      budgetPhp: 10000,
      selectedIds: ['sofa-a'],
    });
    expect(result.visible.map((item) => item.id)).toEqual(['sofa-a']);
    expect(result.overBudget).toBe(true);
  });
});
