const { v4: uuidv4 } = require('uuid');
const logger = require('../core/logger');
const { getDb } = require('../core/database');
const NodeRegistry = require('./node-registry');
const FlowRunner = require('./flow-runner');

class FlowEngine {
  constructor(io, mqttClient) {
    this.io = io;
    this.mqttClient = mqttClient;
    this.nodeRegistry = new NodeRegistry();
    this.activeFlows = new Map(); // flowId -> FlowRunner
    this.db = null;
  }

  async initialize() {
    try {
      this.db = getDb();
      
      // Load built-in nodes
      await this.nodeRegistry.loadBuiltInNodes();
      logger.info(`Loaded ${this.nodeRegistry.getNodeCount()} node types`);
      
      // Load and start auto-start flows
      await this.loadSavedFlows();
      
      logger.info('Flow Engine initialized');
    } catch (error) {
      logger.error('Failed to initialize Flow Engine:', error);
      throw error;
    }
  }

  async loadSavedFlows() {
    const stmt = this.db.prepare('SELECT * FROM flows WHERE status = ?');
    const flows = stmt.all('running');
    
    for (const flow of flows) {
      try {
        const flowConfig = JSON.parse(flow.config);
        await this.startFlow(flow.id, flowConfig);
        logger.info(`Auto-started flow: ${flow.name} (${flow.id})`);
      } catch (error) {
        logger.error(`Failed to auto-start flow ${flow.id}:`, error);
      }
    }
  }

  async deployFlow(flowData) {
    const flowId = flowData.id || uuidv4();
    const now = Math.floor(Date.now() / 1000);
    
    try {
      // Validate flow configuration
      this.validateFlow(flowData);
      
      // Stop existing flow if running
      if (this.activeFlows.has(flowId)) {
        await this.stopFlow(flowId);
      }
      
      // Save to database
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO flows (id, name, description, config, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        flowId,
        flowData.name,
        flowData.description || '',
        JSON.stringify(flowData),
        'stopped',
        now
      );
      
      logger.info(`Flow deployed: ${flowData.name} (${flowId})`);
      
      // Emit event
      this.io.emit('flow:deployed', { flowId, name: flowData.name });
      
      return { flowId, success: true };
    } catch (error) {
      logger.error('Error deploying flow:', error);
      throw error;
    }
  }

  validateFlow(flowData) {
    if (!flowData.name) {
      throw new Error('Flow name is required');
    }
    
    if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
      throw new Error('Flow must have a nodes array');
    }
    
    // Validate each node
    for (const node of flowData.nodes) {
      if (!node.id) {
        throw new Error('Node must have an id');
      }
      
      if (!node.type) {
        throw new Error(`Node ${node.id} must have a type`);
      }
      
      if (!this.nodeRegistry.hasNode(node.type)) {
        throw new Error(`Unknown node type: ${node.type}`);
      }
    }
    
    return true;
  }

  async startFlow(flowId, flowConfig = null) {
    try {
      // If config not provided, load from database
      if (!flowConfig) {
        const stmt = this.db.prepare('SELECT config FROM flows WHERE id = ?');
        const row = stmt.get(flowId);
        
        if (!row) {
          throw new Error(`Flow not found: ${flowId}`);
        }
        
        flowConfig = JSON.parse(row.config);
      }
      
      // Create and start flow runner
      const flowRunner = new FlowRunner(
        flowId,
        flowConfig,
        this.nodeRegistry,
        this.mqttClient,
        this.io
      );
      
      await flowRunner.start();
      this.activeFlows.set(flowId, flowRunner);
      
      // Update status in database
      const stmt = this.db.prepare('UPDATE flows SET status = ? WHERE id = ?');
      stmt.run('running', flowId);
      
      logger.info(`Flow started: ${flowConfig.name} (${flowId})`);
      this.io.emit('flow:started', { flowId, name: flowConfig.name });
      
      return { success: true };
    } catch (error) {
      logger.error(`Error starting flow ${flowId}:`, error);
      throw error;
    }
  }

  async stopFlow(flowId) {
    try {
      const flowRunner = this.activeFlows.get(flowId);
      
      if (!flowRunner) {
        logger.warn(`Flow ${flowId} is not running`);
        return { success: true, message: 'Flow not running' };
      }
      
      await flowRunner.stop();
      this.activeFlows.delete(flowId);
      
      // Update status in database
      const stmt = this.db.prepare('UPDATE flows SET status = ? WHERE id = ?');
      stmt.run('stopped', flowId);
      
      logger.info(`Flow stopped: ${flowId}`);
      this.io.emit('flow:stopped', { flowId });
      
      return { success: true };
    } catch (error) {
      logger.error(`Error stopping flow ${flowId}:`, error);
      throw error;
    }
  }

  async deleteFlow(flowId) {
    try {
      // Stop if running
      if (this.activeFlows.has(flowId)) {
        await this.stopFlow(flowId);
      }
      
      // Delete from database
      const stmt = this.db.prepare('DELETE FROM flows WHERE id = ?');
      stmt.run(flowId);
      
      logger.info(`Flow deleted: ${flowId}`);
      this.io.emit('flow:deleted', { flowId });
      
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting flow ${flowId}:`, error);
      throw error;
    }
  }

  getFlows() {
    const stmt = this.db.prepare('SELECT id, name, description, status, created_at, updated_at FROM flows');
    return stmt.all();
  }

  getFlow(flowId) {
    const stmt = this.db.prepare('SELECT * FROM flows WHERE id = ?');
    const row = stmt.get(flowId);
    
    if (row) {
      row.config = JSON.parse(row.config);
    }
    
    return row;
  }

  getFlowStatus(flowId) {
    const flowRunner = this.activeFlows.get(flowId);
    
    if (!flowRunner) {
      return { running: false };
    }
    
    return {
      running: true,
      stats: flowRunner.getStats()
    };
  }

  async shutdown() {
    logger.info('Shutting down Flow Engine...');
    
    // Stop all active flows
    const stopPromises = Array.from(this.activeFlows.keys()).map(flowId =>
      this.stopFlow(flowId).catch(err => logger.error(`Error stopping flow ${flowId}:`, err))
    );
    
    await Promise.all(stopPromises);
    
    logger.info('Flow Engine shutdown complete');
  }
}

module.exports = FlowEngine;
