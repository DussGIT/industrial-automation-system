const BaseNode = require('../base-node');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const { getDb } = require('../../../core/database');

/**
 * Audio Player Node - Plays audio files on computer speakers
 */
class AudioPlayerNode extends BaseNode {
  static type = 'audio-player';

  constructor(config) {
    super(config);
    this.audioFileId = this.config.audioFileId || null;
    this.volume = this.config.volume || 100; // 0-100
    this.repeat = this.config.repeat || 1; // Number of times to repeat
  }

  /**
   * Play audio file using system audio player
   */
  async playAudio(filepath, volume, repeat, duration) {
    return new Promise((resolve, reject) => {
      let command;
      const absolutePath = path.resolve(filepath);

      // Determine OS and use appropriate audio player
      if (process.platform === 'win32') {
        // Windows: Use PowerShell with SoundPlayer class for WAV files
        // For better compatibility with WAV files
        const psScript = `
          Add-Type -AssemblyName System.Windows.Forms;
          $player = New-Object System.Media.SoundPlayer('${absolutePath.replace(/'/g, "''")}');
          for ($i = 0; $i -lt ${repeat}; $i++) {
            $player.PlaySync();
          }
          $player.Dispose();
        `;
        
        command = `powershell.exe -NoProfile -NonInteractive -Command "${psScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
      } else if (process.platform === 'darwin') {
        // macOS: Use afplay
        command = `afplay -v ${volume / 100} "${absolutePath}"`;
        if (repeat > 1) {
          command = `for i in {1..${repeat}}; do ${command}; done`;
        }
      } else {
        // Linux: Use aplay with HDMI device (plughw:0,3)
        command = `aplay -D plughw:0,3 "${absolutePath}" 2>/dev/null || aplay "${absolutePath}" || paplay "${absolutePath}" || ffplay -nodisp -autoexit "${absolutePath}"`;
        if (repeat > 1) {
          command = `for i in {1..${repeat}}; do ${command}; done`;
        }
      }

      this.log(`Executing audio playback command: ${command}`, 'info');

      exec(command, { windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          this.log(`Audio playback error: ${error.message}`, 'error');
          reject(error);
          return;
        }
        
        if (stderr && !stderr.includes('ALSA')) { // Ignore ALSA warnings on Linux
          this.log(`Audio playback warning: ${stderr}`, 'warn');
        }
        
        resolve();
      });
    });
  }

  /**
   * Handle incoming messages
   */
  async receive(data) {
    try {
      // Allow dynamic configuration via message
      let audioFileId = this.audioFileId;
      let volume = this.volume;
      let repeat = this.repeat;

      if (data.payload && typeof data.payload === 'object') {
        if (data.payload.audioFileId) {
          audioFileId = data.payload.audioFileId;
        }
        if (data.payload.volume !== undefined) {
          volume = Math.max(0, Math.min(100, data.payload.volume));
        }
        if (data.payload.repeat !== undefined) {
          repeat = Math.max(1, Math.min(10, data.payload.repeat));
        }
      }

      // Validate
      if (!audioFileId) {
        throw new Error('Audio file is required');
      }

      // Get database
      const db = getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      // Get audio file from database
      const audioFile = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(audioFileId);
      
      if (!audioFile) {
        throw new Error(`Audio file with ID ${audioFileId} not found`);
      }

      // Check if file exists
      if (!fs.existsSync(audioFile.filepath)) {
        throw new Error(`Audio file not found at path: ${audioFile.filepath}`);
      }

      this.log(`Playing audio: ${audioFile.name} (${audioFile.format})`, 'info');
      this.log(`File path: ${audioFile.filepath}, Volume: ${volume}%, Repeat: ${repeat}x`, 'debug');

      // Play the audio file
      await this.playAudio(audioFile.filepath, volume, repeat, audioFile.duration);

      // Send output message
      const output = {
        ...data,
        payload: {
          action: 'audio_played',
          file: audioFile.name,
          format: audioFile.format,
          duration: audioFile.duration,
          volume: volume,
          repeat: repeat,
          timestamp: new Date().toISOString()
        }
      };

      this.send(output);
      this.log(`Successfully played audio: ${audioFile.name}`, 'info');

    } catch (error) {
      this.log(`Audio playback failed: ${error.message}`, 'error');
      
      // Emit error to UI
      if (this.io) {
        this.io.emit('flow:node-error', {
          nodeId: this.id,
          nodeName: this.name,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      // Send error output instead of throwing
      const errorOutput = {
        ...data,
        payload: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
      this.send(errorOutput);
    }
  }
}

module.exports = AudioPlayerNode;
