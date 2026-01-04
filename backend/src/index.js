const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./core/logger');
const database = require('./core/database');
const mqttClient = require('./core/mqtt');
const { getXBeeManager } = require('./core/xbee-manager');
const { getBluetoothManager } = require('./core/bluetooth-manager');
const FlowEngine = require('./flow-engine');
const apiRoutes = require('./api');
const { initializeFlowsApi } = require('./api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy
app.set('trust proxy', 1);

// Rate limiting disabled for internal system
// const limiter = rateLimit({
//   windowMs: 1 * 60 * 1000,
//   max: 500,
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/', limiter);

// API Routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Industrial Automation System',
    version: '0.1.0',
    status: 'running',
    endpoints: {
      api: '/api',
      health: '/health',
      flows: '/api/flows',
      analytics: '/api/analytics',
      interfaces: '/api/interfaces'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    site: {
      id: process.env.SITE_ID,
      name: process.env.SITE_NAME
    }
  });
});

// Initialize components
let flowEngine;

async function initialize() {
  try {
    logger.info('Starting Industrial Automation Backend...');
    
    // Initialize database
    await database.initialize();
    logger.info('Database initialized');
    
    // Initialize GPIO Manager
    const { getGPIOManager } = require('./core/gpio-manager');
    const gpioManager = getGPIOManager();
    await gpioManager.initialize();
    logger.info('GPIO Manager initialized');
    
    // Initialize settings table
    const { initializeSettingsTable } = require('./api/settings');
    initializeSettingsTable();
    
    // Get settings from database
    const db = database.getDb();
    const xbeePortSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('xbee.port');
    const xbeeBaudSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('xbee.baudRate');
    const xbeePort = xbeePortSetting ? xbeePortSetting.value : '/dev/ttyUSB5';
    const xbeeBaudRate = xbeeBaudSetting ? parseInt(xbeeBaudSetting.value) : 9600;
    
    // Initialize MQTT client
    await mqttClient.connect();
    logger.info('MQTT client connected');
    
    // Initialize XBee Manager
    const xbeeManager = getXBeeManager();
    const xbeeConnected = await xbeeManager.initialize(xbeePort, xbeeBaudRate);
    if (xbeeConnected) {
      logger.info('XBee Manager initialized');
    } else {
      logger.warn('XBee Manager started without serial connection');
    }
    
    // Initialize Bluetooth Manager
    const bluetoothManager = getBluetoothManager();
    await bluetoothManager.initialize();
    logger.info('Bluetooth Manager initialized');
    
    // Initialize Flow Engine
    flowEngine = new FlowEngine(io, mqttClient);
    await flowEngine.initialize();
    logger.info('Flow Engine initialized');
    
    // Initialize API with flow engine
    initializeFlowsApi(flowEngine);
    
    // WebSocket connection handling
    io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
      
      // Flow control events
      socket.on('flow:deploy', async (flow) => {
        try {
          await flowEngine.deployFlow(flow);
          socket.emit('flow:deployed', { success: true });
        } catch (error) {
          logger.error('Error deploying flow:', error);
          socket.emit('flow:error', { error: error.message });
        }
      });
      
      socket.on('flow:start', async (flowId) => {
        try {
          await flowEngine.startFlow(flowId);
          socket.emit('flow:started', { flowId });
        } catch (error) {
          logger.error('Error starting flow:', error);
          socket.emit('flow:error', { error: error.message });
        }
      });
      
      socket.on('flow:stop', async (flowId) => {
        try {
          await flowEngine.stopFlow(flowId);
          socket.emit('flow:stopped', { flowId });
        } catch (error) {
          logger.error('Error stopping flow:', error);
          socket.emit('flow:error', { error: error.message });
        }
      });
    });
    
    // Broadcast XBee events to all connected clients
    xbeeManager.on('data', (packet) => {
      io.emit('xbee:data', {
        timestamp: packet.timestamp || new Date().toISOString(),
        address64: packet.address64,
        address16: packet.address16,
        data: packet.data,
        payload: packet.payload,
        rssi: packet.rssi
      });
    });
    
    xbeeManager.on('device-discovered', (device) => {
      io.emit('xbee:device-discovered', device);
    });
    
    xbeeManager.on('transmit-status', (status) => {
      io.emit('xbee:transmit-status', status);
    });
    
    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`WebSocket server ready`);
    });
    
  } catch (error) {
    logger.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  if (flowEngine) {
    await flowEngine.shutdown();
  }
  
  await mqttClient.disconnect();
  await database.close();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.emit('SIGTERM');
});

// Start the application
initialize();

module.exports = { app, server, io };
