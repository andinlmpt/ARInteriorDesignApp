# Missing Package Installation Guide

## Issue
`expo-image-picker` is listed in `package.json` but not installed in `node_modules` due to corrupted npm installation.

## Error
```
npm error Cannot find module './lib/create.js'
```

## Solutions

### Option 1: Reinstall Node.js/npm (Recommended)
1. Download and reinstall Node.js from https://nodejs.org/
2. After installation, run:
   ```powershell
   cd frontend
   npm install
   ```

### Option 2: Use npm repair
```powershell
npm cache clean --force
npm install -g npm@latest
cd frontend
npm install
```

### Option 3: Manual package installation
If npm is still broken, you can try installing just the missing package:
```powershell
cd frontend
npm install expo-image-picker@~16.0.4 --legacy-peer-deps
```

### Option 4: Use alternative package manager
Install Yarn or pnpm:
```powershell
# Install Yarn
npm install -g yarn

# Then use yarn
cd frontend
yarn install
```

## Current Status
- ✅ `expo-image-picker` is in `package.json` (version ~16.0.4)
- ❌ Package is not installed in `node_modules`
- ✅ `CameraIcon` component has been added to `frontend/components/ui/Icons.tsx`

## After Fixing npm
Once npm is working, run:
```powershell
cd frontend
npm install
```

This will install all missing packages including `expo-image-picker`.
