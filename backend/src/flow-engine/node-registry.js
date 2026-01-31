const path = require('path');
const fs = require('fs');
const logger = require('../core/logger');

class NodeRegistry {
  constructor() {
    this.nodes = new Map(); // type -> NodeClass
  }

  async loadBuiltInNodes() {
    const nodesDir = path.join(__dirname, 'nodes');
    
    if (!fs.existsSync(nodesDir)) {
      logger.warn('Nodes directory not found, creating it');
      fs.mkdirSync(nodesDir, { recursive: true });
      return;
    }
    
    const categories = fs.readdirSync(nodesDir);
    
    for (const category of categories) {
      const categoryPath = path.join(nodesDir, category);
      
      if (!fs.statSync(categoryPath).isDirectory()) {
        continue;
      }
      
      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
      
      for (const file of files) {
        try {
          const nodePath = path.join(categoryPath, file);
          
          // Clear require cache to ensure fresh load
          delete require.cache[require.resolve(nodePath)];
          
          const NodeClass = require(nodePath);
          
          if (NodeClass && NodeClass.type) {
            this.registerNode(NodeClass.type, NodeClass);
            logger.debug(`Registered node type: ${NodeClass.type}`);
          }
        } catch (error) {
          logger.error(`Failed to load node from ${file}:`, error);
        }
      }
    }
  }

  registerNode(type, NodeClass) {
    if (this.nodes.has(type)) {
      logger.warn(`Node type ${type} already registered, overwriting`);
    }
    
    this.nodes.set(type, NodeClass);
  }

  hasNode(type) {
    return this.nodes.has(type);
  }

  getNode(type) {
    return this.nodes.get(type);
  }

  getNodeCount() {
    return this.nodes.size;
  }

  getNodeTypes() {
    return Array.from(this.nodes.keys());
  }

  createNodeInstance(type, config) {
    const NodeClass = this.nodes.get(type);
    
    if (!NodeClass) {
      throw new Error(`Unknown node type: ${type}`);
    }
    
    return new NodeClass(config);
  }
}

module.exports = NodeRegistry;
