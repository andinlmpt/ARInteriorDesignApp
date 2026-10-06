/**
 * Set placeholder merchandising fields on every furniture document:
 * category (chair / sofa / beds), pricePhp, styles, roomTypes/rooms, and stock.
 *
 * Edit values later in the admin Products page or re-run after changing logic.
 *
 * Usage:
 *   node scripts/seed-furniture-merchandising.mjs           (dry run)
 *   node scripts/seed-furniture-merchandising.mjs --apply     (write MongoDB)
 *   node scripts/seed-furniture-merchandising.mjs --apply --force-prices
 *       (overwrite pricePhp even when already set)
 */

import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import { FURNITURE_CATEGORIES, inferFurnitureCategory } from '../src/utils/furnitureCategory.js';
import { mockPricePhp, mockStyles, suitableRooms } from '../src/utils/furnitureMockPricing.js';

const apply = process.argv.includes('--apply');
const forcePrices = process.argv.includes('--force-prices');

function resolveCategory(item) {
  const inferred = inferFurnitureCategory(item.id, item.displayName, item.glbUrl);
  if (inferred) return inferred;
  const current = String(item.category || '').toLowerCase();
  if (FURNITURE_CATEGORIES.includes(current)) return current;
  return 'chair';
}

function buildUpdate(item) {
  const category = resolveCategory(item);
  const doc = { ...item, category };
  const pricePhp = forcePrices || !(Number(item.pricePhp) > 0)
    ? mockPricePhp(doc)
    : Math.round(Number(item.pricePhp));
  const styles = mockStyles(doc);
  const roomTypes = suitableRooms(doc);
  const quantity = typeof item.quantity === 'number' && item.quantity > 0
    ? Math.floor(item.quantity)
    : 1;

  return {
    category,
    pricePhp,
    styles,
    rooms: roomTypes,
    roomTypes,
    quantity,
  };
}

async function main() {
  await connectMongoDB();

  const items = await Furniture.find({}).lean();
  const updates = [];

  for (const item of items) {
    const next = buildUpdate(item);
    const changed =
      item.category !== next.category
      || item.pricePhp !== next.pricePhp
      || JSON.stringify(item.styles || []) !== JSON.stringify(next.styles)
      || JSON.stringify(item.roomTypes || item.rooms || []) !== JSON.stringify(next.roomTypes)
      || item.quantity !== next.quantity;

    if (changed) {
      updates.push({ item, next });
    }
  }

  console.log(`\n${items.length} product(s) scanned — ${apply ? 'APPLYING' : 'DRY RUN'}\n`);

  const totals = { chair: 0, sofa: 0, beds: 0 };
  for (const { next } of updates) {
    totals[next.category] = (totals[next.category] || 0) + 1;
  }

  updates.slice(0, 40).forEach(({ item, next }) => {
    console.log(
      `  ${item.displayName}: ${item.category || '—'} → ${next.category}, `
      + `₱${Number(item.pricePhp) || 0} → ₱${next.pricePhp}, `
      + `qty ${item.quantity ?? 0} → ${next.quantity}, `
      + `rooms [${next.roomTypes.join(', ')}]`,
    );
  });
  if (updates.length > 40) {
    console.log(`  … and ${updates.length - 40} more`);
  }

  console.log(`\n${updates.length} product(s) to update.`);
  console.log(
    'Category totals (changed rows): '
    + `chair ${totals.chair || 0}, sofa ${totals.sofa || 0}, beds ${totals.beds || 0}`,
  );

  if (apply && updates.length > 0) {
    await Furniture.bulkWrite(
      updates.map(({ item, next }) => ({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: next },
        },
      })),
    );
    console.log(`\nUpdated ${updates.length} product(s) in MongoDB.`);
    console.log('Open admin → Products to edit exact ₱ prices and room/style tags.');
  } else if (!apply) {
    console.log('\nNo changes written. Re-run with --apply to update the database.');
  } else {
    console.log('\nAll products already match placeholder merchandising rules.');
  }
}

main()
  .catch((error) => {
    console.error('Merchandising seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongoDB();
  });
