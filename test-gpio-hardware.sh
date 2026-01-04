#!/bin/bash
# UP Board GPIO Hardware Test
# Tests if GPIO changes are actually reaching the hardware pins

echo "=== UP Board GPIO Hardware Test ==="
echo "Testing Physical Pin 13 (PTT) = gpiochip0 line 17"
echo ""

echo "1. Checking current line status..."
docker exec ia-backend gpioinfo gpiochip0 | grep "line  17"
echo ""

echo "2. Setting line 17 to LOW (0V)..."
docker exec ia-backend gpioset --mode=time --sec=2 gpiochip0 17=0 &
GPIOSET_PID=$!
sleep 1
docker exec ia-backend gpioinfo gpiochip0 | grep "line  17"
wait $GPIOSET_PID
echo ""

echo "3. Setting line 17 to HIGH (3.3V)..."
docker exec ia-backend gpioset --mode=time --sec=2 gpiochip0 17=1 &
GPIOSET_PID=$!
sleep 1
docker exec ia-backend gpioinfo gpiochip0 | grep "line  17"
wait $GPIOSET_PID
echo ""

echo "=== Test Complete ==="
echo ""
echo "IMPORTANT: Measure pin 13 with a multimeter during this test:"
echo "- When LOW: Should read ~0V"
echo "- When HIGH: Should read ~3.3V"
echo ""
echo "If voltage does NOT change, the issue is:"
echo "1. BIOS HAT configuration not enabled"
echo "2. Pin not configured as GPIO in BIOS"
echo "3. FPGA not routing signals to physical pins"
