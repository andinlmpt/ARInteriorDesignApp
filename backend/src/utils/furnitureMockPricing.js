/**
 * Mock merchandising data (₱ price, design styles, suitable rooms) for catalog
 * items that do not have real values yet. Values are derived from the item id
 * so they stay stable across requests and devices.
 */

export const DESIGN_STYLE_IDS = [
  'Minimalist',
  'Modern',
  'Scandinavian',
  'Industrial',
  'Contemporary',
  'Traditional',
  'Rustic',
];

const PRICE_RANGES_PHP = {
  sofa: [9000, 38000],
  beds: [7000, 32000],
  chair: [1200, 9000],
  other: [2000, 12000],
};

/** Typical footprint (m²) per category; larger pieces trend toward the top of the range. */
const TYPICAL_FOOTPRINT_M2 = {
  sofa: 1.6,
  beds: 3.0,
  chair: 0.36,
  other: 0.8,
};

const ROOMS_BY_CATEGORY = {
  sofa: ['Living Room', 'Office'],
  beds: ['Bedroom'],
  chair: ['Living Room', 'Dining Room', 'Office', 'Bedroom', 'Kitchen'],
  other: ['Living Room', 'Bedroom', 'Office'],
};

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function categoryKey(category) {
  const key = String(category || '').toLowerCase();
  return PRICE_RANGES_PHP[key] ? key : 'other';
}

export function mockPricePhp(doc = {}) {
  const stored = Number(doc.pricePhp);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);

  const key = categoryKey(doc.category);
  const [min, max] = PRICE_RANGES_PHP[key];
  const footprint = (Number(doc.width) || 0) * (Number(doc.depth) || 0);
  const sizeRatio = footprint > 0 ? footprint / TYPICAL_FOOTPRINT_M2[key] : 1;
  const sizeFactor = Math.max(0, Math.min(1, (sizeRatio - 0.6) / 1.2));
  const jitter = (hashString(`${doc.id}:price`) % 1000) / 1000;
  const t = Math.max(0, Math.min(1, sizeFactor * 0.6 + jitter * 0.4));
  const raw = min + (max - min) * t;
  return Math.max(min, Math.round(raw / 100) * 100 - 1);
}

export function mockStyles(doc = {}) {
  if (Array.isArray(doc.styles) && doc.styles.length > 0) return doc.styles;

  const hash = hashString(`${doc.id}:style`);
  const total = DESIGN_STYLE_IDS.length;
  const count = 2 + (hash % 2);
  const start = (hash >>> 4) % total;
  const step = 1 + ((hash >>> 12) % (total - 1));
  return Array.from({ length: count }, (_, i) => DESIGN_STYLE_IDS[(start + i * step) % total]);
}

export function suitableRooms(doc = {}) {
  if (Array.isArray(doc.rooms) && doc.rooms.length > 0) return doc.rooms;
  return ROOMS_BY_CATEGORY[categoryKey(doc.category)];
}
