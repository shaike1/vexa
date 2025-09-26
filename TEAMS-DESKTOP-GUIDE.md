# Teams Desktop Audio Transcription Guide

## 🎯 Alternative Approach: Teams Desktop + System Audio Capture

This approach bypasses Teams browser security by using the official Teams desktop app and capturing system audio at the OS level.

### 📋 Prerequisites

1. **Microsoft Teams Desktop App** (not browser)
2. **System with speakers/headphones** (audio must play through system)
3. **WhisperLive service running** (our container setup)
4. **PulseAudio** (for Linux audio routing)

### 🚀 Quick Start

```bash
# 1. Ensure WhisperLive is running
COMPOSE_PROFILES=cpu docker compose up -d

# 2. Start Teams desktop audio capture
cd services/vexa-bot/core
node teams-desktop-audio.js
```

### 📱 Usage Workflow

1. **Start the capture system** (command above)
2. **Open Microsoft Teams DESKTOP APP** (not web browser)
3. **Join your meeting** using the desktop app
4. **Ensure audio plays through speakers** (not muted/headphones)
5. **Speak or have others speak** - transcription appears in terminal

### 🔧 How It Works

```
Teams Desktop App → System Audio → PulseAudio Monitor → teams-desktop-audio.js → WhisperLive → Transcription
```

**Key advantages:**
- ✅ Bypasses Teams browser security limitations
- ✅ Uses official Teams desktop client
- ✅ Captures all meeting audio (all participants)
- ✅ Works with existing WhisperLive infrastructure
- ✅ Real-time transcription

### 🎵 Audio Routing Details

The system:
1. **Captures system monitor audio** - whatever plays through speakers
2. **Routes to WhisperLive** - real-time processing
3. **Provides transcription** - of all meeting participants

### ⚡ Expected Output

```
🎤 Teams Desktop Audio Capture Starting...
=====================================
[Teams Audio] ✅ Connected to WhisperLive
[Teams Audio] ✅ WhisperLive ready for audio
[Teams Audio] ✅ Created Teams audio capture sink
[Teams Audio] ✅ Started system audio monitoring
🎯 READY FOR TEAMS MEETING TRANSCRIPTION!

📋 Instructions:
   1. Join your Teams meeting using the DESKTOP app
   2. Ensure meeting audio is playing through speakers
   3. Speak or have others speak in the meeting
   4. Watch for transcription output below

🎵 🎵 🎵 (audio activity indicators)
🗣️  TRANSCRIPTION: "Hello everyone, can you hear me?"
🗣️  TRANSCRIPTION: "Yes, we can hear you clearly"
```

### 🔍 Troubleshooting

**No audio capture:**
```bash
# Check system audio devices
pactl list sources short

# Test system audio monitoring
parec --device=@DEFAULT_MONITOR@ --format=s16le --rate=16000 --channels=1 | hexdump -C
```

**Teams desktop app issues:**
- Ensure using **desktop app**, not browser
- Check audio output is **not muted**
- Verify **speakers are working** (not just headphones)

**WhisperLive connection issues:**
```bash
# Check WhisperLive container
docker ps | grep whisperlive
docker logs vexa-whisperlive-cpu-2 --tail 10
```

### 🎊 Success Indicators

1. **WhisperLive Connected**: "✅ Connected to WhisperLive"
2. **Audio Monitoring**: "✅ Started system audio monitoring" 
3. **Activity**: Occasional `🎵` indicators during speech
4. **Transcription**: Real text output: `🗣️ TRANSCRIPTION: "..."`

---

This approach works around Teams security by capturing at the system level rather than browser level, providing real meeting transcription for all participants.