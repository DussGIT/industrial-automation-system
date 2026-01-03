const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../core/database');
const logger = require('../core/logger');

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
  // Otherwise, check if file exists at audioDir first, then fallback to /data/audio
  const localPath = path.join(audioDir, filename);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return `/data/audio/${filename}`;
}

// Ensure audio directory exists
const audioDir = process.env.AUDIO_DIR || path.join(__dirname, '../../data/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioDir);
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
    
    // Store container-compatible path
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

module.exports = { router, getActualFilePath };
