# 🔍 Teams Audio Issue Root Cause Analysis & Fix Plan

## 🎯 **FOUND THE REAL PROBLEM**

After analyzing the code, I've identified the **exact issue** causing "You" transcriptions:

### **🚨 Critical Problem: No Real Meeting Audio Capture**

The bot is using `getUserMedia()` to capture **bot's own microphone**, not the **meeting participants' audio**:

```typescript
// Line 2238: This captures bot's microphone, not meeting audio
const mediaStream = audioContext.createMediaStreamSource(stream);
```

**What's happening**:
1. Bot joins Teams meeting ✅
2. Bot requests microphone access with `getUserMedia()` ✅  
3. Bot processes **ITS OWN microphone audio** (mostly silence) ❌
4. Bot sends **silent/zero audio data** to WhisperLive ❌
5. WhisperLive processes silence → defaults to "You" transcription ❌

### **🔧 Root Cause: Wrong Audio Source**

```typescript
// WRONG: Captures bot's microphone (silent)
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: { echoCancellation: false, noiseSuppression: false } 
});

// NEED: Capture meeting participants' audio from Teams WebRTC streams
```

## 🎯 **The Fix: Intercept Teams Audio Streams**

### **Solution 1: WebRTC Stream Interception (RECOMMENDED)**

Teams uses WebRTC for audio. We need to intercept the **incoming audio streams**:

```typescript
// Intercept WebRTC audio streams from meeting participants
const interceptTeamsAudio = () => {
  const originalSetRemoteDescription = RTCPeerConnection.prototype.setRemoteDescription;
  RTCPeerConnection.prototype.setRemoteDescription = function(...args) {
    const result = originalSetRemoteDescription.apply(this, args);
    
    this.addEventListener('track', (event) => {
      if (event.track.kind === 'audio') {
        console.log('🎤 Captured Teams participant audio track');
        // Process this audio stream instead of bot's microphone
        processParticipantAudio(event.streams[0]);
      }
    });
    
    return result;
  };
};
```

### **Solution 2: Audio Element Interception**

Teams renders participant audio via HTML5 audio/video elements:

```typescript
// Find and capture audio from participant video elements
const captureTeamsAudio = () => {
  const videoElements = document.querySelectorAll('video, audio');
  videoElements.forEach((element) => {
    if (element.srcObject) {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(element);
      // Process this audio stream for transcription
      processAudioStream(source);
    }
  });
};
```

### **Solution 3: Teams Desktop Audio Injection**

For desktop Teams, inject audio directly into the meeting:

```typescript
// Generate test audio and inject into Teams meeting stream
const injectTestAudio = async () => {
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Speak test phrases that should be transcribed
  const phrases = ["Hello this is a test", "Can you hear me now", "Testing transcription"];
  // ... implementation
};
```

## 🚀 **Implementation Plan**

### **Phase 1: Diagnostic Bot**
Create a bot that logs exactly what audio it's capturing:

```typescript
recorder.onaudioprocess = async (event) => {
  const inputData = event.inputBuffer.getChannelData(0);
  
  // Calculate audio levels to detect if we're getting real audio
  let sum = 0;
  for (let i = 0; i < inputData.length; i++) {
    sum += Math.abs(inputData[i]);
  }
  const averageLevel = sum / inputData.length;
  
  console.log(`🎵 Audio Level: ${averageLevel.toFixed(6)} (${averageLevel > 0.001 ? 'REAL AUDIO' : 'SILENCE'})`);
  
  if (averageLevel > 0.001) {
    console.log('✅ REAL AUDIO DETECTED - This should transcribe properly');
  } else {
    console.log('❌ SILENCE DETECTED - This will transcribe as "You"');
  }
};
```

### **Phase 2: WebRTC Interception**
Replace the microphone capture with WebRTC stream interception:

```typescript
// Replace line ~2238 in teams.ts
const captureParticipantAudio = async () => {
  // Intercept WebRTC streams instead of using getUserMedia
  const audioStreams = await interceptTeamsWebRTCAudio();
  
  if (audioStreams.length > 0) {
    console.log(`🎤 Found ${audioStreams.length} participant audio streams`);
    const audioContext = new AudioContext();
    const mediaStream = audioContext.createMediaStreamSource(audioStreams[0]);
    // Continue with existing processing pipeline...
  } else {
    console.log('❌ No participant audio streams found - using fallback');
    // Fallback to current implementation
  }
};
```

### **Phase 3: Testing & Validation**
Deploy test bot with audio level monitoring:

```bash
# Deploy diagnostic bot to real Teams meeting
docker run -d --name='teams-audio-diagnostic' \
  --network='vexa_default' \
  -e BOT_CONFIG='{"meetingUrl":"REAL_TEAMS_URL","platform":"teams","botName":"Audio-Diagnostic-Bot","language":"en","task":"transcribe","authMode":"guest","connectionId":"diagnostic-session","redisUrl":"redis://vexa-redis-1:6379","whisperLiveUrl":"ws://vexa-whisperlive-cpu-1:9090","token":"diagnostic-token","nativeMeetingId":"diagnostic-meeting","automaticLeave":{"enabled":false,"timeout":999999}}' \
  vexa-vexa-bot
```

## 📋 **Expected Results After Fix**

### **Before (Current)**:
```
🎵 Audio Level: 0.000000 (SILENCE)
❌ SILENCE DETECTED - This will transcribe as "You"
WhisperLive receives: [0,0,0,0,0,0,0...]
Transcription: "You"
```

### **After (Fixed)**:
```
🎵 Audio Level: 0.045231 (REAL AUDIO)  
✅ REAL AUDIO DETECTED - This should transcribe properly
WhisperLive receives: [0.1,-0.2,0.3,0.1,-0.4...]
Transcription: "Hello, this is John speaking in the meeting"
```

## 🎯 **Next Steps**

1. **Create diagnostic bot** to confirm audio levels
2. **Implement WebRTC interception** to capture participant audio  
3. **Test with real Teams meeting** and verify transcriptions
4. **Replace microphone capture** with participant audio capture

**Status**: Ready to implement the fix - we now know exactly what's broken and how to fix it!