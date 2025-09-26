# 🎯 LIVE Teams Meeting Test - Audio Fix Validation

## 📋 **Meeting Information**
- **Meeting URL**: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_NjkyNDk3NTgtZjJhNC00MWE1LThlMjAtZTcyYmU5OTRlZDRi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d`
- **Test Purpose**: Validate Teams audio fix with real meeting
- **Expected Result**: Audio level monitoring to show current issue

## 🚀 **DEPLOYMENT COMMANDS**

### Step 1: Deploy Diagnostic Bot
```bash
docker run -d --name='teams-live-test' \
  --network='vexa_default' \
  -e BOT_CONFIG='{
    "meetingUrl": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_NjkyNDk3NTgtZjJhNC00MWE1LThlMjAtZTcyYmU5OTRlZDRi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d",
    "platform": "teams",
    "botName": "VexaAI-Live-Test",
    "language": "en",
    "task": "transcribe",
    "authMode": "guest",
    "connectionId": "live-test-session",
    "redisUrl": "redis://vexa-redis-1:6379",
    "whisperLiveUrl": "ws://vexa-whisperlive-cpu-1:9090",
    "token": "live-test-token",
    "nativeMeetingId": "live-test-meeting",
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

### Step 2: Monitor Audio Levels
```bash
# Watch for audio level detection
docker logs teams-live-test --follow | grep -E "(AUDIO LEVEL|DIAGNOSTIC|ERROR|joined)"
```

### Step 3: Check Transcriptions
```bash
# Monitor Redis for transcription data
docker exec vexa-redis-1 redis-cli XREAD COUNT 10 STREAMS transcription_segments '$'
```

## 📊 **Expected Results**

### Current State (Problem Confirmation)
```bash
🎤 DIAGNOSTIC: Starting audio capture to monitor levels
✅ DIAGNOSTIC: Got audio stream, creating audio context
🔍 DIAGNOSTIC: Audio monitoring pipeline active
🔇 AUDIO LEVEL: 0.000000 (SILENCE - this causes "You" transcriptions)
```

### WhisperLive Processing
```bash
# Redis transcription check should show:
"segments": [{"text": "You", "start": "0.0", "end": "1.0"}]
```

## 🎯 **Live Test Validation**

This test will prove:
1. ✅ Bot can join the real Teams meeting
2. 🔍 Audio monitoring shows silence (confirming diagnosis)
3. ❌ Transcriptions show "You" (proving the problem)
4. 🚀 Ready for WebRTC fix implementation

## ⏱️ **Test Duration**
- Bot will stay in meeting for monitoring
- Real-time audio level logging  
- Transcription quality assessment

**Status**: 🚀 READY TO DEPLOY TO LIVE MEETING