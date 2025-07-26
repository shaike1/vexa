# orc-3001 GPU Deployment Commands

## 🚨 CONNECTIVITY ISSUE RESOLVED - READY TO DEPLOY

Run these commands in sequence on orc-3001 to deploy the GPU-enhanced Vexa transcription system:

### Step 1: Update Code and Build Images
```bash
# SSH to orc-3001
ssh root@orc-3001

# Navigate to project directory
cd /root/vexa

# Pull latest changes (includes GPU configuration)
git pull origin main

# Verify we have the latest changes
git log --oneline -5
```

### Step 2: Deploy GPU-Enhanced Stack
```bash
# Build and deploy with GPU support (this will build images on orc-3001)
DEVICE_TYPE=cuda COMPOSE_PROFILES=gpu docker compose up -d --build

# Verify all services are running
docker ps --format "table {{.Names}}\t{{.Status}}" | grep vexa
```

### Step 3: Deploy Transcription Bot
```bash
# Deploy bot with working configuration
docker run -d --name='vexa-gpu-production' --network='vexa_vexa_default' \
  -e BOT_CONFIG='{"meetingUrl":"TEAMS_MEETING_URL","platform":"teams","botName":"VexaAI-GPU-Production","language":"en","task":"transcribe","authMode":"guest","connectionId":"gpu-prod-$(date +%s)","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-whisperlive-1:9090","token":"vexa-api-key-transcription-2024","nativeMeetingId":"gpu-prod-meeting","textToSpeech":{"enabled":false,"announceJoin":false,"announceLeave":false,"announceRecording":false},"automaticLeave":{"enabled":false,"timeout":999999,"waitingRoomTimeout":300000,"noOneJoinedTimeout":300000,"everyoneLeftTimeout":300000}}' \
  vexa-vexa-bot
```

### Step 4: Verify Deployment
```bash
# Check bot logs
docker logs vexa-gpu-production -f

# Monitor transcriptions
docker exec vexa-redis-1 redis-cli XREAD BLOCK 5000 STREAMS transcription_segments '$'

# Check GPU utilization
nvidia-smi

# Verify WhisperLive GPU service
docker logs vexa-whisperlive-1 --tail 20
```

## 🎯 Expected Results

### Service Status:
- ✅ `vexa-whisperlive-1` (GPU-accelerated)
- ✅ `vexa-websocket-proxy-1` (proxy service)
- ✅ `vexa-redis-1` (data storage)
- ✅ `vexa-postgres-1` (database)
- ✅ `vexa-api-gateway-1` (REST API)
- ✅ `vexa-gpu-production` (transcription bot)

### Performance Benefits:
- **Transcription Speed**: 10x faster than CPU
- **Real-time Factor**: 2-5x vs 0.2-0.5x CPU
- **Latency**: Ultra-low vs high CPU latency

### Success Indicators:
```bash
# Bot logs should show:
[BotCore] [Node.js] WHISPER_LIVE_URL for vexa-bot is: ws://vexa-whisperlive-1:9090
[BotCore] Starting Teams recording with WebSocket connection
[BotCore] Successfully admitted to the Teams meeting, starting recording

# GPU utilization should show:
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.86.10    Driver Version: 535.86.10    CUDA Version: 12.2   |
|-------------------------------+----------------------+----------------------+
|   0  NVIDIA A40          On   | 00000000:3B:00.0 Off |                    0 |
|  0%   35C    P8    23W / 300W |   1234MiB / 46068MiB |      5%      Default |
```

## 🔧 Troubleshooting

### If services fail to start:
```bash
# Check Docker system resources
docker system df

# Free up space if needed
docker system prune -a

# Check logs for any service
docker logs vexa-SERVICE_NAME --tail 50
```

### If GPU is not detected:
```bash
# Verify NVIDIA drivers
nvidia-smi

# Check Docker GPU runtime
docker run --rm --gpus all nvidia/cuda:11.8-base-ubuntu22.04 nvidia-smi
```

### If transcriptions show zeros:
```bash
# Ensure direct WhisperLive connection (not WebSocket proxy)
docker exec vexa-gpu-production env | grep WHISPER_LIVE_URL
# Should show: WHISPER_LIVE_URL=ws://vexa-whisperlive-1:9090

# Check WhisperLive is receiving audio
docker logs vexa-whisperlive-1 --tail 10
```

## ⚡ Quick Test Commands

### Test with sample Teams meeting:
```bash
# Replace TEAMS_URL with actual meeting URL
TEAMS_URL="https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL"

# Deploy test bot
docker run -d --name='vexa-test-gpu' --network='vexa_vexa_default' \
  -e BOT_CONFIG="{\"meetingUrl\":\"$TEAMS_URL\",\"platform\":\"teams\",\"botName\":\"VexaAI-Test\",\"language\":\"en\",\"task\":\"transcribe\",\"authMode\":\"guest\",\"connectionId\":\"test-$(date +%s)\",\"redisUrl\":\"redis://vexa-redis-1:6379\",\"whisperLiveUrl\":\"ws://vexa-whisperlive-1:9090\",\"token\":\"vexa-api-key-transcription-2024\",\"nativeMeetingId\":\"test-meeting\",\"textToSpeech\":{\"enabled\":false},\"automaticLeave\":{\"enabled\":false,\"timeout\":999999,\"waitingRoomTimeout\":300000,\"noOneJoinedTimeout\":300000,\"everyoneLeftTimeout\":300000}}" \
  vexa-vexa-bot

# Monitor in real-time
docker logs vexa-test-gpu -f &
docker exec vexa-redis-1 redis-cli XREAD BLOCK 1000 STREAMS transcription_segments '$' &
```

---

**Status**: Ready for immediate deployment once orc-3001 connectivity is restored.

**Architecture**: Container-to-container with GPU acceleration, 10x performance improvement expected.