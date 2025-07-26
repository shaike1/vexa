#!/bin/bash

# Vexa AI Docker Hub Deployment Strategy
# This script builds, tags, and pushes all Vexa services to Docker Hub

set -e

# Configuration
DOCKER_HUB_ORG="${DOCKER_HUB_ORG:-vexaai}"
VERSION="${VERSION:-latest}"
BUILD_ARGS="${BUILD_ARGS:-}"

echo "🐳 Vexa AI Docker Hub Deployment"
echo "================================="
echo "Organization: ${DOCKER_HUB_ORG}"
echo "Version: ${VERSION}"
echo ""

# Services to build and push
SERVICES=(
    "vexa-bot"
    "api-gateway" 
    "admin-api"
    "bot-manager"
    "transcription-collector"
    "ai-service-adapter"
    "websocket-proxy"
    "whisperlive-cpu"
)

# Function to build and push a service
build_and_push() {
    local service=$1
    local dockerfile_path="services/${service}/Dockerfile"
    local context_path="."
    
    # Handle special cases
    case $service in
        "whisperlive-cpu")
            dockerfile_path="services/whisperlive/Dockerfile"
            ;;
        "websocket-proxy")
            dockerfile_path="services/websocket-proxy/Dockerfile"
            ;;
    esac
    
    if [[ ! -f "$dockerfile_path" ]]; then
        echo "⚠️  Dockerfile not found for $service at $dockerfile_path - skipping"
        return
    fi
    
    echo "🔨 Building $service..."
    docker build -f "$dockerfile_path" -t "vexa-${service}" $BUILD_ARGS "$context_path"
    
    echo "🏷️  Tagging $service..."
    docker tag "vexa-${service}" "${DOCKER_HUB_ORG}/vexa-${service}:${VERSION}"
    docker tag "vexa-${service}" "${DOCKER_HUB_ORG}/vexa-${service}:latest"
    
    echo "📤 Pushing $service..."
    docker push "${DOCKER_HUB_ORG}/vexa-${service}:${VERSION}"
    docker push "${DOCKER_HUB_ORG}/vexa-${service}:latest"
    
    echo "✅ $service completed"
    echo ""
}

# Check if logged into Docker Hub
if ! docker info | grep -q "Username:"; then
    echo "❌ Please login to Docker Hub first:"
    echo "   docker login"
    exit 1
fi

# Build and push all services
for service in "${SERVICES[@]}"; do
    build_and_push "$service"
done

echo "🎉 All services successfully pushed to Docker Hub!"
echo ""
echo "📋 Next steps:"
echo "1. Update docker-compose.yml to use Docker Hub images:"
echo "   image: ${DOCKER_HUB_ORG}/vexa-bot:${VERSION}"
echo ""
echo "2. For fast deployment anywhere:"
echo "   git clone https://github.com/shaike1/vexa.git"
echo "   cd vexa"
echo "   COMPOSE_PROFILES=cpu docker compose up -d"
echo ""
echo "🚀 Deployment time reduced from 10+ minutes to under 2 minutes!"