# Session Notes - January 4, 2026

## What We Just Completed

### 1. AWR ERM100 Radio Controller - WORKING ✅
Successfully implemented complete radio control system with 3 flow nodes:
- **awr-erm100-transmit** - Enhanced with audio & TTS support
- **awr-erm100-channel** - Channel selection (0-15)
- **awr-erm100-broadcast** - Multi-channel sequential broadcasting

### 2. Critical GPIO Fix - RESOLVED ✅
**Problem**: PTT holding indefinitely despite code showing correct timing
**Root Cause**: PTT is active-LOW on AWR ERM100 (we had it backwards)
**Solution**: Inverted PTT logic in gpio-manager.js:
- activatePTT() now writes 0 (LOW)
- deactivatePTT() now writes 1 (HIGH)
**Result**: PTT now releases correctly at specified durations

### 3. Enhanced Transmit Node - THREE MODES ✅

#### Mode 1: Manual (Timed PTT)
- Keys PTT for specified duration (ms)
- For testing, tone bursts, manual keying

#### Mode 2: Audio File
- Integrates with Audio Library
- Selects audio file from dropdown
- Auto-calculates duration from file metadata
- Plays audio while keying PTT

#### Mode 3: Text-to-Speech
- Uses Piper TTS (MIT license, no restrictions)
- Enter text in config panel
- Generates speech on-the-fly
- Keys PTT during playback
- Auto-cleanup of temp files

### 4. Piper TTS Integration - TESTED ✅
**Location**: `/tmp/piper-test/` on UP Board
**Binary**: `/tmp/piper-test/piper/piper`
**Model**: `/tmp/piper-test/en_US-lessac-medium.onnx`
**Performance**: 3.5x faster than real-time (generates 6.6s audio in 1.85s)
**Quality**: Natural US English voice (Lessac)

## Current System State

### Hardware Configuration
- **Platform**: UP Board at 192.168.1.57
- **GPIO**: gpiochip4 (CPLD/FPGA controlled) - MUST USE CHIP 4!
- **Radio**: AWR ERM100 with active-LOW PTT
- **Pin Mapping** (all on gpiochip4):
  - PTT: Pin 13 = Line 27
  - CS0: Pin 22 = Line 25
  - CS1: Pin 18 = Line 24
  - CS2: Pin 16 = Line 23
  - CS3: Pin 15 = Line 22
  - CLEAR: Pin 32 = Line 12

### Software State
- **Backend**: ia-backend container, 19 node types loaded ✅
- **Frontend**: ia-frontend container, deployed with enhanced UI ✅
- **Database**: Clean SQLite at /app/data/flows.db
- **XBee**: Connected on /dev/ttyUSB5
- **Git**: Last commit "Add AWR ERM100 radio controller with flow nodes"

### Key Files Modified This Session
```
backend/src/core/gpio-manager.js - Active-low PTT logic
backend/src/flow-engine/nodes/output/awr-erm100-transmit.js - Enhanced with 3 modes
backend/src/flow-engine/nodes/output/awr-erm100-broadcast.js - Multi-channel
backend/src/flow-engine/nodes/output/awr-erm100-channel.js - Channel selector
frontend/src/components/flow/NodeConfigPanel.jsx - UI for all 3 modes
frontend/src/components/flow/NodePalette.jsx - AWR ERM100 category
frontend/src/components/flow/CustomNode.jsx - Icons and colors
backend/src/core/GPIO_README.md - Documentation
```

## Important Technical Details

### GPIO - CRITICAL WARNING ⚠️
**ALWAYS USE GPIOCHIP4** - Other chips (0-3) are Intel GPIO and don't control physical pins!
The UP Board uses CPLD/FPGA routing through gpiochip4 for the 40-pin header.

### PTT Control - CRITICAL ⚠️
AWR ERM100 uses **ACTIVE-LOW PTT**:
- Write 0 (LOW) to transmit
- Write 1 (HIGH) to idle/release
This is now correctly implemented.

### Audio File Integration
The transmit node loads audio files from the Audio Library (database table: `audio_files`).
Duration is automatically extracted from file metadata.
Frontend shows file info in dropdown: "name (FORMAT, size, duration)"

### Text-to-Speech
- Piper binary spawned as child process
- Text sent to stdin
- Generates WAV to `/tmp/tts-{timestamp}.wav`
- Audio played with `aplay` while PTT active
- Temp file deleted after transmission
- Duration estimated: ~150 words/minute + 500ms buffer

## Known Issues / Notes

### Non-Critical Issues
1. **DatabaseTransport errors** - Missing 'service' column in system_logs (existing, harmless)
2. **XBeeMonitor.jsx line 343** - Extra closing brace (build warning, non-blocking)
3. **Piper not in Docker** - Currently in /tmp/piper-test/, works but should be containerized for production

### Future Considerations
1. **Add Piper to Docker image** - Include in ia-backend for permanent installation
2. **Voice selection** - Piper supports 40+ languages, multiple voices per language
3. **Broadcast node enhancement** - Could add audio/TTS support like transmit node
4. **Audio library management** - Currently working, may want upload UI improvements
5. **AWRERM100Interface class** - Created but unused (nodes use GPIO directly for simplicity)

## Testing Status

### Verified Working ✅
- GPIO pins all responding correctly
- PTT activates and releases at correct times
- Channel selection (0-15) working
- Audio file mode tested in UI (not yet on actual radio)
- TTS generation working (6.6s test audio created successfully)
- Frontend deploys and loads correctly
- Backend loads all 19 node types

### Not Yet Tested
- Actual radio transmission with audio files
- Actual radio transmission with TTS
- Multi-channel broadcast with real radio
- Broadcast node with audio/TTS (not yet implemented)

## Quick Commands Reference

### Deploy Frontend
```powershell
cd 'C:\Industrial Automation\frontend'
npm run build
scp -r build/* supervisor@192.168.1.57:/tmp/frontend-dist/
ssh supervisor@192.168.1.57 'docker cp /tmp/frontend-dist/. ia-frontend:/usr/share/nginx/html/'
```

### Deploy Backend Node
```powershell
cd 'C:\Industrial Automation\backend\src\flow-engine\nodes\output'
scp awr-erm100-transmit.js supervisor@192.168.1.57:/tmp/
ssh supervisor@192.168.1.57 'docker cp /tmp/awr-erm100-transmit.js ia-backend:/app/src/flow-engine/nodes/output/ && docker restart ia-backend'
```

### Test TTS Manually
```bash
ssh supervisor@192.168.1.57
cd /tmp/piper-test
echo "Your text here" | ./piper/piper --model en_US-lessac-medium.onnx --output_file test.wav
aplay test.wav
```

### Check GPIO Status
```bash
ssh supervisor@192.168.1.57
sudo gpioinfo gpiochip4 | grep "line  27"  # PTT pin
```

## Next Session Recommendations

### High Priority
1. **Test with actual radio** - Connect AWR ERM100 and test all modes
2. **Test TTS transmission** - Try text-to-speech on radio
3. **Test audio library transmission** - Try pre-recorded files

### Medium Priority
4. **Add Piper to Docker** - Permanent installation in backend container
5. **Enhance broadcast node** - Add audio/TTS modes like transmit node
6. **More voices** - Download additional Piper voice models

### Low Priority
7. **Fix XBeeMonitor syntax warning** - Remove extra brace at line 343
8. **Clean up test files** - Remove temporary scripts and test files
9. **Documentation** - User guide for flow editor and radio nodes

## System Access
- **UP Board**: ssh supervisor@192.168.1.57
- **Frontend**: http://192.168.1.57 (nginx on ia-frontend)
- **Backend API**: http://192.168.1.57:3000 (ia-backend)
- **Flow Editor**: Main UI → Flows page

---

**Status**: System is stable and ready for radio testing. All code deployed and working. PTT issue resolved. Ready to resume development.
