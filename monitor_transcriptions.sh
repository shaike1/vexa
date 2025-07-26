#!/bin/bash

echo "🎤 Monitoring live transcriptions from Teams meeting..."
echo "📱 Bot: VO Assist Fixed"
echo "⏰ Started at: $(date)"
echo "=====================================\n"

# Monitor Redis stream for new transcriptions
ssh root@orc-3001 "docker exec vexa-redis-1 redis-cli --csv XREAD BLOCK 0 COUNT 10 STREAMS transcription_segments \\$" | while IFS=',' read -r stream_name msg_id field_name payload; do
    if [[ "$field_name" == "\"payload\"" ]]; then
        # Remove quotes and parse JSON
        clean_payload=$(echo "$payload" | sed 's/^"//;s/"$//' | sed 's/\\"/"/g')
        
        # Extract transcript text if it exists
        transcript=$(echo "$clean_payload" | grep -o '"text":"[^"]*"' | sed 's/"text":"//;s/"//')
        msg_type=$(echo "$clean_payload" | grep -o '"type":"[^"]*"' | sed 's/"type":"//;s/"//')
        timestamp=$(echo "$clean_payload" | grep -o '"timestamp":"[^"]*"' | sed 's/"timestamp":"//;s/"//')
        
        if [[ ! -z "$transcript" ]]; then
            echo "💬 [$timestamp] $transcript"
        elif [[ "$msg_type" == "session_start" ]]; then
            echo "🟢 [$timestamp] Session started"
        else
            echo "📊 [$timestamp] $msg_type"
        fi
    fi
done