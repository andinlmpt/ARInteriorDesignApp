/**
 * Seed or update the admin account.
 *
 * Usage: npm run seed:admin
 *
 * Env (backend/.env):
 *   MONGODB_URI=...
 *   ADMIN_SEED_EMAIL=admin@gmail.com   (default)
 *   ADMIN_SEED_PASSWORD=Admin123!      (default — change in production)
 */

import '../src/loadEnv.js';
import User from '../src/models/User.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const email = (process.env.ADMIN_SEED_EMAIL || 'admin@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD || 'Admin123!';
const name = process.env.ADMIN_SEED_NAME || 'Admin';

async function main() {
  await connectMongoDB();

  let user = await User.findOne({ email }).select('+password');

  if (user) {
    user.role = 'admin';
    user.name = name;
    if (process.env.ADMIN_SEED_PASSWORD) {
      user.password = password;
    }
    await user.save();
    console.log(`Updated existing user to admin: ${email}`);
  } else {
    user = new User({
      email,
      password,
      name,
      role: 'admin',
    });
    await user.save();
    console.log(`Created admin user: ${email}`);
  }

  console.log(`Password: ${process.env.ADMIN_SEED_PASSWORD ? '(from ADMIN_SEED_PASSWORD)' : password}`);
  console.log('Login at http://localhost:5173 with these credentials.');
}

main()
  .catch((error) => {
    console.error('Seed admin failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMongoDB();
  });
