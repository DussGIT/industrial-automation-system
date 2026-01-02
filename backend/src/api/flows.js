const express = require('express');
const router = express.Router();
const FlowEngine = require('../flow-engine');

let flowEngine;

// Initialize with flow engine instance
const initialize = (engineInstance) => {
  flowEngine = engineInstance;
};

// Get all flows
router.get('/flows', (req, res) => {
  try {
    const flows = flowEngine.getFlows();
    res.json({ success: true, flows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single flow
router.get('/flows/:id', (req, res) => {
  try {
    const flow = flowEngine.getFlow(req.params.id);
    
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }
    
    res.json({ success: true, flow });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deploy flow
router.post('/flows', async (req, res) => {
  try {
    const result = await flowEngine.deployFlow(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update flow
router.put('/flows/:id', async (req, res) => {
  try {
    const flowData = { ...req.body, id: req.params.id };
    const result = await flowEngine.deployFlow(flowData);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete flow
router.delete('/flows/:id', async (req, res) => {
  try {
    await flowEngine.deleteFlow(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start flow
router.post('/flows/:id/start', async (req, res) => {
  try {
    await flowEngine.startFlow(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop flow
router.post('/flows/:id/stop', async (req, res) => {
  try {
    await flowEngine.stopFlow(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger a specific node manually
router.post('/flows/:id/trigger/:nodeId', async (req, res) => {
  try {
    const result = await flowEngine.triggerNode(req.params.id, req.params.nodeId);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get flow status
router.get('/flows/:id/status', (req, res) => {
  try {
    const status = flowEngine.getFlowStatus(req.params.id);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available node types
router.get('/nodes', (req, res) => {
  try {
    const nodeTypes = flowEngine.nodeRegistry.getNodeTypes();
    res.json({ success: true, nodeTypes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, initialize };
