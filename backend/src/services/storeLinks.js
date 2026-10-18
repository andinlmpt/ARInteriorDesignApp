/**
 * The store behind a product, as the mobile app shows it ("Where to buy"). Store owners type
 * their links freely ("facebook.com/shop", "@shop", "shop.ph"), so they are turned into
 * working https links here; anything else (other schemes, spaces) is dropped.
 */

import { getRequestOrigin, rewriteLocalhostUrl } from '../utils/publicAssetUrl.js';

const HANDLE = /^[A-Za-z0-9._-]{1,100}$/;

/** https URL for a website, or '' when it can't be one. */
export function normalizeWebsite(value) {
  const raw = String(value || '').trim();
  if (!raw || /\s/.test(raw)) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  return toHttpUrl(withScheme);
}

/**
 * Link to a profile on a social site: a full URL, the site's address without https, or just
 * the handle (with or without "@").
 */
export function normalizeSocial(value, host) {
  const raw = String(value || '').trim();
  if (!raw || /\s/.test(raw)) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return toHttpUrl(raw);

  const bare = raw.replace(/^\/+/, '');
  const hostPattern = new RegExp(`^(?:[a-z0-9-]+\\.)*(?:${host.replace('.', '\\.')})(?:/|$)`, 'i');
  if (hostPattern.test(bare) || (host === 'facebook.com' && /^(?:[a-z0-9-]+\.)*fb\.com(?:\/|$)/i.test(bare))) {
    return toHttpUrl(`https://${bare}`);
  }

  const handle = bare.replace(/^@/, '').replace(/\/+$/, '');
  return HANDLE.test(handle) ? `https://www.${host}/${handle}` : '';
}

/** Digits for a tel: link (a leading + kept), or '' when it is too short to be a number. */
export function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return raw.startsWith('+') ? `+${digits}` : digits;
}

export function normalizeEmail(value) {
  const raw = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : '';
}

function toHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (!url.hostname.includes('.')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Public store details for a product, from a populated `store` field. Null when the product
 * has no store (or it wasn't populated).
 */
export function toPublicStore(store, req) {
  if (!store || typeof store !== 'object' || !store._id || !store.name) return null;

  const logo = String(store.logoUrl || '').trim();
  let logoUrl = '';
  if (/^https?:\/\//i.test(logo)) logoUrl = rewriteLocalhostUrl(logo, req) || logo;
  else if (logo.startsWith('/')) logoUrl = `${getRequestOrigin(req)}${logo}`;

  return {
    id: store._id.toString(),
    name: store.name,
    city: store.city || '',
    logoUrl,
    website: normalizeWebsite(store.website),
    facebook: normalizeSocial(store.facebook, 'facebook.com'),
    instagram: normalizeSocial(store.instagram, 'instagram.com'),
    phone: normalizePhone(store.phone),
    email: normalizeEmail(store.email),
  };
}

/** Fields to populate on `Furniture.store` for the public catalog. */
export const PUBLIC_STORE_FIELDS = 'name city logoUrl website facebook instagram phone email';
