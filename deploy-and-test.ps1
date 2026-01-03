#!/usr/bin/env pwsh
# Deploy updated files to UP board and run test

$upBoard = "192.168.1.57"
$user = "your-username"  # Update this

Write-Host "=== Deploy and Test on UP Board ===" -ForegroundColor Cyan
Write-Host ""

# Files to deploy
$files = @(
    @{local="backend\src\core\gpio-manager.js"; remote="/opt/automation/backend/src/core/gpio-manager.js"},
    @{local="backend\src\api\gpio.js"; remote="/opt/automation/backend/src/api/gpio.js"},
    @{local="test-channel-on-board.sh"; remote="/tmp/test-channel.sh"}
)

Write-Host "1. Deploying updated files to UP board..." -ForegroundColor Yellow
foreach ($file in $files) {
    Write-Host "   Copying $($file.local)..." -ForegroundColor Gray
    scp "$($file.local)" "${user}@${upBoard}:$($file.remote)"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ Failed to copy $($file.local)" -ForegroundColor Red
        exit 1
    }
}
Write-Host "   ✓ Files deployed" -ForegroundColor Green
Write-Host ""

Write-Host "2. Restarting backend service..." -ForegroundColor Yellow
ssh "${user}@${upBoard}" "sudo systemctl restart automation-backend"
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Backend restarted" -ForegroundColor Green
} else {
    Write-Host "   ✗ Failed to restart backend" -ForegroundColor Red
    Write-Host "   Trying Docker restart..." -ForegroundColor Yellow
    ssh "${user}@${upBoard}" "cd /opt/automation && docker-compose restart backend"
}
Write-Host ""

Write-Host "3. Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host ""

Write-Host "4. Running channel test..." -ForegroundColor Yellow
ssh "${user}@${upBoard}" "chmod +x /tmp/test-channel.sh && /tmp/test-channel.sh"
Write-Host ""

Write-Host "5. Fetching recent logs..." -ForegroundColor Yellow
Write-Host "--- Last 30 lines of backend log ---" -ForegroundColor Gray
ssh "${user}@${upBoard}" "docker logs automation-backend --tail 30 2>&1 | grep -i 'channel\|gpio'"
Write-Host ""

Write-Host "=== Deploy and Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view live logs, run:" -ForegroundColor Yellow
Write-Host "  ssh ${user}@${upBoard} 'docker logs -f automation-backend'"
