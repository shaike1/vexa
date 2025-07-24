# Claude Development Notes for Vexa AI

## Key Deployment Principles - REMEMBER THESE

### 🐳 Docker-First Approach - EVERYTHING IN CONTAINERS
- **EVERYTHING runs in Docker containers** - Bot, WhisperLive, Redis, PostgreSQL
- **NO manual launches on host** - Never run `node` commands directly on host
- **NO host-based installations** - All dependencies are containerized
- **NO WebSocket proxy needed** - Direct container-to-container communication
- **Use docker-compose stack ONLY** - All services communicate via Docker networks

### ✅ ONLY Correct Bot Deployment Pattern
```bash
# ✅ CORRECT: Container-to-container deployment (WORKING APPROACH)
docker run -d --name='transcription-bot' --network='vexa_vexa_default' \
  -e BOT_CONFIG='{"meetingUrl":"TEAMS_URL","platform":"teams","botName":"VexaAI-Bot","language":"en","task":"transcribe","authMode":"guest","connectionId":"session-id","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-whisperlive-cpu-1:9090","token":"vexa-api-key-transcription-2024","nativeMeetingId":"meeting-id","automaticLeave":{"enabled":false,"timeout":999999,"waitingRoomTimeout":300000,"noOneJoinedTimeout":300000,"everyoneLeftTimeout":300000}}' \
  vexa-vexa-bot

# ❌ WRONG: Any host-based approach
node bot.js  # ❌ Never do this
npm install  # ❌ Never do this
npx playwright install  # ❌ Never do this
```

### 🔧 Docker Stack Components (orc-3001) - CONTAINER NETWORK ONLY
- **Network**: `vexa_vexa_default` (REQUIRED for all containers)
- **WhisperLive**: `ws://vexa-whisperlive-cpu-1:9090` (Direct container connection)
- **Redis**: `redis://vexa-redis-1:6379` (Container network)
- **PostgreSQL**: `vexa-postgres-1:5432` (Container network)
- **API Gateway**: `http://localhost:18056` (Host access only)

### 🚨 CRITICAL - What NOT to Do (These Approaches FAIL)
1. **❌ NEVER run host-based bots** - `node audio_capture_fixed.js`
2. **❌ NEVER use WebSocket proxy** - `ws://localhost:8090` (causes HTTP Bridge mode)
3. **❌ NEVER use localhost from containers** - Use service names only
4. **❌ NEVER install dependencies on host** - Everything is containerized
5. **❌ NEVER use manual npm/playwright commands** - Containers have everything

### 📋 REQUIRED Bot Configuration Format (COMPLETE JSON)
The bot container expects `BOT_CONFIG` environment variable with ALL required fields:
```json
{
  "meetingUrl": "https://teams.microsoft.com/l/meetup-join/...",
  "platform": "teams",
  "botName": "VexaAI-Transcription",
  "language": "en",
  "task": "transcribe",
  "authMode": "guest",
  "connectionId": "unique-session-id",
  "redisUrl": "redis://vexa-redis-1:6379",
  "whisperLiveUrl": "ws://vexa-whisperlive-cpu-1:9090",
  "token": "vexa-api-key-transcription-2024",
  "nativeMeetingId": "meeting-id",
  "automaticLeave": {
    "enabled": false,
    "timeout": 999999,
    "waitingRoomTimeout": 300000,
    "noOneJoinedTimeout": 300000,
    "everyoneLeftTimeout": 300000
  }
}
```

### 🔄 ONLY Deployment Workflow (Container-Based)
1. **Ensure Docker stack running**: `COMPOSE_PROFILES=cpu docker compose up -d`
2. **Deploy bot via container**: Use exact command pattern below
3. **Monitor container logs**: `docker logs container-name -f`
4. **NO manual operations on host** - Everything containerized

### 💡 CRITICAL Understanding
- **Container-to-container networking works perfectly** - Direct WhisperLive connection
- **Host-based approaches always fail** - Network isolation issues
- **WebSocket proxy causes HTTP Bridge mode** - Results in poor transcription
- **All working transcriptions came from containerized deployments**

## Working Configuration (PROVEN APPROACH)
```bash
# ✅ This is the ONLY approach that produces real transcriptions
docker run -d --name='vexa-transcription' --network='vexa_vexa_default' \
  -e BOT_CONFIG='{"meetingUrl":"TEAMS_URL","platform":"teams","botName":"VexaAI-Working","language":"en","task":"transcribe","authMode":"guest","connectionId":"working-session","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-whisperlive-cpu-1:9090","token":"vexa-api-key-transcription-2024","nativeMeetingId":"working-meeting","automaticLeave":{"enabled":false,"timeout":999999,"waitingRoomTimeout":300000,"noOneJoinedTimeout":300000,"everyoneLeftTimeout":300000}}' \
  vexa-vexa-bot
```

## Service Status (orc-3001) - Container Architecture
- ✅ **WhisperLive**: `vexa-whisperlive-cpu-1:9090` - Direct container access
- ✅ **Redis**: `vexa-redis-1:6379` - Container network 
- ✅ **Bot Container**: `vexa-vexa-bot` - Playwright + audio processing
- ✅ **API Gateway**: `localhost:18056` - Host access for monitoring
- ✅ **Container Network**: `vexa_vexa_default` - All services connected