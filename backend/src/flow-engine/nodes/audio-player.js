const BaseNode = require('./base-node');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

/**
 * Audio Player Node
 * Plays audio files on the computer's speakers
 */
class AudioPlayerNode extends BaseNode {
  constructor(config) {
    super(config);
    this.audioFileId = config.audioFileId || null;
    this.volume = config.volume || 100; // 0-100
    this.repeat = config.repeat || 1; // Number of times to repeat
  }

  /**
   * Get node metadata
   */
  static getMetadata() {
    return {
      type: 'audio-player',
      category: 'output',
      label: 'Audio Player',
      description: 'Play audio files on computer speakers',
      icon: 'volume-2',
      color: '#9333ea',
      inputs: 1,
      outputs: 1,
      properties: {
        audioFileId: {
          type: 'audio-file',
          label: 'Audio File',
          required: true,
          description: 'Select an audio file from the library'
        },
        volume: {
          type: 'number',
          label: 'Volume (%)',
          default: 100,
          min: 0,
          max: 100,
          description: 'Playback volume (0-100)'
        },
        repeat: {
          type: 'number',
          label: 'Repeat',
          default: 1,
          min: 1,
          max: 10,
          description: 'Number of times to play'
        }
      }
    };
  }

  /**
   * Validate node configuration
   */
  validate() {
    const errors = [];
    
    if (!this.audioFileId) {
      errors.push('Audio file is required');
    }

    if (this.volume < 0 || this.volume > 100) {
      errors.push('Volume must be between 0 and 100');
    }

    if (this.repeat < 1 || this.repeat > 10) {
      errors.push('Repeat must be between 1 and 10');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute the audio player node
   */
  async execute(msg, context) {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Audio Player validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      // Get audio file from database
      const db = context.database;
      const audioFile = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(this.audioFileId);
      
      if (!audioFile) {
        throw new Error(`Audio file with ID ${this.audioFileId} not found`);
      }

      // Check if file exists
      if (!fs.existsSync(audioFile.filepath)) {
        throw new Error(`Audio file not found at path: ${audioFile.filepath}`);
      }

      this.log('info', `Playing audio: ${audioFile.name} (${audioFile.format})`);
      this.log('debug', `File path: ${audioFile.filepath}, Volume: ${this.volume}%, Repeat: ${this.repeat}x`);

      // Play the audio file
      await this.playAudio(audioFile.filepath, this.volume, this.repeat);

      // Emit output
      const output = {
        ...msg,
        payload: {
          action: 'audio_played',
          file: audioFile.name,
          format: audioFile.format,
          duration: audioFile.duration,
          volume: this.volume,
          repeat: this.repeat,
          timestamp: new Date().toISOString()
        }
      };

      this.emit('output', output);
      this.log('info', `Successfully played audio: ${audioFile.name}`);

    } catch (error) {
      this.log('error', `Audio playback failed: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Play audio file using system audio player
   */
  async playAudio(filepath, volume, repeat) {
    return new Promise((resolve, reject) => {
      let command;
      const absolutePath = path.resolve(filepath);

      // Determine OS and use appropriate audio player
      if (process.platform === 'win32') {
        // Windows: Use PowerShell with Windows Media Player or built-in player
        // For better compatibility, we'll use a simple approach with Add-Type and MediaPlayer
        const psScript = `
          Add-Type -AssemblyName presentationCore
          $mediaPlayer = New-Object System.Windows.Media.MediaPlayer
          $mediaPlayer.Volume = ${volume / 100}
          for ($i = 0; $i -lt ${repeat}; $i++) {
            $mediaPlayer.Open([uri]"${absolutePath.replace(/\\/g, '\\\\')}")
            $mediaPlayer.Play()
            Start-Sleep -Seconds ${this.getAudioDuration(filepath) || 2}
          }
          $mediaPlayer.Close()
        `.replace(/\n/g, '; ');
        
        command = `powershell -Command "${psScript}"`;
      } else if (process.platform === 'darwin') {
        // macOS: Use afplay
        command = `afplay -v ${volume / 100} "${absolutePath}"`;
        if (repeat > 1) {
          command = `for i in {1..${repeat}}; do ${command}; done`;
        }
      } else {
        // Linux: Use aplay, paplay, or ffplay
        command = `aplay "${absolutePath}" || paplay "${absolutePath}" || ffplay -nodisp -autoexit "${absolutePath}"`;
        if (repeat > 1) {
          command = `for i in {1..${repeat}}; do ${command}; done`;
        }
      }

      this.log('debug', `Executing audio command: ${command.substring(0, 100)}...`);

      exec(command, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          this.log('error', `Audio playback error: ${error.message}`);
          reject(error);
          return;
        }
        
        if (stderr && !stderr.includes('ALSA')) { // Ignore ALSA warnings on Linux
          this.log('warn', `Audio playback warning: ${stderr}`);
        }
        
        resolve();
      });
    });
  }

  /**
   * Get estimated audio duration from database or file
   */
  getAudioDuration(filepath) {
    // This is a fallback - duration should be in database
    // For now, return a default value
    return 2;
  }

  /**
   * Handle incoming messages
   */
  async onInput(msg, context) {
    // Allow dynamic configuration via message
    if (msg.payload && typeof msg.payload === 'object') {
      if (msg.payload.audioFileId) {
        this.audioFileId = msg.payload.audioFileId;
      }
      if (msg.payload.volume !== undefined) {
        this.volume = Math.max(0, Math.min(100, msg.payload.volume));
      }
      if (msg.payload.repeat !== undefined) {
        this.repeat = Math.max(1, Math.min(10, msg.payload.repeat));
      }
    }

    await this.execute(msg, context);
  }

  /**
   * Cleanup when node is removed
   */
  async onClose() {
    this.log('debug', 'Audio player node closing');
    // Nothing to clean up for audio player
  }
}

module.exports = AudioPlayerNode;
