#!/bin/bash

# Deploy Containerized Teams Bot with Audio Fix
set -e

MEETING_URL="$1"

if [ -z "$MEETING_URL" ]; then
    echo "❌ Error: Meeting URL required"
    echo "Usage: $0 'https://teams.microsoft.com/meet/...'"
    exit 1
fi

echo "🚀 Deploying Containerized Teams Bot with Audio Fix"
echo "📱 Meeting URL: $MEETING_URL"

# Copy files to orc-3001 if not already there
if [ "$(hostname)" != "orc-3001" ]; then
    echo "📦 Copying files to orc-3001..."
    scp Dockerfile.teams-bot fixed-teams-bot.js root@orc-3001:/root/vexa/
    
    echo "🔄 Running deployment on orc-3001..."
    ssh root@orc-3001 "cd /root/vexa && ./deploy-containerized-bot.sh '$MEETING_URL'"
    exit 0
fi

# We're on orc-3001, build and run the container
cd /root/vexa

echo "🏗️ Building Teams bot container..."
docker build -f Dockerfile.teams-bot -t vexa-teams-bot:fixed .

echo "🛑 Stopping any existing bot containers..."
docker stop teams-bot-fixed 2>/dev/null || true
docker rm teams-bot-fixed 2>/dev/null || true

echo "🤖 Starting Teams bot container..."
docker run -d \
    --name teams-bot-fixed \
    --network vexa_default \
    -e MEETING_URL="$MEETING_URL" \
    vexa-teams-bot:fixed "$MEETING_URL"

echo "📊 Checking bot status..."
sleep 5
docker logs teams-bot-fixed

echo ""
echo "✅ Teams bot deployed successfully!"
echo "📋 To monitor: docker logs -f teams-bot-fixed"
echo "🛑 To stop: docker stop teams-bot-fixed"
echo ""
echo "👤 Please admit the bot when it appears in your Teams meeting lobby!"