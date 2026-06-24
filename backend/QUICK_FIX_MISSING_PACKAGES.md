# Quick Fix: Missing Packages (mongoose, bcryptjs, jsonwebtoken)

## Current Status
Your npm is corrupted and cannot install packages. Some packages are already installed, but these critical ones are missing:
- ❌ `mongoose` (MongoDB - **REQUIRED for server**)
- ❌ `bcryptjs` (Password hashing)
- ❌ `jsonwebtoken` (JWT authentication)
- ❌ `jest` (Testing)
- ❌ `supertest` (API testing)

## ✅ SOLUTION: Install Yarn (5 minutes)

### Step 1: Download Yarn
1. Open your web browser
2. Go to: **https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable**
3. Download the Windows installer (`.msi` file)
4. Run the installer
5. **Close and reopen PowerShell** (important!)

### Step 2: Install Packages
```powershell
cd backend
yarn install
```

This will install all missing packages including `mongoose`, `bcryptjs`, and `jsonwebtoken`.

### Step 3: Start Server
```powershell
yarn dev
# or
yarn start
```

## Alternative: Reinstall Node.js (Fixes npm permanently)

1. Download Node.js LTS from: **https://nodejs.org/**
2. Run installer → Choose "Repair" or fresh install
3. Restart PowerShell
4. Run: `npm install`

## Why This Happens
npm's internal files are corrupted (`fs-minipass` module has invalid syntax). This prevents npm from installing any packages. Yarn is a reliable alternative that works independently of npm.

## After Installing Packages
Once packages are installed, your server should start successfully:
```powershell
yarn dev
```

The error `Cannot find package 'mongoose'` will be resolved.
