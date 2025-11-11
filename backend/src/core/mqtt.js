const mqtt = require('mqtt');
const logger = require('./logger');

class MQTTClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const brokerUrl = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
      const clientId = process.env.MQTT_CLIENT_ID || `ia-backend-${Math.random().toString(16).substr(2, 8)}`;
      
      logger.info(`Connecting to MQTT broker: ${brokerUrl}`);
      
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 0, // Disable automatic reconnection
      });
      
      // Timeout for initial connection
      const timeout = setTimeout(() => {
        logger.warn('MQTT connection timeout - continuing without MQTT');
        this.connected = false;
        resolve(); // Resolve anyway to allow app to continue
      }, 5000);
      
      this.client.on('connect', () => {
        clearTimeout(timeout);
        logger.info('MQTT client connected');
        this.connected = true;
        resolve();
      });
      
      this.client.on('error', (error) => {
        logger.error('MQTT connection error:', error.message);
        if (!this.connected) {
          clearTimeout(timeout);
          logger.warn('MQTT unavailable - continuing without MQTT support');
          resolve(); // Don't reject, just continue
        }
      });
      
      this.client.on('reconnect', () => {
        logger.info('MQTT client reconnecting...');
      });
      
      this.client.on('close', () => {
        logger.info('MQTT client disconnected');
        this.connected = false;
      });
      
      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });
    });
  }

  handleMessage(topic, message) {
    const handlers = this.subscriptions.get(topic);
    if (handlers) {
      const payload = message.toString();
      let data;
      
      try {
        data = JSON.parse(payload);
      } catch (e) {
        data = payload;
      }
      
      handlers.forEach(handler => {
        try {
          handler(topic, data);
        } catch (error) {
          logger.error(`Error in MQTT message handler for topic ${topic}:`, error);
        }
      });
    }
  }

  subscribe(topic, handler) {
    if (!this.connected) {
      logger.warn('Cannot subscribe - MQTT client not connected');
      return;
    }
    
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, []);
      this.client.subscribe(topic, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to topic ${topic}:`, err);
        } else {
          logger.info(`Subscribed to MQTT topic: ${topic}`);
        }
      });
    }
    
    this.subscriptions.get(topic).push(handler);
  }

  unsubscribe(topic, handler) {
    const handlers = this.subscriptions.get(topic);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      
      if (handlers.length === 0) {
        this.subscriptions.delete(topic);
        this.client.unsubscribe(topic);
        logger.info(`Unsubscribed from MQTT topic: ${topic}`);
      }
    }
  }

  publish(topic, message, options = {}) {
    if (!this.connected) {
      logger.warn('Cannot publish - MQTT client not connected');
      return Promise.reject(new Error('MQTT client not connected'));
    }
    
    return new Promise((resolve, reject) => {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      
      this.client.publish(topic, payload, options, (err) => {
        if (err) {
          logger.error(`Failed to publish to topic ${topic}:`, err);
          reject(err);
        } else {
          logger.debug(`Published to MQTT topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async disconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(false, () => {
          logger.info('MQTT client disconnected');
          this.connected = false;
          resolve();
        });
      });
    }
  }
}

// Singleton instance
const mqttClient = new MQTTClient();

module.exports = mqttClient;
