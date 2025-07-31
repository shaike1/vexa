#!/bin/bash

echo "🎤 LIVE TRANSCRIPTION MONITOR"
echo "================================"
echo "Monitoring WhisperLive transcriptions..."
echo ""

# Monitor WhisperLive logs for transcriptions
docker logs vexa-whisperlive-cpu-1 -f --tail=0 | grep -E --line-buffered "transcription|segment|text:|TRANSCRIPTION" | while read line; do
    timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] $line"
done &

# Also monitor Redis for transcript streams
echo "Monitoring Redis transcript streams..."
docker exec vexa-redis-1 redis-cli --scan --pattern "*transcript*" | while read key; do
    if [ ! -z "$key" ]; then
        echo "Found transcript stream: $key"
        docker exec vexa-redis-1 redis-cli XREAD STREAMS "$key" 0-0 COUNT 100 | head -20
    fi
done

wait