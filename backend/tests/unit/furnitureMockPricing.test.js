import { DESIGN_STYLE_IDS, mockPricePhp, mockStyles, suitableRooms } from '../../src/utils/furnitureMockPricing.js';

describe('furnitureMockPricing', () => {
  const sofa = { id: 'abu-dhabi-sofa', category: 'sofa', width: 1.68, depth: 0.76 };

  test('mock price is stable and inside the category range', () => {
    const price = mockPricePhp(sofa);
    expect(price).toBe(mockPricePhp({ ...sofa }));
    expect(price).toBeGreaterThanOrEqual(9000);
    expect(price).toBeLessThanOrEqual(38000);
  });

  test('stored price overrides the mock price', () => {
    expect(mockPricePhp({ ...sofa, pricePhp: 21500 })).toBe(21500);
  });

  test('mock styles are 2-3 distinct known styles', () => {
    for (let i = 0; i < 50; i += 1) {
      const styles = mockStyles({ id: `item-${i}` });
      expect(styles.length).toBeGreaterThanOrEqual(2);
      expect(styles.length).toBeLessThanOrEqual(3);
      expect(new Set(styles).size).toBe(styles.length);
      styles.forEach((style) => expect(DESIGN_STYLE_IDS).toContain(style));
    }
  });

  test('rooms follow the category', () => {
    expect(suitableRooms({ category: 'beds' })).toEqual(['Bedroom']);
    expect(suitableRooms({ category: 'sofa' })).toContain('Living Room');
  });
});
