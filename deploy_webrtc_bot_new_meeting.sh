#!/bin/bash

# 🤖 Deploy WebRTC Fixed Bot to New Teams Meeting
# Usage: ./deploy_webrtc_bot_new_meeting.sh "TEAMS_MEETING_URL"

if [ -z "$1" ]; then
    echo "❌ Error: Please provide a Teams meeting URL"
    echo ""
    echo "Usage: $0 \"https://teams.microsoft.com/l/meetup-join/...\""
    echo ""
    echo "Example:"
    echo "$0 \"https://teams.microsoft.com/l/meetup-join/19%3ameeting_ABC123...\""
    exit 1
fi

MEETING_URL="$1"
CONTAINER_NAME="teams-webrtc-new-$(date +%s)"
SESSION_ID="webrtc-new-$(date +%s)"

echo "🚀 DEPLOYING WEBRTC FIXED BOT TO NEW MEETING"
echo "============================================="
echo ""
echo "📋 Configuration:"
echo "   Meeting URL: $MEETING_URL"
echo "   Container: $CONTAINER_NAME"
echo "   Session: $SESSION_ID"
echo ""

# Stop any existing test containers (optional cleanup)
echo "🧹 Cleaning up old test containers..."
docker stop teams-webrtc-production teams-webrtc-fix-test teams-live-test 2>/dev/null || true
docker rm teams-webrtc-production teams-webrtc-fix-test teams-live-test 2>/dev/null || true

echo "✅ Cleanup complete"
echo ""

# Deploy the WebRTC fixed bot to the new meeting
echo "🤖 Deploying WebRTC fixed bot..."
docker run -d --name="$CONTAINER_NAME" \
  --network='vexa_default' \
  -e BOT_CONFIG="{
    \"meetingUrl\": \"$MEETING_URL\",
    \"platform\": \"teams\",
    \"botName\": \"VexaAI-WebRTC-Enhanced\",
    \"language\": \"en\",
    \"task\": \"transcribe\",
    \"authMode\": \"guest\",
    \"connectionId\": \"$SESSION_ID\",
    \"redisUrl\": \"redis://vexa-redis-1:6379\",
    \"whisperLiveUrl\": \"ws://vexa-whisperlive-cpu-1:9090\",
    \"token\": \"webrtc-enhanced-token\",
    \"nativeMeetingId\": \"webrtc-enhanced-meeting\",
    \"automaticLeave\": {
      \"enabled\": false,
      \"timeout\": 999999,
      \"waitingRoomTimeout\": 300000,
      \"noOneJoinedTimeout\": 300000,
      \"everyoneLeftTimeout\": 300000
    }
  }" \
  vexa-vexa-bot

if [ $? -eq 0 ]; then
    echo "✅ Bot deployed successfully!"
    echo ""
    echo "📊 Container Status:"
    docker ps | head -1
    docker ps | grep "$CONTAINER_NAME"
    echo ""
    echo "🔍 Monitoring Commands:"
    echo ""
    echo "# Watch bot startup and meeting join:"
    echo "docker logs $CONTAINER_NAME --follow"
    echo ""
    echo "# Monitor for WebRTC audio levels:"
    echo "docker logs $CONTAINER_NAME --follow | grep 'AUDIO LEVEL'"
    echo ""
    echo "# Check for transcriptions:"
    echo "docker exec vexa-redis-1 redis-cli XREAD STREAMS transcription_segments '\$'"
    echo ""
    echo "# Monitor WhisperLive activity:"
    echo "docker logs vexa-whisperlive-cpu-1 --follow | grep '$SESSION_ID'"
    echo ""
    echo "🎤 READY FOR TESTING!"
    echo "The WebRTC enhanced bot should join your new Teams meeting in ~30-60 seconds."
    echo "Speak clearly in the meeting to test the audio fix!"
    echo ""
    echo "Expected results:"
    echo "✅ Audio levels: 'WEBRTC AUDIO LEVEL: >0.00001 (REAL AUDIO!)'"
    echo "✅ Transcriptions: Real speech instead of 'You'"
    echo ""
else
    echo "❌ Failed to deploy bot"
    exit 1
fi