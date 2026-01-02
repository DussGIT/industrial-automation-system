# Simple Deployment Script for UP Board
param(
    [string]$BoardIP = "",
    [string]$BoardUser = "supervisor"
)

if ($BoardIP -eq "") {
    $BoardIP = Read-Host "Enter UP Board IP address"
}

Write-Host "Deploying to $BoardUser@$BoardIP" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Docker
Write-Host "[1/4] Checking if Docker is installed..." -ForegroundColor Yellow
$dockerCheck = ssh "$BoardUser@$BoardIP" "which docker" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker not found. Installing..." -ForegroundColor Yellow
    
    $installScript = @"
sudo apt-get update && \
sudo apt-get install -y ca-certificates curl && \
sudo install -m 0755 -d /etc/apt/keyrings && \
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
echo "deb [arch=`$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu `$(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null && \
sudo apt-get update && \
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin && \
sudo usermod -aG docker `$USER && \
sudo systemctl enable docker && \
sudo systemctl start docker
"@
    
    ssh "$BoardUser@$BoardIP" $installScript
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Docker installation failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Docker is already installed" -ForegroundColor Green
}

# Step 2: Create directory
Write-Host ""
Write-Host "[2/4] Creating deployment directory..." -ForegroundColor Yellow
ssh "$BoardUser@$BoardIP" "mkdir -p ~/industrial-automation"
Write-Host "Directory created" -ForegroundColor Green

# Step 3: Copy files
Write-Host ""
Write-Host "[3/4] Copying files to UP board..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

scp -r docker-compose.yml backend frontend deployment "$BoardUser@$BoardIP`:~/industrial-automation/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Files copied successfully!" -ForegroundColor Green
} else {
    Write-Host "File copy failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Deploy
Write-Host ""
Write-Host "[4/4] Building and starting containers..." -ForegroundColor Yellow

$deployCmd = @"
cd ~/industrial-automation && \
docker compose down 2>/dev/null; \
docker compose build && \
docker compose up -d && \
echo "" && \
echo "Deployment complete!" && \
echo "Containers running:" && \
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
    Write-Host "View logs:" -ForegroundColor Cyan
    Write-Host "  ssh $BoardUser@$BoardIP 'cd ~/industrial-automation && docker compose logs -f'" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
