const express = require('express');
const router = express.Router();
const flowsApi = require('./flows');
const analyticsApi = require('./analytics');
const interfacesApi = require('./interfaces');
const audioApi = require('./audio');
const radioApi = require('./radio');
const xbeeApi = require('./xbee');
const bluetoothApi = require('./bluetooth');
const settingsApi = require('./settings');
const devicesApi = require('./devices');
const gpioApi = require('./gpio');
const systemApi = require('./system');

// Mount route modules
router.use('/', flowsApi.router);
router.use('/', analyticsApi.router);
router.use('/', interfacesApi.router);
router.use('/', audioApi.router);
router.use('/radio', radioApi);
router.use('/', xbeeApi);
router.use('/', bluetoothApi);
router.use('/settings', settingsApi);
router.use('/', devicesApi);
router.use('/gpio', gpioApi);
router.use('/system', systemApi);

// API info
router.get('/', (req, res) => {
  res.json({
    name: 'Industrial Automation API',
    version: '0.1.0',
    endpoints: {
      flows: '/api/flows',
      analytics: '/api/analytics',
      interfaces: '/api/interfaces',
      audio: '/api/audio',
      radio: '/api/radio',
      xbee: '/api/xbee',
      bluetooth: '/api/bluetooth',
      settings: '/api/settings',
      devices: '/api/devices',
      system: '/api/system',
      health: '/health'
    }
  });
});

module.exports = router;
module.exports.initializeFlowsApi = flowsApi.initialize;
