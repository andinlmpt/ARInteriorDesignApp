# Manual Package Installation Script
# This script downloads and installs packages when npm is broken

$ErrorActionPreference = "Stop"

Write-Host "Installing packages manually..." -ForegroundColor Yellow

$packages = @(
    @{name="jsonwebtoken"; version="9.0.2"},
    @{name="mongoose"; version="8.0.3"},
    @{name="bcryptjs"; version="2.4.3"}
)

$nodeModulesPath = Join-Path $PSScriptRoot "node_modules"
$packageJsonPath = Join-Path $PSScriptRoot "package.json"

if (-not (Test-Path $nodeModulesPath)) {
    New-Item -ItemType Directory -Path $nodeModulesPath | Out-Null
}

foreach ($pkg in $packages) {
    $pkgName = $pkg.name
    $pkgVersion = $pkg.version
    $pkgPath = Join-Path $nodeModulesPath $pkgName
    
    Write-Host "Installing $pkgName@$pkgVersion..." -ForegroundColor Cyan
    
    if (Test-Path $pkgPath) {
        Write-Host "  $pkgName already exists, skipping..." -ForegroundColor Gray
        continue
    }
    
    # Try using npm with --no-save flag
    try {
        $env:Path = "C:\Program Files\nodejs;" + $env:Path
        & npm install "$pkgName@$pkgVersion" --no-save --legacy-peer-deps 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ $pkgName installed successfully" -ForegroundColor Green
        } else {
            throw "npm install failed"
        }
    } catch {
        Write-Host "  ✗ Failed to install $pkgName via npm" -ForegroundColor Red
        Write-Host "  Please fix npm or use an alternative package manager" -ForegroundColor Yellow
        Write-Host "  See NPM_FIX_GUIDE.md for instructions" -ForegroundColor Yellow
    }
}

Write-Host "`nInstallation complete!" -ForegroundColor Green
Write-Host "If packages are still missing, please:" -ForegroundColor Yellow
Write-Host "1. Reinstall Node.js from https://nodejs.org/" -ForegroundColor Yellow
Write-Host "2. Or install Yarn: https://classic.yarnpkg.com/en/docs/install#windows-stable" -ForegroundColor Yellow
