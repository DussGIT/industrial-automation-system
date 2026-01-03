#!/bin/bash
# Quick single channel test - run on UP board
# Usage: ./quick-channel-test.sh [channel_number]

CHANNEL=${1:-0}
BASE_URL="http://localhost:3000"

echo "Setting channel $CHANNEL..."

# Send request
RESPONSE=$(curl -s -X POST "$BASE_URL/api/gpio/channel" \
    -H "Content-Type: application/json" \
    -d "{\"channel\": $CHANNEL}")

# Pretty print response
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Also check current GPIO status
echo ""
echo "Current GPIO status:"
curl -s "$BASE_URL/api/gpio/status" | python3 -m json.tool 2>/dev/null

# Show which pins should be active
CS0=$(( ($CHANNEL & 0x01) ? 1 : 0 ))
CS1=$(( ($CHANNEL & 0x02) ? 1 : 0 ))
CS2=$(( ($CHANNEL & 0x04) ? 1 : 0 ))
CS3=$(( ($CHANNEL & 0x08) ? 1 : 0 ))

echo ""
echo "Expected pin states for channel $CHANNEL:"
echo "  CS0 (pin 22): $CS0"
echo "  CS1 (pin 18): $CS1"
echo "  CS2 (pin 16): $CS2"
echo "  CS3 (pin 15): $CS3"
