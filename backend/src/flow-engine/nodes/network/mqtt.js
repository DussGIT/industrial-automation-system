const BaseNode = require('../base-node');

/**
 * MQTT In Node - Subscribe to MQTT topics
 */
class MQTTInNode extends BaseNode {
  static type = 'mqtt-in';

  constructor(config) {
    super(config);
    this.topic = this.config.topic;
    this.qos = this.config.qos || 0;
    this.handler = null;
  }

  async start() {
    if (!this.topic) {
      this.error(new Error('MQTT topic not configured'));
      return;
    }

    // Create message handler
    this.handler = (topic, message) => {
      this.send({
        topic,
        payload: message,
        qos: this.qos
      });
    };

    // Subscribe to topic
    this.mqttClient.subscribe(this.topic, this.handler);
    this.log(`Subscribed to MQTT topic: ${this.topic}`);
  }

  async stop() {
    if (this.handler && this.topic) {
      this.mqttClient.unsubscribe(this.topic, this.handler);
      this.log(`Unsubscribed from MQTT topic: ${this.topic}`);
    }
  }
}

/**
 * MQTT Out Node - Publish to MQTT topics
 */
class MQTTOutNode extends BaseNode {
  static type = 'mqtt-out';

  constructor(config) {
    super(config);
    this.topic = this.config.topic;
    this.qos = this.config.qos || 0;
    this.retain = this.config.retain || false;
  }

  async receive(data) {
    const topic = data.topic || this.topic;
    
    if (!topic) {
      this.error(new Error('No topic specified'));
      return;
    }

    const payload = data.payload !== undefined ? data.payload : data;

    try {
      await this.mqttClient.publish(topic, payload, {
        qos: this.qos,
        retain: this.retain
      });
      
      this.log(`Published to ${topic}`);
      this.send(data);
    } catch (error) {
      this.error(error);
    }
  }
}

module.exports = { MQTTInNode, MQTTOutNode };
