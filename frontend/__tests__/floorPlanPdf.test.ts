import { describe, it, expect } from '@jest/globals';
import { buildFloorPlanPdf, formatPHP } from '@/utils/floorPlanPdf';
import { floorPlanFileName } from '@/utils/floorPlanExport';
import type { CustomizedLayoutItem } from '@/types/design-flow';

jest.mock('expo-file-system/legacy', () => ({}));

const room = { width: 5, length: 4, height: 2.7 };

const item = (index: number, price = 1500, role = 'chair'): CustomizedLayoutItem => ({
  instanceId: `item-${index}`,
  furnitureId: `chair-${index}`,
  displayName: `Chair (${index})`,
  category: 'seating',
  role,
  width: 0.5,
  height: 0.9,
  depth: 0.5,
  localPosition: { x: 0.2 * index, y: 0, z: 0.3 },
  rotationY: index % 2 ? 90 : 0,
  pricePhp: price,
});

const input = (count: number, budgetPhp: number) => {
  const items = Array.from({ length: count }, (_, i) => item(i + 1, i === 0 ? 0 : 1500));
  return {
    title: 'Minimalist Bedroom',
    room,
    items,
    totalPhp: items.reduce((sum, i) => sum + i.pricePhp, 0),
    budgetPhp,
    roomType: 'Bedroom',
    style: 'Minimalist',
    generatedAt: new Date('2026-10-10'),
  };
};

describe('floor plan PDF', () => {
  it('produces a valid PDF whose cross-reference table points at each object', () => {
    const pdf = buildFloorPlanPdf(input(4, 30000));
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
    expect(/^[\x00-\x7F]*$/.test(pdf)).toBe(true);

    const xrefStart = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
    expect(pdf.slice(xrefStart, xrefStart + 4)).toBe('xref');
    const entries = [...pdf.slice(xrefStart).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    entries.forEach((offset, i) => expect(pdf.startsWith(`${i + 1} 0 obj`, offset)).toBe(true));

    // Two pages: floor plan with summary, then the itemized list
    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('(Chair \\(1\\)) Tj');
    expect(pdf).toContain('(PHP 4,500) Tj');
    expect(pdf).toContain('(Remaining) Tj');
    expect(pdf).toContain('(PHP 25,500) Tj');
    expect(pdf).toContain('(Bedroom  |  Minimalist  |  2026-10-10');
  });

  it('paginates long furniture lists and flags spending over budget', () => {
    const pdf = buildFloorPlanPdf(input(40, 1000));
    expect(pdf).toContain('/Count 3');
    expect(pdf).toContain('(Over budget) Tj');
  });

  it('draws rugs dashed and without a number', () => {
    const rug = { ...item(9, 2000, 'rug'), displayName: 'Area Rug', width: 2, depth: 3 };
    const pdf = buildFloorPlanPdf({ ...input(1, 0), items: [rug, item(1)] });
    expect(pdf).toContain('[3 3] 0 d');
    expect(pdf).toContain('(Area Rug) Tj');
  });

  it('formats peso amounts with thousands separators', () => {
    expect(formatPHP(30000)).toBe('PHP 30,000');
    expect(formatPHP(-1250.4)).toBe('-PHP 1,250');
  });

  it('names the file after the design', () => {
    expect(floorPlanFileName('My Cozy Room!', new Date('2026-10-10'))).toBe('my-cozy-room-floor-plan-2026-10-10.pdf');
    expect(floorPlanFileName('', new Date('2026-10-10'))).toBe('design-floor-plan-2026-10-10.pdf');
  });
});
