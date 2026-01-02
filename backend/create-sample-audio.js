const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Connect to database
const dbPath = path.join(__dirname, 'data/flows.db');
const db = new Database(dbPath);

// Ensure audio directory exists
const audioDir = path.join(__dirname, 'data/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Create a simple WAV file with a beep tone (440 Hz for 1 second)
function createWavFile(filename, frequency = 440, durationSeconds = 1) {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  
  // WAV file header
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20); // audio format (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // byte rate
  header.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // block align
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(numSamples * 2, 40);
  
  // Generate audio samples (simple sine wave)
  const samples = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t) * 32767 * 0.5; // 50% volume
    samples.writeInt16LE(Math.round(value), i * 2);
  }
  
  // Combine header and samples
  const wavFile = Buffer.concat([header, samples]);
  
  const filepath = path.join(audioDir, filename);
  fs.writeFileSync(filepath, wavFile);
  
  return {
    filepath,
    filename,
    size: wavFile.length
  };
}

// Create sample audio files
console.log('Creating sample audio files...\n');

const samples = [
  { name: 'Emergency Alert', filename: 'alert-440hz.wav', frequency: 440, duration: 2 },
  { name: 'Notification Beep', filename: 'beep-880hz.wav', frequency: 880, duration: 0.5 },
  { name: 'Warning Tone', filename: 'warning-660hz.wav', frequency: 660, duration: 1.5 },
];

for (const sample of samples) {
  const file = createWavFile(sample.filename, sample.frequency, sample.duration);
  
  // Insert into database
  const stmt = db.prepare(`
    INSERT INTO audio_files (name, description, filename, filepath, format, size, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const description = `${sample.frequency}Hz tone for ${sample.duration} second(s)`;
  
  stmt.run(
    sample.name,
    description,
    file.filename,
    file.filepath,
    'wav',
    file.size,
    sample.duration
  );
  
  console.log(`✓ Created: ${sample.name}`);
  console.log(`  File: ${file.filename}`);
  console.log(`  Size: ${(file.size / 1024).toFixed(2)} KB`);
  console.log(`  Duration: ${sample.duration}s\n`);
}

// Verify
const count = db.prepare('SELECT COUNT(*) as count FROM audio_files').get();
console.log(`Total audio files in library: ${count.count}`);

db.close();
console.log('\nDone!');
