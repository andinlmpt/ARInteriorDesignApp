/**
 * Sync MongoDB furniture to every known public GLB in
 * unity-furniture-assets-01 (root + Sofa/ + accent chairs/ + love seats/).
 *
 * Usage: node scripts/sync-catalog-to-gcs-bucket.mjs
 */

import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const base = (
  process.env.FURNITURE_GCS_BASE_URL ||
  'https://storage.googleapis.com/unity-furniture-assets-01'
).replace(/\/+$/, '');

const encodeObjectPath = (relPath) =>
  String(relPath)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.glb$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const inferCategory = (displayName, folder) => {
  const key = `${folder} ${displayName}`.toLowerCase();
  if (key.includes('bed')) return 'beds';
  if (key.includes('chair')) return 'seating';
  if (key.includes('love seat') || key.includes('seat')) return 'seating';
  if (key.includes('sofa')) return 'seating';
  return 'seating';
};

/** Exact object paths that returned HTTP 200. */
const GCS_FILES = [
  'Abu Dhabi Sofa.glb',
  'Bhutan Sofa.glb',
  'Brunei Sofa.glb',
  'Chad Sofa.glb',
  'Ecuador sofa bed.glb',
  'France Sofa bed.glb',
  'Latvia sofda.glb',
  'Malta mini sofa.glb',
  'Morocco sofa.glb',
  'Qatar Sofa.glb',
  'Sakura Bed.glb',
  'Sri lanka mini sofa.glb',
  'Tanzania sofa.glb',
  'myanmar sofa.glb',
  'palestine sofa.glb',
  'phillipine sofa.glb',
  'Sofa/bahamas sofa.glb',
  'Sofa/canada sofa.glb',
  'Sofa/croatia sofa.glb',
  'Sofa/cuba sofa.glb',
  'Sofa/israel sofa.glb',
  'Sofa/kuwait sofa.glb',
  'Sofa/malaysian sofa.glb',
  'Sofa/russia sofa.glb',
  'Sofa/turkey sofa.glb',
  'accent chairs/Bahrain accent chair.glb',
  'accent chairs/Cyprus accent chair.glb',
  'love seats/Indonesia love seats.glb',
  'love seats/divan love seat.glb',
  'love seats/iraq love seat.glb',
  'love seats/korea love seat.glb',
  'love seats/maldives Love seats.glb',
];

/** Prefer stable seed ids when the display name matches. */
const ID_OVERRIDES = {
  'abu dhabi sofa': 'abu-dhabi-sofa',
  'bhutan sofa': 'bhutan-sofa',
  'brunei sofa': 'brunei-sofa',
  'chad sofa': 'chad-sofa',
  'ecuador sofa bed': 'ecuador-sofa-bed',
  'france sofa bed': 'france-sofa-bed',
  'latvia sofda': 'latvia-sofda',
  'malta mini sofa': 'malta-mini-sofa',
  'morocco sofa': 'morocco-sofa',
  'qatar sofa': 'qatar-sofa',
  'sakura bed': 'sakura-bed',
  'sri lanka mini sofa': 'sri-lanka-mini-sofa',
  'tanzania sofa': 'tanzania-sofa',
  'myanmar sofa': 'myanmar-sofa',
  'palestine sofa': 'palestine-sofa',
  'phillipine sofa': 'phillipine-sofa',
  'bahamas sofa': 'bahamas-sofa',
  'canada sofa': 'canada-sofa',
  'croatia sofa': 'croatia-sofa',
  'cuba sofa': 'cuba-sofa',
  'israel sofa': 'israel-sofa',
  'kuwait sofa': 'kuwait-sofa',
  'malaysian sofa': 'malaysian-sofa',
  'russia sofa': 'russia-sofa',
  'turkey sofa': 'turkey-sofa',
  'bahrain accent chair': 'bahrain-accent-chair',
  'cyprus accent chair': 'cyprus-accent-chair',
  'indonesia love seats': 'indonesia-love-seats',
  'divan love seat': 'divan-love-seat',
  'iraq love seat': 'iraq-love-seat',
  'korea love seat': 'korea-love-seat',
  'maldives love seats': 'maldives-love-seats',
};

function fileToItem(relPath, index) {
  const parts = relPath.split('/');
  const fileName = parts[parts.length - 1];
  const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  const displayName = fileName.replace(/\.glb$/i, '');
  const nameKey = displayName.toLowerCase();
  const id = ID_OVERRIDES[nameKey] || slugify(displayName);

  return {
    id,
    displayName: displayName.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bSofda\b/i, 'Sofda'),
    // Keep readable names closer to file casing for known products
    rawDisplayName: displayName,
    category: inferCategory(displayName, folder),
    file: relPath,
    sortOrder: index,
  };
}

await connectMongoDB();

const items = GCS_FILES.map((file, index) => fileToItem(file, index));
// Fix display names to nicer title case from overrides / original file names
const DISPLAY_NAMES = {
  'abu-dhabi-sofa': 'Abu Dhabi Sofa',
  'bhutan-sofa': 'Bhutan Sofa',
  'brunei-sofa': 'Brunei Sofa',
  'chad-sofa': 'Chad Sofa',
  'ecuador-sofa-bed': 'Ecuador Sofa Bed',
  'france-sofa-bed': 'France Sofa Bed',
  'latvia-sofda': 'Latvia Sofda',
  'malta-mini-sofa': 'Malta Mini Sofa',
  'morocco-sofa': 'Morocco Sofa',
  'qatar-sofa': 'Qatar Sofa',
  'sakura-bed': 'Sakura Bed',
  'sri-lanka-mini-sofa': 'Sri Lanka Mini Sofa',
  'tanzania-sofa': 'Tanzania Sofa',
  'myanmar-sofa': 'Myanmar Sofa',
  'palestine-sofa': 'Palestine Sofa',
  'phillipine-sofa': 'Phillipine Sofa',
  'bahamas-sofa': 'Bahamas Sofa',
  'canada-sofa': 'Canada Sofa',
  'croatia-sofa': 'Croatia Sofa',
  'cuba-sofa': 'Cuba Sofa',
  'israel-sofa': 'Israel Sofa',
  'kuwait-sofa': 'Kuwait Sofa',
  'malaysian-sofa': 'Malaysian Sofa',
  'russia-sofa': 'Russia Sofa',
  'turkey-sofa': 'Turkey Sofa',
  'bahrain-accent-chair': 'Bahrain Accent Chair',
  'cyprus-accent-chair': 'Cyprus Accent Chair',
  'indonesia-love-seats': 'Indonesia Love Seats',
  'divan-love-seat': 'Divan Love Seat',
  'iraq-love-seat': 'Iraq Love Seat',
  'korea-love-seat': 'Korea Love Seat',
  'maldives-love-seats': 'Maldives Love Seats',
};

const keepIds = new Set(items.map((item) => item.id));
let upserted = 0;

for (const item of items) {
  const glbUrl = `${base}/${encodeObjectPath(item.file)}`;
  const existing = await Furniture.findOne({ id: item.id }).lean();
  const displayName = DISPLAY_NAMES[item.id] || item.rawDisplayName;

  await Furniture.findOneAndUpdate(
    { id: item.id },
    {
      id: item.id,
      displayName,
      category: item.category,
      glbUrl,
      thumbnailUrl: existing?.thumbnailUrl || '',
      width: existing?.width ?? (item.category === 'beds' ? 1.6 : 2.1),
      height: existing?.height ?? (item.category === 'beds' ? 0.5 : 0.85),
      depth: existing?.depth ?? (item.category === 'beds' ? 2.0 : 0.9),
      dimensionLabel: existing?.dimensionLabel || '',
      lengthIn: existing?.lengthIn || 0,
      widthIn: existing?.widthIn || 0,
      heightIn: existing?.heightIn || 0,
      quantity: existing?.quantity ?? 1,
      availableColors: existing?.availableColors || [],
      active: true,
      sortOrder: item.sortOrder,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  upserted += 1;
  console.log(`  ✓ ${item.id} → ${glbUrl}`);
}

const deactivate = await Furniture.updateMany(
  { active: true, id: { $nin: [...keepIds] } },
  { $set: { active: false } },
);

const active = await Furniture.find({ active: true })
  .select('id displayName glbUrl')
  .sort({ sortOrder: 1 })
  .lean();

console.log(
  JSON.stringify(
    {
      upserted,
      deactivated: deactivate.modifiedCount,
      activeCount: active.length,
      activeIds: active.map((i) => i.id),
    },
    null,
    2,
  ),
);

await disconnectMongoDB();
