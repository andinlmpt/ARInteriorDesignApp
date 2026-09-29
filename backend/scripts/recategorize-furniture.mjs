/**
 * Re-categorize every product into chair / sofa / beds.
 * Uses the product id, display name, and GLB path (e.g. "accent chairs/", "love seats/").
 *
 * Usage:
 *   npm run recategorize:furniture            (dry run — prints the plan only)
 *   npm run recategorize:furniture -- --apply (writes changes)
 */

import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import { FURNITURE_CATEGORIES, inferFurnitureCategory } from '../src/utils/furnitureCategory.js';

const apply = process.argv.includes('--apply');

async function main() {
  await connectMongoDB();

  const items = await Furniture.find({}, { id: 1, displayName: 1, category: 1, glbUrl: 1, active: 1 }).lean();
  const changes = [];
  const unmatched = [];
  const totals = Object.fromEntries(FURNITURE_CATEGORIES.map((c) => [c, 0]));

  for (const item of items) {
    const next = inferFurnitureCategory(item.id, item.displayName, item.glbUrl);
    if (!next) {
      unmatched.push(item);
      continue;
    }
    totals[next] += 1;
    if (item.category !== next) {
      changes.push({ item, next });
    }
  }

  console.log(`\n${items.length} products scanned — ${apply ? 'APPLYING' : 'DRY RUN'}\n`);
  for (const { item, next } of changes) {
    const flag = item.active ? '' : ' (inactive)';
    console.log(`  ${item.displayName}${flag}: ${item.category || '—'} → ${next}`);
  }
  console.log(`\nResulting totals: ${FURNITURE_CATEGORIES.map((c) => `${c} ${totals[c]}`).join(', ')}`);
  console.log(`${changes.length} product(s) to change.`);

  if (unmatched.length) {
    console.log(`\n${unmatched.length} product(s) could not be classified and were left unchanged:`);
    for (const item of unmatched) {
      console.log(`  ${item.displayName} [${item.category || '—'}] ${item.glbUrl || ''}`);
    }
    console.log('Set these manually in the admin Products page.');
  }

  if (apply && changes.length) {
    await Furniture.bulkWrite(
      changes.map(({ item, next }) => ({
        updateOne: { filter: { _id: item._id }, update: { $set: { category: next } } },
      }))
    );
    console.log(`\nUpdated ${changes.length} product(s).`);
  } else if (!apply) {
    console.log('\nNo changes written. Re-run with --apply to update the database.');
  }
}

main()
  .catch((error) => {
    console.error('Recategorize failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongoDB();
  });
