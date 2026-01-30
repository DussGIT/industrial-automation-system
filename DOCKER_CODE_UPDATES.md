# Docker Code Update Guide

## Important: Node.js Module Caching

**CRITICAL**: When you update backend JavaScript files, simply copying the file to the server and running `docker restart ia-backend` will NOT reload your changes!

Node.js caches all required modules in memory. A container restart doesn't reload these modules - it just restarts the same process with the cached code.

## Correct Deployment Process

### Backend Code Changes
```powershell
# 1. Copy your updated file(s)
scp 'c:\Industrial Automation\backend\src\...\file.js' supervisor@192.168.1.57:~/industrial-automation/backend/src/.../

# 2. Rebuild the container (use --no-cache to ensure fresh build)
ssh supervisor@192.168.1.57 "cd ~/industrial-automation && docker-compose build --no-cache backend"

# 3. Recreate and start the container
ssh supervisor@192.168.1.57 "cd ~/industrial-automation && docker-compose up -d backend"
```

### Frontend Code Changes
Similar process:
```powershell
# 1. Copy files
scp 'c:\Industrial Automation\frontend\src\...\file.jsx' supervisor@192.168.1.57:~/industrial-automation/frontend/src/.../

# 2. Rebuild frontend
ssh supervisor@192.168.1.57 "cd ~/industrial-automation && docker-compose build --no-cache frontend"

# 3. Recreate container
ssh supervisor@192.168.1.57 "cd ~/industrial-automation && docker-compose up -d frontend"

# 4. Clear browser cache (Ctrl+Shift+Delete) to see changes
```

## Why --no-cache?

Docker uses layer caching. Without `--no-cache`, if package.json hasn't changed, Docker may reuse old layers even though your source files changed.

## Quick Verification

After rebuild, check that your code changes are active:
```powershell
# View recent logs
ssh supervisor@192.168.1.57 "docker logs ia-backend --tail=50"

# For frontend, check browser console for your debug logs
```

## Lessons Learned (2026-01-19)

During TTS implementation debugging:
- ✗ Updated radio-gpio-broadcast.js with constructor logging
- ✗ SCP'd file to server 
- ✗ Ran `docker restart ia-backend`
- ✗ Logs showed NO new console.log statements
- ✗ Old code still running due to Node.js module cache!
- ✓ Rebuilt with `docker-compose build --no-cache backend`
- ✓ New logs appeared immediately, issue identified
