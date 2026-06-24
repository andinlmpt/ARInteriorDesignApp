# Quick Yarn Installation Script
# Downloads and installs Yarn when npm is broken

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing Yarn (npm Alternative)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Yarn is already installed
$yarnInstalled = $false
try {
    $yarnVersion = yarn --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Yarn is already installed: $yarnVersion" -ForegroundColor Green
        $yarnInstalled = $true
    }
} catch {
    # Yarn not installed
}

if ($yarnInstalled) {
    Write-Host ""
    Write-Host "You can now install packages with:" -ForegroundColor Yellow
    Write-Host "  yarn install" -ForegroundColor Cyan
    exit 0
}

Write-Host "Yarn is not installed. Installing..." -ForegroundColor Yellow
Write-Host ""

# Method 1: Try using Corepack (if available and has permissions)
Write-Host "Method 1: Trying Corepack..." -ForegroundColor Cyan
try {
    corepack enable 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Corepack enabled!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now use:" -ForegroundColor Yellow
        Write-Host "  corepack yarn install" -ForegroundColor Cyan
        exit 0
    }
} catch {
    Write-Host "✗ Corepack requires administrator privileges" -ForegroundColor Red
    Write-Host ""
}

# Method 2: Download Yarn installer
Write-Host "Method 2: Download Yarn Installer" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "Since npm is broken, you need to download Yarn manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open your web browser" -ForegroundColor White
Write-Host "2. Go to: https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable" -ForegroundColor Cyan
Write-Host "3. Download the Windows installer (.msi file)" -ForegroundColor White
Write-Host "4. Run the installer" -ForegroundColor White
Write-Host "5. Close and reopen PowerShell" -ForegroundColor White
Write-Host "6. Then run: yarn install" -ForegroundColor White
Write-Host ""

# Try to open the download page
Write-Host "Attempting to open Yarn download page..." -ForegroundColor Yellow
try {
    Start-Process "https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable"
    Write-Host "✓ Browser opened to Yarn download page" -ForegroundColor Green
} catch {
    Write-Host "✗ Could not open browser automatically" -ForegroundColor Red
    Write-Host "  Please manually visit: https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "After Installing Yarn" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Run these commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  yarn install" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will install all packages from package.json" -ForegroundColor Gray
Write-Host ""
