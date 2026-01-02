const BaseNode = require('../base-node');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../../../core/database');
const { getRadioManager } = require('../../../core/radio-manager');

/**
 * Radio Broadcast Node - Broadcasts audio files over radio hardware
 */
class RadioBroadcastNode extends BaseNode {
  static type = 'radio-broadcast';

  constructor(config) {
    super(config);
    this.audioFileId = this.config.audioFileId || null;
    this.frequency = this.config.frequency || 146.520; // Default 2m calling frequency
    this.power = this.config.power || 5; // Watts
    this.repeat = this.config.repeat || 1;
    this.radioPort = this.config.radioPort || 'COM3'; // Default COM port
    this.modulation = this.config.modulation || 'FM'; // FM, AM, SSB
    this.squelch = this.config.squelch || 5; // 0-9
    this.radioManager = getRadioManager();
  }

  /**
   * Handle incoming messages
   */
  async receive(data) {
    try {
      // Allow dynamic configuration via message
      let audioFileId = this.audioFileId;
      let frequency = this.frequency;
      let power = this.power;
      let repeat = this.repeat;
      let radioPort = this.radioPort;
      let modulation = this.modulation;

      if (data.payload && typeof data.payload === 'object') {
        if (data.payload.audioFileId) {
          audioFileId = data.payload.audioFileId;
        }
        if (data.payload.frequency !== undefined) {
          frequency = parseFloat(data.payload.frequency);
        }
        if (data.payload.power !== undefined) {
          power = Math.max(1, Math.min(50, data.payload.power));
        }
        if (data.payload.repeat !== undefined) {
          repeat = Math.max(1, Math.min(10, data.payload.repeat));
        }
        if (data.payload.radioPort) {
          radioPort = data.payload.radioPort;
        }
        if (data.payload.modulation) {
          modulation = data.payload.modulation;
        }
      }

      // Validate
      if (!audioFileId) {
        throw new Error('Audio file is required for radio broadcast');
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

      this.log(`Requesting radio broadcast on ${frequency} MHz: ${audioFile.name}`, 'info');

      // Request transmission via Radio Manager (handles queuing)
      const result = await this.radioManager.requestTransmission({
        nodeId: this.id,
        nodeName: this.name,
        audioFile,
        config: {
          frequency,
          power,
          repeat,
          radioPort,
          modulation,
          squelch: this.squelch
        }
      });

      // Send output message
      const output = {
        ...data,
        payload: {
          action: 'radio_broadcast',
          file: audioFile.name,
          format: audioFile.format,
          frequency: frequency,
          power: power,
          modulation: modulation,
          duration: audioFile.duration,
          repeat: repeat,
          success: result.success,
          timestamp: result.timestamp
        }
      };

      this.send(output);
      this.log(`Radio broadcast complete: ${audioFile.name} on ${frequency} MHz`, 'info');

    } catch (error) {
      this.log(`Radio broadcast failed: ${error.message}`, 'error');
      
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

module.exports = RadioBroadcastNode;
