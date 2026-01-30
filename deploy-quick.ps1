# Quick Deploy Script
# 
# DATA PROTECTION:
# - Excludes data/ directory during file copy to preserve flows.db and audio files
# - Uses 'docker-compose stop' instead of 'down' to preserve volumes
# - Backend automatically syncs audio files from /data/audio/ on startup
#
param(
    [string]$BoardIP = "192.168.1.57",
    [string]$BoardUser = "supervisor"
)

Write-Host "Quick Deployment to $BoardUser@$BoardIP" -ForegroundColor Cyan

# Step 1: Create directory
Write-Host "[1/3] Creating directory..." -ForegroundColor Yellow
ssh "$BoardUser@$BoardIP" "mkdir -p ~/industrial-automation"

# Step 2: Copy files (excluding data directory to preserve database and audio files)
Write-Host "[2/3] Copying files..." -ForegroundColor Yellow
Write-Host "  - Excluding data/ directory to preserve flows.db and audio files" -ForegroundColor Gray
scp docker-compose.yml "$BoardUser@${BoardIP}:~/industrial-automation/"
scp -r --exclude='data' backend "$BoardUser@${BoardIP}:~/industrial-automation/"
scp -r frontend "$BoardUser@${BoardIP}:~/industrial-automation/"
scp -r deployment "$BoardUser@${BoardIP}:~/industrial-automation/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "File copy failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Files copied successfully!" -ForegroundColor Green

# Step 3: Build and start (only UP board services, skip central server services)
Write-Host "[3/3] Building and starting containers..." -ForegroundColor Yellow
Write-Host "  - Using restart to preserve volumes and data" -ForegroundColor Gray
ssh "$BoardUser@$BoardIP" "cd ~/industrial-automation && docker-compose build mqtt backend frontend && docker-compose stop mqtt backend frontend && docker-compose up -d mqtt backend frontend"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "Frontend: http://$BoardIP:5173" -ForegroundColor White
    Write-Host "Backend: http://$BoardIP:3000/api" -ForegroundColor White
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
