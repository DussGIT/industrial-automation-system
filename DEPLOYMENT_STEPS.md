# Manual Deployment and Testing Guide

## SSH Connection Issue
The SSH connection is being reset. To fix this:

1. **Restart SSH service on UP board** (if you have console access):
   ```bash
   sudo systemctl restart ssh
   ```

2. **Or check if UP board is accessible**:
   ```powershell
   Test-Connection 192.168.1.57
   ```

3. **Test SSH connection**:
   ```powershell
   ssh upboard 'whoami'
   # Should connect as user 'superviser'
   ```

## Once SSH is Working

### Step 1: Copy Updated Files
```powershell
cd "c:\Industrial Automation"

# Copy updated backend files
scp backend\src\core\gpio-manager.js upboard:/tmp/gpio-manager.js
scp backend\src\api\gpio.js upboard:/tmp/gpio.js

# Copy test scripts
scp test-channel-on-board.sh upboard:/tmp/test-channel.sh
scp quick-channel-test.sh upboard:/tmp/quick-test.sh
```

### Step 2: Deploy Files on UP Board
```powershell
ssh upboard
```

Then on the UP board:
```bash
# Find where the backend is installed
find /opt /home -name "gpio-manager.js" 2>/dev/null

# Assuming it's in /opt/automation or similar, copy files:
sudo cp /tmp/gpio-manager.js /opt/automation/backend/src/core/
sudo cp /tmp/gpio.js /opt/automation/backend/src/api/

# Make test scripts executable
chmod +x /tmp/test-channel.sh /tmp/quick-test.sh
```

### Step 3: Restart Backend
```bash
# If using systemd:
sudo systemctl restart automation-backend

# If using Docker:
cd /opt/automation
sudo docker-compose restart backend

# If using Docker without compose:
sudo docker restart automation-backend
```

### Step 4: Run Tests
```bash
# Full test (channels 0, 1, 2, 4, 8, 15)
/tmp/test-channel.sh

# Quick test of single channel
/tmp/quick-test.sh 5

# Watch logs while testing (in another terminal)
sudo docker logs -f automation-backend
```

## Expected Output in Logs

You should see detailed logs like:
```
Setting radio channel to 5
Channel 5 binary: CS3=0 CS2=1 CS1=0 CS0=1
Physical pins: CS0=22, CS1=18, CS2=16, CS3=15
Setting CS0 (pin 22) to 1
GPIO WRITE CALLED: pin=22, value=1
CS0 result: true
Setting CS1 (pin 18) to 0
GPIO WRITE CALLED: pin=18, value=0
CS1 result: true
...
```

## Troubleshooting

### If SSH still doesn't work:
1. Check if UP board is on: `Test-Connection 192.168.1.57`
2. Try direct connection: `ssh superviser@192.168.1.57`
3. Check SSH key: `Get-Content "$env:USERPROFILE\.ssh\id_rsa.pub"`

### If backend doesn't start:
```bash
# Check status
sudo systemctl status automation-backend
sudo docker ps -a

# Check logs
sudo journalctl -u automation-backend -n 50
sudo docker logs automation-backend --tail 50
```

### If channel setting still fails:
1. Check individual pin writes work
2. Look for errors in detailed logs
3. Verify pin mapping is correct
4. Check if timing/delay is needed between writes

## Files Ready for Deployment

All updated files are in your local directory:
- `backend\src\core\gpio-manager.js` - Enhanced with detailed logging
- `backend\src\api\gpio.js` - Improved channel endpoint
- `test-channel-on-board.sh` - Full test script
- `quick-channel-test.sh` - Quick single channel test
