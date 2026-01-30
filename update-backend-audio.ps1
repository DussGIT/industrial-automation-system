# Quick script to update backend with audio support
param(
    [string]$BoardIP = "192.168.1.57",
    [string]$BoardUser = "supervisor"
)

Write-Host "Updating Backend with Audio Support" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy updated Dockerfile and docker-compose
Write-Host "[1/3] Copying updated configuration files..." -ForegroundColor Yellow
scp backend/Dockerfile "$BoardUser@$BoardIP`:~/industrial-automation/backend/"
scp docker-compose.yml "$BoardUser@$BoardIP`:~/industrial-automation/"

# Step 2: Rebuild backend container
Write-Host "[2/3] Rebuilding backend container with audio support..." -ForegroundColor Yellow
ssh "$BoardUser@$BoardIP" @"
cd ~/industrial-automation
echo "Stopping containers..."
docker stop ia-backend ia-frontend ia-mqtt 2>/dev/null || true
echo "Removing old backend..."
docker rm ia-backend 2>/dev/null || true
echo "Rebuilding backend..."
cd backend
docker build -t ia-backend .
cd ..
"@

# Step 3: Start all containers
Write-Host "[3/3] Starting containers..." -ForegroundColor Yellow

# Create a temporary script file
$script = @'
cd ~/industrial-automation
# Start MQTT
if [ "$(docker ps -a -q -f name=ia-mqtt)" ]; then
    docker start ia-mqtt
else
    docker run -d --name ia-mqtt -p 1883:1883 -p 9001:9001 eclipse-mosquitto:2.0
fi

sleep 3

# Create network if it doesn't exist
docker network create ia-network 2>/dev/null || true

# Start backend with audio device
docker run -d --name ia-backend \
  --network ia-network \
  --device /dev/snd:/dev/snd \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  --device /dev/ttyUSB1:/dev/ttyUSB1 \
  --device /dev/ttyUSB5:/dev/ttyUSB5 \
  --device /dev/mem:/dev/mem \
  --device /dev/gpiomem:/dev/gpiomem \
  -v ~/industrial-automation/backend:/app \
  -v ~/industrial-automation/data:/data \
  -v /var/run/dbus:/var/run/dbus \
  -v /sys:/sys \
  -v backend-node-modules:/app/node_modules \
  -p 3000:3000 -p 3001:3001 \
  -e NODE_ENV=production \
  -e MQTT_BROKER=mqtt://ia-mqtt:1883 \
  -e DATABASE_PATH=/data/flows.db \
  -e LOG_LEVEL=info \
  --privileged \
  --restart unless-stopped \
  ia-backend

sleep 5

# Start frontend
if [ "$(docker ps -a -q -f name=ia-frontend)" ]; then
    docker start ia-frontend
fi
'@

$script | ssh "$BoardUser@$BoardIP" 'bash -s'

Write-Host ""
Write-Host "✓ Backend updated with audio support!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Yellow
Write-Host "  Frontend: http://$BoardIP" -ForegroundColor Gray
Write-Host "  Backend:  http://$BoardIP`:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "Testing audio device access..." -ForegroundColor Yellow
ssh "$BoardUser@$BoardIP" 'docker exec ia-backend aplay -l'
