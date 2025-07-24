# Deployment to orc-3001 - Working Configuration

## 🚨 Critical: Local Development Server Overloaded
- **Disk**: 94% full (90GB/96GB)
- **Memory**: 68% used (5.3GB/7.8GB)
- **Services**: Multiple unhealthy containers
- **Status**: Must deploy to orc-3001 immediately

## ✅ Working Configuration (Tested & Proven)

### 1. Container-Only Architecture
```bash
# ONLY working approach - direct container-to-container
docker run -d --name='vexa-transcription-prod' --network='vexa_vexa_default' \
  -e BOT_CONFIG='{"meetingUrl":"TEAMS_URL","platform":"teams","botName":"VexaAI-Production","language":"en","task":"transcribe","authMode":"guest","connectionId":"prod-session-$(date +%s)","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-whisperlive-cpu-1:9090","token":"vexa-api-key-transcription-2024","nativeMeetingId":"prod-meeting","textToSpeech":{"enabled":false,"announceJoin":false,"announceLeave":false,"announceRecording":false},"automaticLeave":{"enabled":false,"timeout":999999,"waitingRoomTimeout":300000,"noOneJoinedTimeout":300000,"everyoneLeftTimeout":300000}}' \
  vexa-vexa-bot
```

### 2. Key Components (Container Network)
- **Network**: `vexa_vexa_default`
- **WhisperLive**: `ws://vexa-whisperlive-cpu-1:9090` (direct)
- **Redis**: `redis://vexa-redis-1:6379`
- **TTS**: Disabled (no beeping)

### 3. Infrastructure Status Check
```bash
# Check services health
docker ps --format "table {{.Names}}\t{{.Status}}" | grep vexa

# Monitor transcriptions
docker exec vexa-redis-1 redis-cli XREAD BLOCK 5000 COUNT 5 STREAMS transcription_segments '$'

# Check bot logs
docker logs container-name -f
```

## 🔧 Deployment Steps for orc-3001

1. **Git Push Changes**:
   ```bash
   git add .
   git commit -m "Add working containerized transcription architecture"
   git push origin main
   ```

2. **Deploy on orc-3001**:
   ```bash
   # SSH to orc-3001
   ssh root@orc-3001
   
   # Pull latest changes
   cd /root/vexa
   git pull origin main
   
   # Ensure stack is running
   COMPOSE_PROFILES=cpu docker compose up -d
   
   # Deploy bot with working config
   docker run -d --name='vexa-production' --network='vexa_vexa_default' \
     -e BOT_CONFIG='COMPLETE_JSON_CONFIG' \
     vexa-vexa-bot
   ```

3. **Verify Deployment**:
   ```bash
   # Check all services healthy
   docker ps | grep vexa
   
   # Monitor transcriptions
   docker exec vexa-redis-1 redis-cli XREAD BLOCK 5000 STREAMS transcription_segments '$'
   ```

## 🎯 Proven Results
- ✅ Real transcription: `"Hello, I am speaking in the Teams meeting right now"`
- ✅ Container-to-container networking works perfectly
- ✅ No WebSocket proxy issues
- ✅ No TTS beeping
- ✅ Proper Redis streaming

## ⚠️ Critical: What NOT to Do
- ❌ Never use host-based approaches (`node bot.js`)
- ❌ Never use WebSocket proxy (`ws://localhost:8090`)
- ❌ Never install dependencies on host
- ❌ Never use manual npm/playwright commands

## 📋 Complete BOT_CONFIG Template
```json
{
  "meetingUrl": "https://teams.microsoft.com/l/meetup-join/MEETING_URL",
  "platform": "teams",
  "botName": "VexaAI-Production",
  "language": "en",
  "task": "transcribe",
  "authMode": "guest",
  "connectionId": "unique-session-id",
  "redisUrl": "redis://vexa-redis-1:6379",
  "whisperLiveUrl": "ws://vexa-whisperlive-cpu-1:9090",
  "token": "vexa-api-key-transcription-2024",
  "nativeMeetingId": "meeting-id",
  "textToSpeech": {
    "enabled": false,
    "announceJoin": false,
    "announceLeave": false,
    "announceRecording": false
  },
  "automaticLeave": {
    "enabled": false,
    "timeout": 999999,
    "waitingRoomTimeout": 300000,
    "noOneJoinedTimeout": 300000,
    "everyoneLeftTimeout": 300000
  }
}
```

---
**Status**: Ready for immediate deployment to orc-3001 with proper resources and proven architecture.