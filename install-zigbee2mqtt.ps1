# Zigbee2MQTT Installation Script for Windows
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Zigbee2MQTT Installation Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found! Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if Git is installed
try {
    $gitVersion = git --version
    Write-Host "Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "Git not found! Please install Git first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Set installation directory
$installDir = "C:\zigbee2mqtt"

# Check if already installed
if (Test-Path $installDir) {
    Write-Host "Zigbee2MQTT directory already exists at $installDir" -ForegroundColor Yellow
    $response = Read-Host "Do you want to reinstall? (y/n)"
    if ($response -ne 'y') {
        Write-Host "Installation cancelled." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "Removing existing installation..." -ForegroundColor Yellow
    Remove-Item -Path $installDir -Recurse -Force
}

# Clone the repository
Write-Host ""
Write-Host "Cloning Zigbee2MQTT from GitHub..." -ForegroundColor Yellow
try {
    git clone --depth 1 https://github.com/koenkk/zigbee2mqtt.git $installDir
    Write-Host "Repository cloned successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to clone repository" -ForegroundColor Red
    exit 1
}

# Navigate to directory and install dependencies
Write-Host ""
Write-Host "Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
Set-Location $installDir

try {
    npm ci --production
    Write-Host "Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create data directory if it doesn't exist
if (-not (Test-Path "$installDir\data")) {
    New-Item -ItemType Directory -Path "$installDir\data" | Out-Null
}

# Create configuration file
Write-Host ""
Write-Host "Creating configuration file..." -ForegroundColor Yellow

$configContent = "mqtt:`n  server: mqtt://localhost:1883`n`nserial:`n  port: COM3`n`nfrontend:`n  port: 8080`n`nhomeassistant: false`n`nadvanced:`n  log_level: info`n  pan_id: 0x1a62`n  channel: 11`n  network_key: GENERATE"

$configPath = "$installDir\data\configuration.yaml"
Set-Content -Path $configPath -Value $configContent -Encoding UTF8
Write-Host "Configuration file created" -ForegroundColor Green

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Plug in your Zigbee USB adapter" -ForegroundColor White
Write-Host "2. Find the COM port in Device Manager" -ForegroundColor White
Write-Host "3. Edit configuration file if needed:" -ForegroundColor White
Write-Host "   $configPath" -ForegroundColor Cyan
Write-Host "4. Start Zigbee2MQTT:" -ForegroundColor White
Write-Host "   cd $installDir" -ForegroundColor Cyan
Write-Host "   npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Web Interface: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Your System: http://localhost:5173/devices" -ForegroundColor Cyan
Write-Host ""
