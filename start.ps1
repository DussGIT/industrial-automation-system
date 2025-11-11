# Quick Start - Run Development Server
# This script starts both backend and frontend in development mode

Write-Host "Starting Industrial Automation System..." -ForegroundColor Cyan
Write-Host ""

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencies not found. Running setup..." -ForegroundColor Yellow
    .\setup.ps1
}

Write-Host "Starting development servers..." -ForegroundColor Green
Write-Host ""
Write-Host "Backend API will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend UI will be available at: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start the dev server
npm run dev
