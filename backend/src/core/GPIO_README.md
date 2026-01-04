# UP Board GPIO Configuration

## ⚠️ CRITICAL: DO NOT CHANGE CHIP NUMBER

This application MUST use **gpiochip4** on the UP Board.

## Why gpiochip4?

The UP Board has multiple GPIO controllers:
- **gpiochip0-3**: Intel Cherry Trail SoC GPIO controllers
  - These are the RAW hardware GPIO lines
  - **They DO NOT connect to the 40-pin header!**
  - Setting these has NO effect on physical pins
  
- **gpiochip4**: "Raspberry Pi compatible UP GPIO"
  - This is routed through the UP Board CPLD/FPGA
  - **This is the ONLY chip that controls the physical 40-pin header**
  - Uses BCM GPIO numbering (Raspberry Pi compatible)

## What Happens If You Use Wrong Chip?

If you accidentally set `this.chipNumber = 0`:
- ✅ Software will report success
- ✅ libgpiod will work without errors
- ❌ Physical pins will NOT change
- ❌ No voltage output on header
- ❌ Radio control will not work

## Correct Configuration

```javascript
this.chipNumber = 4; // gpiochip4 - UP Board CPLD/FPGA GPIO
```

## Pin Mapping Example

Physical Pin 13 (PTT):
- ❌ WRONG: gpiochip0 line 17
- ✅ CORRECT: gpiochip4 line 27 (BCM GPIO 27)

## Verification Commands

Check available chips:
```bash
gpiodetect
```

Should show:
```
gpiochip4 [Raspberry Pi compatible UP GPIO] (28 lines)
```

Test a pin:
```bash
gpioset gpiochip4 27=1  # Set PTT high
```

## Reference

- UP Board Wiki: https://github.com/up-board/up-community/wiki/Pinout
- UP Board uses BCM numbering like Raspberry Pi
- Always test with multimeter after code changes

## Last Working Configuration

**Date:** January 3, 2026
**Chip:** gpiochip4
**Status:** ✅ All pins tested and working
**Tested Pins:** PTT (27), CS0 (25), CS1 (24), CS2 (23), CS3 (22), CLEAR (12)
