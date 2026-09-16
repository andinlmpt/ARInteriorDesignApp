/**
 * Copy furniture icon PNGs into Unity Resources/FurnitureIcons
 * so Resources.Load("FurnitureIcons/{id}") works in the AR catalog.
 *
 * Source (default): backend/assets/furniture-icons
 * Override: FURNITURE_ICONS_DIR=/path/to/icons
 *
 * Usage:
 *   npm run seed:furniture:unity-icons
 */

import { copyFile, mkdir, readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  UNITY_ICONS_DIR,
  UNITY_DIMENSIONS_PATH,
  iconSlugFromFileName,
  resolveIconSlug,
  resolveIconsDir,
} from './furniture-icon-utils.mjs';

const ICONS_DIR = resolveIconsDir();

await mkdir(UNITY_ICONS_DIR, { recursive: true });

if (!existsSync(ICONS_DIR)) {
  console.error(`Icons folder not found: ${ICONS_DIR}`);
  process.exit(1);
}

console.log(`Icon source: ${ICONS_DIR}`);
console.log(`Unity target: ${UNITY_ICONS_DIR}`);

const iconFiles = (await readdir(ICONS_DIR)).filter((name) =>
  /\.(png|jpg|jpeg|webp)$/i.test(name)
);

/** slug -> absolute source path */
const iconSourceBySlug = new Map();
const iconById = new Map();

for (const file of iconFiles) {
  const slug = iconSlugFromFileName(file);
  const sourcePath = join(ICONS_DIR, file);
  iconSourceBySlug.set(slug, sourcePath);
  iconById.set(slug, file);
}

let copiedSlugs = 0;
for (const [slug, sourcePath] of iconSourceBySlug) {
  await copyFile(sourcePath, join(UNITY_ICONS_DIR, `${slug}.png`));
  copiedSlugs += 1;
}

let catalogMatched = 0;
let catalogFallback = 0;
const catalogItems = [];

if (existsSync(UNITY_DIMENSIONS_PATH)) {
  const raw = await readFile(UNITY_DIMENSIONS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed.furniture)) {
    catalogItems.push(...parsed.furniture);
  }
}

const seatingFallback = iconById.has('bahamas-sofa') ? 'bahamas-sofa' : null;
const bedsFallback = iconById.has('sakura-bed') ? 'sakura-bed' : seatingFallback;

for (const item of catalogItems) {
  if (!item?.id) continue;

  const iconSlug = resolveIconSlug(item, iconById);
  let sourcePath = iconSlug ? iconSourceBySlug.get(iconSlug) : null;

  if (!sourcePath) {
    const fallbackSlug =
      item.id.includes('bed') || String(item.displayName || '').toLowerCase().includes('bed')
        ? bedsFallback
        : seatingFallback;
    sourcePath = fallbackSlug ? iconSourceBySlug.get(fallbackSlug) : null;
    if (sourcePath) catalogFallback += 1;
  } else {
    catalogMatched += 1;
  }

  if (!sourcePath) {
    console.warn(`No Unity icon for catalog id: ${item.id} (${item.displayName || ''})`);
    continue;
  }

  await copyFile(sourcePath, join(UNITY_ICONS_DIR, `${item.id}.png`));
}

console.log(`\nUnity icon sync complete`);
console.log(`  Copied by icon slug: ${copiedSlugs}`);
console.log(`  Catalog ids matched: ${catalogMatched}`);
console.log(`  Catalog ids fallback: ${catalogFallback}`);
console.log(`\nReopen Unity (or Assets > Refresh) to import updated PNGs.`);

process.exit(0);
