/**
 * Apply quantity + availableColors from MFHF inventory summary onto furniture docs.
 *
 * Usage:
 *   node scripts/parse-inventory-docx.mjs
 *   node scripts/seed-furniture-inventory.mjs
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

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Parse inventory text like "2 sofa pieces + 1 stool" into a total piece count. */
const parseQuantity = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const matches = String(value || '').match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((sum, n) => sum + Number(n), 0);
};

async function main() {
  const raw = await readFile(inventoryPath, 'utf8');
  const inventory = JSON.parse(raw);

  if (!Array.isArray(inventory) || inventory.length === 0) {
    throw new Error('No inventory items found. Run scripts/parse-inventory-docx.mjs first.');
  }

  await connectMongoDB();

  const furniture = await Furniture.find({}).lean();
  const byId = new Map(furniture.map((item) => [item.id, item]));
  const byName = new Map(furniture.map((item) => [normalizeName(item.displayName), item]));

  let updated = 0;
  let colorDefaults = 0;
  let missing = [];

  for (const entry of inventory) {
    const id = slugify(entry.displayName);
    const match = byId.get(id) || byName.get(normalizeName(entry.displayName));

    if (!match) {
      missing.push(entry.displayName);
      continue;
    }

    await Furniture.updateOne(
      { _id: match._id },
      {
        $set: {
          quantity: parseQuantity(entry.quantity),
          availableColors: Array.isArray(entry.availableColors) ? entry.availableColors : [],
        },
      }
    );
    updated += 1;
  }

  // Catalog note: nearly all sofas/beds share the same finish set.
  const defaultColors = inventory.find((item) => Array.isArray(item.availableColors) && item.availableColors.length)?.availableColors
    || ['Taupe', 'Light Gray', 'Mocha Beige', 'Dark Gray'];

  const remaining = await Furniture.find({
    $or: [
      { availableColors: { $exists: false } },
      { availableColors: { $size: 0 } },
    ],
    category: { $in: ['seating', 'beds'] },
  });

  for (const item of remaining) {
    await Furniture.updateOne(
      { _id: item._id },
      { $set: { availableColors: defaultColors } }
    );
    colorDefaults += 1;
  }

  console.log(`Updated ${updated} furniture items with inventory quantity/colors.`);
  console.log(`Applied default catalog colors to ${colorDefaults} remaining seating/beds items.`);
  if (missing.length) {
    console.log(`No DB match for ${missing.length} inventory names (not in your catalog DB yet):`);
    for (const name of missing) {
      console.log(`  - ${name}`);
    }
  }
}

main()
  .catch((error) => {
    console.error('Seed furniture inventory failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMongoDB();
  });
