#!/bin/bash

echo "🎤 Real-time Transcription Monitor"
echo "=================================="
echo "Watching WhisperLive for live transcriptions..."
echo ""

# Follow WhisperLive logs and filter for transcription segments
docker logs vexa-whisperlive-cpu-1 -f | while read line; do
    # Check if line contains transcription segments
    if [[ $line == *"[COMPLETE]:"* ]] || [[ $line == *"[PARTIAL]:"* ]]; then
        # Extract just the transcribed text
        timestamp=$(date '+%H:%M:%S')
        text=$(echo "$line" | sed -n 's/.*\[COMPLETE\]: "\(.*\)"/\1/p' | sed -n 's/.*\[PARTIAL\]: "\(.*\)"/\1/p')
        if [[ -n "$text" ]]; then
            echo "[$timestamp] $text"
        fi
    fi
done