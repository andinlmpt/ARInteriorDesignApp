import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export const DEFAULT_ICONS_DIR = join(__dirname, '..', 'assets', 'furniture-icons');
export const UNITY_ICONS_DIR = join(
  ROOT,
  'InteriorDesignViewer',
  'Assets',
  '_App',
  'Furniture',
  'Resources',
  'FurnitureIcons'
);
export const UNITY_DIMENSIONS_PATH = join(
  ROOT,
  'InteriorDesignViewer',
  'Assets',
  '_App',
  'Furniture',
  'Resources',
  'FurnitureDimensions.json'
);

/** Catalog product id -> icon filename slug when they differ. */
export const CATALOG_TO_ICON = {
  'malaysian-sofa': 'malaysia-sofa',
  'maldives-love-seats': 'maldives-love-seat',
  'indonesia-love-seats': 'indonesia-love-seat',
  'phillipine-sofa': 'philippines-sofa',
  'latvia-sofda': 'latvia-sofa',
};

export const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function resolveIconsDir() {
  const configured = process.env.FURNITURE_ICONS_DIR?.trim();
  if (configured && existsSync(configured)) return configured;
  if (existsSync(DEFAULT_ICONS_DIR)) return DEFAULT_ICONS_DIR;
  if (existsSync(UNITY_ICONS_DIR)) return UNITY_ICONS_DIR;
  return DEFAULT_ICONS_DIR;
}

export function iconSlugFromFileName(fileName) {
  return slugify(fileName.replace(/\.(png|jpg|jpeg|webp)$/i, ''));
}

/** Progressively shorter hyphen prefixes, e.g. a-b-c-d → a-b-c → a-b */
function slugPrefixes(slug) {
  const parts = String(slug || '')
    .split('-')
    .filter(Boolean);
  if (parts.length === 0) return [];
  const out = [];
  for (let len = parts.length; len >= 2; len -= 1) {
    out.push(parts.slice(0, len).join('-'));
  }
  if (parts.length === 1) out.push(parts[0]);
  return out;
}

export function resolveIconSlug(catalogItem, iconById) {
  const candidates = [
    catalogItem.id,
    CATALOG_TO_ICON[catalogItem.id],
    slugify(catalogItem.displayName),
    CATALOG_TO_ICON[slugify(catalogItem.displayName)],
  ].filter(Boolean);

  const expanded = [];
  for (const key of candidates) {
    expanded.push(key);
    for (const prefix of slugPrefixes(key)) {
      if (!expanded.includes(prefix)) expanded.push(prefix);
    }
  }

  for (const key of expanded) {
    if (iconById.has(key)) return key;
  }

  for (const key of expanded) {
    if (key.endsWith('s')) {
      const singular = key.slice(0, -1);
      if (iconById.has(singular)) return singular;
    } else if (iconById.has(`${key}s`)) {
      return `${key}s`;
    }
  }

  // Last resort: longest icon slug that is a prefix of the catalog id
  let best = null;
  for (const iconSlug of iconById.keys()) {
    if (
      catalogItem.id === iconSlug ||
      catalogItem.id.startsWith(`${iconSlug}-`)
    ) {
      if (!best || iconSlug.length > best.length) best = iconSlug;
    }
  }

  return best;
}
