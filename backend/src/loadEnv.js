/**
 * Load backend/.env before any other module reads process.env.
 * ESM hoists imports, so this file must be imported first in server.js.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`[Env] Could not load ${envPath}:`, result.error.message);
} else if (process.env.NODE_ENV !== 'production') {
  console.log(`[Env] Loaded ${envPath}`);
}
