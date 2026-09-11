/**
 * MongoDB connection module
 * Handles connection to MongoDB Atlas
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shilapuk_db_user:<db_password>@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0';

let isConnected = false;

/** True when a real Atlas URI is configured (not the placeholder). */
export function isMongoConfigured() {
  return Boolean(MONGODB_URI) && !MONGODB_URI.includes('<db_password>');
}

/**
 * Connect to MongoDB
 */
export async function connectMongoDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('[MongoDB] Already connected');
    return;
  }

  if (!isMongoConfigured()) {
    console.warn('[MongoDB] ⚠️  WARNING: Connection string has <db_password> placeholder!');
    console.warn('[MongoDB] Skipping MongoDB connection - using in-memory database only');
    console.warn('');
    console.warn('To enable MongoDB, create a .env file in the backend directory:');
    console.warn('MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_ACTUAL_PASSWORD@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0');
    console.warn('MONGODB_DB_NAME=ARINTERIORDESIGNAPP');
    console.warn('');
    isConnected = false;
    return;
  }

  try {
    const dbName = process.env.MONGODB_DB_NAME || 'ARINTERIORDESIGNAPP';

    let connectionString;
    let uriPart = MONGODB_URI;
    let queryPart = '';

    if (MONGODB_URI.includes('?')) {
      [uriPart, queryPart] = MONGODB_URI.split('?');
    }

    uriPart = uriPart.endsWith('/') ? uriPart.slice(0, -1) : uriPart;

    const params = new URLSearchParams(queryPart);
    if (!params.has('retryWrites')) params.set('retryWrites', 'true');
    if (!params.has('w')) params.set('w', 'majority');

    connectionString = `${uriPart}/${dbName}?${params.toString()}`;

    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      return;
    }

    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
    });

    isConnected = true;
    console.log('[MongoDB] ✅ Connected successfully');
    console.log(`[MongoDB] Database: ${dbName}`);
  } catch (error) {
    console.error('[MongoDB] ❌ Connection error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      console.error('');
      console.error('Possible causes:');
      console.error('  1. IP address not whitelisted in MongoDB Atlas');
      console.error('  2. Network/firewall blocking connection');
      console.error('  3. Incorrect password in connection string');
      console.error('  4. Cluster is paused or unavailable');
      console.error('  5. DNS resolution issues (specifically SRV records)');
      console.error('');
      console.error('Solutions:');
      console.error('  1. Go to MongoDB Atlas → Network Access → Add IP Address');
      console.error('  2. Click "Allow Access from Anywhere" (0.0.0.0/0) for development');
      console.error('  3. Wait 1-2 minutes for changes to propagate');
      console.error('  4. Verify password is correct in MongoDB Atlas → Database Access');
      console.error('  5. Check if your DNS provider blocks SRV record lookups');
    } else if (error.message.includes('authentication') || error.message.includes('bad auth')) {
      console.error('');
      console.error('Authentication failed - check your password!');
      console.error('  1. Verify password in MongoDB Atlas → Database Access');
      console.error('  2. Make sure password is URL-encoded if it has special characters');
    }

    isConnected = false;
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectMongoDB() {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected');
  } catch (error) {
    console.error('[MongoDB] Error disconnecting:', error.message);
    throw error;
  }
}

/**
 * Check if MongoDB is connected — trust mongoose readyState over a stale cache flag.
 */
export function isMongoDBConnected() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return true;
  }
  return false;
}

/**
 * Ensure a live Mongo connection when Atlas is configured.
 * Prevents auth from silently falling back to ephemeral hardcoded users.
 */
export async function ensureMongoConnection() {
  if (!isMongoConfigured()) return false;
  if (isMongoDBConnected()) return true;

  try {
    await connectMongoDB();
    return isMongoDBConnected();
  } catch (error) {
    console.error('[MongoDB] ensureMongoConnection failed:', error.message);
    return false;
  }
}

/** Only clear the cache when mongoose is actually down. */
export function markMongoDisconnected() {
  if (mongoose.connection.readyState !== 1) {
    isConnected = false;
  }
}

/**
 * Race a promise against a timeout so API handlers never hang forever
 * when Atlas drops mid-request.
 */
export async function withMongoTimeout(promise, timeoutMs = 8000, label = 'MongoDB operation') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`${label} timed out after ${timeoutMs}ms`);
          err.code = 'MONGO_TIMEOUT';
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('[MongoDB] Disconnected');
  isConnected = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Reconnected');
  isConnected = true;
});

mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Connected');
  isConnected = true;
});

export default mongoose;
