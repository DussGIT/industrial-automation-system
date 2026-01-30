#!/bin/bash
# Quick test of Piper TTS
# This will download a voice model and generate test audio

echo "Testing Piper TTS..."
echo "===================="

# Create temp directory
mkdir -p /tmp/piper-test
cd /tmp/piper-test

# Download Piper binary if not exists
if [ ! -f "piper" ]; then
    echo "Downloading Piper..."
    wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
    tar -xzf piper_amd64.tar.gz
    chmod +x piper
fi

# Download a voice model (US English, medium quality)
if [ ! -f "en_US-lessac-medium.onnx" ]; then
    echo "Downloading voice model (en_US-lessac-medium)..."
    wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
    wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
fi

echo ""
echo "Generating test audio..."
echo "Attention all personnel. This is a test of the Piper text to speech system. Radio channel five is now active." | ./piper --model en_US-lessac-medium.onnx --output_file test-output.wav

if [ -f "test-output.wav" ]; then
    echo ""
    echo "✓ Audio generated successfully!"
    echo "File: /tmp/piper-test/test-output.wav"
    echo ""
    echo "Playing audio..."
    aplay test-output.wav 2>/dev/null || echo "Note: Install 'aplay' to hear the audio"
    echo ""
    echo "You can also copy this file to test with your radio system"
else
    echo "✗ Failed to generate audio"
fi
