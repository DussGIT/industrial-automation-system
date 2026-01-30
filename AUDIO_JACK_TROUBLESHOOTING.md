# UP Board Audio Jack Troubleshooting

## Current Status
Your UP board is only detecting HDMI audio outputs (3 HDMI ports). The analog audio jack is not being detected by the Linux kernel.

## Detection Results
```
Audio Card: HDA Intel PCH at 0x91710000 irq 229
Detected Codec: Intel Broxton HDMI (codec#2 only)
Missing: Realtek or other analog audio codec
```

## Solutions

### Option 1: Enable Audio Jack in BIOS (Recommended if available)

1. **Reboot the UP board and enter BIOS**:
   - During boot, press **DEL** or **F7** (depends on UP board model)
   
2. **Look for audio settings**:
   - Navigate to **Chipset** or **Advanced** settings
   - Look for options like:
     - "Onboard Audio"
     - "HD Audio"
     - "Realtek Audio"  
     - "Audio Controller"
   - **Enable** these if they're disabled

3. **Save and exit** BIOS (F10)

4. **After reboot, verify detection**:
   ```bash
   ssh supervisor@192.168.1.57 'aplay -l'
   ```
   You should see a device like "ALC662" or similar Realtek codec

---

### Option 2: USB Audio Adapter (Fastest Solution)

If BIOS doesn't have audio options or they don't work, use a USB audio adapter:

1. **Get a USB audio adapter**
   - Any USB sound card with 3.5mm audio jack
   - Example: Sabrent USB External Stereo Sound Adapter (~$7)

2. **Plug it into the UP board**

3. **Verify detection**:
   ```bash
   ssh supervisor@192.168.1.57 'aplay -l'
   ```
   Should show: `card 1: Device [USB Audio Device]`

4. **Update audio configuration** to use USB device

---

### Option 3: Configure for HDMI Audio (Current Workaround)

If you have speakers connected via HDMI monitor:

**Current device**: `hw:CARD=PCH,DEV=3` (HDMI 0)

**Test HDMI audio now**:
```powershell
ssh supervisor@192.168.1.57 'docker exec ia-backend speaker-test -c 2 -t wav -D hw:0,3'
```

---

## After Getting Audio Jack Working

Once the audio jack is detected (via BIOS or USB adapter), we need to:

1. **Find the new device**:
   ```bash
   aplay -L | grep -A 2 "analog\|front"
   ```

2. **Update audio-player node** to use correct device:
   - Edit: `backend/src/flow-engine/nodes/output/audio-player.js`
   - Change `aplay` command to specify device:
     ```javascript
     command = `aplay -D plughw:0,0 "${absolutePath}"`;
     ```

3. **Restart backend**:
   ```bash
   docker restart ia-backend
   ```

---

## Quick Test Commands

**Test current HDMI audio**:
```bash
# Generate test tone and play through HDMI
ssh supervisor@192.168.1.57 'docker exec ia-backend speaker-test -c 2 -t sine -D hw:0,3 -l 1'
```

**Check all audio devices**:
```bash
ssh supervisor@192.168.1.57 'aplay -L'
```

**Check detected hardware**:
```bash
ssh supervisor@192.168.1.57 'cat /proc/asound/cards'
```

---

## Which UP Board Model Do You Have?

Different UP board models have different audio configurations:
- **UP Board** (original) - Has Realtek ALC662 codec with audio jack
- **UP Squared** - Has Realtek ALC662 codec with audio jack  
- **UP Core** - May have limited or no onboard audio

Can you check:
```bash
ssh supervisor@192.168.1.57 'sudo dmidecode -s system-product-name'
```

This will help determine if your model should have an onboard audio jack.

---

## Next Steps

**Immediate**: Try Option 1 (BIOS) or Option 2 (USB adapter)

**Critical for Radio**: The audio jack needs to work for radio broadcasts. HDMI audio won't help if you need to connect to radio equipment.

Let me know which option you want to pursue!
