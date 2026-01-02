# Simple Deploy - Just copy and run
param(
    [string]$BoardIP = "192.168.1.57",
    [string]$BoardUser = "supervisor"
)

Write-Host "Deploying Industrial Automation to $BoardUser@$BoardIP" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create directory
Write-Host "[1/3] Creating deployment directory..." -ForegroundColor Yellow
ssh "$BoardUser@$BoardIP" "mkdir -p ~/industrial-automation"

# Step 2: Copy files
Write-Host "[2/3] Copying files to UP board..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

scp -r docker-compose.yml backend frontend deployment "$BoardUser@$BoardIP`:~/industrial-automation/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Files copied successfully!" -ForegroundColor Green
} else {
    Write-Host "File copy failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Deploy
Write-Host "[3/3] Building and starting containers..." -ForegroundColor Yellow

$deployCmd = @"
cd ~/industrial-automation
docker compose down 2>/dev/null || true
docker compose build
docker compose up -d
echo ""
echo "Containers running:"
docker compose ps
"@

ssh "$BoardUser@$BoardIP" $deployCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Deployment Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access your application at:" -ForegroundColor Cyan
    Write-Host "  Frontend: http://$BoardIP:5173" -ForegroundColor White
    Write-Host "  Backend API: http://$BoardIP:3000/api" -ForegroundColor White
    Write-Host "  Health Check: http://$BoardIP:3000/health" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
