const BaseInterface = require('../base-interface');
const net = require('net');
const http = require('http');
const https = require('https');

/**
 * IP Camera Interface
 * Provides integration with IP cameras for motion detection, dwelling alerts,
 * line crossing, intrusion detection, and other video analytics events
 */
class IPCameraInterface extends BaseInterface {
  static type = 'camera-ip';

  constructor(config) {
    super(config);
    
    // Camera connection settings
    this.host = config.host || '192.168.1.100';
    this.port = config.port || 80;
    this.username = config.username || 'admin';
    this.password = config.password || '';
    this.protocol = config.protocol || 'http'; // http, https, rtsp
    
    // Event listening settings
    this.eventPort = config.eventPort || 8000;
    this.eventServer = null;
    
    // Camera capabilities
    this.manufacturer = config.manufacturer || 'generic'; // hikvision, dahua, axis, generic
    
    // Event types to monitor
    this.eventTypes = config.eventTypes || [
      'motion',
      'dwelling',
      'lineCrossing',
      'intrusion',
      'faceDetection',
      'tamper',
      'abandoned',
      'missing'
    ];
    
    // Event filters
    this.motionSensitivity = config.motionSensitivity || 50; // 0-100
    this.dwellingTime = config.dwellingTime || 5; // seconds
    this.minConfidence = config.minConfidence || 70; // 0-100
  }

  async connect() {
    try {
      this.log(`Connecting to camera at ${this.host}:${this.port}`);
      
      // Test camera connection
      await this.testConnection();
      
      // Start event listener
      await this.startEventListener();
      
      // Subscribe to camera events
      await this.subscribeToEvents();
      
      this.setStatus('connected');
      this.stats.connected = Date.now();
      this.log('Connected to IP camera');
      
      return { success: true };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async disconnect() {
    if (this.eventServer) {
      await this.stopEventListener();
    }
    
    this.setStatus('disconnected');
    this.log('Disconnected from IP camera');
  }

  async testConnection() {
    // Test camera API connection
    return new Promise((resolve, reject) => {
      const options = {
        host: this.host,
        port: this.port,
        path: '/ISAPI/System/deviceInfo',
        method: 'GET',
        auth: `${this.username}:${this.password}`,
        timeout: 5000
      };
      
      const protocol = this.protocol === 'https' ? https : http;
      
      const req = protocol.request(options, (res) => {
        if (res.statusCode === 200 || res.statusCode === 401) {
          // 200 = success, 401 = auth required but camera is reachable
          resolve();
        } else {
          reject(new Error(`Camera returned status ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Connection timeout')));
      req.end();
    });
  }

  async startEventListener() {
    // Start HTTP server to receive camera event notifications
    return new Promise((resolve, reject) => {
      this.eventServer = http.createServer((req, res) => {
        this.handleEventRequest(req, res);
      });
      
      this.eventServer.listen(this.eventPort, () => {
        this.log(`Event listener started on port ${this.eventPort}`);
        resolve();
      });
      
      this.eventServer.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          this.log(`Port ${this.eventPort} already in use, trying next port`, 'warn');
          this.eventPort++;
          this.startEventListener().then(resolve).catch(reject);
        } else {
          reject(error);
        }
      });
    });
  }

  async stopEventListener() {
    if (this.eventServer) {
      return new Promise((resolve) => {
        this.eventServer.close(() => {
          this.log('Event listener stopped');
          resolve();
        });
      });
    }
  }

  async subscribeToEvents() {
    // Subscribe to camera events based on manufacturer
    switch (this.manufacturer.toLowerCase()) {
      case 'hikvision':
        return this.subscribeHikvision();
      case 'dahua':
        return this.subscribeDahua();
      case 'axis':
        return this.subscribeAxis();
      default:
        return this.subscribeGeneric();
    }
  }

  async subscribeHikvision() {
    // Hikvision event notification subscription
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <EventNotification>
        <eventType>VMD</eventType>
        <eventType>linedetection</eventType>
        <eventType>fielddetection</eventType>
        <eventType>tamperdetection</eventType>
        <eventType>facedetection</eventType>
        <notificationMethod>HTTP</notificationMethod>
        <httpAddress>http://${this.getLocalIP()}:${this.eventPort}/events</httpAddress>
      </EventNotification>`;
    
    await this.sendRequest('/ISAPI/Event/notification/httpHosts', 'POST', xml);
    this.log('Subscribed to Hikvision events');
  }

  async subscribeDahua() {
    // Dahua event subscription
    const config = {
      eventHandler: `http://${this.getLocalIP()}:${this.eventPort}/events`
    };
    
    await this.sendRequest('/cgi-bin/configManager.cgi?action=setConfig&Events', 'POST', JSON.stringify(config));
    this.log('Subscribed to Dahua events');
  }

  async subscribeAxis() {
    // Axis event subscription via VAPIX
    const params = {
      action: 'add',
      template: `http://${this.getLocalIP()}:${this.eventPort}/events`
    };
    
    await this.sendRequest('/axis-cgi/event.cgi', 'GET', null, params);
    this.log('Subscribed to Axis events');
  }

  async subscribeGeneric() {
    // Generic ONVIF event subscription
    this.log('Using generic event polling', 'warn');
    
    // Start polling for events
    this.pollInterval = setInterval(() => {
      this.pollEvents().catch(err => this.handleError(err));
    }, 2000); // Poll every 2 seconds
  }

  async pollEvents() {
    // Poll camera for motion/events (fallback method)
    const response = await this.sendRequest('/ISAPI/Event/notification/alertStream', 'GET');
    
    if (response) {
      this.parseEventData(response);
    }
  }

  handleEventRequest(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      res.writeHead(200);
      res.end('OK');
      
      // Parse and process event
      this.parseEventData(body);
    });
  }

  parseEventData(data) {
    this.stats.messagesReceived++;
    
    try {
      let event = null;
      
      // Try parsing as JSON
      if (data.trim().startsWith('{')) {
        event = this.parseJSONEvent(data);
      } 
      // Try parsing as XML
      else if (data.trim().startsWith('<')) {
        event = this.parseXMLEvent(data);
      }
      // Plain text format
      else {
        event = this.parseTextEvent(data);
      }
      
      if (event) {
        this.processEvent(event);
      }
    } catch (error) {
      this.log(`Error parsing event data: ${error.message}`, 'error');
    }
  }

  parseJSONEvent(data) {
    const json = JSON.parse(data);
    
    return {
      type: json.eventType || json.type || 'unknown',
      timestamp: json.timestamp || Date.now(),
      channel: json.channelID || json.channel || 1,
      confidence: json.confidence || 100,
      region: json.region || null,
      metadata: json
    };
  }

  parseXMLEvent(data) {
    // Simple XML parsing for common camera events
    const eventType = this.extractXMLValue(data, 'eventType');
    const channelID = this.extractXMLValue(data, 'channelID');
    const dateTime = this.extractXMLValue(data, 'dateTime');
    
    return {
      type: this.normalizeEventType(eventType),
      timestamp: dateTime ? new Date(dateTime).getTime() : Date.now(),
      channel: parseInt(channelID) || 1,
      confidence: 100,
      region: null,
      metadata: { raw: data }
    };
  }

  parseTextEvent(data) {
    // Parse simple text event format
    const lines = data.split('\n');
    const event = {
      type: 'unknown',
      timestamp: Date.now(),
      channel: 1,
      confidence: 100
    };
    
    for (const line of lines) {
      if (line.includes('Motion')) event.type = 'motion';
      if (line.includes('Dwelling')) event.type = 'dwelling';
      if (line.includes('LineCrossing')) event.type = 'lineCrossing';
      if (line.includes('Intrusion')) event.type = 'intrusion';
    }
    
    return event;
  }

  extractXMLValue(xml, tag) {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  normalizeEventType(type) {
    // Normalize different camera vendor event types to standard names
    const mapping = {
      'VMD': 'motion',
      'MD': 'motion',
      'MotionDetection': 'motion',
      'linedetection': 'lineCrossing',
      'LineCrossing': 'lineCrossing',
      'fielddetection': 'intrusion',
      'FieldDetection': 'intrusion',
      'IntrusionDetection': 'intrusion',
      'RegionEntrance': 'intrusion',
      'Loitering': 'dwelling',
      'dwelling': 'dwelling',
      'facedetection': 'faceDetection',
      'FaceDetection': 'faceDetection',
      'tamperdetection': 'tamper',
      'SceneChange': 'tamper',
      'abandoned': 'abandoned',
      'ObjectRemoval': 'missing'
    };
    
    return mapping[type] || type.toLowerCase();
  }

  processEvent(event) {
    // Filter events based on configuration
    if (!this.eventTypes.includes(event.type)) {
      this.log(`Ignoring event type: ${event.type}`, 'debug');
      return;
    }
    
    // Check confidence threshold
    if (event.confidence < this.minConfidence) {
      this.log(`Event confidence too low: ${event.confidence}%`, 'debug');
      return;
    }
    
    this.log(`Camera event: ${event.type} (confidence: ${event.confidence}%)`, 'info');
    
    // Enrich event data
    const enrichedEvent = {
      type: 'camera',
      eventType: event.type,
      camera: {
        host: this.host,
        name: this.config.name || this.host,
        channel: event.channel
      },
      confidence: event.confidence,
      region: event.region,
      timestamp: event.timestamp,
      metadata: event.metadata
    };
    
    // Emit event for flow nodes
    this.emit('data', enrichedEvent);
  }

  async sendRequest(path, method = 'GET', body = null, params = null) {
    return new Promise((resolve, reject) => {
      const protocol = this.protocol === 'https' ? https : http;
      
      let url = path;
      if (params) {
        const queryString = Object.entries(params)
          .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
          .join('&');
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
      
      const options = {
        host: this.host,
        port: this.port,
        path: url,
        method: method,
        auth: `${this.username}:${this.password}`,
        headers: {
          'Content-Type': body ? 'application/xml' : 'application/json'
        },
        timeout: 10000
      };
      
      const req = protocol.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      
      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  getLocalIP() {
    // Get local IP address for event callback
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    
    return '127.0.0.1';
  }

  async read(params) {
    const { command } = params;
    
    switch (command) {
      case 'status':
        return this.getCameraStatus();
      case 'snapshot':
        return this.getSnapshot();
      default:
        throw new Error(`Unknown read command: ${command}`);
    }
  }

  async write(params) {
    const { type, data } = params;
    
    switch (type) {
      case 'subscribe':
        return this.subscribeToEvents();
      case 'configure':
        return this.configureSensitivity(data);
      default:
        throw new Error(`Unknown write type: ${type}`);
    }
  }

  async getCameraStatus() {
    const response = await this.sendRequest('/ISAPI/System/status');
    return { status: 'online', data: response };
  }

  async getSnapshot() {
    const image = await this.sendRequest('/ISAPI/Streaming/channels/1/picture');
    return { image: Buffer.from(image).toString('base64') };
  }

  async configureSensitivity(data) {
    this.motionSensitivity = data.motionSensitivity || this.motionSensitivity;
    this.minConfidence = data.minConfidence || this.minConfidence;
    
    this.log(`Updated sensitivity settings: motion=${this.motionSensitivity}, confidence=${this.minConfidence}`);
    
    return { success: true };
  }

  async cleanup() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    await super.cleanup();
  }
}

module.exports = IPCameraInterface;
