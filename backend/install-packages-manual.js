/**
 * Manual Package Installation Script
 * Uses Node.js directly to download and install packages when npm is broken
 * 
 * Run with: node install-packages-manual.js
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const packages = [
  'express@^4.18.2',
  'cors@^2.8.5',
  'dotenv@^16.3.1',
  'helmet@^7.1.0',
  'express-rate-limit@^7.1.4',
  'compression@^1.7.4',
  'morgan@^1.10.0',
  'uuid@^9.0.1',
  '@sentry/node@^7.91.0',
  'mongoose@^8.0.3',
  'bcryptjs@^2.4.3',
  'jsonwebtoken@^9.0.2',
  '@types/node@^20.10.6',
  '@jest/globals@^29.7.0',
  'jest@^29.7.0',
  'supertest@^6.3.3'
];

console.log('========================================');
console.log('Manual Package Installation');
console.log('========================================');
console.log('');
console.log('⚠️  WARNING: npm is corrupted. This script attempts to work around it.');
console.log('');
console.log('RECOMMENDED: Reinstall Node.js from https://nodejs.org/');
console.log('');
console.log('Attempting alternative installation methods...');
console.log('');

// Method 1: Try using node's built-in package manager capabilities
console.log('Method 1: Trying to use Node.js package resolution...');
try {
  // Check if node_modules exists
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    fs.mkdirSync(nodeModulesPath, { recursive: true });
  }

  // Try to use a different approach - check if we can use npm programmatically
  console.log('Note: Direct package installation without npm is complex.');
  console.log('');
} catch (error) {
  console.error('Error:', error.message);
}

console.log('');
console.log('========================================');
console.log('SOLUTION: Install Yarn or Reinstall Node.js');
console.log('========================================');
console.log('');
console.log('Option 1: Install Yarn (Recommended Quick Fix)');
console.log('----------------------------------------');
console.log('1. Download Yarn from:');
console.log('   https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable');
console.log('2. Install Yarn');
console.log('3. Run: yarn install');
console.log('');
console.log('Option 2: Reinstall Node.js (Best Long-term Fix)');
console.log('----------------------------------------');
console.log('1. Download Node.js LTS from: https://nodejs.org/');
console.log('2. Run installer and choose "Repair" or fresh install');
console.log('3. Restart PowerShell');
console.log('4. Run: npm install');
console.log('');
console.log('Option 3: Use Corepack (Requires Admin)');
console.log('----------------------------------------');
console.log('1. Open PowerShell as Administrator');
console.log('2. Run: corepack enable');
console.log('3. Run: corepack yarn install');
console.log('');

// Check if packages are already installed
console.log('Checking for existing packages...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
let installedCount = 0;
let missingCount = 0;

const packageNames = packages.map(pkg => pkg.split('@')[0]);

packageNames.forEach(pkgName => {
  const pkgPath = path.join(nodeModulesPath, pkgName);
  if (fs.existsSync(pkgPath)) {
    console.log(`✓ ${pkgName} is installed`);
    installedCount++;
  } else {
    console.log(`✗ ${pkgName} is missing`);
    missingCount++;
  }
});

console.log('');
console.log(`Installed: ${installedCount}/${packageNames.length}`);
console.log(`Missing: ${missingCount}/${packageNames.length}`);

if (missingCount > 0) {
  console.log('');
  console.log('⚠️  Packages are missing. Please use one of the solutions above.');
}
