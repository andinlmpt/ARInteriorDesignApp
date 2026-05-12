# PowerShell script to start the backend from root directory
# Usage: .\start-backend.ps1

Set-Location -Path "$PSScriptRoot\backend"

Write-Host "Starting backend server..." -ForegroundColor Green
npm start
