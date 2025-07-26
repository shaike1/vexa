#!/bin/bash

# Auto-unmute bot script for persistent unmuting
CONNECTION_ID="vexa-unmuted-session"
REDIS_CONTAINER="vexa-redis-1"

echo "🔊 Starting auto-unmute monitoring for connection: $CONNECTION_ID"

# Function to send unmute command
send_unmute() {
    echo "📢 Sending unmute command..."
    docker exec $REDIS_CONTAINER redis-cli PUBLISH "bot_commands:$CONNECTION_ID" '{"action":"unmute"}'
}

# Wait for bot to join
echo "⏳ Waiting 15 seconds for bot to join meeting..."
sleep 15

# Send initial unmute
send_unmute

# Keep sending unmute commands every 10 seconds
echo "🔄 Starting continuous unmute monitoring (every 10 seconds)..."
while true; do
    sleep 10
    send_unmute
    echo "✅ Unmute command sent at $(date)"
done