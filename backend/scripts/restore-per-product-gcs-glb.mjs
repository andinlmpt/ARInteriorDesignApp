/**
 * Restore per-product glbUrl on each MongoDB furniture row using the GCS
 * naming pattern: {FURNITURE_GCS_BASE_URL}/{Display Name}.glb
 *
 * Usage: node scripts/restore-per-product-gcs-glb.mjs
 */

import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const base = (
  process.env.FURNITURE_GCS_BASE_URL ||
  'https://storage.googleapis.com/unity-furniture-assets-01'
).replace(/\/+$/, '');

await connectMongoDB();

const items = await Furniture.find({ active: true }).lean();
let updated = 0;

for (const item of items) {
  const displayName = String(item.displayName || '').trim();
  if (!displayName) continue;

  const glbUrl = `${base}/${encodeURIComponent(`${displayName}.glb`)}`;
  if (item.glbUrl === glbUrl) continue;

  await Furniture.updateOne({ _id: item._id }, { $set: { glbUrl } });
  updated += 1;
  console.log(`  ✓ ${item.id} → ${glbUrl}`);
}

const sample = await Furniture.find({ active: true })
  .select('id displayName glbUrl')
  .limit(5)
  .lean();

const unique = new Set(
  (await Furniture.find({ active: true }).select('glbUrl').lean()).map((i) => i.glbUrl),
).size;

console.log(JSON.stringify({ base, total: items.length, updated, uniqueUrls: unique, sample }, null, 2));
await disconnectMongoDB();
