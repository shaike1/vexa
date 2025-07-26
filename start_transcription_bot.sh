#!/bin/bash

# Quick script to start transcription bot with a new Teams meeting URL
# Usage: ./start_transcription_bot.sh "https://teams.microsoft.com/l/meetup-join/..."

if [ -z "$1" ]; then
    echo "❌ Please provide a Teams meeting URL"
    echo "Usage: $0 'https://teams.microsoft.com/l/meetup-join/...'"
    exit 1
fi

MEETING_URL="$1"
SESSION_ID="transcription-$(date +%s)"
LOG_FILE="/tmp/transcription-${SESSION_ID}.log"

echo "🤖 Starting Vexa Transcription Bot"
echo "📱 Meeting URL: $MEETING_URL"
echo "🆔 Session ID: $SESSION_ID"
echo "📋 Log file: $LOG_FILE"
echo ""

# Kill any existing bot processes
pkill -f transcription_bot > /dev/null 2>&1

# Create fresh bot configuration
cat > /root/vexa/services/vexa-bot/core/current_session.js << EOF
const { runBot } = require('./dist/index.js');

const transcriptionConfig = {
  meetingUrl: '$MEETING_URL',
  platform: 'teams',
  botName: 'VexaAI-Transcription',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: '$SESSION_ID',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:19090',
  persistentMode: true
};

console.log('🎯 Starting Vexa transcription bot...');
console.log('📡 All services running and ready for transcription');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Transcription bot session completed');
  })
  .catch((error) => {
    console.error('❌ Transcription bot error:', error);
  });
EOF

# Start the bot
cd /root/vexa/services/vexa-bot/core
WHISPER_LIVE_URL="ws://localhost:19090" xvfb-run -a node current_session.js > "$LOG_FILE" 2>&1 &

BOT_PID=$!

echo "✅ Bot started with PID: $BOT_PID"
echo "📊 Monitor logs: tail -f $LOG_FILE"
echo "🔍 Check transcriptions: curl -H 'X-API-Key: vexa-api-key-transcription-2024' 'http://localhost:8123/transcripts/teams/$SESSION_ID'"
echo ""
echo "⏳ The bot will take 2-3 minutes to join the meeting"
echo "🎤 Once admitted, speak clearly and check for transcriptions!"

# Show initial logs
sleep 5
echo "📋 Initial startup logs:"
tail -10 "$LOG_FILE"