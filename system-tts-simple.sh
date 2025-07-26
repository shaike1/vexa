#!/bin/bash

echo "🎤 Starting Simple System TTS Audio Injector..."

# Function to speak text
speak_text() {
    local text="$1"
    echo "🔊 System TTS Speaking: \"$text\""
    
    # Generate unique filename
    local timestamp=$(date +%s%N)
    local audioFile="/tmp/system_tts_${timestamp}.wav"
    
    # Generate audio with espeak
    espeak -s 150 -v en -w "$audioFile" "$text"
    
    if [ -f "$audioFile" ]; then
        echo "✅ Audio file generated: $audioFile"
        
        # Try to play audio
        if command -v aplay >/dev/null 2>&1; then
            echo "🔊 Playing audio with aplay..."
            aplay "$audioFile" 2>/dev/null || echo "⚠️ aplay failed"
        elif command -v paplay >/dev/null 2>&1; then
            echo "🔊 Playing audio with paplay..."
            paplay "$audioFile" 2>/dev/null || echo "⚠️ paplay failed"
        else
            echo "⚠️ No audio player found, file saved: $audioFile"
        fi
        
        # Try PulseAudio virtual sink
        pactl load-module module-null-sink sink_name=virtual_speaker 2>/dev/null || true
        paplay --device=virtual_speaker "$audioFile" 2>/dev/null || true
        
        echo "📁 Audio file: $audioFile"
    else
        echo "❌ Failed to generate audio file"
    fi
}

# Test the system first
speak_text "System TTS Audio Injector initialized and ready for voice injection"

echo "📡 Listening for Redis commands on bot_commands:working-speaker..."

# Listen to Redis commands
docker exec vexa-redis redis-cli --csv psubscribe bot_commands:working-speaker | while IFS=',' read -r type channel message; do
    if [[ "$type" == "\"pmessage\"" ]]; then
        # Clean up the message (remove quotes and handle JSON)
        clean_message=$(echo "$message" | sed 's/^"//; s/"$//' | sed 's/""/"/g')
        
        echo "📨 Received Redis message: $clean_message"
        
        # Extract the message content using jq if available, otherwise use grep
        if command -v jq >/dev/null 2>&1; then
            speak_message=$(echo "$clean_message" | jq -r '.message // empty' 2>/dev/null)
        else
            speak_message=$(echo "$clean_message" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        fi
        
        if [[ -n "$speak_message" && "$speak_message" != "null" ]]; then
            speak_text "$speak_message"
        fi
    fi
done