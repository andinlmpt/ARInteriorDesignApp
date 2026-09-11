/**
 * Seed MongoDB furniture catalog from backend/data/furniture-seed.json.
 *
 * Required env (backend/.env):
 *   MONGODB_URI=...
 *   MONGODB_DB_NAME=ARINTERIORDESIGNAPP
 *   FURNITURE_GCS_BASE_URL=https://storage.googleapis.com/unity-furniture-assets-01
 * Optional:
 *   FURNITURE_THUMBNAIL_BASE_URL=https://storage.googleapis.com/YOUR_BUCKET/furniture/thumbnails
 *
 * Usage: node scripts/seed-furniture.mjs
 */

import '../src/loadEnv.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '..', 'data', 'furniture-seed.json');
const dimensionsPath = join(__dirname, '..', 'data', 'furniture-dimensions.json');

const trimSlash = (value) => String(value || '').replace(/\/+$/, '');

const encodeObjectPath = (fileName) =>
  String(fileName || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const buildObjectUrl = (base, fileName) => `${trimSlash(base)}/${encodeObjectPath(fileName)}`;

const glbBase = trimSlash(process.env.FURNITURE_GCS_BASE_URL);
const thumbBase = trimSlash(process.env.FURNITURE_THUMBNAIL_BASE_URL || '');

if (!glbBase) {
  console.error('Missing FURNITURE_GCS_BASE_URL in backend/.env');
  console.error('Example: FURNITURE_GCS_BASE_URL=https://storage.googleapis.com/unity-furniture-assets-01');
  process.exit(1);
}

const raw = await readFile(seedPath, 'utf8');
const { furniture } = JSON.parse(raw);

let dimensionById = new Map();
try {
  const dimRaw = await readFile(dimensionsPath, 'utf8');
  const { furniture: dims } = JSON.parse(dimRaw);
  dimensionById = new Map(dims.map((d) => [d.id, d]));
} catch {
  console.warn('[seed-furniture] No furniture-dimensions.json — using seed defaults only.');
}

await connectMongoDB();

let upserted = 0;
for (const item of furniture) {
  const glbFile = item.glbFileName || `${item.id}.glb`;
  const thumbFile = item.thumbnailFileName || `${item.id}.webp`;
  const dim = dimensionById.get(item.id);

  // Unity convention: width=x (W), depth=z (L), height=y (H)
  const width = dim?.width ?? item.width ?? 2.0;
  const height = dim?.height ?? item.height ?? 0.85;
  const depth = dim?.length ?? item.depth ?? 0.9;

  await Furniture.findOneAndUpdate(
    { id: item.id },
    {
      id: item.id,
      displayName: item.displayName,
      category: item.category,
      glbUrl: buildObjectUrl(glbBase, glbFile),
      thumbnailUrl: thumbBase ? buildObjectUrl(thumbBase, thumbFile) : (item.thumbnailUrl || ''),
      width,
      height,
      depth,
      dimensionLabel: dim?.label ?? '',
      lengthIn: dim?.lengthIn ?? 0,
      widthIn: dim?.widthIn ?? 0,
      heightIn: dim?.heightIn ?? 0,
      sortOrder: item.sortOrder ?? 0,
      active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  upserted += 1;
  console.log(`  ✓ ${item.id}`);
}

console.log(`\nSeeded ${upserted} furniture items.`);
await disconnectMongoDB();
process.exit(0);
