/**
 * Moves files stored on this PC (backend/uploads) to Cloudinary and updates their links:
 * product 3D models and thumbnails, store logos, and profile photos.
 *
 * - Needs CLOUDINARY_URL (or the three CLOUDINARY_* variables) in backend/.env.
 * - Dry run by default; --apply uploads and updates the database.
 * - Safe to re-run: links that already point to Cloudinary are skipped.
 * - Local files are kept as a backup. A file that fails to upload (e.g. over the plan's
 *   size limit) keeps its local link and is listed at the end.
 *
 * Usage:
 *   node scripts/migrate-uploads-to-cloudinary.mjs
 *   node scripts/migrate-uploads-to-cloudinary.mjs --apply
 */

import '../src/loadEnv.js';
import { existsSync, readFileSync, statSync } from 'fs';
import { basename, extname, join } from 'path';
import Furniture from '../src/models/Furniture.js';
import Store from '../src/models/Store.js';
import User from '../src/models/User.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import { UPLOAD_ROOT } from '../src/services/uploadService.js';
import { cloudinaryFolder, getCloudinaryConfig, uploadToCloudinary } from '../src/services/cloudinaryStorage.js';

const apply = process.argv.includes('--apply');

/** Which documents and fields hold uploaded-file links. */
const TARGETS = [
  { model: Furniture, label: 'product', name: (d) => d.id, fields: ['glbUrl', 'thumbnailUrl'] },
  { model: Store, label: 'store', name: (d) => d.name, fields: ['logoUrl'] },
  { model: User, label: 'user', name: (d) => d.email, fields: ['avatar'] },
];

const CONTENT_TYPES = { '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.webp': 'image/webp' };

/** { subdir, filePath } for a link to one of our own uploads, or null. */
function localUpload(link) {
  let url;
  try {
    url = new URL(String(link || ''), 'http://localhost');
  } catch {
    return null;
  }
  const match = /\/uploads\/(glb|thumbnails|avatars)\/([^/?#]+)$/.exec(url.pathname);
  if (!match) return null;
  const fileName = basename(decodeURIComponent(match[2]));
  return { subdir: match[1], fileName, filePath: join(UPLOAD_ROOT, match[1], fileName) };
}

async function main() {
  if (!getCloudinaryConfig()) {
    throw new Error('Add CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> to backend/.env first.');
  }

  await connectMongoDB();
  const uploaded = new Map(); // local file path → Cloudinary URL (each file is uploaded once)
  const rows = [];
  let changedDocs = 0;

  for (const { model, label, name, fields } of TARGETS) {
    const docs = await model.find({ $or: fields.map((f) => ({ [f]: { $regex: '/uploads/' } })) });
    for (const doc of docs) {
      const updates = {};
      for (const field of fields) {
        const local = localUpload(doc[field]);
        if (!local) continue;

        const row = { item: `${label} ${name(doc)}`, field, file: local.fileName };
        if (!existsSync(local.filePath)) {
          rows.push({ ...row, result: 'MISSING on this PC (link left as is)' });
          continue;
        }
        row.sizeMb = (statSync(local.filePath).size / (1024 * 1024)).toFixed(1);

        if (!apply) {
          rows.push({ ...row, result: 'would upload' });
          continue;
        }

        try {
          let url = uploaded.get(local.filePath);
          if (!url) {
            const raw = local.subdir === 'glb';
            const ext = extname(local.fileName).toLowerCase();
            const publicName = raw ? local.fileName : local.fileName.slice(0, -ext.length);
            ({ url } = await uploadToCloudinary(readFileSync(local.filePath), {
              resourceType: raw ? 'raw' : 'image',
              publicId: `${cloudinaryFolder()}/${local.subdir}/${publicName}`,
              filename: local.fileName,
              contentType: CONTENT_TYPES[ext] || 'image/jpeg',
            }));
            uploaded.set(local.filePath, url);
          }
          updates[field] = url;
          rows.push({ ...row, result: 'moved' });
        } catch (error) {
          rows.push({ ...row, result: `FAILED: ${error.message}` });
        }
      }
      if (Object.keys(updates).length > 0) {
        // Only the link fields change, so older records that fail newer validation still update.
        try {
          await model.updateOne({ _id: doc._id }, { $set: updates });
          changedDocs += 1;
        } catch (error) {
          rows.push({ item: `${label} ${name(doc)}`, field: Object.keys(updates).join(', '), result: `FAILED to save: ${error.message}` });
        }
      }
    }
  }

  console.table(rows);
  const failed = rows.filter((r) => r.result.startsWith('FAILED') || r.result.startsWith('MISSING')).length;
  console.log(apply
    ? `Moved ${uploaded.size} files and updated ${changedDocs} records.${failed ? ` ${failed} need attention (see above).` : ''}`
    : `Dry run: ${rows.length} links found. Re-run with --apply to move them.`);
  await disconnectMongoDB();
}

main().catch(async (error) => {
  console.error(error.message);
  await disconnectMongoDB().catch(() => {});
  process.exit(1);
});
