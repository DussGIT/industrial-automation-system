# Work Session Notes - January 2, 2026

## Current System State

**UP Board:** 192.168.1.57 (hostname: florlink, user: supervisor)
- Backend container: ia-backend (running, restarted successfully)
- Frontend container: ia-frontend (running)
- Audio files location: `/data/audio/` in container (mounted from host)

## Completed Today

### 1. GPIO Channel Setting Fix
- **Issue:** Radio-channel node always set channel to 0
- **Root cause:** Config structure was `config.config.channel`, not `config.channel`
- **Fix:** Updated constructor to access nested config properly
- **Status:** ✅ Verified working - all channels 0-15 tested successfully

### 2. Radio GPIO Broadcast Node
- **Created:** New `radio-gpio-broadcast` node that combines:
  - Channel selection (0-15 via CS pins)
  - Clear channel check (optional, currently disabled by default)
  - PTT activation/deactivation
  - Audio file playback
- **Status:** ✅ Deployed and functional

### 3. Audio File Path Issues
- **Issue:** Database stored Windows paths (C:\...) but container needs Linux paths (/data/audio/)
- **Fix:** Created `getActualFilePath()` helper function in audio.js
  - Converts old Windows paths to `/data/audio/filename`
  - Backward compatible with existing database entries
- **Status:** ✅ Audio files now found correctly

### 4. PTT Control
- **Issue:** Pin 13 (PTT) staying HIGH after broadcast
- **Fix:** Added try-finally block to ensure PTT always deactivates
- **Enhancement:** Added simulated audio duration when aplay fails (no audio hardware)
- **Status:** ✅ PTT reliably activates and deactivates

## Pin Configuration (Verified Working)

| Function | Physical Pin | Chip/Line | Binary Position |
|----------|-------------|-----------|-----------------|
| CS0      | 22          | chip0/17  | Bit 0 (LSB)    |
| CS1      | 18          | chip0/13  | Bit 1          |
| CS2      | 16          | chip0/11  | Bit 2          |
| CS3      | 15          | chip0/6   | Bit 3 (MSB)    |
| PTT      | 13          | chip0/4   | -              |

**Channel Examples Verified:**
- Channel 0 (0000): All pins LOW
- Channel 5 (0101): CS0=HIGH, CS2=HIGH
- Channel 6 (0110): CS1=HIGH, CS2=HIGH
- Channel 8 (1000): CS3=HIGH only

## Known Issues

1. **Database corruption** - SQLite database shows "disk image is malformed" errors
   - Doesn't affect GPIO functionality
   - Only impacts flow execution logging
   - Consider rebuilding database at some point

2. **No audio hardware** - UP board has no speakers/audio device
   - Currently using simulated duration based on file size
   - PTT timing works correctly even without audio playback

3. **Clear channel check** - Pin 23 not configured
   - Feature disabled by default
   - Would need hardware connection to radio's squelch output

## Files Modified (Committed)

**Backend:**
- `backend/src/flow-engine/nodes/output/radio-channel.js` - Fixed config access
- `backend/src/flow-engine/nodes/output/radio-gpio-broadcast.js` - New node
- `backend/src/api/audio.js` - Added path helper, fixed file reading
- `backend/src/core/gpio-manager.js` - Enhanced logging (from previous session)

**Frontend:**
- `frontend/src/components/flow/NodePalette.jsx` - Added new node to palette
- `frontend/src/components/flow/NodeConfigPanel.jsx` - Added config UI for new node
- `frontend/src/components/flow/CustomNode.jsx` - Added icon/color for new node

## Next Steps / To Do

- [ ] Test with actual radio hardware connected
- [ ] Test audio playback if audio device added to UP board
- [ ] Consider fixing database corruption issue
- [ ] Test clear channel feature if squelch output connected
- [ ] Remove debug logging once fully tested
- [ ] Update documentation with new node usage

## Deployment Command Reference

**Deploy backend file:**
```powershell
scp backend\src\...\file.js supervisor@192.168.1.57:/tmp/
ssh supervisor@192.168.1.57 'docker cp /tmp/file.js ia-backend:/app/src/.../file.js && docker restart ia-backend'
```

**Deploy frontend:**
```powershell
cd frontend
npm run build
cd ..
scp -r frontend\build\* supervisor@192.168.1.57:/tmp/frontend-dist/
ssh supervisor@192.168.1.57 'docker cp /tmp/frontend-dist/. ia-frontend:/usr/share/nginx/html/ && docker restart ia-frontend'
```

## Testing Notes

- GPIO monitor page shows real-time pin states
- Channel setting node works independently (tested via flow)
- Broadcast node successfully sets channel, activates PTT, attempts audio playback
- All timing appears correct even without audio hardware
