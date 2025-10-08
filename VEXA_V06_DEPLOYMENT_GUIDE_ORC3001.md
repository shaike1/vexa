# Vexa.ai v0.6 Deployment Guide for orc-3001

## Overview

This guide provides step-by-step instructions to deploy the working Vexa.ai v0.6 solution on orc-3001, replacing our current broken Teams audio implementation.

## Prerequisites

- SSH access to `root@orc-3001`
- Docker and Docker Compose installed
- Git access to Vexa.ai repository

## Phase 1: Clean Environment Setup

### 1.1 Backup Current Implementation
```bash
# SSH to orc-3001
ssh root@orc-3001

# Backup current vexa directory
cd /root
cp -r vexa vexa-backup-$(date +%Y%m%d-%H%M%S)

# Stop any running containers
docker stop $(docker ps -aq --filter "name=vexa") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=vexa") 2>/dev/null || true
```

### 1.2 Clone Fresh Vexa.ai v0.6
```bash
# Remove old vexa directory (after backup)
rm -rf /root/vexa

# Clone fresh Vexa.ai v0.6 repository
cd /root
git clone https://github.com/Vexa-ai/vexa.git
cd vexa

# Verify we have the latest version with Teams support
git log --oneline -5
```

## Phase 2: Environment Configuration

### 2.1 Configure Environment Variables
```bash
# Copy example environment
cp env-example.cpu .env

# Edit environment for orc-3001
cat > .env << 'EOF'
# Device Configuration
DEVICE_TYPE=cpu
WHISPER_MODEL_SIZE=tiny
WL_MAX_CLIENTS=10

# Language Detection
LANGUAGE_DETECTION_SEGMENTS=4

# VAD Configuration  
VAD_FILTER_THRESHOLD=0

# Consul Configuration
CONSUL_ENABLE=true
CONSUL_HTTP_ADDR=http://consul:8500

# Redis Discovery
WL_REDIS_DISCOVERY_ENABLED=false

# Port Configuration
API_GATEWAY_HOST_PORT=18056
ADMIN_API_HOST_PORT=18057
TRANSCRIPTION_COLLECTOR_HOST_PORT=18123
MCP_HOST_PORT=18888
POSTGRES_HOST_PORT=15438

# Service Configuration
COMPOSE_PROJECT_NAME=vexa
ADMIN_API_TOKEN=vexa-admin-api-token-2024

# Bot Configuration
BOT_IMAGE_NAME=vexa-bot:dev
EOF
```

### 2.2 Setup Directory Structure
```bash
# Create required directories
mkdir -p /root/vexa/hub
mkdir -p /root/vexa/services/WhisperLive/models

# Set permissions
chmod -R 755 /root/vexa
```

## Phase 3: Build and Deploy Services

### 3.1 Build All Services
```bash
cd /root/vexa

# Build all services with CPU profile
make all TARGET=cpu

# Verify build completed successfully
docker images | grep vexa
```

### 3.2 Start Core Services
```bash
# Start all services with CPU profile
COMPOSE_PROFILES=cpu docker-compose up -d

# Verify all services are running
docker ps --filter "name=vexa"

# Check service logs
docker-compose logs -f --tail=50
```

### 3.3 Verify Service Health
```bash
# Check API Gateway
curl -s http://localhost:18056/health || echo "API Gateway not ready"

# Check WhisperLive
curl -s http://localhost:18056/whisperlive/health || echo "WhisperLive not ready"

# Check database connection
docker exec vexa-postgres-1 pg_isready -U postgres

# Check Redis
docker exec vexa-redis-1 redis-cli ping
```

## Phase 4: Teams Bot Testing

### 4.1 Generate API Key
```bash
# Follow the notebook instructions to generate API key
cd /root/vexa
# Open nbs/0_basic_test.ipynb and follow steps to create API key
# Or use admin API directly

# Set your API key
export VEXA_API_KEY="your-generated-api-key-here"
```

### 4.2 Deploy Teams Bot
```bash
# Use the Teams meeting URL you provided
TEAMS_URL="https://teams.microsoft.com/l/meetup-join/19%3ameeting_NTQ2ZDE3ODItMDA5Mi00MjZiLTg1ZDAtOWU3NjY4YzkzMDgx%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d"

# Extract meeting ID and passcode (you'll need to provide these)
MEETING_ID="your-numeric-meeting-id"
PASSCODE="your-meeting-passcode"

# Deploy bot using new API
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $VEXA_API_KEY" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "'$MEETING_ID'",
    "passcode": "'$PASSCODE'"
  }'
```

### 4.3 Monitor Bot Activity
```bash
# Watch bot manager logs
docker logs -f vexa-bot-manager-1

# Watch transcription collector logs  
docker logs -f vexa-transcription-collector-1

# Watch WhisperLive logs
docker logs -f vexa-whisperlive-cpu-1

# Check for active bot containers
docker ps --filter "name=bot-"
```

### 4.4 Retrieve Transcripts
```bash
# Get transcripts via REST API
curl -H "X-API-Key: $VEXA_API_KEY" \
  "http://localhost:18056/transcripts/teams/$MEETING_ID"

# Get real-time transcripts via WebSocket (optional)
# See docs/websocket.md for WebSocket implementation
```

## Phase 5: Troubleshooting

### 5.1 Common Issues

#### Bot Container Not Starting
```bash
# Check bot manager logs
docker logs vexa-bot-manager-1

# Check Docker network
docker network ls | grep vexa

# Verify bot image exists
docker images | grep vexa-bot
```

#### No Audio Capture
```bash
# Check if bot joined meeting successfully
docker logs $(docker ps -q --filter "name=bot-") | grep -i "joined\|meeting\|audio"

# Verify WhisperLive connection
docker logs vexa-whisperlive-cpu-1 | grep -i "client\|connection\|audio"

# Check for Teams-specific errors
docker logs $(docker ps -q --filter "name=bot-") | grep -i "teams\|edge\|media"
```

#### No Transcriptions
```bash
# Check transcription collector
docker logs vexa-transcription-collector-1 | grep -i "segment\|transcript"

# Check Redis streams
docker exec vexa-redis-1 redis-cli XINFO STREAM transcription_segments

# Check database
docker exec vexa-postgres-1 psql -U postgres -d vexa -c "SELECT * FROM meeting_segments ORDER BY created_at DESC LIMIT 5;"
```

### 5.2 Debug Commands

#### Enable Debug Logging
```bash
# Set debug environment and restart
echo "LOG_LEVEL=DEBUG" >> .env
docker-compose down
COMPOSE_PROFILES=cpu docker-compose up -d
```

#### Container Inspection
```bash
# Get container details
docker inspect $(docker ps -q --filter "name=bot-")

# Access container shell
docker exec -it $(docker ps -q --filter "name=bot-") /bin/sh

# Check container resources
docker stats --no-stream
```

#### Network Debugging
```bash
# Test container-to-container connectivity
docker exec vexa-bot-manager-1 curl -s http://vexa-whisperlive-cpu-1:9090/health

# Check DNS resolution
docker exec vexa-bot-manager-1 nslookup vexa-whisperlive-cpu-1
```

## Phase 6: Migration from Current Bot

### 6.1 Update Existing Bot Scripts
```bash
# Replace our current bot deployment with new API calls
cat > /root/vexa/deploy-new-teams-bot.sh << 'EOF'
#!/bin/bash
set -e

TEAMS_URL="$1"
MEETING_ID="$2"
PASSCODE="$3"
API_KEY="${VEXA_API_KEY:-vexa-api-key-transcription-2024}"

if [[ -z "$TEAMS_URL" || -z "$MEETING_ID" ]]; then
    echo "Usage: $0 <teams_url> <meeting_id> [passcode]"
    echo "Example: $0 'https://teams.microsoft.com/...' '12345' 'optional-passcode'"
    exit 1
fi

echo "Deploying Teams bot to meeting: $MEETING_ID"

# Deploy via new API
RESPONSE=$(curl -s -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"platform\": \"teams\",
    \"native_meeting_id\": \"$MEETING_ID\",
    \"passcode\": \"$PASSCODE\"
  }")

echo "Bot deployment response: $RESPONSE"

# Get bot container name
sleep 5
BOT_CONTAINER=$(docker ps --filter "name=bot-" --format "{{.Names}}" | head -1)

if [[ -n "$BOT_CONTAINER" ]]; then
    echo "Bot container: $BOT_CONTAINER"
    echo "Monitoring bot logs..."
    docker logs -f "$BOT_CONTAINER"
else
    echo "No bot container found. Check bot manager logs:"
    docker logs vexa-bot-manager-1
fi
EOF

chmod +x /root/vexa/deploy-new-teams-bot.sh
```

### 6.2 Test with Your Meeting
```bash
# Use the meeting URL you provided earlier
/root/vexa/deploy-new-teams-bot.sh \
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_NTQ2ZDE3ODItMDA5Mi00MjZiLTg1ZDAtOWU3NjY4YzkzMDgx%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d" \
  "MEETING_ID_FROM_URL" \
  "OPTIONAL_PASSCODE"
```

## Phase 7: Monitoring and Maintenance

### 7.1 Health Monitoring
```bash
# Create health check script
cat > /root/vexa/health-check.sh << 'EOF'
#!/bin/bash

echo "=== Vexa.ai v0.6 Health Check ==="
echo "Timestamp: $(date)"
echo

echo "1. Service Status:"
docker ps --filter "name=vexa" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo

echo "2. API Gateway Health:"
curl -s http://localhost:18056/health | jq . 2>/dev/null || echo "API Gateway unreachable"
echo

echo "3. Active Bots:"
docker ps --filter "name=bot-" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
echo

echo "4. Recent Transcriptions:"
docker exec -it vexa-postgres-1 psql -U postgres -d vexa -c "SELECT meeting_id, participant_name, text, created_at FROM meeting_segments ORDER BY created_at DESC LIMIT 3;" 2>/dev/null || echo "Database unreachable"
EOF

chmod +x /root/vexa/health-check.sh
```

### 7.2 Log Monitoring
```bash
# Create log monitoring script
cat > /root/vexa/monitor-logs.sh << 'EOF'
#!/bin/bash

echo "Monitoring Vexa.ai v0.6 logs..."
echo "Press Ctrl+C to stop"

# Monitor all core services
docker-compose logs -f --tail=10 \
  api-gateway \
  bot-manager \
  whisperlive-cpu \
  transcription-collector \
  admin-api
EOF

chmod +x /root/vexa/monitor-logs.sh
```

## Summary

This deployment replaces our broken Teams audio implementation with Vexa.ai's proven v0.6 solution that:

1. **Uses browser-native audio capture** - captures actual Teams audio streams
2. **Implements stubborn WebSocket reconnection** - maintains connection stability  
3. **Provides comprehensive speaker detection** - identifies all participants accurately
4. **Supports real-time configuration** - allows language/task changes during meetings
5. **Includes proper error handling** - graceful failures and automatic recovery

The new architecture is production-ready and actively maintained by the Vexa.ai team, ensuring ongoing compatibility with Teams updates.

## Next Steps

1. **Deploy the new architecture** using this guide
2. **Test with live Teams meetings** to verify audio capture works
3. **Migrate existing bot configurations** to use the new API
4. **Monitor performance** and tune as needed
5. **Update documentation** to reflect new deployment process

The solution is comprehensive and should resolve all Teams audio streaming issues we've encountered.