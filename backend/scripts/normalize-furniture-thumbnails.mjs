/**
 * Normalize furniture thumbnail PNGs so every product fills a consistent square.
 *
 * - Trims transparent / near-edge whitespace
 * - Places the subject centered on a transparent square canvas
 * - Leaves uniform padding so Home cards look the same size
 *
 * Processes:
 *   backend/assets/furniture-icons  (source icons)
 *   backend/uploads/thumbnails      (served to the app)
 *
 * Usage: node scripts/normalize-furniture-thumbnails.mjs
 */

import { readdir, mkdir, rename, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import { resolveIconsDir } from './furniture-icon-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_THUMBS = join(__dirname, '..', 'uploads', 'thumbnails');
const ICONS_DIR = resolveIconsDir();

const SIZE = Number(process.env.FURNITURE_THUMB_SIZE || 1024);
/** Subject occupies this fraction of the square (rest is equal padding). */
const CONTENT_RATIO = Number(process.env.FURNITURE_THUMB_CONTENT_RATIO || 0.88);
const TRIM_THRESHOLD = Number(process.env.FURNITURE_THUMB_TRIM_THRESHOLD || 28);

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

async function listImages(dir) {
  if (!existsSync(dir)) return [];
  const names = await readdir(dir);
  return names
    .filter((name) => IMAGE_EXT.test(name) && !name.startsWith('.') && !name.includes('.tmp-'))
    .map((name) => join(dir, name));
}

async function normalizeOne(inputPath, outputPath) {
  const contentSize = Math.max(64, Math.round(SIZE * CONTENT_RATIO));

  let trimmed;
  try {
    trimmed = await sharp(inputPath)
      .rotate()
      .ensureAlpha()
      .trim({ threshold: TRIM_THRESHOLD })
      .png()
      .toBuffer();
  } catch {
    trimmed = await sharp(inputPath).rotate().ensureAlpha().png().toBuffer();
  }

  const resized = await sharp(trimmed)
    .resize(contentSize, contentSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toFile(outputPath);
}

async function normalizeDirectory(dir, label) {
  const files = await listImages(dir);
  console.log(`[normalize] ${label}: ${files.length} images in ${dir}`);
  let ok = 0;
  let failed = 0;

  for (const file of files) {
    const outPng = join(dirname(file), `${basename(file, extname(file))}.png`);
    const tmp = `${outPng}.tmp-normalize.png`;
    try {
      await normalizeOne(file, tmp);
      await rename(tmp, outPng);
      ok += 1;
      console.log(`  ✓ ${basename(outPng)}`);
    } catch (error) {
      failed += 1;
      try {
        await unlink(tmp);
      } catch {
        /* ignore */
      }
      console.warn(`  ✗ ${basename(file)}: ${error.message}`);
    }
  }

  return { ok, failed, total: files.length };
}

function getPublicBaseUrl() {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '').replace(/\/uploads$/i, '') + '/uploads';
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}/uploads`;
}

async function bumpThumbnailCacheBusters() {
  await connectMongoDB();
  const version = Date.now();
  const base = getPublicBaseUrl().replace(/\/+$/, '');
  const items = await Furniture.find({}).select('id thumbnailUrl').lean();
  let updated = 0;

  for (const item of items) {
    const id = String(item.id || '').trim().toLowerCase();
    if (!id) continue;
    const next = `${base}/thumbnails/${encodeURIComponent(`${id}.png`)}?v=${version}`;
    if (item.thumbnailUrl === next) continue;
    await Furniture.updateOne({ _id: item._id }, { $set: { thumbnailUrl: next } });
    updated += 1;
  }

  console.log(`[normalize] Bumped thumbnailUrl cache busters on ${updated} furniture docs (v=${version})`);
  await disconnectMongoDB();
}

await mkdir(UPLOAD_THUMBS, { recursive: true });

const iconsResult = await normalizeDirectory(ICONS_DIR, 'furniture-icons');
const uploadResult = await normalizeDirectory(UPLOAD_THUMBS, 'uploads/thumbnails');

console.log(
  JSON.stringify(
    {
      size: SIZE,
      contentRatio: CONTENT_RATIO,
      icons: iconsResult,
      uploads: uploadResult,
    },
    null,
    2,
  ),
);

await bumpThumbnailCacheBusters();
