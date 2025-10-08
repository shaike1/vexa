#!/bin/bash

# 🚀 Teams Audio Fix - Complete Deployment Script
# This script deploys the fixed Teams bot with participant audio capture

echo "🔧 TEAMS AUDIO FIX - DEPLOYMENT STARTING"
echo "========================================"
echo "🎯 GOAL: Fix 'you' transcription issue by capturing real participant audio"
echo "🐛 PROBLEM: Bot was receiving silent audio data [0,0,0,0,0...]"
echo "✅ SOLUTION: Enhanced WebRTC + system audio capture"
echo ""

# Check if containers are running
echo "📊 Checking VEXA container status..."
docker ps | grep vexa- | head -5

echo ""
echo "🔍 Checking WhisperLive health..."
curl -s http://localhost:9091/health | head -1 || echo "❌ WhisperLive health check failed"

echo ""
echo "🔍 Checking Redis connectivity..."
docker exec vexa-redis-1 redis-cli ping 2>/dev/null || echo "❌ Redis connection failed"

echo ""
echo "📦 Building fixed Teams bot core..."
cd /root/vexa/services/vexa-bot/core
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful - Teams audio fix compiled"
else
    echo "❌ Build failed - cannot deploy fix"
    exit 1
fi

echo ""
echo "🚀 DEPLOYING TEAMS AUDIO FIX..."
echo "This will start a bot that:"
echo "  ✅ Captures real participant audio (not silence)" 
echo "  ✅ Processes actual speech data"
echo "  ✅ Generates real transcriptions (not just 'you')"
echo ""

# Create deployment configuration
cat > /tmp/teams-audio-fix-config.env << EOF
# Teams Audio Fix Configuration
TEAMS_MEETING_URL=${TEAMS_MEETING_URL:-"https://teams.microsoft.com/meet/placeholder"}
BOT_NAME="VexaAI-AudioFixed-$(date +%s)"
REDIS_URL="redis://vexa-redis-1:6379"
WHISPERLIVE_URL="ws://vexa-whisperlive-cpu-1:9090"
DEBUG_AUDIO_LEVELS=true
EOF

echo "📋 Configuration created:"
cat /tmp/teams-audio-fix-config.env

echo ""
echo "🤖 Starting Teams participant audio bot..."
echo "📱 Monitor logs for 'REAL PARTICIPANT SPEECH' messages"
echo "🎯 Success indicator: Audio levels > 0.001 with real transcriptions"
echo ""

# Start the bot in background for monitoring
cd /root/vexa
nohup node teams-participant-audio-final-fix.js > bot-audio-fix.log 2>&1 &
BOT_PID=$!

echo "🚀 Teams audio fix bot started (PID: $BOT_PID)"
echo "📋 Monitoring commands:"
echo "  Monitor logs: tail -f /root/vexa/bot-audio-fix.log"
echo "  Check audio levels: grep 'PARTICIPANT SPEECH' /root/vexa/bot-audio-fix.log"  
echo "  Check transcriptions: docker exec vexa-redis-1 redis-cli XREAD STREAMS transcription_segments '$'"
echo "  Stop bot: kill $BOT_PID"

echo ""
echo "⏰ Waiting 30 seconds to check initial status..."
sleep 30

echo ""
echo "📊 INITIAL STATUS CHECK:"
if ps -p $BOT_PID > /dev/null; then
    echo "✅ Bot is running (PID: $BOT_PID)"
    echo "📋 Last few log lines:"
    tail -5 /root/vexa/bot-audio-fix.log 2>/dev/null || echo "  (No logs yet)"
else
    echo "❌ Bot stopped unexpectedly"
    echo "📋 Error logs:"
    tail -10 /root/vexa/bot-audio-fix.log 2>/dev/null || echo "  (No logs found)"
fi

echo ""
echo "🔍 NEXT STEPS:"
echo "1. Join the Teams meeting URL with the bot"
echo "2. Speak in the meeting: 'Testing audio capture, one two three'"
echo "3. Monitor logs for 'REAL PARTICIPANT SPEECH' messages"
echo "4. Check transcription output contains actual words (not 'you')"
echo ""
echo "🎯 SUCCESS CRITERIA:"
echo "  ✅ Audio levels: > 0.001 (not 0.000000)"
echo "  ✅ Transcriptions: Real words appear in output"
echo "  ✅ No more 'you' as the only transcription result"

echo ""
echo "📋 TROUBLESHOOTING:"
echo "  - If still getting 'you': Bot may not have permission to capture system audio"
echo "  - If no audio levels: Check meeting has active participants speaking"
echo "  - If bot doesn't join: Verify meeting URL is valid and accessible"

echo ""
echo "🚀 TEAMS AUDIO FIX DEPLOYMENT COMPLETE"
echo "========================================"