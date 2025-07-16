# 🤖 Dual Bot Testing Guide - Speaker & Transcription Bots

## Overview

This guide demonstrates how to deploy both a **Speaker Bot** and a **Transcription Bot** to the same Teams meeting for comprehensive testing of the transcription pipeline.

## 🎯 Bot Roles

### 1. Speaker Bot (`task: "speak"`)
- **Purpose**: Generates test speech using browser's Speech Synthesis API
- **Function**: Provides consistent audio input for transcription testing
- **Features**:
  - Joins meeting as "Speaker Bot"
  - Speaks predefined test phrases
  - Enables microphone audio for other bots to capture

### 2. Transcription Bot (`task: "transcribe"`)
- **Purpose**: Captures and transcribes all meeting audio in real-time
- **Function**: Processes audio through WhisperLive transcription service
- **Features**:
  - Joins meeting as "Transcription Bot"
  - Captures audio from all participants (including Speaker Bot)
  - Sends audio to WhisperLive via Node.js proxy bridge
  - Returns real-time transcription results

## 🚀 Quick Launch Commands

### Start Both Bots for Live Testing

```bash
# 1. Start Speaker Bot
docker run -d --name speaker-bot-live \
  --network vexa_vexa_default \
  -e BOT_CONFIG='{"meetingUrl":"https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d","botName":"Speaker Bot 🎤","platform":"teams","task":"speak","language":"en","connectionId":"speaker-live-001","token":"test-token","nativeMeetingId":"live-meeting-001","redisUrl":"redis://redis:6379/0","automaticLeave":{"waitingRoomTimeout":300,"noOneJoinedTimeout":600,"everyoneLeftTimeout":180}}' \
  -e WHISPER_LIVE_URL="ws://whisperlive-cpu:9090" \
  vexa-bot:node-proxy-fix

# 2. Start Transcription Bot
docker run -d --name transcription-bot-live \
  --network vexa_vexa_default \
  -e BOT_CONFIG='{"meetingUrl":"https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d","botName":"Transcription Bot 📝","platform":"teams","task":"transcribe","language":"en","connectionId":"transcription-live-002","token":"test-token","nativeMeetingId":"live-meeting-002","redisUrl":"redis://redis:6379/0","automaticLeave":{"waitingRoomTimeout":300,"noOneJoinedTimeout":600,"everyoneLeftTimeout":180}}' \
  -e WHISPER_LIVE_URL="ws://whisperlive-cpu:9090" \
  vexa-bot:node-proxy-fix
```

## 📊 Monitoring Commands

### Check Bot Status
```bash
# Check both bots are running
docker ps | grep -E "(speaker-bot-live|transcription-bot-live)"

# Monitor Speaker Bot logs
docker logs speaker-bot-live --follow

# Monitor Transcription Bot logs  
docker logs transcription-bot-live --follow

# Check WebSocket proxy sessions
docker logs vexa_websocket-proxy_1 --tail=20
```

### Key Log Indicators

#### ✅ Success Indicators:
- `Successfully admitted to the Teams meeting`
- `HTTP Proxy session initialized successfully`
- `Audio data sent successfully via Node.js bridge`
- `SERVER_READY` messages from WhisperLive

#### ⚠️ Watch for:
- `Failed to initialize proxy session`
- `WebSocket not ready`
- `Audio permission denied`

## 🔧 Technical Architecture

### Node.js Proxy Bridge
- **Purpose**: Bypasses browser security restrictions for WebSocket communication
- **Components**:
  - `initializeProxySession()` - Establishes connection to WhisperLive
  - `sendAudioToProxy()` - Streams audio data for transcription
  - `closeProxySession()` - Cleanly terminates session

### Audio Processing Pipeline
```
Speaker Bot → Speech Synthesis → Teams Meeting Audio
                                       ↓
Transcription Bot → Audio Capture → Node.js Proxy → WebSocket Proxy → WhisperLive → Transcription
```

## 🎭 Testing Scenarios

### 1. Basic Functionality Test
- Both bots join the meeting
- Speaker Bot announces itself and starts speaking test phrases
- Transcription Bot captures and processes audio
- Real-time transcription results are generated

### 2. Audio Quality Test
- Speaker Bot speaks clearly defined test phrases
- Transcription Bot validates audio reception quality
- Compare transcription accuracy against known input

### 3. Concurrent Session Test
- Multiple proxy sessions operate simultaneously
- No interference between bot audio streams
- Independent session management

## 🚨 Manual Admission Required

**IMPORTANT**: Both bots will appear in the Teams meeting lobby and require manual admission:

1. **Join the meeting** using the provided link
2. **Check the lobby** for waiting participants:
   - "Speaker Bot 🎤" 
   - "Transcription Bot 📝"
3. **Admit both bots** to the meeting
4. **Observe**: Both bots will start their respective tasks automatically

## 📋 Expected Behavior

### Speaker Bot:
1. Joins meeting as "Speaker Bot 🎤"
2. Announces start of transcription test
3. Speaks test phrases:
   - "Testing transcription functionality. This is test phrase one."
   - "Hello, this is the second test phrase for transcription verification."
   - "The quick brown fox jumps over the lazy dog. Test phrase three complete."
4. Repeats speech cycle for continuous testing

### Transcription Bot:
1. Joins meeting as "Transcription Bot 📝"
2. Initializes WebSocket proxy session
3. Begins audio capture from meeting
4. Sends audio data to WhisperLive
5. Processes real-time transcription results

## 🧹 Cleanup Commands

```bash
# Stop and remove both bots
docker rm -f speaker-bot-live transcription-bot-live

# Check proxy sessions are closed
docker logs vexa_websocket-proxy_1 --tail=10
```

## 🔍 Troubleshooting

### Common Issues:

1. **Bots don't join meeting**
   - Check if meeting URL is still valid
   - Verify network connectivity: `docker exec speaker-bot-live curl -s http://websocket-proxy:8090/health`

2. **Audio not captured**
   - Check browser permissions in bot logs
   - Verify PulseAudio is running: `docker exec transcription-bot-live pulseaudio --check`

3. **Transcription not working**
   - Verify WhisperLive service: `docker logs vexa_whisperlive-cpu_1`
   - Check proxy connectivity: `docker logs vexa_websocket-proxy_1`

### Debug Commands:
```bash
# Test proxy endpoints
docker exec transcription-bot-live curl -X POST http://websocket-proxy:8090/initialize \
  -H "Content-Type: application/json" \
  -d '{"uid":"debug-test","platform":"teams","language":"en","task":"transcribe"}'

# Check audio devices
docker exec speaker-bot-live pactl list sources short
```

## 🎯 Success Metrics

- ✅ Both bots successfully join Teams meeting
- ✅ Speaker Bot generates audible test speech
- ✅ Transcription Bot captures and processes audio
- ✅ WebSocket proxy maintains stable connections
- ✅ Real-time transcription results are generated
- ✅ No audio interference between bots
- ✅ Clean session management and cleanup

---

**Ready for Live Testing!** 🚀

The system is now configured for comprehensive dual-bot testing with the provided meeting link. Both bots will demonstrate the complete transcription pipeline working end-to-end.