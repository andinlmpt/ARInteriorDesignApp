# PowerShell script to start the frontend from root directory
# Usage: .\start-frontend.ps1 [--web|--android|--ios]

param(
    [string]$platform = ""
)

Set-Location -Path "$PSScriptRoot\frontend"

if ($platform) {
    Write-Host "Starting Expo frontend with platform: $platform" -ForegroundColor Green
    npx expo start $platform
} else {
    Write-Host "Starting Expo frontend..." -ForegroundColor Green
    npm start
}
