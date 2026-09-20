/**
 * Remove white / near-white backdrop from France Sofa Bed thumbnail
 * and re-normalize to the standard square transparent canvas.
 *
 * Usage: node scripts/fix-france-sofa-thumb.mjs
 */

import sharp from 'sharp';
import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const paths = [
  'uploads/thumbnails/france-sofa-bed.png',
  'assets/furniture-icons/France_Sofa_Bed.png',
];

const SIZE = 1024;
const CONTENT_RATIO = 0.88;

async function punchWhite(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Hard white plate
    if (min >= 220 && max >= 235 && max - min <= 30) {
      px[i + 3] = 0;
      continue;
    }
    // Soft light-gray card / fringe
    if (min >= 200 && max >= 220 && max - min <= 22) {
      px[i + 3] = 0;
    }
  }

  let trimmed;
  try {
    trimmed = await sharp(px, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .trim({ threshold: 8 })
      .toBuffer();
  } catch {
    trimmed = await sharp(px, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  const contentSize = Math.round(SIZE * CONTENT_RATIO);
  const resized = await sharp(trimmed)
    .resize(contentSize, contentSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toFile(inputPath);

  console.log(`updated ${inputPath}`);
}

for (const p of paths) {
  await punchWhite(p);
}

await connectMongoDB();
const version = Date.now();
const url = `http://192.168.1.33:3000/uploads/thumbnails/france-sofa-bed.png?v=${version}`;
await Furniture.updateOne({ id: 'france-sofa-bed' }, { $set: { thumbnailUrl: url } });
console.log(`cache bust ${url}`);
await disconnectMongoDB();
