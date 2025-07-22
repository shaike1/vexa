#!/bin/bash

echo "🔄 Restarting Vexa services with updated Docker Compose configuration..."

# Stop current services
echo "🛑 Stopping current services..."
docker compose --profile cpu down

# Kill any standalone processes
echo "🧹 Cleaning up standalone processes..."
pkill -f "node.*proxy" 2>/dev/null || true
pkill -f "python.*whisper" 2>/dev/null || true

# Build and start services with CPU profile
echo "🚀 Starting services with CPU profile..."
COMPOSE_PROFILES=cpu docker compose up -d --build

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
COMPOSE_PROFILES=cpu docker compose ps

echo "✅ Service restart completed!"
echo ""
echo "📊 Service URLs:"
echo "  - API Gateway: http://localhost:18056"
echo "  - Admin API: http://localhost:18057"
echo "  - Transcription Collector: http://localhost:18123"
echo "  - WebSocket Proxy: http://localhost:8088 and http://localhost:8090"
echo "  - Traefik Dashboard: http://localhost:18085"
echo "  - Traefik Web: http://localhost:18080"
echo ""
echo "🔧 To check logs:"
echo "  docker-compose logs -f [service_name]"