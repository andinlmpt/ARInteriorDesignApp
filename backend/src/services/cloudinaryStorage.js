/**
 * Cloudinary storage for uploaded images and 3D models (signed uploads, no SDK).
 *
 * Configure with CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 * (shown on the Cloudinary console dashboard), or with CLOUDINARY_CLOUD_NAME,
 * CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. CLOUDINARY_FOLDER sets the top folder
 * (default "ar-interior"). The API secret stays on the server.
 */

import { createHash } from 'crypto';

/** Credentials from the environment, or null when Cloudinary isn't configured. */
export function getCloudinaryConfig(env = process.env) {
  const url = env.CLOUDINARY_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'cloudinary:' && parsed.hostname && parsed.username && parsed.password) {
        return {
          cloudName: parsed.hostname,
          apiKey: decodeURIComponent(parsed.username),
          apiSecret: decodeURIComponent(parsed.password),
        };
      }
    } catch {
      // fall through to the separate variables
    }
  }

  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export const isCloudinaryConfigured = () => getCloudinaryConfig() !== null;

/** Top-level Cloudinary folder for this app's files. */
export const cloudinaryFolder = () =>
  (process.env.CLOUDINARY_FOLDER || 'ar-interior').trim().replace(/^\/+|\/+$/g, '') || 'ar-interior';

/** Cloudinary request signature: SHA-1 of the sorted "key=value" pairs joined by "&", plus the secret. */
export function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/** "File size too large. Got 10806272. Maximum is 10485760." → a message a store can act on. */
function friendlyError(message, status) {
  const tooLarge = /File size too large\. Got (\d+)\. Maximum is (\d+)/i.exec(message || '');
  if (tooLarge) {
    const mb = (bytes) => (Number(bytes) / (1024 * 1024)).toFixed(1);
    return `The file is ${mb(tooLarge[1])} MB, but the storage plan allows up to ${mb(tooLarge[2])} MB. Compress it and upload again.`;
  }
  return message || `Cloudinary upload failed (${status})`;
}

/**
 * Uploads a buffer and returns its HTTPS URL.
 * resourceType "image" for pictures (resizable on delivery), "raw" for 3D models
 * (delivered byte-for-byte). For raw files the public id must keep its extension.
 */
export async function uploadToCloudinary(
  buffer,
  { resourceType, publicId, filename, contentType },
  { fetchImpl = fetch, config = getCloudinaryConfig() } = {}
) {
  if (!config) throw new Error('Cloudinary is not configured');

  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType || 'application/octet-stream' }), filename);
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));
  form.append('api_key', config.apiKey);
  form.append('signature', signParams(params, config.apiSecret));

  const res = await fetchImpl(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`,
    { method: 'POST', body: form }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error(friendlyError(data?.error?.message, res.status));
  }
  return { url: data.secure_url, publicId: data.public_id, bytes: data.bytes };
}

/**
 * Smaller delivery URL for a Cloudinary image (keeps the original format, which Unity needs).
 * Other URLs are returned unchanged.
 */
export function cloudinaryResized(url, maxWidth = 600) {
  const value = String(url || '');
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(value)) return value;
  if (/\/image\/upload\/c_limit,w_\d+,q_auto\//.test(value)) return value;
  return value.replace('/image/upload/', `/image/upload/c_limit,w_${maxWidth},q_auto/`);
}
