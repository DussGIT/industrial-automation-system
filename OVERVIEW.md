# 🏭 Industrial Automation System

Welcome to your comprehensive industrial automation platform! This system has been designed from the ground up to provide enterprise-grade automation capabilities with support for industrial communication protocols.

## 🚀 Quick Start

### Windows (PowerShell)
```powershell
# Run the setup script
.\setup.ps1

# Start the development server
.\start.ps1
```

### Manual Start
```bash
# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Start development
npm run dev
```

### Access the System
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

## 📋 What's Included

### ✅ Fully Implemented
- **Flow Engine** - Node-RED-inspired visual flow execution
- **REST API** - Complete backend API for flow and interface management
- **WebSocket Server** - Real-time flow monitoring and updates
- **React Frontend** - Modern UI with dashboard and flow management
- **Database** - SQLite with comprehensive schema for flows, logs, and analytics
- **MQTT Integration** - Internal messaging and external MQTT support
- **Logging System** - Winston-based logging with file and console output
- **Interface Architecture** - Plugin system for communication interfaces
- **Radio Interfaces** - Ritron DTX and Motorola DLR implementations
- **Docker Support** - Complete containerization for deployment
- **Documentation** - Getting started guides and API documentation

### 🔨 Node Types Available
- **Inject** - Trigger flows (manual, interval, scheduled)
- **Debug** - Output debugging information
- **Function** - Execute JavaScript transformations
- **MQTT In/Out** - Publish/subscribe to MQTT topics

### 📡 Communication Interfaces

#### Implemented (Stub/Framework)
- **Ritron DTX Radio** - Serial communication, PTT control, transmit/receive
- **Motorola DLR Radio** - Text messaging, GPS, emergency alerts

#### Defined (Ready for Implementation)
- **Zigbee** - Mesh networking for IoT devices
- **Bluetooth/BLE** - Wireless sensor connectivity
- **Modbus TCP/RTU** - Industrial PLC communication
- **OPC UA** - Modern industrial protocol
- **MQTT** - Lightweight messaging (fully functional)

## 📁 Project Structure

```
industrial-automation/
├── backend/                   # Node.js backend
│   ├── src/
│   │   ├── api/              # REST API routes
│   │   │   ├── flows.js      # Flow management
│   │   │   ├── analytics.js  # Analytics and logging
│   │   │   └── interfaces.js # Interface configuration
│   │   ├── core/             # Core services
│   │   │   ├── database.js   # SQLite database
│   │   │   ├── mqtt.js       # MQTT client
│   │   │   └── logger.js     # Winston logger
│   │   ├── flow-engine/      # Flow execution engine
│   │   │   ├── index.js      # FlowEngine class
│   │   │   ├── node-registry.js
│   │   │   ├── flow-runner.js
│   │   │   └── nodes/        # Flow node types
│   │   ├── interfaces/       # Communication interfaces
│   │   │   ├── base-interface.js
│   │   │   └── radio/        # Radio interfaces
│   │   └── index.js          # Main entry point
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   └── Layout.jsx
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Flows.jsx
│   │   │   ├── FlowEditor.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Interfaces.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/         # API client
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── deployment/               # Deployment configurations
│   └── docker/
│       └── mosquitto/
│           └── mosquitto.conf
│
├── docs/                     # Documentation
│   ├── GETTING_STARTED.md
│   └── INTERFACES.md
│
├── docker-compose.yml        # Docker orchestration
├── PROJECT_SUMMARY.md        # Detailed project summary
├── README.md                 # This file
├── setup.ps1                 # Windows setup script
└── start.ps1                 # Windows start script
```

## 🎯 Core Features

### Flow Engine
- Create visual automation workflows
- Deploy and manage multiple flows
- Start/stop flows independently
- Real-time execution monitoring
- Comprehensive logging of all executions

### Dashboard
- System status overview
- Active flow monitoring
- Execution statistics
- Error tracking

### Interfaces
- Plugin-based architecture
- Support for serial, network, and wireless protocols
- Easy configuration through UI
- Real-time status monitoring

### Analytics
- Flow execution logs
- Performance metrics
- System logs
- Exportable data

## 🛠️ Development

### Adding a New Node Type

1. Create node file in `backend/src/flow-engine/nodes/[category]/`
2. Extend `BaseNode` class
3. Implement `receive()` method
4. Node will be automatically registered

Example:
```javascript
const BaseNode = require('../base-node');

class MyCustomNode extends BaseNode {
  static type = 'my-custom';

  async receive(data) {
    // Process data
    const result = this.processData(data);
    
    // Send output
    this.send(result, data);
  }
}

module.exports = MyCustomNode;
```

### Adding a New Interface

1. Create interface file in `backend/src/interfaces/[category]/`
2. Extend `BaseInterface` class
3. Implement `connect()`, `disconnect()`, `read()`, `write()` methods
4. Register in interface registry

### API Endpoints

#### Flows
- `GET /api/flows` - List all flows
- `GET /api/flows/:id` - Get flow details
- `POST /api/flows` - Create/deploy flow
- `PUT /api/flows/:id` - Update flow
- `DELETE /api/flows/:id` - Delete flow
- `POST /api/flows/:id/start` - Start flow
- `POST /api/flows/:id/stop` - Stop flow
- `GET /api/flows/:id/status` - Get flow status

#### Analytics
- `GET /api/analytics/executions` - Get execution logs
- `GET /api/analytics/metrics` - Get metrics
- `GET /api/analytics/logs` - Get system logs
- `GET /api/analytics/flows/stats` - Get flow statistics

#### Interfaces
- `GET /api/interfaces` - List interfaces
- `GET /api/interfaces/:id` - Get interface
- `POST /api/interfaces` - Create interface
- `DELETE /api/interfaces/:id` - Delete interface
- `GET /api/interfaces/types` - Get available types

## 🐳 Docker Deployment

### Development
```bash
docker-compose up
```

### Production
```bash
docker-compose -f docker-compose.yml up -d
```

### Central Server Only
```bash
docker-compose --profile central up
```

## 📊 Database Schema

### Flows Table
- Flow definitions and configurations
- Version tracking
- Status (running/stopped)

### Flow Executions Table
- Complete execution history
- Input/output data
- Error tracking
- Duration metrics

### Interfaces Table
- Interface configurations
- Connection status

### Analytics Table
- Custom metrics
- Performance data
- Time-series analytics

### System Logs Table
- Application logs
- Error logs
- Debug information

## 🔒 Security Considerations

- API authentication (to be implemented)
- Role-based access control (planned)
- Secure serial port access
- Network protocol encryption support
- Audit logging

## 📦 Dependencies

### Backend
- express - Web framework
- socket.io - WebSocket support
- better-sqlite3 - Database
- mqtt - MQTT client
- winston - Logging
- serialport - Serial communication
- modbus-serial - Modbus protocol

### Frontend
- react - UI framework
- reactflow - Flow editor (to be integrated)
- socket.io-client - WebSocket client
- axios - HTTP client
- tailwindcss - Styling
- recharts - Charts and graphs

## 🎓 Learning Resources

- **Getting Started**: `docs/GETTING_STARTED.md`
- **Interfaces Guide**: `docs/INTERFACES.md`
- **Project Summary**: `PROJECT_SUMMARY.md`

## 🗺️ Roadmap

### Phase 1: Foundation (✅ Complete)
- [x] Backend architecture
- [x] Flow engine
- [x] Frontend UI structure
- [x] Database schema
- [x] Basic node types
- [x] Interface architecture

### Phase 2: Visual Editor (In Progress)
- [ ] ReactFlow integration
- [ ] Drag-and-drop node placement
- [ ] Connection management
- [ ] Real-time execution visualization
- [ ] Node configuration UI

### Phase 3: Protocols (Next)
- [ ] Modbus TCP/RTU implementation
- [ ] Zigbee integration
- [ ] Bluetooth/BLE support
- [ ] OPC UA client

### Phase 4: Analytics (Planned)
- [ ] Advanced dashboards
- [ ] Data visualization
- [ ] Trend analysis
- [ ] Export functionality

### Phase 5: Central Server (Planned)
- [ ] Multi-site aggregation
- [ ] Central analytics
- [ ] Fleet management
- [ ] Remote configuration

### Phase 6: AI Features (Future)
- [ ] Natural language flow creation
- [ ] Predictive maintenance
- [ ] Anomaly detection
- [ ] Automated optimization

## 🤝 Support

For questions or issues, refer to the documentation in the `docs/` directory.

## 📝 License

To be determined

---

**Built with ❤️ for industrial automation**
