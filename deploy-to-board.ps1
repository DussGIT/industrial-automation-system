# Deploy to UP Board via SSH
# This script helps deploy the Industrial Automation System to a UP Board

param(
    [Parameter(Mandatory=$false)]
    [string]$BoardIP = "",
    
    [Parameter(Mandatory=$false)]
    [string]$BoardUser = "upsquared",
    
    [Parameter(Mandatory=$false)]
    [switch]$InstallDocker,
    
    [Parameter(Mandatory=$false)]
    [switch]$TestConnection,
    
    [Parameter(Mandatory=$false)]
    [switch]$Deploy
)

Write-Host "UP Board Deployment Tool" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Prompt for IP if not provided
if ($BoardIP -eq "") {
    $BoardIP = Read-Host "Enter UP Board IP address (e.g., 192.168.1.100)"
}

# Test SSH connection
function Test-SSHConnection {
    Write-Host "Testing SSH connection to $BoardUser@$BoardIP..." -ForegroundColor Yellow
    
    # Check if ssh is available
    try {
        $sshVersion = ssh -V 2>&1
        Write-Host "✓ SSH client found: $sshVersion" -ForegroundColor Green
    } catch {
        Write-Host "SSH client not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "To install OpenSSH on Windows:" -ForegroundColor Yellow
        Write-Host "1. Open Settings > Apps > Optional Features" -ForegroundColor White
        Write-Host "2. Click Add a feature" -ForegroundColor White
        Write-Host "3. Search for OpenSSH Client and install it" -ForegroundColor White
        Write-Host ""
        Write-Host "Or use PowerShell:" -ForegroundColor Yellow
        Write-Host "Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0" -ForegroundColor White
        Write-Host ""
        return $false
    }
    
    # Test connection
    Write-Host "Attempting to connect..." -ForegroundColor Gray
    $testCmd = "echo 'Connection successful'"
    $result = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$BoardUser@$BoardIP" "$testCmd" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ SSH connection successful!" -ForegroundColor Green
        Write-Host "  Response: $result" -ForegroundColor Gray
        return $true
    } else {
        Write-Host "SSH connection failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
        Write-Host "1. Verify the UP board is powered on and connected to network" -ForegroundColor White
        Write-Host "2. Verify the IP address is correct: $BoardIP" -ForegroundColor White
        Write-Host "3. Check if SSH is enabled on the UP board" -ForegroundColor White
        Write-Host "4. If prompted for password use the UP boards password" -ForegroundColor White
        Write-Host ""
        Write-Host "Common fixes for UP board:" -ForegroundColor Yellow
        Write-Host "Default credentials: upsquared/upsquared" -ForegroundColor White
        Write-Host "Enable SSH: sudo systemctl enable ssh" -ForegroundColor White
        Write-Host "Check firewall: sudo ufw allow 22" -ForegroundColor White
        Write-Host ""
        Write-Host "Error details: $result" -ForegroundColor Red
        return $false
    }
}

# Install Docker on UP board
function Install-Docker {
    Write-Host "Installing Docker on UP board..." -ForegroundColor Yellow
    
    $installScript = @'
#!/bin/bash
set -e

echo "Updating package lists..."
sudo apt-get update

echo "Installing prerequisites..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release

echo "Adding Docker GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "Adding Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "Installing Docker..."
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "Adding user to docker group..."
sudo usermod -aG docker $USER

echo "Starting Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo "Docker installation complete!"
docker --version
docker compose version
'@
    
    # Send script to board and execute
    Write-Host "Sending installation script to board..." -ForegroundColor Gray
    $installScript | ssh "$BoardUser@$BoardIP" "cat > /tmp/install-docker.sh && chmod +x /tmp/install-docker.sh && /tmp/install-docker.sh"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker installed successfully!" -ForegroundColor Green
        Write-Host "  Note: You may need to log out and back in for group changes to take effect" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Docker installation failed!" -ForegroundColor Red
    }
}

# Deploy application
function Deploy-Application {
    Write-Host "Deploying Industrial Automation System to UP board..." -ForegroundColor Yellow
    Write-Host ""
    
    # Create deployment directory
    Write-Host "Creating deployment directory on board..." -ForegroundColor Gray
    ssh "$BoardUser@$BoardIP" "mkdir -p ~/industrial-automation"
    
    # Copy files using scp
    Write-Host "Copying files to board..." -ForegroundColor Gray
    Write-Host "  This may take a few minutes..." -ForegroundColor Gray
    
    # Use scp to copy files
    scp -r -o StrictHostKeyChecking=no `
        docker-compose.yml `
        backend `
        frontend `
        deployment `
        "$BoardUser@$BoardIP`:~/industrial-automation/"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ File copy failed!" -ForegroundColor Red
        return
    }
    
    Write-Host "✓ Files copied successfully!" -ForegroundColor Green
    
    # Build and start containers
    Write-Host "Building and starting containers..." -ForegroundColor Gray
    $deployCommands = @'
cd ~/industrial-automation
docker compose build
docker compose up -d
docker compose ps
'@
    
    ssh "$BoardUser@$BoardIP" $deployCommands
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Application is now running on UP board!" -ForegroundColor Cyan
        Write-Host "  Frontend: http://$BoardIP:5173" -ForegroundColor White
        Write-Host "  Backend API: http://$BoardIP:3000/api" -ForegroundColor White
        Write-Host ""
        Write-Host "To view logs:" -ForegroundColor Yellow
        Write-Host "  ssh $BoardUser@$BoardIP 'cd ~/industrial-automation && docker compose logs -f'" -ForegroundColor White
    } else {
        Write-Host "✗ Deployment failed!" -ForegroundColor Red
    }
}

# Main execution
if ($TestConnection) {
    Test-SSHConnection
    exit
}

if ($InstallDocker) {
    if (Test-SSHConnection) {
        Install-Docker
    }
    exit
}

if ($Deploy) {
    if (Test-SSHConnection) {
        Deploy-Application
    }
    exit
}

# Interactive mode
Write-Host "What would you like to do?" -ForegroundColor Yellow
Write-Host "  1. Test SSH connection" -ForegroundColor White
Write-Host "  2. Install Docker on UP board" -ForegroundColor White
Write-Host "  3. Deploy application" -ForegroundColor White
Write-Host "  4. Full setup test install Docker deploy" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Test-SSHConnection
    }
    "2" {
        if (Test-SSHConnection) {
            Install-Docker
        }
    }
    "3" {
        if (Test-SSHConnection) {
            Deploy-Application
        }
    }
    "4" {
        if (Test-SSHConnection) {
            Install-Docker
            Write-Host ""
            Write-Host "Waiting 5 seconds before deployment..." -ForegroundColor Gray
            Start-Sleep -Seconds 5
            Deploy-Application
        }
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
