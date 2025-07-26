#!/bin/bash

echo "🎯 TESTING VEXA TRANSCRIPTION PIPELINE"
echo "======================================"

# Start a new transcription bot for testing
cd /root/vexa/services/vexa-bot/core

echo "📝 Starting Vexa transcription bot..."
WHISPER_LIVE_URL="ws://localhost:19090" xvfb-run -a node transcription_bot_persistent.js > /tmp/test-transcription.log 2>&1 &
BOT_PID=$!

echo "✅ Bot started with PID: $BOT_PID"
echo "📋 Bot will join Teams meeting and capture transcriptions"
echo ""
echo "🔗 Monitor logs: tail -f /tmp/test-transcription.log"
echo "🌐 View transcriptions: http://localhost:8123/docs"
echo "❌ Stop bot: kill $BOT_PID"
echo ""
echo "📢 TO TEST:"
echo "1. Admit the VexaAI-Transcription bot to your Teams meeting"
echo "2. Speak clearly for 10-15 seconds" 
echo "3. Check transcriptions at: curl 'http://localhost:8123/transcripts/teams/transcription-bot-persistent'"
echo "4. Or visit: http://localhost:8123/docs"

# Monitor for admission
echo "⏳ Monitoring for bot admission..."
timeout 30 tail -f /tmp/test-transcription.log | grep -m1 "Successfully admitted" && {
    echo "✅ Bot admitted to meeting!"
    echo "🎤 Now speak to generate transcriptions..."
} || {
    echo "⚠️ Bot not yet admitted. Please check Teams meeting for admission request."
}