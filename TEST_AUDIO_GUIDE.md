# Audio Testing Guide

## Quick Start

### 1. Test Your Headphones First

Run the simple headphone test:
```powershell
.\test-audio-simple.ps1
```

This will play a test tone (440 Hz beep) to verify your headphones are connected and working.

---

## 2. Start the System

### Start Backend:
```powershell
cd backend
npm start
```

The backend should start on `http://localhost:3000`

### Start Frontend:
```powershell
cd frontend
npm run dev
```

The frontend should start on `http://localhost:5173`

---

## 3. Test Audio Library

### Option A: Use the Test Script
```powershell
.\test-audio-windows.ps1
```

This will:
- Check backend connection
- List available audio files
- Play a test audio file (if available)
- Test text-to-speech (if available)

### Option B: Use the Web UI
1. Open browser: `http://localhost:5173`
2. Navigate to **Audio Library** in the sidebar
3. Upload test audio files (WAV, MP3, etc.)
4. Click the play button to test playback

---

## 4. Test Text-to-Speech

### In Flow Editor:
1. Open **Flow Editor** in the web UI
2. Drag an **AWR ERM100 Transmit** node or **Radio GPIO Broadcast** node to canvas
3. Configure the node:
   - Set Mode: **Text-to-Speech**
   - Enter text: "This is a test"
   - Set channel
4. Add a trigger (Timer or Inject node)
5. Deploy the flow
6. Trigger it and listen for audio

### Manual API Test:
```powershell
# Generate TTS audio
$body = @{
    text = "This is a test of text to speech"
    voice = "en_US-lessac-medium"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/tts/generate" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

---

## 5. Test Audio Playback Node

### Create a Simple Test Flow:
1. **Inject Node** → **Audio Player Node**
2. Configure Audio Player:
   - Select an audio file from library
   - Set volume (0-100)
   - Set repeat count
3. Deploy and trigger
4. Audio should play through your headphones

---

## 6. Upload Test Audio Files

### Using Web UI:
1. Go to Audio Library
2. Click "Upload Audio"
3. Select WAV, MP3, or other audio files
4. Files will be stored in `backend/data/audio/`

### Using curl (if you prefer CLI):
```powershell
# Upload an audio file
$file = "path\to\your\audio.wav"
curl.exe -X POST http://localhost:3000/api/audio/upload `
    -F "audio=@$file" `
    -F "name=Test Audio" `
    -F "description=Testing audio playback"
```

---

## 7. Common Issues

### "Cannot find audio device"
- Make sure headphones are plugged in
- Check Windows Sound settings
- Restart PowerShell terminal

### "Backend not running"
- Check if Node.js is running: `Get-Process node`
- Start backend: `cd backend; npm start`
- Check port 3000 is not in use: `netstat -ano | findstr 3000`

### "No audio files available"
- Upload files through the web UI
- Or use the `create-sample-audio.js` script:
  ```powershell
  cd backend
  node create-sample-audio.js
  ```

### "TTS endpoint not found"
- TTS API might not be implemented yet in backend
- Check `backend/src/api/` for tts.js
- Feature might be in AWR node only

---

## 8. Testing on UP Board (Later)

Once you've verified everything works on Windows, you can test on the UP Board:

```bash
# SSH to UP Board
ssh supervisor@192.168.1.57

# Check if audio device exists
aplay -l

# If no audio, audio will be simulated (for PTT timing only)
```

---

## Sample Audio Files

If you need test audio files, the backend can generate them:

```powershell
cd backend
node create-sample-audio.js
```

This creates sample tones in the audio library.

---

## What to Test

- [x] Headphones work (test-tone)
- [ ] Audio Library loads
- [ ] Can upload audio files
- [ ] Can play audio files through UI
- [ ] Audio Player node works in flows
- [ ] TTS generates audio
- [ ] TTS audio plays correctly
- [ ] Volume control works
- [ ] Repeat playback works

---

## Next Steps

After verifying audio works on Windows:
1. Test radio integration (GPIO + audio)
2. Test AWR ERM100 transmit node
3. Test Radio GPIO Broadcast node
4. Deploy to UP Board and test with real radio

---

**Note**: On the UP Board without audio hardware, the system will simulate playback duration for correct PTT timing. You won't hear audio on the board itself, but the radio transmission timing will be correct.
