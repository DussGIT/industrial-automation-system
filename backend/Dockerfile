FROM node:20-slim

WORKDIR /app

# Install build dependencies for native modules and libgpiod
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libgpiod-dev \
    gpiod \
    alsa-utils \
    pulseaudio-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Piper TTS
RUN wget -O /tmp/piper.tar.gz https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz \
    && mkdir -p /opt/piper \
    && tar -xzf /tmp/piper.tar.gz -C /opt/piper \
    && ln -s /opt/piper/piper/piper /usr/local/bin/piper \
    && chmod +x /opt/piper/piper/piper \
    && rm -rf /tmp/piper.tar.gz

# Download default voice model
RUN mkdir -p /usr/local/share/piper/models \
    && cd /usr/local/share/piper/models \
    && wget https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-lessac-medium.tar.gz \
    && tar -xzf voice-en-us-lessac-medium.tar.gz \
    && rm voice-en-us-lessac-medium.tar.gz \
    && mv en-us-lessac-medium.onnx en_US-lessac-medium.onnx \
    && mv en-us-lessac-medium.onnx.json en_US-lessac-medium.onnx.json

# Set library path for piper
ENV LD_LIBRARY_PATH=/opt/piper/piper:$LD_LIBRARY_PATH

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
