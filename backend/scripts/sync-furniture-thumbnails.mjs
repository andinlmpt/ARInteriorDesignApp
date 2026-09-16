/**
 * Copy furniture icon PNGs into backend/uploads/thumbnails and
 * set furniture.thumbnailUrl for catalog items.
 *
 * Default icon source: backend/assets/furniture-icons
 * Override: FURNITURE_ICONS_DIR=/path/to/icons
 *
 * Usage:
 *   npm run seed:furniture:thumbnails
 */

import '../src/loadEnv.js';
import { copyFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import {
  iconSlugFromFileName,
  resolveIconSlug,
  resolveIconsDir,
} from './furniture-icon-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THUMB_DIR = join(__dirname, '..', 'uploads', 'thumbnails');

function getPublicBaseUrl() {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}/uploads`;
}

const ICONS_DIR = resolveIconsDir();

await mkdir(THUMB_DIR, { recursive: true });

if (!existsSync(ICONS_DIR)) {
  console.error(`Icons folder not found: ${ICONS_DIR}`);
  process.exit(1);
}

console.log(`Using icon source: ${ICONS_DIR}`);

const iconFiles = (await readdir(ICONS_DIR)).filter((name) =>
  /\.(png|jpg|jpeg|webp)$/i.test(name)
);
const iconById = new Map();

for (const file of iconFiles) {
  const id = iconSlugFromFileName(file);
  const dest = join(THUMB_DIR, `${id}.png`);
  await copyFile(join(ICONS_DIR, file), dest);
  iconById.set(id, `${id}.png`);
  console.log(`Copied ${file} -> ${id}.png`);
}

const seatingFallbackSrc = iconById.get('bahamas-sofa') || [...iconById.values()].find((f) => f.includes('sofa'));
const bedsFallbackSrc = iconById.get('sakura-bed') || iconById.get('cosmos-bed') || seatingFallbackSrc;

if (seatingFallbackSrc) {
  await copyFile(join(THUMB_DIR, seatingFallbackSrc), join(THUMB_DIR, '_default-seating.png'));
}
if (bedsFallbackSrc) {
  await copyFile(join(THUMB_DIR, bedsFallbackSrc), join(THUMB_DIR, '_default-beds.png'));
}

const base = getPublicBaseUrl();
await connectMongoDB();

const items = await Furniture.find({}).select('id displayName category thumbnailUrl').lean();
let matched = 0;
let fallback = 0;
let skipped = 0;

for (const item of items) {
  const iconSlug = resolveIconSlug(item, iconById);
  let fileName = iconSlug ? iconById.get(iconSlug) : null;

  if (!fileName) {
    if (item.category === 'beds' && existsSync(join(THUMB_DIR, '_default-beds.png'))) {
      fileName = '_default-beds.png';
      fallback += 1;
    } else if (existsSync(join(THUMB_DIR, '_default-seating.png'))) {
      fileName = '_default-seating.png';
      fallback += 1;
    } else {
      skipped += 1;
      console.warn(`No icon for: ${item.id} (${item.displayName})`);
      continue;
    }
  } else {
    if (iconSlug !== item.id) {
      const dest = join(THUMB_DIR, `${item.id}.png`);
      await copyFile(join(THUMB_DIR, fileName), dest);
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
