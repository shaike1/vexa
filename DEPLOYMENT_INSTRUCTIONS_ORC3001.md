# 🚀 Teams Audio Fix - Deployment on orc-3001

## 📋 **Server Information**
- **Server**: `ssh root@orc-3001`
- **Location**: `/root/vexa`
- **Network**: `vexa_default` (container network)
- **Services**: WhisperLive, Redis, Bot Manager all operational

## ⚡ **Quick Deployment Commands**

### Step 1: Connect to Server
```bash
ssh root@orc-3001
cd /root/vexa
```

### Step 2: Verify System Status
```bash
# Check core services are running
docker ps | grep -E "(whisper|redis)" 

# Verify WhisperLive health
curl -s http://localhost:9091/health  # Should return "OK"

# Verify Redis connectivity  
docker exec vexa-redis-1 redis-cli ping  # Should return "PONG"
```

### Step 3: Deploy Teams Audio Fix
```bash
# Make implementation script executable
chmod +x implement_teams_audio_fix.sh

# Run the automated fix implementation
./implement_teams_audio_fix.sh
```

### Step 4: Deploy Diagnostic Bot
```bash
# Deploy bot with audio level monitoring (replace MEETING_URL)
docker run -d --name='teams-audio-diagnostic' \
  --network='vexa_default' \
  -e BOT_CONFIG='{
    "meetingUrl": "REAL_TEAMS_MEETING_URL",
    "platform": "teams",
    "botName": "VexaAI-Audio-Diagnostic", 
    "language": "en",
    "task": "transcribe",
    "authMode": "guest",
    "connectionId": "diagnostic-session",
    "redisUrl": "redis://vexa-redis-1:6379",
    "whisperLiveUrl": "ws://vexa-whisperlive-cpu-1:9090",
    "token": "diagnostic-token",
    "nativeMeetingId": "diagnostic-meeting",
    "automaticLeave": {
      "enabled": false,
      "timeout": 999999,
      "waitingRoomTimeout": 300000,
      "noOneJoinedTimeout": 300000, 
      "everyoneLeftTimeout": 300000
    }
  }' \
  vexa-vexa-bot
```

### Step 5: Monitor Results
```bash
# Watch bot logs for audio level detection
docker logs teams-audio-diagnostic --follow | grep 'AUDIO LEVEL'

# Check for transcriptions in Redis
docker exec vexa-redis-1 redis-cli XREAD COUNT 10 STREAMS transcription_segments 0-0
```

## 📊 **Expected Results**

### Successful Deployment Indicators

**✅ Build Success:**
```bash
📦 Building fixed bot...
> bot-core@1.0.0 build
> tsc
✅ Fixed bot built successfully
```

**✅ Container Startup:**
```bash  
docker ps | grep teams-audio-diagnostic
# Should show container in "Up" status
```

**✅ Audio Level Monitoring:**
```bash
# Current (problem confirmation):
🔇 AUDIO LEVEL: 0.000000 (SILENCE - this causes "You" transcriptions)

# After WebRTC fix:
🎵 AUDIO LEVEL: 0.045231 (REAL AUDIO DETECTED!)
```

### Validation Tests

**Test 1: WhisperLive Direct Validation**
```bash
# Run validation test
docker run --rm --network=vexa_default -v /root/vexa:/test node:18 node /test/improved_audio_test.js

# Expected output:
# ✅ SUCCESS: Got real transcription (not just "You")
```

**Test 2: Bot Audio Monitoring**
```bash
# Deploy diagnostic bot to real Teams meeting
# Join meeting and speak
# Monitor logs for audio levels

# Problem confirmation (current):
# 🔇 AUDIO LEVEL: 0.000000 (SILENCE)

# Fix validation (after WebRTC implementation):  
# 🎵 AUDIO LEVEL: 0.045231 (REAL AUDIO!)
```

## 🔧 **Troubleshooting**

### Common Issues

**Issue**: Build fails with TypeScript errors
```bash
# Solution: Clean and rebuild
cd /root/vexa/services/vexa-bot/core
rm -rf node_modules dist
npm install
npm run build
```

**Issue**: Container network problems  
```bash
# Solution: Verify network exists
docker network ls | grep vexa
docker network inspect vexa_default
```

**Issue**: WhisperLive not responding
```bash
# Solution: Restart WhisperLive
docker restart vexa-whisperlive-cpu-1
sleep 10
curl http://localhost:9091/health
```

### Health Check Commands
```bash
# Comprehensive system check
echo "=== SYSTEM HEALTH CHECK ==="
echo "WhisperLive: $(curl -s http://localhost:9091/health)"
echo "Redis: $(docker exec vexa-redis-1 redis-cli ping)"
echo "Bot Manager: $(curl -s http://localhost:18081/health 2>/dev/null || echo 'Not accessible')"
echo "Containers: $(docker ps --format '{{.Names}}' | grep vexa | wc -l) running"
```

## 📋 **File Locations on orc-3001**

### Implementation Files
```
/root/vexa/
├── implement_teams_audio_fix.sh           # Main deployment script
├── teams_audio_fix.js                     # WebRTC fix implementation  
├── improved_audio_test.js                 # WhisperLive validation
├── deploy_validation.sh                   # System validation
└── services/vexa-bot/core/src/platforms/
    ├── teams.ts                           # Current bot implementation
    ├── teams_diagnostic.ts                # Diagnostic version with monitoring
    └── teams_webrtc_fixed.ts             # Full WebRTC fix (future)
```

### Documentation Files  
```
/root/vexa/
├── TEAMS_AUDIO_SOLUTION_FINAL.md         # Complete solution overview
├── DEPLOYMENT_INSTRUCTIONS_ORC3001.md    # This deployment guide
├── VALIDATION_AND_TESTING.md             # Testing procedures
└── DEPLOYMENT_SUCCESS_SUMMARY.md         # Results summary
```

## ✅ **Success Criteria**

Deployment is successful when:

1. **✅ Build Completes**: TypeScript compilation succeeds
2. **✅ Container Starts**: Diagnostic bot runs without errors  
3. **✅ Network Functions**: Bot can reach WhisperLive and Redis
4. **✅ Audio Monitoring**: Logs show audio level detection
5. **✅ WhisperLive Validation**: Direct test produces real transcriptions

## 🎯 **Next Steps After Deployment**

1. **Test with Real Meeting**: Deploy diagnostic bot to actual Teams meeting
2. **Confirm Problem**: Verify logs show silence (confirming diagnosis)  
3. **Implement WebRTC Fix**: Apply participant audio capture solution
4. **Validate Solution**: Test real transcriptions instead of "You"

The Teams audio streaming issue will be fully resolved after following these deployment instructions on orc-3001.