/**
 * Shared furniture field handling for the store portal (create/update) and the admin
 * overview (read-only + moderation).
 */

import Furniture from '../models/Furniture.js';

export const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const parseAvailableColors = (value) => {
  if (Array.isArray(value)) {
    return value.map((color) => String(color).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean);
  }
  return [];
};

/** Accepts a number or legacy inventory text like "2 sofa pieces + 1 stool". */
export const parseQuantity = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() !== '') {
    return Math.max(0, Math.floor(asNumber));
  }
  const matches = String(value || '').match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((sum, n) => sum + Number(n), 0);
};

/** `store` may be a populated Store document, an ObjectId, or null. */
export const toFurnitureDto = (doc) => {
  const store = doc.store && typeof doc.store === 'object' && 'name' in doc.store ? doc.store : null;
  return {
    id: doc.id,
    displayName: doc.displayName,
    category: doc.category,
    glbUrl: doc.glbUrl,
    thumbnailUrl: doc.thumbnailUrl || '',
    width: doc.width,
    height: doc.height,
    depth: doc.depth,
    dimensionLabel: doc.dimensionLabel || '',
    lengthIn: doc.lengthIn || 0,
    widthIn: doc.widthIn || 0,
    heightIn: doc.heightIn || 0,
    quantity: parseQuantity(doc.quantity),
    availableColors: Array.isArray(doc.availableColors) ? doc.availableColors : [],
    pricePhp: Number(doc.pricePhp) || 0,
    styles: Array.isArray(doc.styles) ? doc.styles : [],
    rooms: Array.isArray(doc.rooms) ? doc.rooms : [],
    roomTypes: Array.isArray(doc.roomTypes) && doc.roomTypes.length > 0
      ? doc.roomTypes
      : (Array.isArray(doc.rooms) ? doc.rooms : []),
    active: doc.active,
    sortOrder: doc.sortOrder,
    storeId: doc.store ? String(store ? store._id : doc.store) : null,
    storeName: store ? store.name : '',
    storeStatus: store ? store.status : '',
    takenDown: Boolean(doc.takenDown),
    takenDownReason: doc.takenDownReason || '',
    modelSize: doc.modelSize
      ? { width: doc.modelSize.width, height: doc.modelSize.height, depth: doc.modelSize.depth }
      : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const EDITABLE_FIELDS = [
  'displayName', 'category', 'glbUrl', 'thumbnailUrl',
  'width', 'height', 'depth', 'dimensionLabel',
  'lengthIn', 'widthIn', 'heightIn', 'quantity', 'availableColors',
  'pricePhp', 'styles', 'rooms', 'roomTypes',
  'active', 'sortOrder',
];

/**
 * Copies the editable fields present in `body` onto `item`. Ownership (`store`) and
 * moderation (`takenDown`) are never taken from the request body.
 */
export function applyFurnitureFields(item, body) {
  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;

    if (field === 'active') {
      item.active = body.active !== false && body.active !== 'false';
    } else if (field === 'availableColors') {
      item.availableColors = parseAvailableColors(body.availableColors);
    } else if (field === 'styles') {
      item.styles = Array.isArray(body.styles) ? body.styles.map(String) : [];
    } else if (field === 'rooms' || field === 'roomTypes') {
      const list = Array.isArray(body[field]) ? body[field].map(String) : [];
      item[field] = list;
      if (field === 'roomTypes') item.rooms = list;
      if (field === 'rooms') item.roomTypes = list;
    } else if (field === 'pricePhp') {
      item.pricePhp = Math.max(0, Math.round(Number(body.pricePhp) || 0));
    } else if (field === 'quantity') {
      item.quantity = Math.max(0, Math.floor(Number(body.quantity) || 0));
    } else if (['width', 'height', 'depth', 'lengthIn', 'widthIn', 'heightIn', 'sortOrder'].includes(field)) {
      item[field] = Number(body[field]) || 0;
    } else if (field === 'category') {
      item.category = String(body.category).trim().toLowerCase();
    } else {
      item[field] = String(body[field]).trim();
    }
  }
  return item;
}

/**
 * Product ids are global (the AR scene and saved designs refer to them), so two stores
 * selling a "Classic Sofa" get "classic-sofa" and "classic-sofa-2".
 */
export async function uniqueFurnitureId(base) {
  const root = slugify(base);
  if (!root) return '';
  if (!(await Furniture.exists({ id: root }))) return root;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!(await Furniture.exists({ id: candidate }))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
