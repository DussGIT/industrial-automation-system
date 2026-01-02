# UP Board BIOS GPIO Configuration Check

## How to Access BIOS
1. Reboot the UP Board
2. Press **DEL** or **F7** during boot to enter BIOS setup
3. Navigate to the GPIO/HAT configuration section

## Critical BIOS Settings to Check

### 1. HAT Configuration
**Location:** Advanced → HAT Configuration

**Required Settings:**
- **HAT Configuration Enable:** `Enabled`
- **I2C0 Configuration:** `Disabled` (unless you need I2C on pins 3/5)
- **I2C1 Configuration:** `Disabled` 
- **SPI Configuration:** `Disabled` (unless you need SPI)
- **UART Configuration:** As needed

### 2. Pin Modes for Your Radio Interface

Based on your GPIO_CONFIGURATION.md, you need these pins as GPIO:

| Physical Pin | Function | BIOS Setting |
|--------------|----------|--------------|
| 13 | GPIO 5 (PTT) | Set to GPIO mode |
| 15 | GPIO 6 (CS3) | Set to GPIO mode |
| 16 | GPIO 19 (CS2) | Set to GPIO mode |
| 18 | GPIO 20 (CS1) | Set to GPIO mode |
| 22 | GPIO 21 (CS0) | Set to GPIO mode |
| 32 | GPIO 25 (Clear Channel) | Set to GPIO mode |

**Pins 3 & 5:** If set to I2C mode, they cannot be used as GPIO
**Pins 19, 21, 23:** If set to SPI mode, they cannot be used as GPIO

### 3. Specific BIOS Options to Enable

Look for these in the BIOS:
- **GPIO Mode:** Native or ACPI (try Native first)
- **LPSS & SCC Configuration:** May need to be configured
- **Pin Muxing:** Should allow GPIO function

## Current GPIO Chip Status

From `gpioinfo` output:
```
gpiochip0 - 78 lines
gpiochip1 - 77 lines
gpiochip2 - 47 lines
gpiochip3 - 43 lines
gpiochip4 - 4 lines
```

### Problematic Lines Found:
- **gpiochip0 line 17:** Already has a consumer (something is using it)
  - This might be your PTT pin - need to release it first
- **gpiochip3 lines 16-19:** Have consumers (dataout, datain, strobe, clear)
  - These are being used by something else

## UP Board Specific Notes

The UP Board uses **Intel Cherry Trail** SoC with multiple GPIO controllers:
- **gpiochip0:** INT33FF - Main GPIO controller (most 40-pin header pins)
- **gpiochip1:** INT33FF - Secondary GPIO
- **gpiochip2:** INT33FC - LPSS GPIO
- **gpiochip3:** INT33FF - Additional GPIO
- **gpiochip4:** INT34CE - Power/kernel reserved

## Pin Mapping Reference

According to UP Board documentation:
- Physical Pin 13 (GPIO 5) → Usually gpiochip0 or gpiochip1
- The exact line number depends on BIOS configuration

## Commands to Test After BIOS Check

Once BIOS is configured, test each pin:
```bash
# Test Pin 13 (PTT) - try different chips/lines
sudo gpioset gpiochip0 17=1 --mode=time --sec=5
sudo gpioget gpiochip0 17

# List all available GPIO lines with their current state
sudo gpioinfo | grep -i output
```

## Next Steps

1. **Access BIOS** and verify HAT configuration is enabled
2. **Disable I2C/SPI** on pins you need for GPIO
3. **Set pins to GPIO mode** (not I2C, SPI, UART)
4. **Save and reboot**
5. **Run `sudo gpioinfo`** again to see if pin configurations changed
6. **Test with gpioset** to confirm hardware responds

## If Pins Still Don't Work

The UP Board might need:
1. **Device tree overlay** to properly map pins
2. **Kernel module parameters** for the GPIO driver
3. **libgpiod configuration** for pin naming
4. **UP board specific utilities** (`upboard-pinctrl` if available)

Let me know what you find in the BIOS and we'll adjust the code accordingly!
