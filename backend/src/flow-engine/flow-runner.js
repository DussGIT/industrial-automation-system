const logger = require('../core/logger');
const { getDb } = require('../core/database');

class FlowRunner {
  constructor(flowId, flowConfig, nodeRegistry, mqttClient, io) {
    this.flowId = flowId;
    this.flowConfig = flowConfig;
    this.nodeRegistry = nodeRegistry;
    this.mqttClient = mqttClient;
    this.io = io;
    
    this.nodes = new Map(); // nodeId -> node instance
    this.running = false;
    this.stats = {
      startTime: null,
      executionCount: 0,
      errorCount: 0,
      lastExecution: null
    };
  }

  async start() {
    try {
      logger.info(`Starting flow: ${this.flowConfig.name}`);
      
      // Create node instances
      for (const nodeConfig of this.flowConfig.nodes) {
        const nodeInstance = this.nodeRegistry.createNodeInstance(
          nodeConfig.type,
          nodeConfig
        );
        
        // Set up node event handlers
        nodeInstance.on('output', (data) => {
          this.handleNodeOutput(nodeConfig.id, data);
        });
        
        nodeInstance.on('error', (error) => {
          this.handleNodeError(nodeConfig.id, error);
        });
        
        // Initialize the node
        await nodeInstance.initialize(this.mqttClient, this.io);
        
        this.nodes.set(nodeConfig.id, nodeInstance);
      }
      
      // Start all nodes
      for (const [nodeId, node] of this.nodes) {
        await node.start();
      }
      
      this.running = true;
      this.stats.startTime = Date.now();
      
      logger.info(`Flow started: ${this.flowConfig.name} with ${this.nodes.size} nodes`);
    } catch (error) {
      logger.error(`Error starting flow ${this.flowId}:`, error);
      await this.cleanup();
      throw error;
    }
  }

  async stop() {
    try {
      logger.info(`Stopping flow: ${this.flowConfig.name}`);
      
      this.running = false;
      
      // Stop all nodes
      for (const [nodeId, node] of this.nodes) {
        try {
          await node.stop();
        } catch (error) {
          logger.error(`Error stopping node ${nodeId}:`, error);
        }
      }
      
      await this.cleanup();
      
      logger.info(`Flow stopped: ${this.flowConfig.name}`);
    } catch (error) {
      logger.error(`Error stopping flow ${this.flowId}:`, error);
      throw error;
    }
  }

  async cleanup() {
    // Clean up node instances
    for (const [nodeId, node] of this.nodes) {
      try {
        if (node.cleanup) {
          await node.cleanup();
        }
      } catch (error) {
        logger.error(`Error cleaning up node ${nodeId}:`, error);
      }
    }
    
    this.nodes.clear();
  }

  handleNodeOutput(nodeId, data) {
    this.stats.executionCount++;
    this.stats.lastExecution = Date.now();
    
    // Log execution
    this.logExecution(nodeId, 'success', data.input, data.output);
    
    // Emit to connected clients
    this.io.emit('flow:node-output', {
      flowId: this.flowId,
      nodeId,
      data: data.output,
      timestamp: Date.now()
    });
    
    // Find connected nodes and trigger them
    this.triggerConnectedNodes(nodeId, data.output);
  }

  handleNodeError(nodeId, error) {
    this.stats.errorCount++;
    
    logger.error(`Node ${nodeId} error in flow ${this.flowId}:`, error);
    
    // Log error
    this.logExecution(nodeId, 'error', null, null, error.message);
    
    // Emit to connected clients
    this.io.emit('flow:node-error', {
      flowId: this.flowId,
      nodeId,
      error: error.message,
      timestamp: Date.now()
    });
  }

  triggerConnectedNodes(sourceNodeId, data) {
    // Find wires connected to this node
    const connections = this.flowConfig.wires || [];
    
    for (const wire of connections) {
      if (wire.source === sourceNodeId) {
        const targetNode = this.nodes.get(wire.target);
        
        if (targetNode && targetNode.receive) {
          try {
            targetNode.receive(data, wire.sourcePort, wire.targetPort);
          } catch (error) {
            logger.error(`Error triggering node ${wire.target}:`, error);
            this.handleNodeError(wire.target, error);
          }
        }
      }
    }
  }

  logExecution(nodeId, status, input, output, error = null) {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO flow_executions (flow_id, node_id, status, input_data, output_data, error)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        this.flowId,
        nodeId,
        status,
        input ? JSON.stringify(input) : null,
        output ? JSON.stringify(output) : null,
        error
      );
    } catch (err) {
      logger.error('Error logging flow execution:', err);
    }
  }

  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
      nodeCount: this.nodes.size
    };
  }
}

module.exports = FlowRunner;
