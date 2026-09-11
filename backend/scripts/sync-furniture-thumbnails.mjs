/**
 * Copy Unity FurnitureIcons into backend/uploads/thumbnails and
 * set furniture.thumbnailUrl for catalog items.
 *
 * Usage:
 *   node scripts/sync-furniture-thumbnails.mjs
 */

import '../src/loadEnv.js';
import { copyFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ICONS_DIR = join(
  ROOT,
  'InteriorDesignViewer',
  'Assets',
  '_App',
  'Furniture',
  'Resources',
  'FurnitureIcons'
);
const THUMB_DIR = join(__dirname, '..', 'uploads', 'thumbnails');

const ALIASES = {
  'malaysia-sofa': 'malaysian-sofa',
};

function getPublicBaseUrl() {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}/uploads`;
}

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

await mkdir(THUMB_DIR, { recursive: true });

if (!existsSync(ICONS_DIR)) {
  console.error(`Icons folder not found: ${ICONS_DIR}`);
  process.exit(1);
}

const iconFiles = (await readdir(ICONS_DIR)).filter((name) => name.toLowerCase().endsWith('.png'));
const iconById = new Map();

for (const file of iconFiles) {
  const id = slugify(file.replace(/\.png$/i, ''));
  const dest = join(THUMB_DIR, `${id}.png`);
  await copyFile(join(ICONS_DIR, file), dest);
  iconById.set(id, `${id}.png`);
  console.log(`Copied ${file} -> ${id}.png`);
}

// Category fallbacks so products without a dedicated icon still show a preview.
const seatingFallbackSrc = iconById.get('bahamas-sofa') || [...iconById.values()].find((f) => f.includes('sofa'));
const bedsFallbackSrc = iconById.get('sakura-bed') || seatingFallbackSrc;

if (seatingFallbackSrc) {
  await copyFile(join(THUMB_DIR, seatingFallbackSrc), join(THUMB_DIR, '_default-seating.png'));
}
if (bedsFallbackSrc) {
  await copyFile(join(THUMB_DIR, bedsFallbackSrc), join(THUMB_DIR, '_default-beds.png'));
}

const base = getPublicBaseUrl();
await connectMongoDB();

const items = await Furniture.find({}).select('id category thumbnailUrl').lean();
let matched = 0;
let fallback = 0;
let skipped = 0;

for (const item of items) {
  const alias = ALIASES[item.id];
  const iconFile = iconById.get(item.id) || (alias ? iconById.get(alias) : null);

  let fileName = iconFile;
  if (!fileName) {
    if (item.category === 'beds' && existsSync(join(THUMB_DIR, '_default-beds.png'))) {
      fileName = '_default-beds.png';
      fallback += 1;
    } else if (existsSync(join(THUMB_DIR, '_default-seating.png'))) {
      fileName = '_default-seating.png';
      fallback += 1;
    } else {
      skipped += 1;
      continue;
    }
  } else {
    // Prefer product-specific icon copied under product id when alias was used.
    if (alias && iconById.get(alias)) {
      const dest = join(THUMB_DIR, `${item.id}.png`);
      await copyFile(join(THUMB_DIR, iconById.get(alias)), dest);
      fileName = `${item.id}.png`;
    }
    matched += 1;
  }

  const thumbnailUrl = `${base}/thumbnails/${fileName}`;
  await Furniture.updateOne({ id: item.id }, { $set: { thumbnailUrl } });
}

console.log(`\nUpdated thumbnails`);
console.log(`  Matched icons: ${matched}`);
console.log(`  Category fallbacks: ${fallback}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Public base: ${base}`);

await disconnectMongoDB();
process.exit(0);
