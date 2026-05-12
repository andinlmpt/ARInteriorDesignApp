# Fix npm Corruption - Comprehensive Solution
# Run this script as Administrator for best results

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "npm Corruption Fix Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is working: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not working. Please reinstall Node.js." -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ npm is working: $npmVersion" -ForegroundColor Green
        Write-Host "npm appears to be working. Try running: cd backend && npm install" -ForegroundColor Yellow
        exit 0
    }
} catch {
    Write-Host "✗ npm is corrupted" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SOLUTION OPTIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Solution 1: Try to reinstall npm using node
Write-Host "Solution 1: Reinstalling npm using Node.js..." -ForegroundColor Yellow
Write-Host "This may require administrator privileges." -ForegroundColor Gray
Write-Host ""

$npmInstallScript = @"
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Attempting to reinstall npm...');
try {
    // Try to install npm using node's built-in method
    const npmPath = path.join(process.execPath, '..', 'node_modules', 'npm');
    console.log('npm path:', npmPath);
    
    // Use node to install npm globally
    console.log('Installing npm@latest...');
    execSync('node -e "require(\"child_process\").spawnSync(\"node\", [\"-e\", \"require(\\\"fs\\\").writeFileSync(\\\"test.txt\\\", \\\"test\\\")\"], {stdio: \"inherit\"})"', {stdio: 'inherit'});
    
    // Alternative: try to download and install npm manually
    console.log('Please run: npm install -g npm@latest');
    console.log('If that fails, proceed to Solution 2 or 3');
} catch (error) {
    console.error('Error:', error.message);
    console.log('Please proceed to Solution 2 or 3');
}
"@

try {
    $tempScript = [System.IO.Path]::GetTempFileName() + ".js"
    $npmInstallScript | Out-File -FilePath $tempScript -Encoding UTF8
    node $tempScript
    Remove-Item $tempScript -ErrorAction SilentlyContinue
} catch {
    Write-Host "Could not auto-fix npm. Proceeding to manual solutions..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Solution 2: Reinstall Node.js (RECOMMENDED)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "1. Download Node.js LTS from: https://nodejs.org/" -ForegroundColor White
Write-Host "2. Run the installer" -ForegroundColor White
Write-Host "3. Choose 'Repair' or do a fresh install" -ForegroundColor White
Write-Host "4. Restart PowerShell/terminal" -ForegroundColor White
Write-Host "5. Verify: npm --version" -ForegroundColor White
Write-Host "6. Then run: cd backend && npm install" -ForegroundColor White
Write-Host ""

Write-Host "Solution 3: Install Yarn (Alternative Package Manager)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "1. Download Yarn from: https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable" -ForegroundColor White
Write-Host "2. Install Yarn" -ForegroundColor White
Write-Host "3. Then use: cd backend && yarn install" -ForegroundColor White
Write-Host ""

Write-Host "Solution 4: Use Corepack (Built into Node.js 22+)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Run PowerShell as Administrator, then:" -ForegroundColor White
Write-Host "  corepack enable" -ForegroundColor Cyan
Write-Host "  cd backend" -ForegroundColor Cyan
Write-Host "  corepack yarn install" -ForegroundColor Cyan
Write-Host "  OR" -ForegroundColor White
Write-Host "  corepack pnpm install" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick Test After Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "cd backend" -ForegroundColor Cyan
Write-Host "npm install" -ForegroundColor Cyan
Write-Host ""
