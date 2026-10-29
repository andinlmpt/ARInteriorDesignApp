import {
  mapDocToPlannerItem,
  plannerFootprint,
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

  test('picked furniture is all the layout gets: no second piece beside it', () => {
    const roomy = [...pool, mapDocToPlannerItem({
      id: 'chair-cheap', displayName: 'Chair', category: 'chair', width: 0.5, depth: 0.5, height: 0.9,
      pricePhp: 1999, quantity: 10, active: true, styles: ['Modern'], roomTypes: ['Living Room'], glbUrl: '/chair.glb',
    })];
    const result = selectCatalogFurnitureSet(roomy, {
      roomType: 'Living Room',
      style: 'Modern',
      budgetPhp: 100000,
      requiredItemIds: ['sofa-large'],
      variantIndex: 0,
    });
    expect(result.furniture.map((item) => item.catalogId)).toEqual(['sofa-large']);
    expect(result.totalPhp).toBe(32999);
    expect(result.withinBudget).toBe(true);
  });

  test('nothing picked: a set is suggested for the room', () => {
    const result = selectCatalogFurnitureSet(pool, {
      roomType: 'Bedroom',
      style: 'Minimalist',
      budgetPhp: 50000,
      variantIndex: 0,
    });
    expect(result.furniture.length).toBeGreaterThan(1);
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

  test('layouts use the 3D model size: AR shows the model, not the listed piece', () => {
    // Listed as one 66" sofa; the model is the whole 3-piece set.
    const set = mapDocToPlannerItem({
      id: 'sofa-set', displayName: 'Sofa Set', category: 'sofa', pricePhp: 20000,
      width: 1.68, depth: 0.76, height: 0.81,
      modelSize: { width: 2.61, depth: 2.62, height: 0.81 },
    });
    expect(set.width).toBe(2.61);
    expect(set.length).toBe(2.62);
    expect(set.dimensions).toEqual({ width: 2.61, length: 2.62, height: 0.81 });

    // Listed with its 75" length as the width: the model's long side is its depth.
    const bed = plannerFootprint({ width: 1.905, depth: 0.914, height: 0.61, modelSize: { width: 1.58, depth: 2.61, height: 1.32 } });
    expect(bed).toEqual({ width: 1.58, length: 2.61, height: 1.32 });
  });

  test('without a measured model the listed size is used', () => {
    expect(plannerFootprint({ width: 1.2, depth: 0.6, height: 0.75, modelSize: null }))
      .toEqual({ width: 1.2, length: 0.6, height: 0.75 });
    expect(plannerFootprint({ width: 1.2, depth: 0.6, height: 0.75, modelSize: { width: 0, depth: 0.5, height: 0.7 } }))
      .toEqual({ width: 1.2, length: 0.6, height: 0.75 });
    expect(plannerFootprint({})).toEqual({ width: 1, length: 0.8, height: 0.8 });
  });
});

describe('suggested extras', () => {
  // Five cheap sofas: with only the budget as a limit, a living room used to get them all.
  const sofas = [1, 2, 3, 4, 5].map((n) => mapDocToPlannerItem({
    id: `sofa-${n}`,
    displayName: `Sofa ${n}`,
    category: 'sofa',
    width: 2,
    depth: 0.9,
    height: 0.8,
    pricePhp: 5000 + n,
    quantity: 3,
    active: true,
    roomTypes: ['Living Room'],
  }));

  it('suggests at most two of a kind', () => {
    const { furniture } = selectCatalogFurnitureSet(sofas, { roomType: 'Living Room', style: '', budgetPhp: 100000 });
    expect(furniture.filter((item) => item.category === 'sofa')).toHaveLength(2);
  });

  it('stops adding extras when the floor would get crowded', () => {
    // 6 m² of floor: 40% is 2.4 m², room for one 1.8 m² sofa.
    const { furniture } = selectCatalogFurnitureSet(sofas, { roomType: 'Living Room', style: '', budgetPhp: 100000, floorArea: 6 });
    expect(furniture).toHaveLength(1);
  });

  it('leaves picked furniture alone', () => {
    const picked = sofas.map((item) => item.catalogId);
    const { furniture } = selectCatalogFurnitureSet(sofas, {
      roomType: 'Living Room', style: '', budgetPhp: 100000, requiredItemIds: picked, floorArea: 6,
    });
    expect(furniture).toHaveLength(5);
  });
});
