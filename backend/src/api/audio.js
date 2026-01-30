const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { getDb } = require('../core/database');
const logger = require('../core/logger');

const execPromise = promisify(exec);

// Helper function to fix file paths (handles both old Windows paths and new Linux paths)
function getActualFilePath(dbPath, filename) {
  // If path starts with C:\ or similar Windows path, convert to /data/audio/filename
  if (dbPath && (dbPath.includes(':\\') || dbPath.includes('C:'))) {
    return `/data/audio/${filename}`;
  }
  // If path already starts with /data, use it as-is
  if (dbPath && dbPath.startsWith('/data')) {
    return dbPath;
  }
  // Otherwise use /data/audio
  return `/data/audio/${filename}`;
}

// Get audio directory (check env var at runtime)
const getAudioDir = () => {
  const audioDir = process.env.AUDIO_DIR || '/data/audio';
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  return audioDir;
};

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getAudioDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|ogg|m4a|aac|flac/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only audio files are allowed!'));
  }
});

// Get all audio files
router.get('/audio', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM audio_files ORDER BY created_at DESC');
    const files = stmt.all();
    
    res.json(files);
  } catch (error) {
    logger.error('Error getting audio files:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload audio file
router.post('/audio/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const db = getDb();
    const { name, description } = req.body;
    
    // Get file info
    const stats = fs.statSync(req.file.path);
    const format = path.extname(req.file.originalname).slice(1);
    
    // Store path relative to container's data mount
    const containerPath = `/data/audio/${req.file.filename}`;
    
    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO audio_files (name, description, filename, filepath, format, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      name || req.file.originalname,
      description || null,
      req.file.filename,
      containerPath,
      format,
      stats.size
    );
    
    logger.info(`Audio file uploaded: ${name} (${req.file.filename})`);
    
    res.json({
      success: true,
      id: result.lastInsertRowid,
      filename: req.file.filename
    });
  } catch (error) {
    logger.error('Error uploading audio file:', error);
    // Clean up file if database insert fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stream audio file
router.get('/audio/:id/stream', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM audio_files WHERE id = ?');
    const file = stmt.get(req.params.id);
    
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const filepath = getActualFilePath(file.filepath, file.filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const stat = fs.statSync(filepath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filepath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': `audio/${file.format}`
      });
      
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': `audio/${file.format}`
      });
      
      fs.createReadStream(filepath).pipe(res);
    }
  } catch (error) {
    logger.error('Error streaming audio file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download audio file
router.get('/audio/:id/download', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM audio_files WHERE id = ?');
    const file = stmt.get(req.params.id);
    
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const filepath = getActualFilePath(file.filepath, file.filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    res.download(filepath, `${file.name}.${file.format}`);
  } catch (error) {
    logger.error('Error downloading audio file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update audio file info
router.post('/audio/:id/update', (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    
    const stmt = db.prepare(`
      UPDATE audio_files 
      SET name = ?, description = ?
      WHERE id = ?
    `);
    
    stmt.run(name, description, req.params.id);
    
    logger.info(`Audio file updated: ${req.params.id}`);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating audio file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete audio file
router.post('/audio/:id/delete', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM audio_files WHERE id = ?');
    const file = stmt.get(req.params.id);
    
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // Delete file from filesystem
    const filepath = getActualFilePath(file.filepath, file.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    
    // Delete from database
    const deleteStmt = db.prepare('DELETE FROM audio_files WHERE id = ?');
    deleteStmt.run(req.params.id);
    
    logger.info(`Audio file deleted: ${file.name}`);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting audio file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync audio files from filesystem to database on startup
async function syncAudioFiles() {
  try {
    const audioDir = getAudioDir();
    const db = getDb();
    
    // Get all files currently in database
    const dbFiles = db.prepare('SELECT filename FROM audio_files').all();
    const dbFilenames = new Set(dbFiles.map(f => f.filename));
    
    // Scan filesystem for audio files
    const filesOnDisk = fs.readdirSync(audioDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext);
    });
    
    // Add missing files to database
    let addedCount = 0;
    for (const filename of filesOnDisk) {
      if (!dbFilenames.has(filename)) {
        const filepath = path.join(audioDir, filename);
        const stats = fs.statSync(filepath);
        const format = path.extname(filename).slice(1);
        const name = path.basename(filename, path.extname(filename));
        
        const stmt = db.prepare(`
          INSERT INTO audio_files (name, filename, filepath, format, size, duration, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          name,
          filename,
          filepath,
          format,
          stats.size,
          0, // Duration unknown for pre-existing files
          'Auto-synced from filesystem',
          new Date().toISOString()
        );
        
        addedCount++;
        logger.info(`Synced audio file to database: ${filename}`);
      }
    }
    
    if (addedCount > 0) {
      logger.info(`Audio sync complete: ${addedCount} files added to database`);
    } else {
      logger.info('Audio sync complete: all files already in database');
    }
  } catch (error) {
    logger.error('Error syncing audio files:', error);
  }
}

// TTS Test endpoint - generate and preview TTS without saving
router.post('/audio/tts/test', async (req, res) => {
  try {
    const { text, voice, speed } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }
    
    // Generate a temporary filename
    const tempFilename = `tts-test-${Date.now()}.wav`;
    const tempFilepath = path.join(getAudioDir(), tempFilename);
    
    // Use piper-tts to generate audio
    const voiceModel = voice || 'en_US-lessac-medium';
    const speedValue = speed || '1.0';
    
    logger.info(`Generating TTS test: "${text.substring(0, 50)}..." with voice ${voiceModel}`);
    
    try {
      // Check if piper is available
      const piperPath = process.env.PIPER_PATH || '/usr/local/bin/piper';
      const modelPath = process.env.PIPER_MODEL_PATH || '/usr/local/share/piper/models';
      const modelFile = path.join(modelPath, `${voiceModel}.onnx`);
      
      // Generate TTS audio
      // Note: Piper's length_scale is inverse - higher = slower, lower = faster
      // So we invert the speed: if user wants 2x speed, we use 0.5 length_scale
      const lengthScale = parseFloat(speedValue) > 0 ? (1.0 / parseFloat(speedValue)) : 1.0;
      const command = `echo "${text.replace(/"/g, '\\"')}" | ${piperPath} --model ${modelFile} --output_file ${tempFilepath} --length_scale ${lengthScale}`;
      await execPromise(command);
      
      // Get file stats
      const stats = fs.statSync(tempFilepath);
      
      // Calculate duration (WAV: 44.1kHz, 16-bit, mono = 88,200 bytes/sec)
      const headerSize = 44;
      const dataSize = stats.size - headerSize;
      const durationMs = Math.round((dataSize / 88200) * 1000);
      
      logger.info(`TTS test generated: ${tempFilename} (${stats.size} bytes, ~${durationMs}ms)`);
      
      // Return info and audio URL
      res.json({
        success: true,
        filename: tempFilename,
        size: stats.size,
        duration: durationMs,
        audioUrl: `/api/audio/tts/test/${tempFilename}`
      });
    } catch (error) {
      logger.error('TTS generation failed:', error);
      
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilepath)) {
        fs.unlinkSync(tempFilepath);
      }
      
      return res.status(500).json({ 
        success: false, 
        error: 'TTS generation failed. Is Piper TTS installed?',
        details: error.message
      });
    }
  } catch (error) {
    logger.error('Error in TTS test endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve TTS test audio files
router.get('/audio/tts/test/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Security: only allow filenames that match the test pattern
    if (!filename.match(/^tts-test-\d+\.wav$/)) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    
    const filepath = path.join(getAudioDir(), filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // Stream the audio file
    const stat = fs.statSync(filepath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filepath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/wav'
      });
      
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/wav'
      });
      
      fs.createReadStream(filepath).pipe(res);
    }
    
    // Clean up test file after 5 minutes
    setTimeout(() => {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info(`Cleaned up TTS test file: ${filename}`);
      }
    }, 5 * 60 * 1000);
  } catch (error) {
    logger.error('Error serving TTS test audio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, getActualFilePath, syncAudioFiles };
