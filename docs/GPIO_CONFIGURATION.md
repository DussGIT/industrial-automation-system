# GPIO Configuration for Radio Interface

## Pin Assignments

Based on your AW harness connection:

| UP Board Pin | GPIO # | Signal | AW Harness Pin | Wire Color | Function |
|--------------|--------|--------|----------------|------------|----------|
| 5 | GPIO 2 | - | 4 | GREEN | - |
| 6 | GND | PWR GND | 5 | BLACK | Ground |
| 9 | GND | MIKE GND | 6 | BLACK | Ground |
| 12 | GPIO 18 | - | 7 | BLUE | - |
| 13 | GPIO 5 | PTT | 8 | BROWN | Push To Talk |
| 15 | GPIO 6 | CS3 | 9 | WHITE | Channel Select 3 |
| 16 | GPIO 19 | CS2 | 10 | GREY | Channel Select 2 |
| 18 | GPIO 20 | CS1 | 11 | ORANGE | Channel Select 1 |
| 19 | GPIO 7 | - | 12 | GREEN | - |
| 21 | GPIO 8 | - | 13 | BLUE | - |
| 22 | GPIO 21 | CS0 | 14 | BROWN | Channel Select 0 |
| 32 | GPIO 25 | CLEAR CHANNEL | 15 | WHITE | Clear Channel |
| 33 | GPIO 13 | - | 16 | GREY | - |

## Key Functions

### Push To Talk (PTT)
- **GPIO**: 5
- **Function**: Activates radio transmission
- **Usage**: Set HIGH to transmit, LOW to receive

### Channel Selection (CS0-CS3)
- **GPIOs**: 21, 20, 19, 6
- **Function**: Selects radio channel (0-15)
- **Binary encoding**: 
  - CS0 (GPIO 21) = Bit 0 (LSB)
  - CS1 (GPIO 20) = Bit 1
  - CS2 (GPIO 19) = Bit 2
  - CS3 (GPIO 6) = Bit 3 (MSB)

**Channel Examples:**
```
Channel 0:  CS3=0, CS2=0, CS1=0, CS0=0  (0000)
Channel 1:  CS3=0, CS2=0, CS1=0, CS0=1  (0001)
Channel 5:  CS3=0, CS2=1, CS1=0, CS0=1  (0101)
Channel 15: CS3=1, CS2=1, CS1=1, CS0=1  (1111)
```

### Clear Channel
- **GPIO**: 25
- **Function**: Enables clear channel mode
- **Usage**: Set HIGH to enable, LOW to disable

## Flow Nodes Available

### 1. GPIO Output (`gpio-out`)
Generic GPIO output control.
```json
{
  "type": "gpio-out",
  "pin": 5,
  "pinName": "PTT"
}
```

### 2. GPIO Input (`gpio-in`)
Read GPIO pin state.
```json
{
  "type": "gpio-in",
  "pin": 18,
  "interval": 1000
}
```

### 3. Radio PTT (`radio-ptt`)
Control Push To Talk function.
```json
{
  "type": "radio-ptt",
  "action": "pulse",
  "duration": 2000
}
```

Actions:
- `on` / `activate` - Enable PTT
- `off` / `deactivate` - Disable PTT
- `toggle` - Toggle PTT state
- `pulse` - Enable PTT for specified duration

### 4. Radio Channel (`radio-channel`)
Select radio channel.
```json
{
  "type": "radio-channel",
  "channel": 5
}
```

## Example Flows

### Simple Radio Broadcast
```
[Inject] → [Radio Channel: 5] → [Delay: 100ms] → [Radio PTT: pulse 3s] → [Audio Player]
```

### Channel Scan
```
[Timer: 5s] → [Function: increment channel] → [Radio Channel] → [Radio PTT: pulse 1s]
```

### Emergency Broadcast All Channels
```
[Button] → [Function: loop 0-15] → [Radio Channel] → [Delay: 500ms] → [Radio PTT: pulse 5s] → [Audio Player]
```

## Testing GPIO

### Command Line Testing
```bash
# Export GPIO 5 (PTT)
echo 5 | sudo tee /sys/class/gpio/export
echo out | sudo tee /sys/class/gpio/gpio5/direction

# Activate PTT
echo 1 | sudo tee /sys/class/gpio/gpio5/value

# Deactivate PTT
echo 0 | sudo tee /sys/class/gpio/gpio5/value

# Unexport
echo 5 | sudo tee /sys/class/gpio/unexport
```

### Using API
```bash
# Test PTT
curl -X POST http://192.168.1.57:3000/api/gpio/ptt -H "Content-Type: application/json" -d '{"action":"pulse", "duration":2000}'

# Set Channel
curl -X POST http://192.168.1.57:3000/api/gpio/channel -H "Content-Type: application/json" -d '{"channel":5}'

# Write GPIO
curl -X POST http://192.168.1.57:3000/api/gpio/write -H "Content-Type: application/json" -d '{"pin":25, "value":1}'

# Read GPIO
curl http://192.168.1.57:3000/api/gpio/read?pin=18
```

## Safety Notes

1. **Always release PTT** - Don't leave PTT activated continuously
2. **Test on low channels first** - Start with channel 0 or 1 for testing
3. **Use proper delays** - Allow time between channel changes
4. **Monitor audio levels** - Prevent distortion
5. **Emergency shutoff** - Have a way to quickly disable all GPIO

## Troubleshooting

### Permission Denied
```bash
# Add user to gpio group
sudo usermod -a -G gpio supervisor
sudo reboot
```

### GPIO Already Exported
```bash
# Unexport all
for i in {0..40}; do echo $i | sudo tee /sys/class/gpio/unexport 2>/dev/null; done
```

### Check GPIO Status
```bash
# List exported GPIOs
ls /sys/class/gpio/

# Check specific GPIO
cat /sys/class/gpio/gpio5/direction
cat /sys/class/gpio/gpio5/value
```
