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
    if (!flowData.name || flowData.name.trim() === '') {
      throw new Error('Flow name is required');
    }
    
    if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
      throw new Error('Flow must have a nodes array');
    }
    
    // Allow empty flows to be saved
    if (flowData.nodes.length === 0) {
      logger.warn('Saving flow with no nodes');
      return true;
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
        throw new Error(`Unknown node type: ${node.type}. Available types: ${this.nodeRegistry.getNodeTypes().join(', ')}`);
      }
      
      // Validate GPIO nodes have required pin configuration
      if ((node.type === 'gpio-in' || node.type === 'gpio-out') && node.config) {
        if (!node.config.pin && !node.config.pinName) {
          logger.warn(`GPIO node ${node.id} has no pin configured - will fail at runtime`);
        }
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
      
      // Delete from database - delete related records first to avoid foreign key constraint
      // Delete flow executions
      const deleteExecutions = this.db.prepare('DELETE FROM flow_executions WHERE flow_id = ?');
      deleteExecutions.run(flowId);
      
      // Delete the flow itself
      const deleteFlow = this.db.prepare('DELETE FROM flows WHERE id = ?');
      deleteFlow.run(flowId);
      
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
      const flowConfig = JSON.parse(row.config);
      // Return the flow data in the format expected by frontend
      return {
        id: row.id,
        name: row.name || flowConfig.name,
        description: row.description || flowConfig.description,
        nodes: flowConfig.nodes || [],
        edges: flowConfig.edges || [],
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    }
    
    return null;
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

  async triggerNode(flowId, nodeId) {
    try {
      // Get flow config
      const flow = this.getFlow(flowId);
      if (!flow) {
        throw new Error(`Flow not found: ${flowId}`);
      }

      // Find the node
      const node = flow.nodes.find(n => n.id === nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // If flow is not running, start it temporarily
      let flowRunner = this.activeFlows.get(flowId);
      const wasRunning = !!flowRunner;

      if (!wasRunning) {
        flowRunner = new FlowRunner(
          flowId,
          { name: flow.name, nodes: flow.nodes, edges: flow.edges },
          this.nodeRegistry,
          this.mqttClient,
          this.io
        );
        await flowRunner.start();
      }

      // Trigger the node
      const result = await flowRunner.triggerNode(nodeId);

      // If we started the flow for this trigger, stop it after a delay
      if (!wasRunning) {
        setTimeout(async () => {
          await flowRunner.stop();
        }, 1000);
      }

      logger.info(`Node triggered: ${nodeId} in flow ${flowId}`);
      
      return result;
    } catch (error) {
      logger.error(`Error triggering node ${nodeId} in flow ${flowId}:`, error);
      throw error;
    }
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
