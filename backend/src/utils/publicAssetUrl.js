/**
 * Resolve LAN-reachable absolute URLs for furniture media.
 * Unity / phones cannot fetch http://localhost — rewrite to the request host.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { UPLOAD_ROOT, getPublicBaseUrl } from '../services/uploadService.js';

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;
const PRIVATE_LAN_RE =
  /^https?:\/\/((?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3})(:\d+)?/i;

/**
 * Public origin for this request (no trailing slash), e.g. http://192.168.1.33:3000
 */
export function getRequestOrigin(req) {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '').replace(/\/uploads$/i, '');
  }

  if (req) {
    const xfProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim();
    const xfHost = String(req.headers['x-forwarded-host'] || '')
      .split(',')[0]
      .trim();
    const host = xfHost || req.headers.host;
    if (host) {
      const proto = xfProto || req.protocol || 'http';
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

/**
 * Rewrite localhost / stale LAN upload URLs to the request/LAN origin.
 */
export function rewriteLocalhostUrl(url, req) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const origin = getRequestOrigin(req);

  if (LOCALHOST_RE.test(raw)) {
    return raw.replace(LOCALHOST_RE, origin);
  }

  // Thumbnails saved with an old Wi‑Fi IP (e.g. 192.168.1.33) after hotspot switch.
  if (PRIVATE_LAN_RE.test(raw) && raw.includes('/uploads')) {
    try {
      const parsed = new URL(raw);
      const target = new URL(origin);
      if (parsed.hostname !== target.hostname) {
        parsed.protocol = target.protocol;
        parsed.hostname = target.hostname;
        parsed.port = target.port;
        return parsed.toString();
      }
    } catch {
      return raw;
    }
  }

  return raw;
}

/**
 * Use the stored glbUrl (typically GCS). Local uploads/glb/{id}.glb is only a
 * fallback when no remote URL is configured.
 */
export function resolveFurnitureGlbUrl(doc, req) {
  const stored = String(doc?.glbUrl || '').trim();
  if (stored) {
    return rewriteLocalhostUrl(stored, req) || stored;
  }

  const id = String(doc?.id || '')
    .trim()
    .toLowerCase();
  if (id) {
    const localPath = join(UPLOAD_ROOT, 'glb', `${id}.glb`);
    if (existsSync(localPath)) {
      return `${getRequestOrigin(req)}/uploads/glb/${encodeURIComponent(`${id}.glb`)}`;
    }
  }

  return '';
}

export function resolveFurnitureThumbnailUrl(doc, req) {
  return rewriteLocalhostUrl(doc?.thumbnailUrl || '', req);
}

export { getPublicBaseUrl };
