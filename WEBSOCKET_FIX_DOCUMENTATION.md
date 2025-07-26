# WebSocket Connection Fix for orc-3001

## Problem Summary
- **Issue**: Bot showing `WebSocket connecting, state: 3` errors continuously
- **Result**: Audio streaming failed, no transcriptions generated
- **Root Cause**: websocket-proxy misconfigured with wrong WhisperLive service name

## Root Cause Analysis

### Environment Differences
**Local Development Server:**
- Network: `vexa_default`
- Service names: `whisperlive`, `whisperlive-cpu`

**orc-3001 Production:**
- Network: `vexa_vexa_default` 
- Service names: `vexa-whisperlive-1`, `vexa-whisperlive-cpu-1`, `vexa-whisperlive-cpu-2`

### The Bug
websocket-proxy was configured to connect to:
```
WHISPER_LIVE_URL=ws://whisperlive:9090
```

But on orc-3001, this service **doesn't exist**. The actual services are:
- `vexa-whisperlive-cpu-1:9090` (CPU WhisperLive)
- `vexa-whisperlive-1:9090` (GPU WhisperLive)

## Solution Applied

### Step 1: Remove Broken websocket-proxy
```bash
docker rm -f vexa-websocket-proxy-1
```

### Step 2: Deploy Fixed websocket-proxy
```bash
docker run -d --name='vexa-websocket-proxy-fixed' --network='vexa_vexa_default' \
  -p 8088:8088 -p 8090:8090 \
  -e WHISPER_LIVE_URL='ws://vexa-whisperlive-cpu-1:9090' \
  -e WHISPER_LIVE_URL_FALLBACK='ws://vexa-whisperlive-cpu-1:9090' \
  -e PORT=8090 \
  -e HTTP_PORT=8088 \
  -e LOG_LEVEL=DEBUG \
  -e REDIS_URL='redis://vexa-redis-1:6379/0' \
  vexa-websocket-proxy
```

### Step 3: Deploy Bot with Fixed Proxy
```bash
docker run -d --name='vexa-websocket-fixed-test' --network='vexa_vexa_default' \
  -e WHISPER_LIVE_URL='ws://vexa-websocket-proxy-fixed:8090' \
  -e BOT_CONFIG='{"meetingUrl":"TEAMS_URL","platform":"teams","botName":"VexaAI-WebSocket-Fixed-Test","language":"en","task":"transcribe","authMode":"guest","connectionId":"websocket-fixed-test-ID","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-websocket-proxy-fixed:8090","token":"vexa-api-key-transcription-2024","nativeMeetingId":"websocket-fixed-test-meeting","automaticLeave":{"enabled":false,"timeout":999999,"waitingRoomTimeout":300000,"noOneJoinedTimeout":300000,"everyoneLeftTimeout":300000}}' \
  vexa-vexa-bot
```

## Results
- ✅ **No more `WebSocket connecting, state: 3` errors**
- ✅ **Bot successfully joins Teams meetings**
- ✅ **websocket-proxy connects to WhisperLive correctly**
- ✅ **Audio streaming pipeline ready**

## Verification Commands

### Check websocket-proxy is working
```bash
docker logs vexa-websocket-proxy-fixed --tail 10
# Should show: "📡 Forwarding to WhisperLive: ws://vexa-whisperlive-cpu-1:9090"
```

### Check bot has no WebSocket errors
```bash
docker logs vexa-websocket-fixed-test | grep -E "(WebSocket connecting, state: 3|HTTP Proxy Bridge)"
# Should show HTTP Proxy Bridge but NO state: 3 errors
```

### Test transcription pipeline
```bash
# Speak in Teams meeting, then check Redis for transcriptions
docker exec vexa-redis-1 redis-cli XREAD COUNT 5 STREAMS transcription_segments '$'
```

## Prevention for Future Deployments

### Update docker-compose.yml Environment
Ensure websocket-proxy uses correct service names:
```yaml
websocket-proxy:
  environment:
    - WHISPER_LIVE_URL=ws://vexa-whisperlive-cpu-1:9090  # Correct for orc-3001
    - WHISPER_LIVE_URL_FALLBACK=ws://vexa-whisperlive-cpu-2:9090
```

### Service Name Mapping
| Environment | WhisperLive CPU | WhisperLive GPU |
|-------------|-----------------|-----------------|
| Local Dev   | `whisperlive-cpu:9090` | `whisperlive:9090` |
| orc-3001    | `vexa-whisperlive-cpu-1:9090` | `vexa-whisperlive-1:9090` |

## Test Status
- [x] websocket-proxy connects to WhisperLive
- [x] Bot joins Teams meeting without WebSocket errors  
- [ ] **PENDING**: Confirm audio transcription works end-to-end

---
**Date**: 2025-07-24  
**Fixed by**: Claude Code  
**Status**: WebSocket connectivity restored, audio transcription testing required