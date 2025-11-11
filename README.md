# Industrial Automation System

A comprehensive industrial automation platform with visual flow creation, multi-site analytics, and support for industrial communication protocols including radio systems (Ritron DTX, Motorola DLR), Zigbee, Bluetooth, and network interfaces.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Central Analytics Server                  │
│  - PostgreSQL Database                                       │
│  - Grafana Dashboards                                        │
│  - Multi-site Log Aggregation                               │
│  - Activity Monitoring                                       │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS/MQTT
                              │
        ┌─────────────────────┴─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│  Site 1 (UP)   │   │  Site 2 (UP)    │   │  Site N (UP)   │
│  Board         │   │  Board          │   │  Board         │
├────────────────┤   ├─────────────────┤   ├────────────────┤
│ - Flow Engine  │   │ - Flow Engine   │   │ - Flow Engine  │
│ - Web GUI      │   │ - Web GUI       │   │ - Web GUI      │
│ - Interfaces   │   │ - Interfaces    │   │ - Interfaces   │
│ - Local DB     │   │ - Local DB      │   │ - Local DB     │
│ - Analytics    │   │ - Analytics     │   │ - Analytics    │
└────────────────┘   └─────────────────┘   └────────────────┘
```

## Features

### Core Capabilities
- **Visual Flow Editor**: Drag-and-drop interface for creating automation workflows
- **AI-Assisted Flow Creation**: Natural language to automation flow conversion (future)
- **Multi-Site Management**: Central aggregation and monitoring of multiple locations
- **Real-time Analytics**: Local and central analytics with dashboards
- **Comprehensive Logging**: Full flow execution tracking and outcome analysis

### Communication Interfaces
- **Radio Systems**:
  - Ritron DTX
  - Motorola DLR
- **Wireless Protocols**:
  - Zigbee
  - Bluetooth/BLE
- **Network Protocols**:
  - TCP/IP
  - Modbus TCP/RTU
  - MQTT
  - OPC UA
  - REST APIs

### Target Platform
- **Hardware**: UP Boards (Intel-based SBCs)
- **OS**: Ubuntu Linux
- **Deployment**: Docker containers with systemd services

## Project Structure

```
industrial-automation/
├── backend/                    # Core backend services
│   ├── flow-engine/           # Flow execution engine
│   ├── api/                   # REST API server
│   ├── interfaces/            # Communication interface plugins
│   │   ├── radio/            # Ritron DTX, Motorola DLR
│   │   ├── zigbee/           # Zigbee support
│   │   ├── bluetooth/        # Bluetooth/BLE
│   │   └── network/          # TCP/IP, Modbus, MQTT, OPC UA
│   ├── logging/              # Logging and analytics
│   └── core/                 # Shared utilities
├── frontend/                  # Web-based GUI
│   ├── flow-editor/          # Visual flow creation interface
│   ├── dashboard/            # Monitoring and analytics UI
│   └── config/               # Interface configuration UI
├── central-server/            # Central analytics server
│   ├── aggregator/           # Log aggregation service
│   ├── database/             # PostgreSQL schemas
│   └── dashboards/           # Grafana configurations
├── deployment/                # Deployment configurations
│   ├── docker/               # Docker configurations
│   ├── systemd/              # Systemd service files
│   └── install/              # Installation scripts
└── docs/                      # Documentation
```

## Technology Stack

### Local Node (UP Board)
- **Runtime**: Node.js 20+ (Flow Engine) + Python 3.11+ (Industrial Protocols)
- **Web Server**: Express.js
- **Real-time**: WebSocket (Socket.io)
- **Message Bus**: MQTT (Mosquitto)
- **Local Database**: SQLite + DuckDB for analytics
- **Frontend**: React 18 + ReactFlow
- **Containerization**: Docker

### Central Server
- **Database**: PostgreSQL 15+ with TimescaleDB
- **Analytics**: Grafana + custom dashboards
- **Message Queue**: MQTT broker
- **API**: FastAPI (Python) or Express.js
- **Log Shipping**: Vector or Fluentd

## Development Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Ubuntu 22.04+ (for UP Board testing)

### Quick Start
```bash
# Install dependencies
npm install
cd backend && pip install -r requirements.txt

# Run in development mode
npm run dev

# Build for production
npm run build

# Deploy to UP Board
./deployment/install/deploy.sh
```

## License

TBD

## Contributing

TBD
