#!/bin/bash

# Interactive Bot Deployment Script
# Deploys Speaker Bot and Transcription Bot to Teams meeting

echo "🤖 ============================================="
echo "🚀 Teams Bot Deployment Script"
echo "============================================="
echo ""
echo "This script will deploy both:"
echo "🎤 Speaker Bot (speaks test phrases)"
echo "📝 Transcription Bot (captures & transcribes audio)"
echo ""

# Function to validate Teams URL
validate_teams_url() {
    local url="$1"
    if [[ "$url" =~ ^https://teams\.microsoft\.com/l/meetup-join/ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to clean up existing bots
cleanup_bots() {
    echo "🧹 Cleaning up any existing bots..."
    docker rm -f speaker-bot-live transcription-bot-live speaker-bot-api transcription-bot-api speaker-bot-fresh transcription-bot-fresh 2>/dev/null || true
    echo "✅ Cleanup completed"
    echo ""
}

# Get meeting URL from user
echo "📋 Please enter your Teams meeting URL:"
echo "   (Copy and paste the full meeting link)"
echo ""
read -p "Meeting URL: " MEETING_URL

# Validate URL
if ! validate_teams_url "$MEETING_URL"; then
    echo ""
    echo "❌ Invalid Teams meeting URL format!"
    echo "   Please ensure the URL starts with: https://teams.microsoft.com/l/meetup-join/"
    echo ""
    exit 1
fi

echo ""
echo "✅ Valid Teams meeting URL detected"
echo "🔗 Meeting URL: $MEETING_URL"
echo ""

# Confirm deployment
read -p "🚀 Deploy both bots to this meeting? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🎯 Starting bot deployment..."
echo ""

# Clean up existing bots
cleanup_bots

# Generate unique connection IDs
TIMESTAMP=$(date +%s)
SPEAKER_ID="speaker-${TIMESTAMP}"
TRANSCRIPTION_ID="transcription-${TIMESTAMP}"

# Create bot configurations
SPEAKER_CONFIG="{\"meetingUrl\":\"$MEETING_URL\",\"botName\":\"Speaker Bot 🎤\",\"platform\":\"teams\",\"task\":\"speak\",\"language\":\"en\",\"connectionId\":\"$SPEAKER_ID\",\"token\":\"test-token\",\"nativeMeetingId\":\"meeting-$SPEAKER_ID\",\"redisUrl\":\"redis://redis:6379/0\",\"automaticLeave\":{\"waitingRoomTimeout\":300,\"noOneJoinedTimeout\":600,\"everyoneLeftTimeout\":180}}"

TRANSCRIPTION_CONFIG="{\"meetingUrl\":\"$MEETING_URL\",\"botName\":\"Transcription Bot 📝\",\"platform\":\"teams\",\"task\":\"transcribe\",\"language\":\"en\",\"connectionId\":\"$TRANSCRIPTION_ID\",\"token\":\"test-token\",\"nativeMeetingId\":\"meeting-$TRANSCRIPTION_ID\",\"redisUrl\":\"redis://redis:6379/0\",\"automaticLeave\":{\"waitingRoomTimeout\":300,\"noOneJoinedTimeout\":600,\"everyoneLeftTimeout\":180}}"

# Deploy Speaker Bot
echo "🎤 Deploying Speaker Bot..."
SPEAKER_CONTAINER=$(docker run -d --name speaker-bot-live \
    --network vexa_vexa_default \
    -e BOT_CONFIG="$SPEAKER_CONFIG" \
    -e WHISPER_LIVE_URL="ws://whisperlive-cpu:9090" \
    vexa-bot:node-proxy-fix)

if [ $? -eq 0 ]; then
    echo "✅ Speaker Bot deployed successfully"
    echo "   Container ID: ${SPEAKER_CONTAINER:0:12}"
else
    echo "❌ Failed to deploy Speaker Bot"
    exit 1
fi

# Wait a moment between deployments
sleep 2

# Deploy Transcription Bot
echo "📝 Deploying Transcription Bot..."
TRANSCRIPTION_CONTAINER=$(docker run -d --name transcription-bot-live \
    --network vexa_vexa_default \
    -e BOT_CONFIG="$TRANSCRIPTION_CONFIG" \
    -e WHISPER_LIVE_URL="ws://whisperlive-cpu:9090" \
    vexa-bot:node-proxy-fix)

if [ $? -eq 0 ]; then
    echo "✅ Transcription Bot deployed successfully"
    echo "   Container ID: ${TRANSCRIPTION_CONTAINER:0:12}"
else
    echo "❌ Failed to deploy Transcription Bot"
    exit 1
fi

echo ""
echo "🎉 ============================================="
echo "🚀 Bot Deployment Completed!"
echo "============================================="
echo ""
echo "📊 Status:"
echo "   🎤 Speaker Bot: speaker-bot-live"
echo "   📝 Transcription Bot: transcription-bot-live"
echo ""
echo "⏱️  Expected Timeline:"
echo "   • 0-30s: Bots initialize and start"
echo "   • 30-60s: Navigate to Teams meeting"
echo "   • 60-120s: Appear in meeting lobby"
echo "   • 120s+: Begin speaking/transcribing"
echo ""
echo "🔔 Action Required:"
echo "   1. Join the Teams meeting yourself"
echo "   2. Check the lobby for waiting participants:"
echo "      - 'Speaker Bot 🎤'"
echo "      - 'Transcription Bot 📝'"
echo "   3. Manually admit both bots"
echo "   4. Watch them work together!"
echo ""
echo "📋 Monitoring Commands:"
echo "   # Check bot status"
echo "   docker ps | grep bot-live"
echo ""
echo "   # Monitor Speaker Bot"
echo "   docker logs speaker-bot-live --follow"
echo ""
echo "   # Monitor Transcription Bot"
echo "   docker logs transcription-bot-live --follow"
echo ""
echo "   # Check WebSocket proxy"
echo "   docker logs vexa_websocket-proxy_1 --tail=20"
echo ""
echo "🧹 Cleanup (when done):"
echo "   docker rm -f speaker-bot-live transcription-bot-live"
echo ""
echo "🎯 Expected Behavior:"
echo "   • Speaker Bot will announce itself and speak test phrases"
echo "   • Transcription Bot will capture and transcribe all audio"
echo "   • Both bots demonstrate end-to-end transcription pipeline"
echo ""
echo "✅ Ready for live testing!"