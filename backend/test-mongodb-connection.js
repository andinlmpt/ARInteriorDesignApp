/**
 * Test MongoDB Connection Script
 * Run with: node test-mongodb-connection.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shilapuk_db_user:<db_password>@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0';
const dbName = process.env.MONGODB_DB_NAME || 'ARINTERIORDESIGNAPP';

import fs from 'fs';

function log(message) {
  console.log(message);
  fs.appendFileSync('connection.log', message + '\n');
}

// Clear previous log
fs.writeFileSync('connection.log', '');

log('========================================');
log('MongoDB Connection Test');
log('========================================');
log('');

// Check if password placeholder exists
if (MONGODB_URI.includes('<db_password>')) {
  log('❌ ERROR: Connection string still has <db_password> placeholder!');
  log('');
  log('Please create a .env file with your actual password:');
  log('MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_PASSWORD@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0');
  log('');
  process.exit(1);
}

// Check if password is set
if (!MONGODB_URI.includes('@cluster0')) {
  log('❌ ERROR: Connection string appears to be missing password!');
  log('');
  process.exit(1);
}

log('✓ Connection string format looks OK');
log('');

// Build connection string
// Build connection string
let connectionString;
const baseUri = MONGODB_URI;
let uriPart = baseUri;
let queryPart = '';

if (baseUri.includes('?')) {
  [uriPart, queryPart] = baseUri.split('?');
}

// Remove trailing slash from URI part
uriPart = uriPart.endsWith('/') ? uriPart.slice(0, -1) : uriPart;

// Parse existing params
const params = new URLSearchParams(queryPart);

// Add required params if missing
if (!params.has('retryWrites')) params.set('retryWrites', 'true');
if (!params.has('w')) params.set('w', 'majority');

// Construct final string
connectionString = `${uriPart}/${dbName}?${params.toString()}`;

log('Attempting to connect to MongoDB...');
log(`Database: ${dbName}`);
log('');

// Mask password in connection string for display
const maskedUri = connectionString.replace(/:[^:@]+@/, ':***@');
log(`Connection string: ${maskedUri}`);
log('');

try {
  await mongoose.connect(connectionString, {
    serverSelectionTimeoutMS: 10000, // 10 seconds
  });

  log('✅ SUCCESS: Connected to MongoDB!');
  log(`✅ Database: ${dbName}`);
  log(`✅ Connection state: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}`);
  log('');

  // Test a simple operation
  const collections = await mongoose.connection.db.listCollections().toArray();
  log(`✅ Collections in database: ${collections.length}`);
  if (collections.length > 0) {
    log('   Collections: ' + collections.map(c => c.name).join(', '));
  }
  log('');

  await mongoose.disconnect();
  log('✅ Disconnected successfully');
  process.exit(0);
} catch (error) {
  log('❌ CONNECTION FAILED');
  log('');
  log('Error details:');
  log(`  Code: ${error.code || 'N/A'}`);
  log(`  Message: ${error.message}`);
  log('');

  if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
    log('Possible causes:');
    log('  1. IP address not whitelisted in MongoDB Atlas');
    log('  2. Network/firewall blocking connection');
    log('  3. Incorrect password');
    log('  4. Cluster is paused or unavailable');
    log('');
    log('Solutions:');
    log('  1. Go to MongoDB Atlas → Network Access → Add IP Address');
    log('  2. Click "Allow Access from Anywhere" (0.0.0.0/0) for development');
    log('  3. Wait 1-2 minutes for changes to propagate');
    log('  4. Verify password is correct in MongoDB Atlas → Database Access');
  } else if (error.message.includes('authentication')) {
    log('Authentication failed - check your password!');
    log('  1. Verify password in MongoDB Atlas → Database Access');
    log('  2. Make sure password is URL-encoded if it has special characters');
  }

  process.exit(1);
}
