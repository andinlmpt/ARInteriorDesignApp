# PowerShell script to start both frontend and backend together
# Usage: .\start-dev.ps1

Write-Host "🚀 Starting AR Interior Design App (Frontend + Backend)" -ForegroundColor Cyan
Write-Host ""

# Check if concurrently is installed
$hasConcurrently = Get-Command npm -ErrorAction SilentlyContinue | Select-Object -First 1

if ($hasConcurrently) {
    Write-Host "📦 Using npm concurrently to run both servers..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
    Write-Host ""
    
    # Check if package.json has dev script
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.dev) {
            npm run dev
        } else {
            Write-Host "⚠️  No 'dev' script found. Starting manually..." -ForegroundColor Yellow
            # Start manually using PowerShell jobs
            Start-Job -ScriptBlock { Set-Location $using:PWD; cd backend; npm start } -Name "Backend"
            Start-Job -ScriptBlock { Set-Location $using:PWD; cd frontend; npm start } -Name "Frontend"
            
            Write-Host "✅ Backend and Frontend started in background jobs" -ForegroundColor Green
            Write-Host "View jobs: Get-Job" -ForegroundColor Cyan
            Write-Host "Stop jobs: Stop-Job -Name Backend,Frontend" -ForegroundColor Cyan
            Write-Host "Remove jobs: Remove-Job -Name Backend,Frontend" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ package.json not found in root directory" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ npm not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}
