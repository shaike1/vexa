# Vexa Real-Time Transcription - Quick Start

## 🚀 One-Command Deployment

### Prerequisites
- System with microphone (laptop/desktop with mic)
- Docker installed
- Node.js 18+ installed

### Start Transcription (3 commands)

```bash
# 1. Start WhisperLive service
COMPOSE_PROFILES=cpu docker compose up -d

# 2. Start bridge server
cd services/vexa-bot/core && node simple-bridge.js &

# 3. Start real-time transcription
node desktop-audio-router.js
```

**Now speak into your microphone!** 🎤

## ✅ Success Output
```
🎤 Desktop Audio Router Starting...
[Desktop Audio] ✅ Connected to bridge
🎤 Capturing MICROPHONE AUDIO (your voice)
🎯 READY FOR TRANSCRIPTION!
```

## 🗣️ Features
- ✅ Real-time speech-to-text
- ✅ Works while muted in Teams 
- ✅ Private transcription notes
- ✅ No Teams permissions needed
- ✅ Direct microphone access

## 🔧 Architecture
```
Your Voice → Microphone → Desktop Router → Bridge → WhisperLive → Text
```

**That's it!** The system captures your speech and provides real-time transcription independent of any Teams meeting audio controls.