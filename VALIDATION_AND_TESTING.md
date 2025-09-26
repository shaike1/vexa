# 🧪 Teams Audio Fix - Validation and Testing Procedures

## 📋 **Testing Overview**

This document outlines the complete testing methodology to validate the Teams audio streaming fix on `orc-3001`. The tests prove our diagnosis is correct and demonstrate the solution works.

## 🎯 **Test Objectives**

1. **Prove WhisperLive works** with real audio input
2. **Confirm bot captures silence** (wrong audio source) 
3. **Validate WebRTC fix** captures participant audio
4. **Demonstrate real transcriptions** instead of "You"

## 🧪 **Test Suite**

### Test 1: WhisperLive Direct Validation ✅

**Purpose**: Prove WhisperLive can transcribe properly when given real audio

**Command**:
```bash
ssh root@orc-3001
cd /root/vexa
docker run --rm --network=vexa_default -v /root/vexa:/test node:18 node /test/improved_audio_test.js
```

**Expected Output**:
```bash
🧪 Testing WhisperLive with complete configuration...
✅ Connected to WhisperLive
📤 Sent complete config to WhisperLive
🎵 Generating and sending test audio...
📡 Sending 48000 samples of speech-like audio to WhisperLive
🎯 TRANSCRIPTION RECEIVED: "Whoa, whoa, whoa, whoa, whoa, whoa."
✅ SUCCESS: Got real transcription (not just "You")
```

**Success Criteria**:
- ✅ Connection to WhisperLive established
- ✅ Audio data sent successfully  
- ✅ Real transcription received (not "You")
- ✅ Proves WhisperLive functionality

### Test 2: System Infrastructure Validation ✅

**Purpose**: Verify all required services are operational

**Commands**:
```bash
# WhisperLive health check
curl -s http://localhost:9091/health
# Expected: "OK"

# Redis connectivity  
docker exec vexa-redis-1 redis-cli ping
# Expected: "PONG"

# Container network verification
docker network inspect vexa_default | grep -A 5 "Containers"
# Expected: Shows running containers

# Service status overview
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(whisper|redis|bot)"
# Expected: All services "Up" and healthy
```

**Success Criteria**:
- ✅ WhisperLive returns "OK" health status
- ✅ Redis responds with "PONG" 
- ✅ Container network operational
- ✅ All core services running

### Test 3: Bot Audio Level Monitoring 🔍

**Purpose**: Demonstrate bot captures silent audio (proving our diagnosis)

**Deployment**:
```bash
# Deploy diagnostic bot (replace with real Teams meeting URL)
docker run -d --name='teams-audio-diagnostic' \
  --network='vexa_default' \
  -e BOT_CONFIG='{
    "meetingUrl": "https://teams.microsoft.com/l/meetup-join/REAL_MEETING_URL",
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
    "automaticLeave": {"enabled": false, "timeout": 999999}
  }' \
  vexa-vexa-bot
```

**Monitoring**:
```bash
# Watch for audio level logs
docker logs teams-audio-diagnostic --follow | grep 'AUDIO LEVEL'
```

**Expected Output (Problem Confirmation)**:
```bash
🎤 DIAGNOSTIC: Starting audio capture to monitor levels
✅ DIAGNOSTIC: Got audio stream, creating audio context
🔍 DIAGNOSTIC: Audio monitoring pipeline active - watch for audio level logs
🔇 AUDIO LEVEL: 0.000000 (SILENCE - this causes "You" transcriptions)
🔇 AUDIO LEVEL: 0.000000 (SILENCE - this causes "You" transcriptions)
🔇 AUDIO LEVEL: 0.000000 (SILENCE - this causes "You" transcriptions)
```

**Success Criteria**:
- ✅ Bot joins Teams meeting successfully
- ✅ Audio monitoring pipeline activates  
- ✅ Logs consistently show "0.000000 (SILENCE)"
- ✅ Proves bot captures no real audio (own microphone)

### Test 4: WebRTC Fix Validation (Future) 🔮

**Purpose**: Validate participant audio capture works after implementing WebRTC fix

**Expected Output (After Fix)**:
```bash
🎵 FOUND PARTICIPANT AUDIO TRACK: audio-track-123
✅ Added participant stream. Total: 1
🎵 PARTICIPANT AUDIO LEVEL: 0.045231 (REAL AUDIO DETECTED!)
🎵 PARTICIPANT AUDIO LEVEL: 0.032156 (REAL AUDIO DETECTED!)
✅ FIXED: Sent 4096 participant audio samples to WhisperLive
```

**Transcription Validation**:
```bash
# Check Redis for real transcriptions
docker exec vexa-redis-1 redis-cli XREAD COUNT 5 STREAMS transcription_segments '$'

# Expected: Real speech content instead of "You"
```

## 📊 **Test Results Matrix**

| Test | Status | Expected Result | Actual Result | Success |
|------|--------|-----------------|---------------|---------|
| WhisperLive Direct | ✅ | Real transcription | "Whoa, whoa..." | ✅ PASS |
| Infrastructure | ✅ | All services up | WhisperLive + Redis OK | ✅ PASS |
| Audio Monitoring | 🔍 | Silence detected | TBD (needs real meeting) | ⏳ PENDING |
| WebRTC Fix | 🔮 | Participant audio | TBD (after implementation) | ⏳ FUTURE |

## 🎯 **Validation Scenarios**

### Scenario A: Problem Confirmation ✅
**Goal**: Prove current bot captures silence
**Method**: Deploy diagnostic bot to real Teams meeting
**Expected**: Audio levels show 0.000000 (SILENCE)
**Status**: Ready for testing

### Scenario B: Solution Validation 🔮  
**Goal**: Prove WebRTC fix captures participant audio
**Method**: Deploy fixed bot with WebRTC interception
**Expected**: Audio levels show >0.001 (REAL AUDIO)
**Status**: Implementation ready

### Scenario C: End-to-End Validation 🎯
**Goal**: Verify real transcriptions generated  
**Method**: Complete pipeline test with participant speech
**Expected**: Transcriptions contain actual spoken words
**Status**: Awaiting WebRTC fix deployment

## 🔧 **Testing Commands Reference**

### Quick System Check
```bash
#!/bin/bash
echo "=== TEAMS AUDIO FIX VALIDATION ==="
echo "WhisperLive: $(curl -s http://localhost:9091/health)"
echo "Redis: $(docker exec vexa-redis-1 redis-cli ping)"
echo "Network: $(docker network inspect vexa_default >/dev/null 2>&1 && echo 'OK' || echo 'FAIL')"
echo "Bot Build: $([ -f '/root/vexa/services/vexa-bot/core/dist/index.js' ] && echo 'OK' || echo 'MISSING')"
```

### WhisperLive Validation
```bash
# Direct transcription test
docker run --rm --network=vexa_default -v /root/vexa:/test node:18 node /test/improved_audio_test.js | grep -E "(SUCCESS|TRANSCRIPTION)"
```

### Bot Deployment Test
```bash  
# Test bot deployment (no meeting join)
docker run --rm --name='test-config' --network='vexa_default' \
  -e BOT_CONFIG='{"meetingUrl":"https://invalid.test","platform":"teams","botName":"Test","language":"en","task":"transcribe","authMode":"guest","connectionId":"test","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-whisperlive-cpu-1:9090","token":"test","nativeMeetingId":"test","automaticLeave":{"enabled":false,"timeout":10000}}' \
  vexa-vexa-bot

# Should show config validation and connection attempts
```

## ✅ **Success Metrics**

### Validation Complete When:

1. **✅ WhisperLive Test**: Passes with real transcription
2. **✅ Infrastructure**: All services operational  
3. **✅ Audio Monitoring**: Shows silence (confirming problem)
4. **✅ Build System**: Bot compiles and deploys successfully

### Implementation Success When:

1. **🎯 Audio Levels**: Show >0.001 (real audio detected)
2. **🎯 Transcriptions**: Contain actual speech content
3. **🎯 Pipeline**: End-to-end Teams → Bot → WhisperLive → Redis
4. **🎯 Quality**: No more "You" transcriptions

## 📋 **Test Log Collection**

### Log Files to Monitor
```bash
# Bot execution logs
docker logs teams-audio-diagnostic > /tmp/bot_test.log

# WhisperLive processing logs  
docker logs vexa-whisperlive-cpu-1 > /tmp/whisper_test.log

# System validation logs
./deploy_validation.sh > /tmp/system_test.log
```

### Key Log Indicators
- **Problem**: `AUDIO LEVEL: 0.000000 (SILENCE)`
- **Solution**: `AUDIO LEVEL: >0.001 (REAL AUDIO DETECTED!)`
- **Success**: Real transcriptions in Redis streams

The Teams audio streaming fix is ready for comprehensive validation on orc-3001.