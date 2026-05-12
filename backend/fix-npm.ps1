# Fix npm Corruption Script
# This script attempts to fix corrupted npm installation

Write-Host "Attempting to fix npm..." -ForegroundColor Yellow

# Method 1: Try to reinstall npm using node
Write-Host ""
Write-Host "Method 1: Reinstalling npm via node..." -ForegroundColor Cyan
try {
    $npmPath = "C:\Program Files\nodejs\npm.cmd"
    if (Test-Path $npmPath) {
        Write-Host "Found npm at: $npmPath" -ForegroundColor Gray
    }
    
    # Try using node to install npm
    $nodePath = (Get-Command node).Source
    Write-Host "Node.js path: $nodePath" -ForegroundColor Gray
    
    Write-Host "Note: This requires manual intervention" -ForegroundColor Yellow
    Write-Host "Please download and install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Method 2: Check if we can use alternative package managers
Write-Host ""
Write-Host "Method 2: Checking for alternative package managers..." -ForegroundColor Cyan

# Check for yarn
try {
    $yarn = Get-Command yarn -ErrorAction SilentlyContinue
    if ($yarn) {
        Write-Host "Yarn is available!" -ForegroundColor Green
        Write-Host "You can use: yarn install" -ForegroundColor Yellow
    } else {
        Write-Host "Yarn not found" -ForegroundColor Red
        Write-Host "Download Yarn: https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Yarn not available" -ForegroundColor Red
}

# Method 3: Manual npm fix instructions
Write-Host ""
Write-Host "Method 3: Manual Fix Instructions" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "1. Download Node.js from: https://nodejs.org/" -ForegroundColor White
Write-Host "2. Run the installer and choose Repair or reinstall" -ForegroundColor White
Write-Host "3. Restart your terminal/PowerShell" -ForegroundColor White
Write-Host "4. Verify: npm --version" -ForegroundColor White
Write-Host ""
Write-Host "OR" -ForegroundColor Yellow
Write-Host "1. Download Yarn: https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable" -ForegroundColor White
Write-Host "2. Use yarn instead of npm: yarn install" -ForegroundColor White

Write-Host ""
Write-Host "Current Status:" -ForegroundColor Cyan
$nodeVer = node --version
Write-Host "Node.js: $nodeVer" -ForegroundColor Gray
try {
    $npmVer = npm --version 2>&1 | Out-String
    Write-Host "npm: $npmVer" -ForegroundColor Gray
} catch {
    Write-Host "npm: ERROR - Cannot get version" -ForegroundColor Red
}
