# Audio Testing Script for Windows
# Tests Audio Library and Text-to-Speech functionality

param(
    [Parameter(Mandatory=$false)]
    [string]$BackendURL = "http://localhost:3000"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Audio System Test - Windows" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "1. Checking backend connection..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BackendURL/health" -Method Get -ErrorAction Stop
    Write-Host "   ✓ Backend is running at $BackendURL" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend not running at $BackendURL" -ForegroundColor Red
    Write-Host "   Please start the backend first:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor Gray
    Write-Host "   npm start" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# Test 1: Check Audio Library
Write-Host "2. Testing Audio Library..." -ForegroundColor Yellow
try {
    $audioFiles = Invoke-RestMethod -Uri "$BackendURL/api/audio" -Method Get -ErrorAction Stop
    Write-Host "   ✓ Audio Library accessible" -ForegroundColor Green
    Write-Host "   Found $($audioFiles.Count) audio file(s)" -ForegroundColor Gray
    
    if ($audioFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "   Available audio files:" -ForegroundColor Gray
        foreach ($file in $audioFiles) {
            $sizeMB = [math]::Round($file.size / 1MB, 2)
            Write-Host "   - ID: $($file.id) | $($file.name) | $($file.format) | $sizeMB MB" -ForegroundColor Gray
        }
    } else {
        Write-Host "   No audio files uploaded yet." -ForegroundColor Gray
        Write-Host "   You can upload files through the web UI at http://localhost:5173/audio" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Failed to access Audio Library: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Play audio file (if any exist)
if ($audioFiles.Count -gt 0) {
    Write-Host "3. Testing Audio Playback..." -ForegroundColor Yellow
    $testFile = $audioFiles[0]
    Write-Host "   Testing playback of: $($testFile.name)" -ForegroundColor Gray
    
    try {
        # Download and play the first audio file
        $tempFile = "$env:TEMP\test-audio.$($testFile.format)"
        Invoke-RestMethod -Uri "$BackendURL/api/audio/$($testFile.id)/download" -Method Get -OutFile $tempFile -ErrorAction Stop
        Write-Host "   ✓ Downloaded audio file" -ForegroundColor Green
        
        # Play the audio using Windows Media Player
        Write-Host "   ▶ Playing audio... (Press any key to stop)" -ForegroundColor Cyan
        
        Add-Type -AssemblyName System.Windows.Forms
        $player = New-Object System.Media.SoundPlayer($tempFile)
        $player.PlaySync()
        $player.Dispose()
        
        Write-Host "   ✓ Audio playback completed" -ForegroundColor Green
        
        # Cleanup
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    } catch {
        Write-Host "   ✗ Playback failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "3. Skipping audio playback test (no files available)" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Text-to-Speech API
Write-Host "4. Testing Text-to-Speech API..." -ForegroundColor Yellow
$ttsText = "This is a test of the text to speech system. Emergency broadcast on channel five."

try {
    # Check if TTS endpoint exists
    $ttsBody = @{
        text = $ttsText
        voice = "en_US-lessac-medium"
    } | ConvertTo-Json
    
    Write-Host "   Generating speech: '$ttsText'" -ForegroundColor Gray
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    # Call TTS API
    $response = Invoke-RestMethod -Uri "$BackendURL/api/tts/generate" -Method Post -Body $ttsBody -Headers $headers -ErrorAction Stop
    
    if ($response.success) {
        Write-Host "   ✓ TTS generation successful" -ForegroundColor Green
        Write-Host "   Audio file: $($response.filename)" -ForegroundColor Gray
        Write-Host "   Size: $([math]::Round($response.size / 1024, 2)) KB" -ForegroundColor Gray
        
        # Try to play the generated TTS
        Write-Host "   ▶ Playing TTS audio..." -ForegroundColor Cyan
        $ttsFile = "$env:TEMP\tts-test.wav"
        Invoke-RestMethod -Uri "$BackendURL/api/audio/$($response.id)/download" -Method Get -OutFile $ttsFile -ErrorAction Stop
        
        Add-Type -AssemblyName System.Windows.Forms
        $player = New-Object System.Media.SoundPlayer($ttsFile)
        $player.PlaySync()
        $player.Dispose()
        
        Write-Host "   ✓ TTS playback completed" -ForegroundColor Green
        
        # Cleanup
        Remove-Item $ttsFile -ErrorAction SilentlyContinue
    } else {
        Write-Host "   ✗ TTS generation failed: $($response.error)" -ForegroundColor Red
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-Host "   ⚠ TTS API not available (endpoint not found)" -ForegroundColor Yellow
        Write-Host "   Note: TTS feature may not be implemented yet on this backend" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ TTS test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open web UI: http://localhost:5173" -ForegroundColor Gray
Write-Host "2. Navigate to Audio Library" -ForegroundColor Gray
Write-Host "3. Upload test audio files" -ForegroundColor Gray
Write-Host "4. Create a flow with Audio Player node" -ForegroundColor Gray
Write-Host "5. Test playback through the flow" -ForegroundColor Gray
