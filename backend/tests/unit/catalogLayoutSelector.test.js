import {
  mapDocToPlannerItem,
  selectCatalogFurnitureSet,
  sumCatalogPricePhp,
  estimateFurnitureCostPhp,
} from '../../src/services/catalogLayoutSelector.js';

const pool = [
  mapDocToPlannerItem({
    id: 'bed-queen',
    displayName: 'Queen Bed',
    category: 'beds',
    width: 1.6,
    depth: 2.1,
    height: 0.5,
    pricePhp: 14999,
    quantity: 5,
    active: true,
    styles: ['Minimalist'],
    roomTypes: ['Bedroom'],
    glbUrl: '/bed.glb',
  }),
  mapDocToPlannerItem({
    id: 'desk-study',
    displayName: 'Study Desk',
    category: 'chair',
    width: 1.2,
    depth: 0.6,
    height: 0.75,
    pricePhp: 6999,
    quantity: 3,
    active: true,
    styles: ['Minimalist'],
    roomTypes: ['Bedroom', 'Office'],
    glbUrl: '/desk.glb',
  }),
  mapDocToPlannerItem({
    id: 'sofa-large',
    displayName: 'Large Sofa',
    category: 'sofa',
    width: 2.2,
    depth: 0.9,
    height: 0.85,
    pricePhp: 32999,
    quantity: 2,
    active: true,
    styles: ['Modern'],
    roomTypes: ['Living Room'],
    glbUrl: '/sofa.glb',
  }),
];

describe('catalogLayoutSelector', () => {
  test('required SKUs are always included', () => {
    const result = selectCatalogFurnitureSet(pool, {
      roomType: 'Bedroom',
      style: 'Minimalist',
      budgetPhp: 50000,
      requiredItemIds: ['bed-queen', 'desk-study'],
      variantIndex: 0,
    });
    const ids = result.furniture.map((item) => item.catalogId);
    expect(ids).toEqual(expect.arrayContaining(['bed-queen', 'desk-study']));
  });

  test('budget blocks expensive optional pieces', () => {
    const result = selectCatalogFurnitureSet(
      [...pool, mapDocToPlannerItem({
        id: 'chair-cheap',
        displayName: 'Chair',
        category: 'chair',
        width: 0.5,
        depth: 0.5,
        height: 0.9,
        pricePhp: 1999,
        quantity: 10,
        active: true,
        styles: ['Minimalist'],
        roomTypes: ['Bedroom'],
        glbUrl: '/chair.glb',
      })],
      {
        roomType: 'Bedroom',
        style: 'Minimalist',
        budgetPhp: 25000,
        requiredItemIds: ['bed-queen', 'desk-study'],
        variantIndex: 0,
      },
    );
    expect(result.totalPhp).toBeLessThanOrEqual(25000);
    expect(result.furniture.some((item) => item.catalogId === 'sofa-large')).toBe(false);
  });

  test('estimateFurnitureCostPhp sums catalog prices with optional buffer', () => {
    const cost = estimateFurnitureCostPhp(pool.slice(0, 2), { buffer: 0.1 });
    expect(cost.subtotalPhp).toBe(21998);
    expect(cost.totalPhp).toBe(24198);
    expect(sumCatalogPricePhp(pool.slice(0, 2))).toBe(21998);
  });
});
