# Vexa.ai v0.6 Microsoft Teams Audio Solution Analysis

## Executive Summary

Vexa.ai v0.6 (released October 4, 2025) has successfully solved the Microsoft Teams audio streaming issue that we've been struggling with. Their solution is a **complete architectural overhaul** that abandons traditional Playwright audio capture methods in favor of **direct DOM media element manipulation** and **browser-based audio processing**.

## Key Technical Breakthroughs

### 1. Browser-Based Audio Capture Architecture

**Revolutionary Approach**: Instead of relying on Playwright's `page.video()` or external screen recording, Vexa.ai implemented a **browser-native audio capture system** that operates entirely within the web page context.

**Core Components**:
- **BrowserAudioService**: Captures audio directly from DOM media elements
- **BrowserWhisperLiveService**: Handles WebSocket connections from browser context
- **Combined Audio Stream Processing**: Merges multiple media sources in real-time

### 2. DOM Media Element Discovery

**Problem Solved**: Our previous attempts failed because we couldn't reliably capture Teams' audio stream.

**Vexa.ai's Solution**:
```typescript
// They find and capture ALL active media elements in the page
audioService.findMediaElements().then(async (mediaElements: HTMLMediaElement[]) => {
  if (mediaElements.length === 0) {
    reject(new Error("No active media elements found"));
    return;
  }
  // Create combined audio stream from ALL discovered media elements
  return await audioService.createCombinedAudioStream(mediaElements);
})
```

**Why This Works**:
- Teams uses multiple `<audio>` and `<video>` elements for different participants
- Traditional capture methods miss these distributed audio sources
- Direct DOM access captures the **actual rendered audio** that users hear

### 3. Advanced Audio Processing Pipeline

**Sophisticated Browser-Side Processing**:
```typescript
// Real-time audio processing with proper sample rates
const audioService = new BrowserAudioService({
  targetSampleRate: 16000,  // Whisper-optimized
  bufferSize: 4096,         // Balanced latency/quality
  inputChannels: 1,         // Mono for transcription
  outputChannels: 1
});

// Setup audio data processing with RMS/peak analysis
audioService.setupAudioDataProcessor(async (audioData: Float32Array, sessionStartTime: number | null) => {
  // Compute diagnostics
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < audioData.length; i++) {
    const v = audioData[i];
    sumSquares += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, audioData.length));
  
  // Send to WhisperLive with metadata
  whisperLiveService.sendAudioChunkMetadata(audioData.length, 16000);
  whisperLiveService.sendAudioData(audioData);
});
```

### 4. Teams-Specific Speaker Detection

**Multi-Layered Speaker Identification**:

1. **Voice Level Indicator Detection**: 
   - Monitors `voice-level-stream-outline` elements
   - **Key Insight**: Visible outline = SILENT, Hidden outline = SPEAKING
   
2. **ARIA-based Participant Tracking**:
   ```typescript
   function collectAriaParticipants(): string[] {
     const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
     const names = new Set<string>();
     for (const item of menuItems) {
       const hasImg = !!(item.querySelector('img') || item.querySelector('[role="img"]'));
       if (!hasImg) continue;
       // Extract participant name from accessible attributes
     }
     return Array.from(names);
   }
   ```

3. **Real-time Mutation Observation**:
   - Monitors DOM changes for speaking state transitions
   - Uses `requestAnimationFrame` for sub-second responsiveness
   - Debounced event firing to prevent spam

### 5. Stubborn WebSocket Reconnection

**"Never Give Up" Connection Strategy**:
```typescript
// BrowserWhisperLiveService with stubborn mode for Teams
const whisperLiveService = new BrowserWhisperLiveService({
  whisperLiveUrl: whisperUrlForBrowser
}, true); // Enable stubborn mode for Teams

// Stubborn reconnection - NEVER GIVES UP!
const whisperLiveUrl = await whisperLiveService.initializeWithStubbornReconnection("Teams");
```

**Why Critical for Teams**:
- Teams meetings can have network interruptions
- WebRTC connections may drop during screen sharing
- Ensures transcription continuity throughout entire meeting

## Architecture Comparison

### Our Previous Approach (FAILED)
```javascript
// ❌ External audio capture - missed Teams' distributed audio
const audioProcess = spawn('ffmpeg', [
  '-f', 'pulse',
  '-i', 'default',
  // ... complex external audio routing
]);

// ❌ Playwright video recording - couldn't access Teams audio
await page.video({ path: 'recording.webm' });
```

### Vexa.ai v0.6 Approach (SUCCESS)
```typescript
// ✅ Direct DOM media element capture
const mediaElements = await audioService.findMediaElements();
const combinedStream = await audioService.createCombinedAudioStream(mediaElements);
const processor = await audioService.initializeAudioProcessor(combinedStream);

// ✅ Browser-native audio processing
audioService.setupAudioDataProcessor(async (audioData: Float32Array) => {
  whisperLiveService.sendAudioData(audioData);
});
```

## Critical Implementation Details

### 1. Browser Context Isolation

**Problem**: Node.js cannot directly access Teams' audio streams
**Solution**: All audio processing happens in browser context

```typescript
// Everything critical runs in page.evaluate()
await page.evaluate(async (pageArgs) => {
  // Browser-side audio capture and processing
  const audioService = new BrowserAudioService(config);
  const whisperLiveService = new BrowserWhisperLiveService(config);
  
  // Direct media element access - only possible in browser context
  const mediaElements = document.querySelectorAll('audio, video');
  // ... process audio streams
});
```

### 2. Microsoft Edge Browser Requirement

**Critical Discovery**: Teams works best with Edge browser
```typescript
if (botConfig.platform === "teams") {
  log("Using MS Edge browser for Teams platform");
  browserInstance = await chromium.launch({ 
    headless: false,
    channel: 'msedge',  // KEY: Use Edge channel
    args: [
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors'
    ]
  });
}
```

### 3. Real-time Configuration Updates

**Dynamic Language/Task Changes**:
```typescript
// Node.js receives Redis commands
const handleRedisMessage = async (message: string, channel: string, page: Page) => {
  const command = JSON.parse(message);
  if (command.action === 'reconfigure') {
    // Send to browser context
    await page.evaluate(([lang, task]) => {
      const fn = window.triggerWebSocketReconfigure;
      if (typeof fn === 'function') {
        fn(lang, task);
      }
    }, [command.language, command.task]);
  }
};
```

## New Service Architecture

### 1. Microservices Approach
- **api-gateway**: Routes API requests
- **bot-manager**: Handles bot lifecycle  
- **vexa-bot**: Browser automation + audio capture
- **WhisperLive**: Real-time transcription
- **transcription-collector**: Processes transcripts

### 2. Container-to-Container Communication
```yaml
# docker-compose.yml - All services in Docker network
networks:
  vexa_default:
    driver: bridge

# Bot Manager launches bot containers dynamically
environment:
  - DOCKER_NETWORK=${COMPOSE_PROJECT_NAME:-vexa}_vexa_default
  - WHISPER_LIVE_URL=ws://traefik:8081/ws
```

### 3. Advanced Meeting Monitoring

**Multi-dimensional Monitoring**:
- Participant count tracking via ARIA roles
- Removal detection via DOM text analysis
- Automatic leave timeouts with different modes
- Speaking activity correlation with audio capture

## Why Our Previous Solutions Failed

### 1. **Wrong Audio Source**
- We tried to capture system audio or Playwright video
- Teams' audio is distributed across multiple DOM elements
- Only direct media element access works

### 2. **Wrong Browser**
- Chrome has restrictions for Teams
- Edge browser required for full Teams compatibility
- WebRTC permissions differ between browsers

### 3. **Wrong Architecture**
- Node.js-based audio capture misses browser context
- External tools can't access Teams' internal audio streams
- Browser-native processing is mandatory

### 4. **Insufficient Speaker Detection**
- We relied on simple DOM selectors
- Teams uses complex, dynamic UI elements
- Multiple detection methods needed for reliability

## Deployment Differences

### Our Current (Broken) Approach:
```bash
# ❌ Host-based bot deployment
node bot.js

# ❌ Manual Docker container management
docker run --name bot vexa-vexa-bot
```

### Vexa.ai v0.6 (Working) Approach:
```bash
# ✅ Microservice orchestration
make all TARGET=cpu

# ✅ Dynamic bot container spawning via bot-manager
curl -X POST http://api-gateway:8000/bots \
  -H "Content-Type: application/json" \
  -d '{"platform": "teams", "native_meeting_id": "123", "passcode": "456"}'
```

## Implementation Roadmap

### Phase 1: Architecture Migration
1. **Adopt Vexa.ai's service structure**
   - Implement bot-manager service
   - Create browser-based audio capture
   - Add stubborn WebSocket reconnection

### Phase 2: Teams-Specific Integration  
1. **Browser audio capture system**
   - Port BrowserAudioService
   - Implement media element discovery
   - Add combined audio stream processing

### Phase 3: Enhanced Speaker Detection
1. **Multi-layered speaker identification**
   - Voice level indicator monitoring
   - ARIA-based participant tracking
   - Real-time mutation observation

### Phase 4: Production Deployment
1. **Container orchestration**
   - Deploy on orc-3001 with new architecture
   - Implement dynamic bot spawning
   - Add monitoring and health checks

## Key Takeaways

1. **Browser Context is King**: All critical audio processing must happen in browser context
2. **Direct DOM Access Required**: Media element capture is the only reliable method for Teams
3. **Edge Browser Mandatory**: Teams has specific browser requirements
4. **Stubborn Reconnection Critical**: Teams meetings have network instability
5. **Multi-layered Detection Needed**: Teams UI is complex and dynamic

## Next Steps

The solution is clear: we need to completely rewrite our audio capture system using Vexa.ai's browser-native approach. The traditional external audio capture methods will never work reliably with Teams.

**Immediate Action**: Deploy Vexa.ai v0.6 architecture on orc-3001 and migrate our existing bot logic to their proven solution.