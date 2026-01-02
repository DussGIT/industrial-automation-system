FROM node:20-slim

WORKDIR /app

# Install build dependencies for native modules and libgpiod
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libgpiod-dev \
    gpiod \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (include all for native modules)
RUN npm install

# Copy source code
COPY src ./src

# Create directories for data and logs
RUN mkdir -p /data /logs

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "src/index.js"]
