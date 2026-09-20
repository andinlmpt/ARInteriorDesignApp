/**
 * Materialize local GLB files for every active furniture row so Unity can load
 * models when remote GCS URLs 404.
 *
 * Copies category stand-ins from frontend/assets/models/furniture into
 * backend/uploads/glb/{id}.glb and updates MongoDB glbUrl to a LAN upload URL.
 *
 * Usage: node scripts/materialize-local-glbs.mjs
 */

import '../src/loadEnv.js';
import { mkdir, copyFile, access } from 'fs/promises';
import { constants, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import { UPLOAD_ROOT } from '../src/services/uploadService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const glbOutDir = join(UPLOAD_ROOT, 'glb');

const STANDINS = {
  seating: join(repoRoot, 'frontend', 'assets', 'models', 'furniture', 'sofa-3230.glb'),
  chair: join(repoRoot, 'frontend', 'assets', 'models', 'furniture', 'accent-chair.glb'),
  beds: join(repoRoot, 'frontend', 'assets', 'models', 'furniture', 'unimat-mattress.glb'),
  other: join(repoRoot, 'frontend', 'assets', 'models', 'furniture', 'kids-armchair.glb'),
};

function getPublicOrigin() {
  const configured = process.env.PUBLIC_UPLOAD_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '').replace(/\/uploads$/i, '');
  }
  return 'http://192.168.1.33:3000';
}

function pickStandin(item) {
  const key = `${item.id} ${item.displayName} ${item.category}`.toLowerCase();
  if (key.includes('bed') || key.includes('mattress') || item.category === 'beds') {
    return { path: STANDINS.beds, via: 'standin:beds' };
  }
  if (key.includes('chair') || key.includes('armchair')) {
    return { path: STANDINS.chair, via: 'standin:chair' };
  }
  if (
    key.includes('sofa') ||
    key.includes('seat') ||
    key.includes('divan') ||
    item.category === 'seating'
  ) {
    return { path: STANDINS.seating, via: 'standin:seating' };
  }
  return { path: STANDINS.other, via: 'standin:other' };
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  for (const [label, path] of Object.entries(STANDINS)) {
    if (!(await fileExists(path))) {
      console.error(`[materialize] Missing stand-in for ${label}: ${path}`);
      process.exit(1);
    }
  }

  if (!existsSync(glbOutDir)) {
    await mkdir(glbOutDir, { recursive: true });
  }

  await connectMongoDB();
  const items = await Furniture.find({ active: true }).lean();
  console.log(`[materialize] ${items.length} active furniture items`);

  const origin = getPublicOrigin();
  let written = 0;
  let updated = 0;

  for (const item of items) {
    const id = String(item.id || '').trim().toLowerCase();
    if (!id) continue;

    const dest = join(glbOutDir, `${id}.glb`);
    const source = pickStandin(item);

    if (!(await fileExists(source.path))) {
      console.warn(`  ! missing source for ${id} (${source.via})`);
      continue;
    }

    await copyFile(source.path, dest);
    written += 1;

    const publicUrl = `${origin}/uploads/glb/${encodeURIComponent(`${id}.glb`)}`;
    if (item.glbUrl !== publicUrl) {
      await Furniture.updateOne({ _id: item._id }, { $set: { glbUrl: publicUrl } });
      updated += 1;
    }

    console.log(`  ✓ ${id} ← ${source.via}`);
  }

  console.log(`\n[materialize] Wrote ${written} GLBs under uploads/glb`);
  console.log(`[materialize] Updated ${updated} MongoDB glbUrl fields → ${origin}/uploads/glb/…`);
  await disconnectMongoDB();
}

main().catch(async (error) => {
  console.error('[materialize] Failed:', error);
  try {
    await disconnectMongoDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
