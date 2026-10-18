/**
 * File upload service — Cloudinary when configured, otherwise optional GCS, otherwise local disk.
 */

import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { cloudinaryFolder, isCloudinaryConfigured, uploadToCloudinary } from './cloudinaryStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_ROOT = join(__dirname, '..', '..', 'uploads');
const GLB_DIR = join(UPLOAD_ROOT, 'glb');
const THUMB_DIR = join(UPLOAD_ROOT, 'thumbnails');
const AVATAR_DIR = join(UPLOAD_ROOT, 'avatars');
const PROFILE_PICTURE_DIR = join(UPLOAD_ROOT, 'profile-pictures');

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
  for (const dir of [UPLOAD_ROOT, GLB_DIR, THUMB_DIR, AVATAR_DIR, PROFILE_PICTURE_DIR]) {
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

/**
 * Uploads to Cloudinary when it is configured; returns null otherwise. Errors (e.g. a file over
 * the plan's size limit) are thrown so the uploader sees them instead of a LAN-only fallback.
 */
async function uploadToCloudinaryIfConfigured(buffer, { subdir, filename, contentType, raw }) {
  if (!isCloudinaryConfigured()) return null;
  const name = raw ? filename : filename.replace(/\.[^.]+$/, '');
  const { url } = await uploadToCloudinary(buffer, {
    resourceType: raw ? 'raw' : 'image',
    publicId: `${cloudinaryFolder()}/${subdir}/${name}`,
    filename,
    contentType,
  });
  return url;
}

async function saveLocally(buffer, subdir, filename) {
  await ensureDirs();
  const dir =
    subdir === 'glb'
      ? GLB_DIR
      : subdir === 'avatars'
        ? AVATAR_DIR
        : subdir === 'profile-pictures'
          ? PROFILE_PICTURE_DIR
          : THUMB_DIR;
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

  const cloudUrl = await uploadToCloudinaryIfConfigured(file.buffer, {
    subdir: 'glb', filename: safeName, contentType: 'model/gltf-binary', raw: true,
  });
  if (cloudUrl) {
    return { url: cloudUrl, filename: safeName, storage: 'cloudinary' };
  }

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
  const cloudUrl = await uploadToCloudinaryIfConfigured(file.buffer, { subdir: 'thumbnails', filename: safeName, contentType });
  if (cloudUrl) {
    return { url: cloudUrl, filename: safeName, storage: 'cloudinary' };
  }

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
  const cloudUrl = await uploadToCloudinaryIfConfigured(file.buffer, { subdir: 'avatars', filename: safeName, contentType });
  if (cloudUrl) {
    return { url: cloudUrl, filename: safeName, storage: 'cloudinary' };
  }

  const gcsUrl = await uploadToGcsIfConfigured(file.buffer, gcsPath, contentType);
  if (gcsUrl) {
    return { url: gcsUrl, filename: safeName, storage: 'gcs' };
  }

  const url = await saveLocally(file.buffer, 'avatars', safeName);
  return { url, filename: safeName, storage: 'local' };
}

/**
 * A user's profile photo (already shrunk to a small JPEG). Cloudinary keeps one file per user —
 * a new photo replaces it and its link changes version; GCS and local copies get a new name.
 */
export async function uploadProfilePicture(buffer, userId) {
  if (!buffer?.length) {
    throw new Error('No profile picture provided');
  }

  const id = sanitizeFilename(String(userId || 'user'));
  const cloudUrl = await uploadToCloudinaryIfConfigured(buffer, {
    subdir: 'profile-pictures',
    filename: `${id}.jpg`,
    contentType: 'image/jpeg',
  });
  if (cloudUrl) {
    return { url: cloudUrl, storage: 'cloudinary' };
  }

  const fileName = `${id}-${Date.now()}.jpg`;
  const gcsUrl = await uploadToGcsIfConfigured(buffer, `profile-pictures/${fileName}`, 'image/jpeg');
  if (gcsUrl) {
    return { url: gcsUrl, storage: 'gcs' };
  }

  const url = await saveLocally(buffer, 'profile-pictures', fileName);
  return { url, storage: 'local' };
}

export { UPLOAD_ROOT, getPublicBaseUrl };
