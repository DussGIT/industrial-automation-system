#!/bin/bash
cd ~/industrial-automation/data
cp flows.db flows.db.backup
echo "UPDATE settings SET value='/dev/ttyUSB0' WHERE key='xbee.port';" | docker run --rm -i -v ~/industrial-automation/data:/data -w /data alpine sh -c "apk add --no-cache sqlite > /dev/null 2>&1 && sqlite3 /data/flows.db"
echo "Verifying change:"
echo "SELECT key, value FROM settings WHERE key='xbee.port';" | docker run --rm -i -v ~/industrial-automation/data:/data -w /data alpine sh -c "apk add --no-cache sqlite > /dev/null 2>&1 && sqlite3 /data/flows.db"
