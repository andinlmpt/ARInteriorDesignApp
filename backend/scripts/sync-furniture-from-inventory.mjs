/**
 * Sync admin Products catalog to MFHF inventory summary.
 * - Upserts every inventory item (quantity + availableColors)
 * - Deactivates products that are not in the inventory file
 *
 * Usage:
 *   npm run seed:furniture:inventory
 *   (or) node scripts/sync-furniture-from-inventory.mjs
 */

import '../src/loadEnv.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inventoryPath = join(__dirname, '..', 'data', 'furniture-inventory.json');

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Parse inventory text like "2 sofa pieces + 1 stool" into a total piece count. */
const parseQuantity = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const matches = String(value || '').match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((sum, n) => sum + Number(n), 0);
};

const inferCategory = (displayName) => {
  const key = String(displayName || '').toLowerCase();
  if (key.includes('bed')) return 'beds';
  if (key.includes('sofa') || key.includes('chair') || key.includes('seat')) return 'seating';
  return 'other';
};

const trimSlash = (value) => String(value || '').replace(/\/+$/, '');

async function main() {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  if (!Array.isArray(inventory) || inventory.length === 0) {
    throw new Error('furniture-inventory.json is empty. Run parse-inventory-docx.mjs first.');
  }

  await connectMongoDB();

  const existing = await Furniture.find({}).lean();
  const byId = new Map(existing.map((item) => [item.id, item]));
  const fallbackGlb =
    existing.find((item) => item.glbUrl)?.glbUrl
    || `${trimSlash(process.env.FURNITURE_GCS_BASE_URL || 'https://storage.googleapis.com/unity-furniture-assets-01')}/placeholder.glb`;

  const inventoryIds = new Set();
  let created = 0;
  let updated = 0;

  for (let index = 0; index < inventory.length; index += 1) {
    const entry = inventory[index];
    const id = slugify(entry.displayName);
    inventoryIds.add(id);

    const current = byId.get(id);
    const glbBase = trimSlash(process.env.FURNITURE_GCS_BASE_URL || '');
    const guessedGlb = glbBase
      ? `${glbBase}/${encodeURIComponent(`${entry.displayName}.glb`)}`
      : fallbackGlb;

    const payload = {
      id,
      displayName: entry.displayName,
      category: inferCategory(entry.displayName),
      quantity: parseQuantity(entry.quantity),
      availableColors: Array.isArray(entry.availableColors) ? entry.availableColors : [],
      active: true,
      sortOrder: index + 1,
      glbUrl: current?.glbUrl || guessedGlb,
      thumbnailUrl: current?.thumbnailUrl || '',
      width: current?.width ?? 2.0,
      height: current?.height ?? 0.85,
      depth: current?.depth ?? 0.9,
      dimensionLabel: current?.dimensionLabel || '',
      lengthIn: current?.lengthIn || 0,
      widthIn: current?.widthIn || 0,
      heightIn: current?.heightIn || 0,
    };

    await Furniture.findOneAndUpdate({ id }, payload, { upsert: true, new: true, setDefaultsOnInsert: true });

    if (current) updated += 1;
    else created += 1;
  }

  const deactivateResult = await Furniture.updateMany(
    { id: { $nin: [...inventoryIds] } },
    { $set: { active: false } }
  );

  const activeCount = await Furniture.countDocuments({ active: true });
  const inactiveCount = await Furniture.countDocuments({ active: false });

  console.log(`Inventory items: ${inventory.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Deactivated non-inventory products: ${deactivateResult.modifiedCount}`);
  console.log(`Active products now: ${activeCount}`);
  console.log(`Inactive products now: ${inactiveCount}`);
}

main()
  .catch((error) => {
    console.error('Sync failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMongoDB();
  });
