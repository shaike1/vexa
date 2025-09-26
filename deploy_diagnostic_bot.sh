#!/bin/bash

echo "🔍 DEPLOYING TEAMS AUDIO DIAGNOSTIC BOT"
echo "======================================"
echo ""
echo "This bot will help us understand why transcriptions show 'You'"
echo ""

# Build the bot first
echo "📦 Building bot with diagnostic features..."
cd /root/vexa/services/vexa-bot/core && npm run build

if [ $? -eq 0 ]; then
    echo "✅ Bot build successful"
else
    echo "❌ Bot build failed"
    exit 1
fi

echo ""
echo "🚀 Ready to deploy diagnostic bot!"
echo ""
echo "📋 To test the audio issue:"
echo "   1. Replace PLACEHOLDER_URL in teams_audio_diagnostic_bot.js with a real Teams meeting URL"
echo "   2. Run: node teams_audio_diagnostic_bot.js"
echo "   3. Join the Teams meeting yourself"
echo "   4. Speak in the meeting"
echo "   5. Watch bot logs for audio level diagnostics"
echo ""
echo "🔍 Expected logs:"
echo "   ❌ Current: 'Audio Level: 0.000000 (SILENCE)'"
echo "   ✅ After fix: 'Audio Level: 0.045231 (REAL AUDIO)'"
echo ""

# Create a quick container test
echo "🐳 Testing container deployment..."

CONTAINER_NAME="teams-audio-diagnostic-$(date +%s)"

docker run -d --name="$CONTAINER_NAME" \
  --network='vexa_default' \
  -e BOT_CONFIG='{"meetingUrl":"https://teams.microsoft.com/test","platform":"teams","botName":"Audio-Diagnostic","language":"en","task":"transcribe","authMode":"guest","connectionId":"diag-test","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-whisperlive-cpu-1:9090","token":"diagnostic-token","nativeMeetingId":"diag-meeting","automaticLeave":{"enabled":false,"timeout":999999,"waitingRoomTimeout":300000,"noOneJoinedTimeout":300000,"everyoneLeftTimeout":300000}}' \
  vexa-vexa-bot

if [ $? -eq 0 ]; then
    echo "✅ Test container started: $CONTAINER_NAME"
    echo "⏳ Waiting 10 seconds to check container status..."
    sleep 10
    
    CONTAINER_STATUS=$(docker inspect $CONTAINER_NAME --format='{{.State.Status}}' 2>/dev/null)
    echo "📊 Container status: $CONTAINER_STATUS"
    
    if [ "$CONTAINER_STATUS" = "running" ]; then
        echo "✅ Container is running successfully"
        echo "📋 To see logs: docker logs $CONTAINER_NAME --follow"
    else
        echo "❌ Container failed to start properly"
        echo "📋 Check logs: docker logs $CONTAINER_NAME"
    fi
    
    echo "🧹 Cleaning up test container..."
    docker stop $CONTAINER_NAME > /dev/null 2>&1
    docker rm $CONTAINER_NAME > /dev/null 2>&1
    
else
    echo "❌ Test container failed to start"
fi

echo ""
echo "🎯 NEXT STEPS:"
echo "   1. The diagnostic bot is ready to deploy"
echo "   2. Use a real Teams meeting URL for testing"
echo "   3. Monitor audio levels to confirm the issue"
echo "   4. Apply the WebRTC interception fix"
echo ""
echo "✅ Diagnostic setup complete!"