/**
 * File upload service — local disk storage with optional GCS support.
 */

import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_ROOT = join(__dirname, '..', '..', 'uploads');
const GLB_DIR = join(UPLOAD_ROOT, 'glb');
const THUMB_DIR = join(UPLOAD_ROOT, 'thumbnails');
const AVATAR_DIR = join(UPLOAD_ROOT, 'avatars');

const ALLOWED_GLB = ['.glb', '.gltf'];
const ALLOWED_IMAGE = ['.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_THUMB = ALLOWED_IMAGE;

function getPublicBaseUrl() {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}/uploads`;
}

async function ensureDirs() {
  for (const dir of [UPLOAD_ROOT, GLB_DIR, THUMB_DIR, AVATAR_DIR]) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

function sanitizeFilename(name) {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function validateExtension(filename, allowed) {
  const ext = extname(filename).toLowerCase();
  if (!allowed.includes(ext)) {
    throw new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`);
  }
  return ext;
}

async function uploadToGcsIfConfigured(buffer, destination, contentType) {
  const bucketName = process.env.GCS_BUCKET_NAME?.trim();
  if (!bucketName) {
    return null;
  }

  try {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destination);

    await file.save(buffer, {
      metadata: { contentType },
      resumable: false,
    });

    const publicBase = process.env.FURNITURE_GCS_BASE_URL?.trim()?.replace(/\/+$/, '');
    if (publicBase) {
      return `${publicBase}/${destination.split('/').map(encodeURIComponent).join('/')}`;
    }

    return `https://storage.googleapis.com/${bucketName}/${destination.split('/').map(encodeURIComponent).join('/')}`;
  } catch (error) {
    console.warn('[Upload] GCS upload failed, falling back to local storage:', error.message);
    return null;
  }
}

async function saveLocally(buffer, subdir, filename) {
  await ensureDirs();
  const dir =
    subdir === 'glb' ? GLB_DIR : subdir === 'avatars' ? AVATAR_DIR : THUMB_DIR;
  const filePath = join(dir, filename);
  await writeFile(filePath, buffer);
  const base = getPublicBaseUrl();
  return `${base}/${subdir}/${encodeURIComponent(filename)}`;
}

export async function uploadGlb(file) {
  if (!file?.buffer) {
    throw new Error('No GLB file provided');
  }

  const ext = validateExtension(file.originalname, ALLOWED_GLB);
  const safeName = `${randomUUID()}-${sanitizeFilename(file.originalname.replace(ext, ''))}${ext}`;
  const gcsPath = `furniture/glb/${safeName}`;

  const gcsUrl = await uploadToGcsIfConfigured(file.buffer, gcsPath, 'model/gltf-binary');
  if (gcsUrl) {
    return { url: gcsUrl, filename: safeName, storage: 'gcs' };
  }

  const url = await saveLocally(file.buffer, 'glb', safeName);
  return { url, filename: safeName, storage: 'local' };
}

export async function uploadThumbnail(file) {
  if (!file?.buffer) {
    throw new Error('No thumbnail file provided');
  }

  const ext = validateExtension(file.originalname, ALLOWED_THUMB);
  const safeName = `${randomUUID()}-${sanitizeFilename(file.originalname.replace(ext, ''))}${ext}`;
  const gcsPath = `furniture/thumbnails/${safeName}`;

  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const gcsUrl = await uploadToGcsIfConfigured(file.buffer, gcsPath, contentType);
  if (gcsUrl) {
    return { url: gcsUrl, filename: safeName, storage: 'gcs' };
  }

  const url = await saveLocally(file.buffer, 'thumbnails', safeName);
  return { url, filename: safeName, storage: 'local' };
}

export async function uploadAvatar(file) {
  if (!file?.buffer) {
    throw new Error('No avatar file provided');
  }

  const ext = validateExtension(file.originalname, ALLOWED_IMAGE);
  const safeName = `${randomUUID()}-${sanitizeFilename(file.originalname.replace(ext, ''))}${ext}`;
  const gcsPath = `admin/avatars/${safeName}`;

  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const gcsUrl = await uploadToGcsIfConfigured(file.buffer, gcsPath, contentType);
  if (gcsUrl) {
    return { url: gcsUrl, filename: safeName, storage: 'gcs' };
  }

  const url = await saveLocally(file.buffer, 'avatars', safeName);
  return { url, filename: safeName, storage: 'local' };
}

export { UPLOAD_ROOT, getPublicBaseUrl };
