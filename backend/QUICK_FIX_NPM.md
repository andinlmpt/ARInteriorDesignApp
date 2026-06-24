# Quick Fix for npm Corruption

## The Problem
Your npm installation is corrupted - the file `create.js` is missing from npm's internal modules. This prevents npm from installing any packages.

## ✅ SOLUTION: Reinstall Node.js (5 minutes)

### Step 1: Download Node.js
1. Go to: **https://nodejs.org/**
2. Click the big green **"Download Node.js (LTS)"** button
3. This downloads `node-v24.13.0-x64.msi` (or latest version)

### Step 2: Uninstall Old Node.js (Optional but Recommended)
1. Open **Settings** → **Apps** → **Apps & features**
2. Search for "Node.js"
3. Click **Uninstall**
4. Restart your computer (recommended)

### Step 3: Install New Node.js
1. Run the downloaded `.msi` installer
2. Click **Next** through the wizard
3. **Important:** Check "Automatically install the necessary tools"
4. Click **Install** (allow admin access if prompted)
5. Wait for installation to complete

### Step 4: Verify Installation
1. **Close and reopen** PowerShell/terminal (IMPORTANT!)
2. Run these commands:
   ```powershell
   node --version
   npm --version
   ```
3. Both should show version numbers without errors

### Step 5: Install Your Packages
```powershell
cd C:\Users\Admin\Documents\GitHub\ARInteriorDesignApp\backend
npm install
```

This should now work! ✅

## Alternative: Use Yarn (If you can't reinstall Node.js)

1. Download Yarn: https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable
2. Install it
3. Then use:
   ```powershell
   cd backend
   yarn install
   ```

## Why This Happens
- npm's internal files got corrupted (possibly during an update or system issue)
- The `tar` module's `create.js` file is missing
- This is a system-level issue, not your project

## After Fixing
Once npm works, you'll be able to install:
- ✅ mongoose (MongoDB)
- ✅ bcryptjs (password hashing)
- ✅ jsonwebtoken (JWT authentication)

Then your MongoDB authentication system will be ready to use!
