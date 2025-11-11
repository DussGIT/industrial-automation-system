const express = require('express');
const router = express.Router();
const flowsApi = require('./flows');
const analyticsApi = require('./analytics');
const interfacesApi = require('./interfaces');

// Mount route modules
router.use('/', flowsApi.router);
router.use('/', analyticsApi.router);
router.use('/', interfacesApi.router);

// API info
router.get('/', (req, res) => {
  res.json({
    name: 'Industrial Automation API',
    version: '0.1.0',
    endpoints: {
      flows: '/api/flows',
      analytics: '/api/analytics',
      interfaces: '/api/interfaces',
      health: '/health'
    }
  });
});

module.exports = router;
module.exports.initializeFlowsApi = flowsApi.initialize;
