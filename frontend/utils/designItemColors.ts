/**
 * Distinct, mid-tone colors used to tell furniture pieces apart in the floor plan,
 * the 3D layout, and the furniture legend. These identify items; they are not the
 * design's style palette.
 */
const ITEM_COLORS = [
  '#4F7CAC',
  '#D9822B',
  '#3E9E6E',
  '#B85C8E',
  '#C9A227',
  '#6C5FC7',
  '#2A9DB5',
  '#C2553F',
  '#7A9A3A',
  '#8C6D52',
];

const RUG_COLOR = '#C8BFAF';

export function designItemColor(index: number, category?: string, role?: string): string {
  if (role === 'rug' || /\brug\b/i.test(category || '')) return RUG_COLOR;
  return ITEM_COLORS[((index % ITEM_COLORS.length) + ITEM_COLORS.length) % ITEM_COLORS.length];
}
