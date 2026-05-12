# PowerShell script to start both frontend and backend in separate windows
# Usage: .\start-all.ps1

Write-Host "Starting AR Interior Design App" -ForegroundColor Cyan
Write-Host ""

$backendScript = Join-Path $PSScriptRoot "start-backend.ps1"
$frontendScript = Join-Path $PSScriptRoot "start-frontend.ps1"

# Start backend in new window
if (Test-Path $backendScript) {
    Write-Host "Starting Backend Server..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$backendScript`""
    Start-Sleep -Seconds 2
} else {
    Write-Host "Backend script not found: $backendScript" -ForegroundColor Yellow
}

# Start frontend in new window
if (Test-Path $frontendScript) {
    Write-Host "Starting Frontend (Expo)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$frontendScript`""
    Start-Sleep -Seconds 2
} else {
    Write-Host "Frontend script not found: $frontendScript" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Both servers started in separate windows" -ForegroundColor Green
Write-Host "Backend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: Check Expo output in the frontend window" -ForegroundColor Cyan
Write-Host ""
