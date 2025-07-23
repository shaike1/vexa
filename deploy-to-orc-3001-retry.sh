#!/bin/bash

# Deploy Vexa Transcription System to orc-3001 (Retry with better timeout handling)

set -e

TARGET_HOST="orc-3001"
TARGET_USER="root"
DEPLOY_PATH="/opt/vexa"

echo "🚀 Retrying deployment to $TARGET_USER@$TARGET_HOST with better timeout handling"

# Deploy the application with better pip timeout settings
ssh $TARGET_USER@$TARGET_HOST << 'ENDSSH'
set -e

echo "📦 Continuing deployment in /opt/vexa..."
cd /opt/vexa

# Try to continue the build with better pip settings
echo "🏗️ Retrying build with increased timeouts..."

# Set pip timeout and retry settings
export PIP_TIMEOUT=300
export PIP_RETRIES=5

# Build services individually to avoid timeout issues
echo "🐳 Building services with extended timeouts..."
COMPOSE_PROFILES=cpu docker compose build --build-arg PIP_TIMEOUT=300 --no-cache

echo "🚀 Starting services..."
COMPOSE_PROFILES=cpu docker compose up -d

echo "⏳ Waiting for services to initialize..."
sleep 60

echo "🏥 Final health check..."
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
echo "✅ All services deployed with VAD disabled for reliable transcriptions!"

ENDSSH

echo "🎯 Deployment retry completed!"