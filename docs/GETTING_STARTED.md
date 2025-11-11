# Getting Started

This guide will help you set up and run the Industrial Automation System.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+ (for future protocol integrations)
- Docker and Docker Compose (for production deployment)
- Git

## Development Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Configure Environment

```bash
# Copy environment template
cd backend
cp .env.example .env

# Edit .env with your settings
# Default values should work for local development
```

### 3. Start Services

#### Option A: Start All Services Together (Recommended for Development)

```bash
# From project root
npm run dev
```

This will start:
- Backend API server on http://localhost:3000
- Frontend dev server on http://localhost:5173

#### Option B: Start Services Separately

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

#### Option C: Using Docker (Production-like)

```bash
# Start local services (backend, frontend, MQTT)
docker-compose up

# Or start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Access the Application

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

## Creating Your First Flow

1. Navigate to http://localhost:5173
2. Click on "Flows" in the sidebar
3. Click "Create Flow"
4. Use the visual editor to create your automation workflow
5. Deploy and start your flow

## Project Structure

```
industrial-automation/
├── backend/               # Node.js backend
│   ├── src/
│   │   ├── api/          # REST API routes
│   │   ├── core/         # Core services (database, MQTT, logging)
│   │   └── flow-engine/  # Flow execution engine
│   └── package.json
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   └── services/     # API client
│   └── package.json
└── docker-compose.yml    # Docker orchestration
```

## Available Scripts

### Root Level
- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build both backend and frontend for production
- `npm test` - Run tests for both projects

### Backend
- `npm run dev` - Start backend with hot reload
- `npm start` - Start backend in production mode
- `npm test` - Run backend tests

### Frontend
- `npm run dev` - Start frontend dev server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build

## Troubleshooting

### Port Already in Use

If ports 3000 or 5173 are already in use:

```bash
# Find and kill the process using the port (Windows PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Or change the port in .env (backend) or vite.config.js (frontend)
```

### Database Issues

```bash
# Delete and recreate database
cd backend
rm -rf data/
# Restart backend - it will create a new database
```

### MQTT Connection Issues

Make sure MQTT broker is running:

```bash
# Start MQTT broker with Docker
docker-compose up mqtt
```

## Next Steps

- [ ] Create your first automation flow
- [ ] Configure communication interfaces
- [ ] Explore analytics and logging
- [ ] Set up remote log shipping to central server
- [ ] Deploy to UP Board for production use

## Support

For issues and questions, please refer to the main README.md or create an issue in the repository.
