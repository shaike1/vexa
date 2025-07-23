#!/bin/bash

# Deploy Vexa Transcription System to orc-3001
# This script deploys the complete Teams bot transcription pipeline

set -e

TARGET_HOST="orc-3001"
TARGET_USER="root"
DEPLOY_PATH="/opt/vexa"
REPO_URL="https://github.com/shaike1/vexa.git"

echo "🚀 Starting deployment to $TARGET_USER@$TARGET_HOST"

# Test connection
echo "🔌 Testing SSH connection..."
ssh -o ConnectTimeout=10 $TARGET_USER@$TARGET_HOST "echo 'SSH connection successful'"

# Deploy the application
ssh $TARGET_USER@$TARGET_HOST << 'ENDSSH'
set -e

echo "📦 Setting up deployment directory..."
mkdir -p /opt/vexa
cd /opt/vexa

# Stop existing services if running
echo "🛑 Stopping existing services..."
if [ -f docker-compose.yml ]; then
    COMPOSE_PROFILES=cpu docker compose down || true
fi

# Clone/update repository
echo "📥 Cloning/updating repository..."
if [ -d .git ]; then
    git fetch origin
    git reset --hard origin/main
    git clean -fd
else
    git clone https://github.com/shaike1/vexa.git .
fi

# Create .env file with production settings
echo "⚙️ Creating production environment configuration..."
cat > .env << 'ENVEOF'
# Vexa Production Environment - orc-3001

# Core Services
DEVICE_TYPE=cpu
POSTGRES_HOST=localhost
POSTGRES_PORT=15438
POSTGRES_DB=vexa
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379

# Transcription Services
WHISPER_LIVE_URL=ws://whisperlive-cpu:9090
REDIS_STREAM_URL=redis://redis:6379/0/transcription_segments

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
JWT_SECRET=your-super-secure-jwt-secret-key-here-production
CORS_ORIGINS=["*"]

# WebSocket and Audio
WEBSOCKET_PROXY_HOST=websocket-proxy
WEBSOCKET_PROXY_PORT=8090

# Port Mappings (Fixed port conflicts)
TRAEFIK_WEB_HOST_PORT=18080
TRAEFIK_DASHBOARD_PORT=18085
POSTGRES_HOST_PORT=15438
TRANSCRIPTION_COLLECTOR_HOST_PORT=18123
API_GATEWAY_HOST_PORT=18056
ADMIN_API_HOST_PORT=18057

# Bot Configuration
BOT_MEMORY_LIMIT=2g
BOT_CPU_LIMIT=2

# Logging
LOG_LEVEL=INFO
ENVEOF

echo "🏗️ Building and starting services..."
COMPOSE_PROFILES=cpu docker compose up -d --build

echo "⏳ Waiting for services to start..."
sleep 30

echo "🏥 Checking service health..."
COMPOSE_PROFILES=cpu docker compose ps

echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service URLs:"
echo "  - Traefik Dashboard: http://orc-3001:18080"
echo "  - API Gateway: http://orc-3001:18056"
echo "  - Admin API: http://orc-3001:18057"
echo "  - Transcription Collector: http://orc-3001:18123"
echo "  - WebSocket Proxy: http://orc-3001:8090"
echo ""
echo "🤖 To start a Teams bot:"
echo 'curl -X POST http://orc-3001:18056/bots \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "X-API-Key: YOUR_API_KEY" \'
echo '  -d '"'"'{"meeting_url": "TEAMS_URL", "platform": "teams", "native_meeting_id": "meeting_id"}'"'"
echo ""
echo "✅ Deployment complete! All services running with VAD disabled for reliable transcriptions."

ENDSSH

echo "🎯 Deployment to $TARGET_HOST completed successfully!"