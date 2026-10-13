/**
 * Adds Maharlika furniture 3D models (a folder of .glb files) to the product catalog.
 *
 * - Real product sizes and labels come from Unity's FurnitureDimensions.json (inventory sizes).
 * - Thumbnails come from Unity's FurnitureIcons/<id>.png when present.
 * - GLBs already in uploads/glb (same bytes) are reused instead of copied again.
 * - The model's own size is measured and stored, so the store/admin product lists flag
 *   models that don't match the real product size.
 * - Products are added without a store; an admin assigns them on the Products page
 *   ("Assign all") once the Maharlika store is registered and accepted.
 * - Existing product ids are skipped, never overwritten.
 *
 * Usage (dry run first, then --apply):
 *   node scripts/import-maharlika-models.mjs --dir "C:\path\to\1MAHARLIKA3D-optimized"
 *   node scripts/import-maharlika-models.mjs --dir "C:\path\to\1MAHARLIKA3D-optimized" --apply
 */

import '../src/loadEnv.js';
import { createHash, randomUUID } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import { UPLOAD_ROOT, getPublicBaseUrl } from '../src/services/uploadService.js';
import { measureModelAtUrl } from '../src/services/modelSize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const unityResources = join(__dirname, '..', '..', 'InteriorDesignViewer', 'Assets', '_App', 'Furniture', 'Resources');
const GLB_DIR = join(UPLOAD_ROOT, 'glb');
const THUMB_DIR = join(UPLOAD_ROOT, 'thumbnails');
/** Placeholder stock so AI layouts can use the product; the store should set real stock. */
const PLACEHOLDER_QUANTITY = 1;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dirIndex = args.indexOf('--dir');
const sourceDir = dirIndex >= 0 ? args[dirIndex + 1] : '';

/** "Latvia sofda.glb" → "latvia-sofda" (as spelled in the file and the inventory). */
const toSlug = (fileName) =>
  basename(fileName, extname(fileName))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Product id with the "sofda" typo fixed. */
const toId = (fileName) => toSlug(fileName).replace(/\bsofda\b/, 'sofa');

const titleCase = (id) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const cm = (m) => Math.round(m * 100);

/** Reuses an identical file already in uploads/glb, or copies the model in. */
function storeGlb(sourceFile, existingByHash) {
  const hash = sha256(sourceFile);
  const existing = existingByHash.get(hash);
  if (existing) return { fileName: existing, copied: false };
  const safe = basename(sourceFile).replace(/[^a-zA-Z0-9._-]+/g, '-');
  const fileName = `${randomUUID()}-${safe}`;
  if (apply) {
    mkdirSync(GLB_DIR, { recursive: true });
    copyFileSync(sourceFile, join(GLB_DIR, fileName));
  }
  return { fileName, copied: true };
}

async function main() {
  if (!sourceDir || !existsSync(sourceDir)) {
    throw new Error('Pass the folder of .glb files with --dir "<path>"');
  }

  const dimensions = JSON.parse(readFileSync(join(unityResources, 'FurnitureDimensions.json'), 'utf8')).furniture;
  const dimsById = new Map(dimensions.map((d) => [d.id, d]));
  const existingByHash = new Map(
    (existsSync(GLB_DIR) ? readdirSync(GLB_DIR) : []).map((f) => [sha256(join(GLB_DIR, f)), f]));
  const base = getPublicBaseUrl();

  await connectMongoDB();
  const rows = [];
  let added = 0;

  for (const file of walk(sourceDir).filter((f) => extname(f).toLowerCase() === '.glb').sort()) {
    const id = toId(file);
    const real = dimsById.get(id) || dimsById.get(toSlug(file));
    if (await Furniture.exists({ id })) {
      rows.push({ id, result: 'skipped (already in the catalog)' });
      continue;
    }

    const glb = storeGlb(file, existingByHash);
    const glbUrl = `${base}/glb/${encodeURIComponent(glb.fileName)}`;
    const modelSize = apply || !glb.copied
      ? await measureModelAtUrl(glbUrl)
      : null;

    const icon = join(unityResources, 'FurnitureIcons', `${id}.png`);
    let thumbnailUrl = '';
    if (existsSync(icon)) {
      if (apply) {
        mkdirSync(THUMB_DIR, { recursive: true });
        copyFileSync(icon, join(THUMB_DIR, `${id}.png`));
      }
      thumbnailUrl = `${base}/thumbnails/${id}.png`;
    }

    // Without an inventory size, fall back to the model's own size (flagged in the summary).
    const size = real
      ? { width: real.length, depth: real.width, height: real.height }
      : modelSize
        ? { width: Math.max(modelSize.width, modelSize.depth), depth: Math.min(modelSize.width, modelSize.depth), height: modelSize.height }
        : { width: 2, depth: 0.9, height: 0.85 };

    const doc = {
      id,
      displayName: real?.displayName || titleCase(id),
      category: /bed\b/.test(id) && !/sofa/.test(id) ? 'beds' : 'sofa',
      glbUrl,
      thumbnailUrl,
      width: size.width,
      height: size.height,
      depth: size.depth,
      dimensionLabel: real?.label || '',
      lengthIn: real?.lengthIn || 0,
      widthIn: real?.widthIn || 0,
      heightIn: real?.heightIn || 0,
      quantity: PLACEHOLDER_QUANTITY,
      active: true,
      store: null,
      modelSize,
    };

    if (apply) {
      await Furniture.create(doc);
      added += 1;
    }

    rows.push({
      id,
      result: apply ? 'added' : 'would add',
      realCm: real ? `${cm(real.length)}×${cm(real.width)}×${cm(real.height)}` : 'NO INVENTORY SIZE (using model size)',
      modelCm: modelSize ? `${cm(Math.max(modelSize.width, modelSize.depth))}×${cm(Math.min(modelSize.width, modelSize.depth))}×${cm(modelSize.height)}` : '?',
      glb: glb.copied ? `copy → ${glb.fileName}` : `reuse ${glb.fileName}`,
      thumbnail: thumbnailUrl ? 'yes' : 'none',
    });
  }

  console.table(rows);
  console.log(apply
    ? `Added ${added} products (no store yet; quantity ${PLACEHOLDER_QUANTITY} each).`
    : 'Dry run only. Re-run with --apply to write to the database.');
  await disconnectMongoDB();
}

main().catch(async (error) => {
  console.error(error.message);
  await disconnectMongoDB().catch(() => {});
  process.exit(1);
});
