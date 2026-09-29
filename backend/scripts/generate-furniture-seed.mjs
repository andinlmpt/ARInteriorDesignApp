/**
 * Scan Unity GLB folder and write backend/data/furniture-seed.json.
 * glbUrl/thumbnailUrl are filled at seed time from FURNITURE_GCS_BASE_URL.
 *
 * Usage: node scripts/generate-furniture-seed.mjs
 */

import { readdir, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { inferFurnitureCategory } from '../src/utils/furnitureCategory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const glbRoot = join(root, 'InteriorDesignViewer', 'Assets', '_App', 'Furniture', 'GLB');
const outPath = join(__dirname, '..', 'data', 'furniture-seed.json');

const toId = (fileName) =>
  fileName
    .replace(/\.glb$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const toDisplayName = (fileName) =>
  fileName
    .replace(/\.glb$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const inferCategory = (id, displayName, relPath) =>
  inferFurnitureCategory(relPath, id, displayName) || 'other';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
      files.push(full);
    }
  }

  return files;
}

const files = await walk(glbRoot);
const furniture = files
  .map((fullPath, index) => {
    const rel = relative(glbRoot, fullPath);
    const fileName = rel.split(/[/\\]/).pop();
    const id = toId(fileName);
    const displayName = toDisplayName(fileName);

    return {
      id,
      displayName,
      category: inferCategory(id, displayName, rel),
      glbFileName: `${id}.glb`,
      thumbnailFileName: `${id}.webp`,
      width: 2.0,
      height: 0.85,
      depth: 0.9,
      sortOrder: index,
    };
  })
  .sort((a, b) => a.displayName.localeCompare(b.displayName));

await writeFile(outPath, `${JSON.stringify({ furniture }, null, 2)}\n`, 'utf8');
console.log(`Wrote ${furniture.length} items to ${outPath}`);
