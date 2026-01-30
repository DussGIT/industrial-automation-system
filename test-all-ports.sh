#!/bin/bash

for i in 0 1 2 3 4 5; do
  echo ""
  echo "========== Testing /dev/ttyUSB$i =========="
  sudo chmod 666 /dev/ttyUSB$i 2>/dev/null
  timeout 6 docker run --rm --device=/dev/ttyUSB$i:/dev/ttyUSB5 \
    -v ~/read-xbee-config.js:/app/read.js \
    -w /app ia-backend:latest node read.js 2>&1 | grep -E "API Mode|opened|error"
done
