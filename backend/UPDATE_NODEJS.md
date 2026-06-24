# Update Node.js - Quick Guide

## Option 1: Manual Download (Recommended - 2 minutes)

1. **Download Node.js LTS:**
   - Go to: https://nodejs.org/
   - Click "Download Node.js (LTS)" - this will download the Windows installer
   - The latest LTS version is **v24.13.0**

2. **Run the Installer:**
   - Double-click the downloaded `.msi` file
   - Follow the installation wizard
   - **Important:** Check "Automatically install the necessary tools" if prompted
   - Click "Install" (you may need to allow administrator access)

3. **Restart Your Terminal:**
   - Close and reopen PowerShell/Command Prompt
   - Or restart your IDE/editor

4. **Verify Installation:**
   ```powershell
   node --version
   npm --version
   ```

5. **Install Backend Dependencies:**
   ```powershell
   cd backend
   npm install
   ```

## Option 2: Use Winget (Requires Admin)

If you have administrator access, run PowerShell **as Administrator** and execute:

```powershell
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
```

Then restart your terminal and verify:
```powershell
node --version
npm --version
```

## After Updating

Once Node.js is updated and npm is working:

1. **Install the MongoDB packages:**
   ```powershell
   cd backend
   npm install
   ```

2. **Verify packages are installed:**
   ```powershell
   npm list mongoose bcryptjs jsonwebtoken
   ```

3. **Start the server:**
   ```powershell
   npm start
   ```

## Troubleshooting

If npm still doesn't work after updating:
1. Restart your computer
2. Check if Node.js is in your PATH: `where.exe node`
3. Try uninstalling Node.js completely, then reinstalling fresh

## What This Fixes

- ✅ Fixes corrupted npm installation
- ✅ Updates to latest stable Node.js LTS (v24.13.0)
- ✅ Allows installation of MongoDB dependencies
- ✅ Enables your authentication system to work
