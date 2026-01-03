#!/bin/bash
# Test channel setting on UP board
# Run this directly on the UP board at 192.168.1.57

echo "=== Channel Setting Test on UP Board ==="
echo ""

BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "Checking if backend is running..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}✗ Backend not running at $BASE_URL${NC}"
    echo "Start it with: cd /opt/automation/backend && npm start"
    exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

# Test channels
CHANNELS=(0 1 2 4 8 15)

for CHANNEL in "${CHANNELS[@]}"; do
    echo -e "${YELLOW}Testing Channel $CHANNEL...${NC}"
    
    # Calculate expected binary
    CS0=$(( ($CHANNEL & 0x01) ? 1 : 0 ))
    CS1=$(( ($CHANNEL & 0x02) ? 1 : 0 ))
    CS2=$(( ($CHANNEL & 0x04) ? 1 : 0 ))
    CS3=$(( ($CHANNEL & 0x08) ? 1 : 0 ))
    
    echo "  Expected: CS3=$CS3 CS2=$CS2 CS1=$CS1 CS0=$CS0"
    
    # Send API request
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/gpio/channel" \
        -H "Content-Type: application/json" \
        -d "{\"channel\": $CHANNEL}")
    
    # Check if successful
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✓ Channel set successfully${NC}"
        
        # Extract actual states from response
        ACTUAL=$(echo "$RESPONSE" | grep -o '"actualStates":{[^}]*}')
        echo "  Response: $ACTUAL"
    else
        echo -e "  ${RED}✗ Failed to set channel${NC}"
        echo "  Response: $RESPONSE"
    fi
    
    echo ""
    sleep 1
done

echo "=== Test Complete ==="
echo ""
echo "Check backend logs for detailed information:"
echo "  docker logs automation-backend"
echo "  or: journalctl -u automation-backend -f"
