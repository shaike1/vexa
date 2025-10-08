# 🤖 Deploy WebRTC Bot to New Teams Meeting - Quick Guide

## 🚀 **Simple Deployment to New Meeting**

### **Option 1: Quick Command (Replace with your meeting URL)**
```bash
# On root@orc-3001, run this single command:
./deploy_webrtc_bot_new_meeting.sh "YOUR_NEW_TEAMS_MEETING_URL_HERE"
```

### **Option 2: Manual Docker Command**
```bash
# Replace MEETING_URL with your new Teams meeting link:
docker run -d --name='teams-webrtc-new' \
  --network='vexa_default' \
  -e BOT_CONFIG='{
    "meetingUrl": "YOUR_NEW_TEAMS_MEETING_URL_HERE",
    "platform": "teams",
    "botName": "VexaAI-WebRTC-Enhanced",
    "language": "en",
    "task": "transcribe",
    "authMode": "guest",
    "connectionId": "webrtc-new-session",
    "redisUrl": "redis://vexa-redis-1:6379",
    "whisperLiveUrl": "ws://vexa-whisperlive-cpu-1:9090",
    "token": "webrtc-new-token",
    "nativeMeetingId": "webrtc-new-meeting",
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

## 📋 **What You Need:**

1. **Teams Meeting URL**: The full `https://teams.microsoft.com/l/meetup-join/...` link
2. **Server Access**: SSH to `root@orc-3001`
3. **Meeting Access**: Make sure the meeting allows guests to join

## 🔍 **Monitor the Bot:**

### **Watch Bot Join Meeting:**
```bash
docker logs teams-webrtc-new --follow
```

### **Monitor Audio Levels:**
```bash
docker logs teams-webrtc-new --follow | grep "AUDIO LEVEL"
```

### **Check Transcriptions:**
```bash
docker exec vexa-redis-1 redis-cli XREAD STREAMS transcription_segments '$'
```

## 🎯 **Expected Results with WebRTC Fix:**

- **✅ Bot Joins**: Should join meeting as "VexaAI-WebRTC-Enhanced"
- **✅ Audio Detection**: `WEBRTC AUDIO LEVEL: >0.00001 (REAL AUDIO!)`
- **✅ Real Transcriptions**: Your actual speech transcribed accurately
- **❌ No More "You"**: End of the transcription issue

## 🧹 **Managing Multiple Bots:**

### **List Active Bots:**
```bash
docker ps | grep teams-webrtc
```

### **Stop Old Bot:**
```bash
docker stop teams-webrtc-production && docker rm teams-webrtc-production
```

### **Clean Up All Test Bots:**
```bash
docker stop $(docker ps -q --filter "name=teams-") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=teams-") 2>/dev/null || true
```

## 🎤 **Ready to Test!**

1. **Get your new Teams meeting URL**
2. **Run the deployment command**  
3. **Wait 30-60 seconds for bot to join**
4. **Speak clearly in the meeting**
5. **Watch for enhanced audio detection and real transcriptions!**

**The WebRTC audio fix is ready to be deployed to any new Teams meeting instantly!**