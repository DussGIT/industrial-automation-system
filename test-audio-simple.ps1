# Simple Audio Test - Just play a test tone
# Run this to verify your headphones are working

Write-Host "Simple Audio Test" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will play a test tone through your headphones." -ForegroundColor Yellow
Write-Host "Press any key to start..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "▶ Playing test tone..." -ForegroundColor Green

# Generate a simple test tone using PowerShell
$duration = 1.0  # seconds
$frequency = 440  # Hz (A4 note)
$sampleRate = 44100
$amplitude = 0.3

# Create WAV file with test tone
$wavFile = "$env:TEMP\test-tone.wav"

# Build PCM audio data
$samples = [int]($sampleRate * $duration)
$data = New-Object byte[] ($samples * 2)  # 16-bit samples

for ($i = 0; $i -lt $samples; $i++) {
    $sample = [int]($amplitude * 32767 * [Math]::Sin(2 * [Math]::PI * $frequency * $i / $sampleRate))
    $data[$i * 2] = $sample -band 0xFF
    $data[$i * 2 + 1] = ($sample -shr 8) -band 0xFF
}

# Create WAV header
$header = New-Object byte[] 44
[System.Text.Encoding]::ASCII.GetBytes("RIFF").CopyTo($header, 0)
[BitConverter]::GetBytes([int]($data.Length + 36)).CopyTo($header, 4)
[System.Text.Encoding]::ASCII.GetBytes("WAVE").CopyTo($header, 8)
[System.Text.Encoding]::ASCII.GetBytes("fmt ").CopyTo($header, 12)
[BitConverter]::GetBytes([int]16).CopyTo($header, 16)  # fmt chunk size
[BitConverter]::GetBytes([short]1).CopyTo($header, 20)  # PCM format
[BitConverter]::GetBytes([short]1).CopyTo($header, 22)  # mono
[BitConverter]::GetBytes([int]$sampleRate).CopyTo($header, 24)
[BitConverter]::GetBytes([int]($sampleRate * 2)).CopyTo($header, 28)  # byte rate
[BitConverter]::GetBytes([short]2).CopyTo($header, 32)  # block align
[BitConverter]::GetBytes([short]16).CopyTo($header, 34)  # bits per sample
[System.Text.Encoding]::ASCII.GetBytes("data").CopyTo($header, 36)
[BitConverter]::GetBytes([int]$data.Length).CopyTo($header, 40)

# Write WAV file
$stream = [System.IO.File]::Create($wavFile)
$stream.Write($header, 0, $header.Length)
$stream.Write($data, 0, $data.Length)
$stream.Close()

# Play the audio
Add-Type -AssemblyName System.Windows.Forms
$player = New-Object System.Media.SoundPlayer($wavFile)
$player.PlaySync()
$player.Dispose()

# Cleanup
Remove-Item $wavFile -ErrorAction SilentlyContinue

Write-Host "✓ Test tone completed" -ForegroundColor Green
Write-Host ""
Write-Host "Did you hear a tone? If yes, your headphones are working!" -ForegroundColor Yellow
