# GPIO Implementation Status - January 3, 2026

## CURRENT STATUS: ✅ **WORKING - Using gpiochip4**

### Solution
MUST use **gpiochip4** ("Raspberry Pi compatible UP GPIO") which routes through the UP Board CPLD/FPGA.
DO NOT use gpiochip0 - it's the raw Intel GPIO controller that doesn't control the physical 40-pin header.

## ⚠️ CRITICAL CONFIGURATION

**UP Board GPIO Requirements:**
- **MUST USE:** gpiochip4 ("Raspberry Pi compatible UP GPIO")
- **DO NOT USE:** gpiochip0, gpiochip1, gpiochip2, gpiochip3 (Intel controllers - don't control physical pins)
- **Pin Mapping:** Use BCM GPIO numbers on gpiochip4
- **Example:** Physical Pin 13 (PTT) = gpiochip4 line 27 (BCM GPIO 27)

## What We've Accomplished

### ✅ Infrastructure Setup
1. **SSH Key Authentication** - Passwordless SSH working
2. **Passwordless Sudo** - No more password prompts for sudo commands
3. **GPIO Software Tools** - libgpiod v2.2.1 installed and working
4. **GPIO Detection** - All GPIO chips detected and accessible

### ✅ Software Verification
- `gpioset` and `gpioget` commands work
- Can read/write GPIO line states in software
- GPIO chips responding: gpiochip0 (78 lines), gpiochip1 (77 lines), gpiochip2-4
- FPGA firmware loaded: v0.3.2 build 0x3

### ✅ Hardware Working
**Physical pins now respond correctly to software commands**
- Root cause was using wrong GPIO chip (gpiochip0 instead of gpiochip4)
- gpiochip4 routes through UP Board CPLD/FPGA to physical pins
- All radio control pins tested and working: PTT, CS0-CS3, CLEAR

## Hardware Details

**UP Board Configuration:**
- IP: 192.168.1.57 (hostname: florlink)
- OS: Ubuntu with Linux kernel 6.14.0-37
- BIOS: American Megatrends UNAPAM22 (07/26/2021)
- FPGA: upboard_fpga module loaded, v0.3.2 build 0x3
- Pin Controller: FPGA-based (PINCTRL SSDT detected)

**GPIO Chips Detected:**
```
gpiochip0: 78 lines - Intel INT3452:00 (DO NOT USE - doesn't control physical pins)
gpiochip1: 77 lines - Intel INT3452:01 (DO NOT USE)
gpiochip2: 47 lines - Intel INT3452:02 (DO NOT USE)
gpiochip3: 43 lines - Intel INT3452:03 (DO NOT USE)
gpiochip4: 28 lines - "Raspberry Pi compatible UP GPIO" (✅ USE THIS - controls 40-pin header)
gpiochip5: 4 lines - ftdi-cbus (FTDI adapter for XBee)
```

## Verified Pin Mapping (gpiochip4)

✅ WORKING - Based on UP board testing with gpiochip4:
- **Physical Pin 13** (PTT) = gpiochip4 line 27 (BCM GPIO 27)
- **Physical Pin 15** (CS3) = gpiochip4 line 22 (BCM GPIO 22)
- **Physical Pin 16** (CS2) = gpiochip4 line 23 (BCM GPIO 23)
- **Physical Pin 18** (CS1) = gpiochip4 line 24 (BCM GPIO 24)
- **Physical Pin 22** (CS0) = gpiochip4 line 25 (BCM GPIO 25)
- **Physical Pin 32** (CLEAR) = gpiochip4 line 12 (BCM GPIO 12)
- **Physical Pin 16** (CS2) = gpiochip0 line 19
- **Physical Pin 18** (CS1) = gpiochip0 line 20
- **Physical Pin 22** (CS0) = gpiochip0 line 21
- **Physical Pin 32** (Clear Channel) = gpiochip0 line 25

## What We Tested

### Software Tests (All Passed ✅)
```bash
# Read GPIO state
sudo gpioget --chip gpiochip0 17  # Works, returns state

# Set GPIO high/low
sudo gpioset --chip gpiochip0 17=1  # Command succeeds
sudo gpioset --chip gpiochip0 17=0  # Command succeeds
```

### Hardware Tests (All Failed ❌)
- Pin 13: No voltage change with gpioset
- Pin 18: No voltage change with gpioset
- Pin 5: Stuck at 3.3V (possibly I2C or power)
- Pin 3: Stuck at 3.3V (possibly I2C or power)
- Tested all output-capable lines: 6,7,8,9,10,11,12,13,17,18,19,27,36,60,61,72,73

## NEXT STEP: **BIOS Configuration Required**

User needs physical keyboard/monitor access to enter BIOS and enable GPIO.

### BIOS Settings to Check/Enable:
1. **HAT Configuration** → Enable
2. **40-pin GPIO Header** → Enable  
3. **Pin Muxing** → Set pins to GPIO mode (not I2C/SPI/UART)
4. **GPIO Mode** → Set to Native or ACPI
5. **I2C Configuration** → Disable on pins 3/5 if needed for GPIO
6. **SPI Configuration** → Disable if not needed
7. **LPSS & SCC Configuration** → May need adjustment

### After BIOS Update:
1. Reboot the UP board
2. Test pin 18 with: `sudo gpioset --chip gpiochip0 18=1`
3. Verify voltage change with multimeter
4. If successful, proceed with full GPIO implementation

## Files Ready for Deployment (Once GPIO Works)

- ✅ `backend/src/core/gpio-manager.js` - GPIO manager using shell commands
- ✅ `backend/Dockerfile` - Container configuration
- ✅ `backend/package.json` - Dependencies
- ✅ `docker-compose.local.yml` - Has `privileged: true` for GPIO access

## Current Implementation Approach

**Using shell commands via Docker:**
- Docker container runs with `--privileged` flag
- Mount `/dev/gpiochip0` into container
- Execute `gpioset`/`gpioget` via child_process
- Works for software, waiting on hardware enable

## Test Command (Once GPIO Hardware Works)
```bash
# Test PTT (pin 13)
sudo gpioset --chip gpiochip0 17=1  # Should see 3.3V on pin 13
sudo gpioset --chip gpiochip0 17=0  # Should see 0V on pin 13
```

## Notes
- Cable adapter between UP board and radio may have different pin mapping
- User measuring through 16-pin connector, not direct 40-pin header
- Software is 100% ready, waiting on hardware configuration
