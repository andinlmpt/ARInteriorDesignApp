/**
 * Moves profile photos that are stored inside user records (as base64 data URLs, from before
 * photos were uploaded) to Cloudinary, and keeps only the link on the user — the same way
 * product images are stored.
 *
 * - Needs CLOUDINARY_URL (or the three CLOUDINARY_* variables) in backend/.env.
 * - Dry run by default; --apply uploads and updates the database.
 * - Each photo is shrunk to the 512 px square the app now uses before it is uploaded.
 * - Before changing anything, --apply writes the original values to
 *   backend/backups/profile-pictures-<timestamp>.json.
 * - Safe to re-run: users whose photo is already a link are skipped.
 *
 * Usage:
 *   node scripts/migrate-profile-pictures-to-cloudinary.mjs
 *   node scripts/migrate-profile-pictures-to-cloudinary.mjs --apply
 */

import '../src/loadEnv.js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import { getCloudinaryConfig } from '../src/services/cloudinaryStorage.js';
import { normalizeProfilePicture } from '../src/services/profilePicture.js';

const apply = process.argv.includes('--apply');
const backupDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'backups');

async function main() {
  if (!getCloudinaryConfig()) {
    throw new Error('Add CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> to backend/.env first.');
  }

  await connectMongoDB();
  const users = await User.find({ profilePicture: { $regex: '^data:image/' } })
    .select('+profilePicture email')
    .lean();

  console.log(`${users.length} user(s) have a photo stored in the database.`);
  if (users.length === 0 || !apply) {
    for (const user of users) {
      console.log(`  ${user.email}: ${Math.round(user.profilePicture.length / 1024)} KB of photo data`);
    }
    if (users.length && !apply) console.log('\nDry run. Re-run with --apply to move them to Cloudinary.');
    return;
  }

  mkdirSync(backupDir, { recursive: true });
  const backupFile = join(backupDir, `profile-pictures-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(backupFile, JSON.stringify(users.map((u) => ({ _id: String(u._id), email: u.email, profilePicture: u.profilePicture }))));
  console.log(`Backup of the original photos: ${backupFile}`);

  const failed = [];
  for (const user of users) {
    try {
      const url = await normalizeProfilePicture(user.profilePicture, { userId: String(user._id) });
      await User.updateOne({ _id: user._id }, { $set: { profilePicture: url } });
      console.log(`  ${user.email}: ${url}`);
    } catch (error) {
      failed.push(user.email);
      console.log(`  ${user.email}: NOT moved (${error.message}) — kept as it was`);
    }
  }

  console.log(`\nMoved ${users.length - failed.length} of ${users.length}.`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectMongoDB());
