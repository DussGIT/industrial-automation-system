const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Quick test of Piper TTS for Node.js
 * Generates audio from text using Piper
 */

const PIPER_DIR = '/tmp/piper-test';
const PIPER_BIN = path.join(PIPER_DIR, 'piper');
const MODEL_FILE = path.join(PIPER_DIR, 'en_US-lessac-medium.onnx');

async function testPiperTTS() {
  console.log('Piper TTS Node.js Test');
  console.log('======================\n');

  // Test text
  const testText = 'Attention all personnel. Emergency alert on channel five. Please respond immediately.';
  const outputFile = path.join(PIPER_DIR, 'test-node.wav');

  console.log('Text:', testText);
  console.log('Output:', outputFile);
  console.log('\nGenerating audio...\n');

  // Check if piper exists
  if (!fs.existsSync(PIPER_BIN)) {
    console.error('Error: Piper not found. Please run test-piper-tts.sh first to download Piper.');
    process.exit(1);
  }

  // Check if model exists
  if (!fs.existsSync(MODEL_FILE)) {
    console.error('Error: Voice model not found. Please run test-piper-tts.sh first to download the model.');
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const piper = spawn(PIPER_BIN, [
      '--model', MODEL_FILE,
      '--output_file', outputFile
    ]);

    // Send text to stdin
    piper.stdin.write(testText);
    piper.stdin.end();

    let stderr = '';
    piper.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    piper.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        console.log('✓ Audio generated successfully!');
        console.log(`File: ${outputFile}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`\nYou can play it with: aplay ${outputFile}`);
        resolve(outputFile);
      } else {
        console.error('✗ Failed to generate audio');
        if (stderr) console.error('Error:', stderr);
        reject(new Error('Piper failed'));
      }
    });
  });
}

// Run test
testPiperTTS()
  .then(() => {
    console.log('\n======================');
    console.log('Test complete!');
    console.log('\nPiper TTS is working. Ready to integrate into your system.');
  })
  .catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
  });
