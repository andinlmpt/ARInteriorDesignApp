# Fixing npm Installation Issues

## Problem
npm is corrupted and cannot find its internal modules (`./lib/create.js`). This is a system-level npm issue, not a project issue.

## Solutions (try in order)

### Solution 1: Reinstall Node.js (Recommended)
1. Download the latest Node.js LTS version from: https://nodejs.org/
2. Run the installer and choose "Repair" or do a fresh install
3. Restart your terminal/PowerShell
4. Verify: `npm --version` and `node --version`
5. Try installing again: `cd backend && npm install`

### Solution 2: Install Yarn (Alternative Package Manager)
Yarn is a reliable alternative to npm:

```powershell
# Install Yarn globally
npm install -g yarn

# Then use yarn instead of npm
cd backend
yarn install
```

### Solution 3: Install pnpm (Another Alternative)
pnpm is faster and uses less disk space:

```powershell
# Install pnpm globally
npm install -g pnpm

# Then use pnpm instead of npm
cd backend
pnpm install
```

### Solution 4: Manual npm Fix (Advanced)
If you want to fix npm without reinstalling Node.js:

1. Download npm separately:
   ```powershell
   npm install -g npm@latest
   ```

2. If that doesn't work, try:
   ```powershell
   # Remove npm cache manually
   Remove-Item -Recurse -Force "$env:APPDATA\npm-cache"
   
   # Reinstall npm
   npm install -g npm@latest
   ```

### Solution 5: Use Corepack (Node.js Built-in)
Node.js 22 includes Corepack which can manage package managers:

```powershell
# Enable Corepack
corepack enable

# Use yarn
cd backend
corepack yarn install

# Or use pnpm
corepack pnpm install
```

## After Fixing

Once npm is working, install the MongoDB dependencies:

```powershell
cd backend
npm install
```

Or if using yarn:
```powershell
cd backend
yarn install
```

## Verify Installation

After installing, verify the packages are installed:

```powershell
cd backend
npm list mongoose bcryptjs jsonwebtoken
```

## Quick Test

Test if npm is working:
```powershell
npm --version
npm install -g npm-check-updates
```

If the second command works, npm is fixed!
