#!/bin/bash

# Camera Integration Deployment Script
# Deploys flexible camera integration system to UP Board

echo "=========================================="
echo "Camera Integration Deployment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on UP Board
if [ ! -f "/etc/upboard" ] && [ ! -d "/sys/class/gpio" ]; then
    echo -e "${YELLOW}Warning: Not detected as UP Board. Continuing anyway...${NC}"
fi

# Pull latest changes
echo -e "${BLUE}1. Pulling latest code...${NC}"
cd ~/industrial-automation
git pull origin main

if [ $? -ne 0 ]; then
    echo "Error: Failed to pull latest code"
    exit 1
fi

# Show what's new
echo ""
echo -e "${GREEN}✓ Latest changes pulled${NC}"
git log -1 --oneline
echo ""

# Stop services
echo -e "${BLUE}2. Stopping services...${NC}"
docker-compose down

# Rebuild backend (has new database schema)
echo ""
echo -e "${BLUE}3. Rebuilding backend container...${NC}"
docker-compose build backend

# Start services
echo ""
echo -e "${BLUE}4. Starting services...${NC}"
docker-compose up -d

# Wait for backend to be ready
echo ""
echo -e "${BLUE}5. Waiting for backend to initialize...${NC}"
sleep 10

# Check if backend is running
if ! docker ps | grep -q ia-backend; then
    echo -e "${YELLOW}Warning: Backend container may not be running${NC}"
    docker-compose logs --tail=20 backend
    exit 1
fi

# Seed device definitions
echo ""
echo -e "${BLUE}6. Seeding device definitions...${NC}"
docker exec ia-backend node seed-device-definitions.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Device definitions seeded${NC}"
else
    echo -e "${YELLOW}Warning: Failed to seed definitions (may already exist)${NC}"
fi

# Show running containers
echo ""
echo -e "${BLUE}7. Checking service status...${NC}"
docker-compose ps

# Get IP address
IP_ADDR=$(hostname -I | awk '{print $1}')

# Success message
echo ""
echo "=========================================="
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE${NC}"
echo "=========================================="
echo ""
echo "Camera Integration System Ready!"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  Main UI:      http://${IP_ADDR}"
echo "  Cameras:      http://${IP_ADDR}/cameras"
echo "  Unknown Events: http://${IP_ADDR}/unknown-events"
echo "  API:          http://${IP_ADDR}:3000/api"
echo ""
echo -e "${BLUE}Camera Webhook Endpoint:${NC}"
echo "  http://${IP_ADDR}:3000/api/events/camera/{deviceId}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Navigate to http://${IP_ADDR}/cameras"
echo "  2. Click 'Add Camera' and select AXIS M1075-L"
echo "  3. Configure your camera to send events to the endpoint above"
echo "  4. Monitor unknown events at http://${IP_ADDR}/unknown-events"
echo ""
echo "Documentation: See CAMERA_INTEGRATION.md"
echo ""
