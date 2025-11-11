# Zigbee Button Integration Guide

## Overview
The Industrial Automation System supports Zigbee wireless buttons for triggering automation flows. This guide covers setup, configuration, and usage.

## Supported Devices

### IKEA TRADFRI
- **Buttons:** Toggle, Brightness Up, Brightness Down, Left, Right
- **Features:** 5 button actions
- **Pairing:** Hold button near coordinator for 10 seconds

### Philips Hue Tap
- **Buttons:** Button 1, Button 2, Button 3, Button 4
- **Features:** 4 physical buttons, battery-free
- **Pairing:** Press all 4 buttons simultaneously

### Xiaomi/Aqara Button
- **Actions:** Single, Double, Triple, Hold, Release
- **Features:** Multi-click detection, long press
- **Pairing:** Hold button for 5 seconds until LED blinks

### Tuya Smart Button
- **Actions:** Single, Double, Hold
- **Features:** 3 action types
- **Pairing:** Hold button for 3 seconds

### SONOFF SNZB-01
- **Actions:** Single, Double, Long
- **Features:** Wireless mini button
- **Pairing:** Hold button for 5 seconds

## Hardware Requirements

### Zigbee Coordinator
One of the following USB coordinators:
- **ConBee II** (Recommended) - `/dev/ttyACM0`
- **CC2531** with Z-Stack firmware - `/dev/ttyUSB0`
- **CC2652** - `/dev/ttyUSB0` or `/dev/ttyACM0`
- **SONOFF Zigbee Bridge** - Network-based

### System Requirements
- USB port available on UP Board
- Ubuntu 22.04+ with kernel support for USB serial
- User must be in `dialout` group: `sudo usermod -a -G dialout $USER`

## Setup Instructions

### 1. Connect Zigbee Coordinator

```bash
# Check if coordinator is detected
ls -l /dev/ttyACM* /dev/ttyUSB*

# Should see something like:
# /dev/ttyACM0 -> USB-based coordinator
# /dev/ttyUSB0 -> Serial-based coordinator

# Verify permissions
sudo chmod 666 /dev/ttyACM0
```

### 2. Configure Zigbee Interface

In the web UI, navigate to **Interfaces** → **Add Interface**

```json
{
  "id": "zigbee-main",
  "type": "wireless-zigbee",
  "name": "Main Zigbee Network",
  "config": {
    "port": "/dev/ttyACM0",
    "baudRate": 115200,
    "autoDiscover": true,
    "clearChannelThreshold": -90
  }
}
```

### 3. Pair Button Device

**Via API:**
```bash
curl -X POST http://localhost:3000/api/interfaces/zigbee-main/pair \
  -H "Content-Type: application/json" \
  -d '{"duration": 60}'
```

**Via Flow:**
Create a flow with an Inject node → Zigbee Button node configured to trigger pairing.

**Manual Pairing Steps:**
1. Put coordinator in pairing mode (60-second window)
2. Press button pairing sequence (varies by device)
3. Wait for device to appear in device list
4. Note the IEEE address (e.g., `0x00158d0001a2b3c4`)

### 4. Configure Button in Flow

Add a **Zigbee Button** node to your flow:

```javascript
{
  "type": "zigbee-button",
  "name": "Office Light Button",
  "interfaceId": "zigbee-main",
  "deviceAddr": "0x00158d0001a2b3c4", // Specific button
  "buttonAction": "single" // Or: double, triple, hold, release, any
}
```

## Usage Examples

### Example 1: Toggle Light on Button Press

```
[Zigbee Button] → [Function] → [MQTT Out]
   (single)        (toggle)     (light/toggle)
```

**Function Node:**
```javascript
msg.payload = {
  state: msg.payload.action === 'single' ? 'toggle' : 'off'
};
msg.topic = 'home/office/light/set';
return msg;
```

### Example 2: Multi-Button Scene Control

```
[Zigbee Button] → [Switch] → [Multiple Outputs]
   (any action)     (route)    (Scene 1, 2, 3, 4)
```

**Switch Node Configuration:**
- Property: `msg.payload.action`
- Route to output based on: `button_1`, `button_2`, `button_3`, `button_4`

### Example 3: Dimming with Hold

```
[Zigbee Button] → [Function] → [MQTT Out]
   (hold/release)   (dimmer)    (light/brightness)
```

**Function Node:**
```javascript
if (msg.payload.action === 'brightness_up') {
  msg.payload = { brightness: '+10' };
} else if (msg.payload.action === 'brightness_down') {
  msg.payload = { brightness: '-10' };
}
return msg;
```

### Example 4: Emergency Alert Button

```
[Zigbee Button] → [Function] → [Radio Alert]
   (triple click)   (format)     (broadcast)
```

**Function Node:**
```javascript
// Triple click triggers emergency
if (msg.payload.action === 'triple') {
  msg.payload = {
    type: 'emergency',
    location: 'Warehouse Floor 2',
    device: msg.payload.device,
    timestamp: msg.timestamp
  };
  return msg;
}
return null; // Ignore other actions
```

## Button Event Format

When a button is pressed, the Zigbee Button node outputs:

```javascript
{
  "payload": {
    "action": "single",           // Button action type
    "device": "0x00158d0001a2b3c4", // IEEE address
    "deviceType": "XIAOMI_BUTTON", // Detected device type
    "endpoint": 1,                 // Zigbee endpoint
    "cluster": "genOnOff",         // Cluster that triggered
    "command": "toggle",           // Raw Zigbee command
    "data": {}                     // Additional payload data
  },
  "topic": "zigbee/button/0x00158d0001a2b3c4/single",
  "timestamp": 1699659600000
}
```

## Button Actions

### Common Actions
- `single` - Single press/click
- `double` - Double press within 500ms
- `triple` - Triple press within 500ms
- `hold` - Button held down
- `release` - Button released after hold
- `any` - Match any action (use for filtering)

### Device-Specific Actions
- **IKEA TRADFRI:** `toggle`, `brightness_up`, `brightness_down`, `left`, `right`
- **Philips Hue:** `button_1`, `button_2`, `button_3`, `button_4`
- **Scene buttons:** `scene_0`, `scene_1`, etc.

## Advanced Configuration

### Auto-Configuration on Pairing

```javascript
// Listen for new device joins
flow.on('zigbee:deviceJoined', async (device) => {
  if (isButton(device)) {
    // Automatically configure button
    await zigbee.configureButton(device.ieeeAddr, {
      endpoint: 1,
      minInterval: 1,    // Report immediately
      maxInterval: 300,  // At least every 5 minutes
    });
  }
});
```

### Multi-Click Detection Settings

Default multi-click window is 500ms. Adjust in interface config:

```json
{
  "config": {
    "multiClickWindow": 500,  // Milliseconds
    "longPressThreshold": 1000 // Hold duration for "long" press
  }
}
```

### Battery Monitoring

```javascript
// Check button battery level
const device = await zigbee.read({
  command: 'device',
  ieeeAddr: '0x00158d0001a2b3c4'
});

console.log(`Battery: ${device.battery}%`);

// Alert on low battery
if (device.battery < 20) {
  sendAlert('Button battery low!');
}
```

## Troubleshooting

### Button Not Pairing
1. Verify coordinator is in pairing mode (LED blinking)
2. Check button has battery (if battery powered)
3. Reset button: Hold for 10+ seconds until multiple blinks
4. Move button closer to coordinator
5. Check coordinator USB connection: `lsusb`

### Button Events Not Received
1. Check if device is still paired: 
   ```bash
   curl http://localhost:3000/api/interfaces/zigbee-main/devices
   ```
2. Verify button is configured:
   ```bash
   curl http://localhost:3000/api/interfaces/zigbee-main/device/0x00158d0001a2b3c4
   ```
3. Re-bind button:
   ```javascript
   await zigbee.write({
     type: 'configureButton',
     ieeeAddr: '0x00158d0001a2b3c4'
   });
   ```

### Delayed Response
- **Cause:** Button in sleep mode
- **Solution:** Some buttons (like Xiaomi) sleep deeply. First press wakes device, second press triggers action
- **Workaround:** Configure shorter sleep intervals if supported

### Multiple Events on Single Press
- **Cause:** Button sends multiple Zigbee commands per press
- **Solution:** Use debouncing in Function node:
  ```javascript
  const now = Date.now();
  const lastPress = context.get('lastPress') || 0;
  
  if (now - lastPress < 200) {
    return null; // Ignore duplicate
  }
  
  context.set('lastPress', now);
  return msg;
  ```

## Security Considerations

### Network Security
- Zigbee networks use AES-128 encryption
- Change default network key after setup
- Enable install codes for critical buttons

### Physical Security
- Button presses cannot be authenticated to specific users
- Consider location-based authorization
- Log all button events for audit trail

### Best Practices
1. Use unique network keys per installation
2. Disable pairing mode when not needed
3. Monitor for unknown devices joining
4. Implement rate limiting on critical actions
5. Require multi-factor confirmation for destructive operations

## API Reference

### Start Pairing
```bash
POST /api/interfaces/{interfaceId}/pair
{
  "duration": 60  # Seconds
}
```

### Stop Pairing
```bash
POST /api/interfaces/{interfaceId}/unpair
```

### List Devices
```bash
GET /api/interfaces/{interfaceId}/devices
```

### Remove Device
```bash
DELETE /api/interfaces/{interfaceId}/device/{ieeeAddr}
```

### Configure Button
```bash
POST /api/interfaces/{interfaceId}/configure
{
  "ieeeAddr": "0x00158d0001a2b3c4",
  "options": {
    "endpoint": 1,
    "minInterval": 1,
    "maxInterval": 300
  }
}
```

## Performance

- **Latency:** Typical button-to-action latency: 50-200ms
- **Range:** 10-30 meters indoor (depends on obstacles)
- **Battery Life:** 1-2 years typical (varies by device and usage)
- **Network Capacity:** Up to 50+ devices per coordinator
- **Event Rate:** 10+ events/second supported

## Future Enhancements

- [ ] Button battery alerts
- [ ] OTA firmware updates for buttons
- [ ] Custom multi-click patterns
- [ ] Button groups (multiple buttons → single action)
- [ ] Button state persistence across restarts
- [ ] Visual button configuration UI
- [ ] Gesture recognition (shake, rotate for compatible devices)

---

**Related Documentation:**
- [Zigbee Interface Configuration](./INTERFACES.md#zigbee)
- [Flow Engine Overview](./OVERVIEW.md#flow-engine)
- [API Reference](./API.md)
