/**
 * Friendly names for AR Furniture photo captures.
 * Disk/gallery keep a branded technical stem; Saved tab shows a readable title.
 */

import { BRAND } from '@/constants/branding';

/** File stem written by Unity / used when saving to gallery. */
export function buildArPhotoFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `Maharlika_AR_${stamp}.png`;
}

/**
 * Display title for Saved tab / image viewer.
 * Examples: "AR Capture · Sep 20, 2026"
 */
export function formatArPhotoDisplayName(
  fileNameOrTitle?: string | null,
  savedAtMs?: number | null
): string {
  const fromStamp = parseStampFromFileName(fileNameOrTitle);
  const date = fromStamp ?? (savedAtMs ? new Date(savedAtMs) : new Date());

  if (Number.isNaN(date.getTime())) {
    return 'AR Capture';
  }

  const label = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `AR Capture · ${label}`;
}

export function isArPhotoFileName(name?: string | null): boolean {
  if (!name) return false;
  return /^(ar_photo_|Maharlika_AR_)/i.test(name) || /\.png$/i.test(name) && /AR/i.test(name);
}

function parseStampFromFileName(name?: string | null): Date | null {
  if (!name) return null;

  // Maharlika_AR_2026-09-20_005424.png
  let match = name.match(/(\d{4})-(\d{2})-(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    );
  }

  // ar_photo_20260920_005424.png
  match = name.match(/(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    );
  }

  return null;
}

export const AR_PHOTO_SHARE_SUBJECT = `${BRAND.name} — AR capture`;
