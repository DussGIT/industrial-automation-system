# Optimized Deploy - Only copy source files, build on board
param(
    [string]$BoardIP = "192.168.1.57",
    [string]$BoardUser = "supervisor"
)

Write-Host "Optimized Deployment to $BoardUser@$BoardIP" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create directory structure
Write-Host "[1/4] Creating deployment directory..." -ForegroundColor Yellow
ssh "$BoardUser@$BoardIP" "mkdir -p ~/industrial-automation"

# Step 2: Copy only essential source files (exclude node_modules, build artifacts)
Write-Host "[2/4] Copying source files (excluding node_modules)..." -ForegroundColor Yellow

# Copy backend source (excluding node_modules)
Write-Host "  - Backend source files..." -ForegroundColor Gray
scp -r --exclude='node_modules' --exclude='logs' --exclude='*.log' `
    backend/src backend/package*.json backend/Dockerfile `
    "$BoardUser@$BoardIP`:~/industrial-automation/backend/"

# Copy frontend source (excluding node_modules and build)
Write-Host "  - Frontend source files..." -ForegroundColor Gray
scp -r --exclude='node_modules' --exclude='build' --exclude='dist' --exclude='.vite' `
    frontend/src frontend/public frontend/package*.json frontend/*.js frontend/*.json frontend/Dockerfile frontend/*.config.js frontend/*.html `
    "$BoardUser@$BoardIP`:~/industrial-automation/frontend/"

# Copy docker-compose and deployment configs
Write-Host "  - Docker and deployment configs..." -ForegroundColor Gray
scp docker-compose.local.yml "$BoardUser@$BoardIP`:~/industrial-automation/"
scp -r deployment "$BoardUser@$BoardIP`:~/industrial-automation/" 2>/dev/null

if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) {
    Write-Host "File copy failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Source files copied successfully!" -ForegroundColor Green

# Step 3: Build on the board
Write-Host "[3/4] Building containers on UP board..." -ForegroundColor Yellow

$buildCmd = @"
cd ~/industrial-automation
echo "Stopping existing containers..."
docker-compose -f docker-compose.local.yml down 2>/dev/null || true
echo "Building containers..."
docker-compose -f docker-compose.local.yml build
"@

ssh "$BoardUser@$BoardIP" $buildCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Start containers
Write-Host "[4/4] Starting containers..." -ForegroundColor Yellow

$startCmd = @"
cd ~/industrial-automation
docker-compose -f docker-compose.local.yml up -d
echo ""
echo "Containers running:"
docker-compose -f docker-compose.local.yml ps
"@

ssh "$BoardUser@$BoardIP" $startCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Deployment Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access your application at:" -ForegroundColor Cyan
    Write-Host "  Frontend: http://$BoardIP" -ForegroundColor White
    Write-Host "  Backend API: http://$BoardIP:3000/api" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
