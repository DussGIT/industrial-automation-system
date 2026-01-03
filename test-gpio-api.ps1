#!/usr/bin/env pwsh
# Test script for GPIO API endpoints

$baseUrl = "http://localhost:3000"

Write-Host "=== GPIO API Test Script ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check status
Write-Host "1. Checking GPIO Status..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "$baseUrl/api/gpio/status" -Method Get
    Write-Host "   Pins: $($status.pins | ConvertTo-Json -Compress)" -ForegroundColor Gray
    Write-Host "   States: $($status.states | ConvertTo-Json -Compress)" -ForegroundColor Gray
    Write-Host "   ✓ Status retrieved" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Get debug info
Write-Host "2. Getting Debug Info..." -ForegroundColor Yellow
try {
    $debug = Invoke-RestMethod -Uri "$baseUrl/api/gpio/debug" -Method Get
    Write-Host "   Initialized: $($debug.initialized)" -ForegroundColor Gray
    Write-Host "   Chip Number: $($debug.chipNumber)" -ForegroundColor Gray
    Write-Host "   Channel Pins:" -ForegroundColor Gray
    Write-Host "      CS0: Pin $($debug.channelPins.CS0.physical) -> State $($debug.channelPins.CS0.state)" -ForegroundColor Gray
    Write-Host "      CS1: Pin $($debug.channelPins.CS1.physical) -> State $($debug.channelPins.CS1.state)" -ForegroundColor Gray
    Write-Host "      CS2: Pin $($debug.channelPins.CS2.physical) -> State $($debug.channelPins.CS2.state)" -ForegroundColor Gray
    Write-Host "      CS3: Pin $($debug.channelPins.CS3.physical) -> State $($debug.channelPins.CS3.state)" -ForegroundColor Gray
    Write-Host "   ✓ Debug info retrieved" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Set various channels
$channels = @(0, 1, 2, 4, 8, 15)

foreach ($channel in $channels) {
    Write-Host "3. Setting Channel $channel..." -ForegroundColor Yellow
    
    # Calculate expected binary
    $cs0 = ($channel -band 0x01) -ne 0 ? 1 : 0
    $cs1 = ($channel -band 0x02) -ne 0 ? 1 : 0
    $cs2 = ($channel -band 0x04) -ne 0 ? 1 : 0
    $cs3 = ($channel -band 0x08) -ne 0 ? 1 : 0
    
    Write-Host "   Expected: CS3=$cs3 CS2=$cs2 CS1=$cs1 CS0=$cs0" -ForegroundColor Gray
    
    try {
        $body = @{ channel = $channel } | ConvertTo-Json
        $result = Invoke-RestMethod -Uri "$baseUrl/api/gpio/channel" -Method Post -Body $body -ContentType "application/json"
        
        Write-Host "   Response: $($result | ConvertTo-Json -Compress)" -ForegroundColor Gray
        
        if ($result.success) {
            Write-Host "   ✓ Channel $channel set successfully" -ForegroundColor Green
            
            # Verify by reading status
            Start-Sleep -Milliseconds 100
            $status = Invoke-RestMethod -Uri "$baseUrl/api/gpio/status" -Method Get
            
            $actualCS0 = $status.states."22"
            $actualCS1 = $status.states."18"
            $actualCS2 = $status.states."16"
            $actualCS3 = $status.states."15"
            
            Write-Host "   Actual: CS3=$actualCS3 CS2=$actualCS2 CS1=$actualCS1 CS0=$actualCS0" -ForegroundColor Gray
            
            if ($actualCS0 -eq $cs0 -and $actualCS1 -eq $cs1 -and $actualCS2 -eq $cs2 -and $actualCS3 -eq $cs3) {
                Write-Host "   ✓ Verification passed!" -ForegroundColor Green
            } else {
                Write-Host "   ✗ Verification FAILED!" -ForegroundColor Red
            }
        } else {
            Write-Host "   ✗ Failed to set channel" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ✗ Failed: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Start-Sleep -Milliseconds 500
}

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
