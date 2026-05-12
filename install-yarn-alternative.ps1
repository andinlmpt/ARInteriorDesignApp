# Install Yarn as Alternative to npm
# This script downloads and sets up Yarn when npm is broken

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing Yarn as npm Alternative" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Yarn is already installed
Write-Host "Checking for existing Yarn installation..." -ForegroundColor Yellow
try {
    $yarnVersion = yarn --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Yarn is already installed: $yarnVersion" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now use Yarn instead of npm:" -ForegroundColor Yellow
        Write-Host "  cd backend" -ForegroundColor Cyan
        Write-Host "  yarn install" -ForegroundColor Cyan
        exit 0
    }
} catch {
    Write-Host "Yarn not found. Proceeding with installation..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Method 1: Download Yarn Installer (Recommended)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "1. Open your web browser" -ForegroundColor White
Write-Host "2. Go to: https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable" -ForegroundColor Cyan
Write-Host "3. Download the Windows installer (.msi file)" -ForegroundColor White
Write-Host "4. Run the installer" -ForegroundColor White
Write-Host "5. Restart PowerShell" -ForegroundColor White
Write-Host "6. Then run: cd backend && yarn install" -ForegroundColor White
Write-Host ""

Write-Host "Method 2: Use Corepack (Built into Node.js 22+)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Note: This requires Administrator privileges" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor White
Write-Host "2. Run: corepack enable" -ForegroundColor Cyan
Write-Host "3. Then: cd backend" -ForegroundColor Cyan
Write-Host "4. Then: corepack yarn install" -ForegroundColor Cyan
Write-Host ""

Write-Host "Method 3: Manual Yarn Installation via npm (if npm gets fixed)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Once npm is working, run:" -ForegroundColor White
Write-Host "  npm install -g yarn" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "After Installing Yarn" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Use these commands instead of npm:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  yarn install          (instead of npm install)" -ForegroundColor Cyan
Write-Host "  yarn add <package>   (instead of npm install <package>)" -ForegroundColor Cyan
Write-Host "  yarn start            (instead of npm start)" -ForegroundColor Cyan
Write-Host ""

Write-Host "For this project:" -ForegroundColor Yellow
Write-Host "  cd backend" -ForegroundColor Cyan
Write-Host "  yarn install" -ForegroundColor Cyan
Write-Host ""
