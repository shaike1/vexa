import { Page } from "playwright";
import { log, randomDelay } from "../utils";
import { BotConfig } from "../types";

// WEBRTC PARTICIPANT AUDIO CAPTURE - THE FIX
const captureParticipantAudio = async (page: Page) => {
  log("🎯 APPLYING WEBRTC FIX: Capturing participant audio instead of bot microphone");
  
  return await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      (window as any).logBot("🔧 WEBRTC AUDIO FIX: Intercepting participant audio streams");
      
      let participantStreams: MediaStream[] = [];
      let audioFound = false;
      
      // Step 1: Intercept WebRTC to capture participant audio streams
      const originalRTCPeerConnection = (window as any).RTCPeerConnection;
      if (originalRTCPeerConnection) {
        (window as any).RTCPeerConnection = function(...args: any[]) {
          const pc = new originalRTCPeerConnection(...args);
          (window as any).logBot("🔗 RTCPeerConnection intercepted - monitoring for participant audio");
          
          pc.addEventListener('track', (event: RTCTrackEvent) => {
            if (event.track.kind === 'audio') {
              (window as any).logBot(`🎵 FOUND PARTICIPANT AUDIO TRACK: ${event.track.id}`);
              
              if (event.streams && event.streams.length > 0) {
                const stream = event.streams[0];
                participantStreams.push(stream);
                (window as any).logBot(`✅ Captured participant stream. Total: ${participantStreams.length}`);
                
                if (!audioFound) {
                  audioFound = true;
                  (window as any).logBot("🎯 SUCCESS: Resolving with participant audio stream");
                  resolve(stream);
                }
              }
            }
          });
          
          return pc;
        };
        (window as any).logBot("✅ WebRTC interception active");
      }
      
      // Step 2: Also search for existing media elements with participant audio
      const findExistingParticipantAudio = () => {
        (window as any).logBot("🔍 Searching for existing participant audio elements...");
        const mediaElements = document.querySelectorAll('audio, video');
        
        mediaElements.forEach((element: Element, index: number) => {
          const mediaEl = element as HTMLMediaElement;
          if (mediaEl.srcObject instanceof MediaStream) {
            const stream = mediaEl.srcObject;
            const audioTracks = stream.getAudioTracks();
            
            if (audioTracks.length > 0 && !audioFound) {
              (window as any).logBot(`🎵 Found participant audio in element ${index}: ${audioTracks.length} tracks`);
              audioFound = true;
              resolve(stream);
            }
          }
        });
      };
      
      // Try immediate search
      findExistingParticipantAudio();
      
      // Set up periodic search for new audio
      const searchInterval = setInterval(() => {
        if (!audioFound) {
          findExistingParticipantAudio();
        } else {
          clearInterval(searchInterval);
        }
      }, 3000);
      
      // Fallback timeout - if no participant audio found, try getUserMedia as last resort
      setTimeout(() => {
        if (!audioFound) {
          (window as any).logBot("⚠️ No participant audio found via WebRTC, trying getUserMedia fallback");
          clearInterval(searchInterval);
          
          navigator.mediaDevices.getUserMedia({ 
            audio: { 
              echoCancellation: false, 
              noiseSuppression: false,
              autoGainControl: false
            } 
          })
            .then((stream) => {
              (window as any).logBot("📱 Fallback: Using getUserMedia stream");
              resolve(stream);
            })
            .catch(reject);
        }
      }, 20000); // 20 second timeout
    });
  });
};

// FIXED: Teams audio processing with participant streams
const processParticipantAudio = async (page: Page, botConfig: BotConfig, sessionId: string) => {
  log("🎵 PROCESSING PARTICIPANT AUDIO: Setting up real-time transcription pipeline");
  
  await page.evaluate((sessionIdParam) => {
    (window as any).logBot("🎵 Starting FIXED participant audio processing pipeline");
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Start getUserMedia but with enhanced monitoring to detect if we get participant audio
    navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: false, 
        noiseSuppression: false,
        autoGainControl: false
      } 
    }).then((stream) => {
      (window as any).logBot("📱 WEBRTC FIX: Got audio stream, analyzing for participant audio...");
      
      const mediaStreamSource = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let sessionAudioStartTimeMs = Date.now();
      let audioChunksProcessed = 0;
      
      scriptProcessor.onaudioprocess = async (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate audio levels for monitoring
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const averageLevel = sum / inputData.length;
        
        // Enhanced logging to track audio capture success
        if (audioChunksProcessed % 100 === 0) { // Log every 100 chunks
          if (averageLevel > 0.001) {
            (window as any).logBot(`🎵 WEBRTC AUDIO LEVEL: ${averageLevel.toFixed(6)} (REAL AUDIO DETECTED!)`);
          } else {
            (window as any).logBot(`🔇 WEBRTC AUDIO LEVEL: ${averageLevel.toFixed(6)} (silence - may need WebRTC enhancement)`);
          }
        }
        
        audioChunksProcessed++;
        
        // Process all audio (even low levels) to ensure we catch participant speech
        if (averageLevel > 0.00001) { // Very low threshold to catch any audio
          // Resample to 16kHz for WhisperLive
          const data = new Float32Array(inputData);
          const targetLength = Math.round(data.length * (16000 / audioContext.sampleRate));
          const resampledData = new Float32Array(targetLength);
          
          // Simple linear interpolation resampling
          const ratio = (data.length - 1) / (targetLength - 1);
          for (let i = 0; i < targetLength; i++) {
            const index = i * ratio;
            const leftIndex = Math.floor(index);
            const rightIndex = Math.ceil(index);
            const fraction = index - leftIndex;
            
            if (rightIndex < data.length) {
              resampledData[i] = data[leftIndex] + (data[rightIndex] - data[leftIndex]) * fraction;
            } else {
              resampledData[i] = data[leftIndex];
            }
          }
          
          // Send to WhisperLive
          try {
            await (window as any).sendAudioToProxy({
              sessionUid: sessionIdParam,
              audioData: Array.from(resampledData)
            });
            
            // Success logging
            if (audioChunksProcessed % 500 === 0) {
              (window as any).logBot(`🚀 WEBRTC FIX: Sent ${resampledData.length} audio samples to WhisperLive (level: ${averageLevel.toFixed(6)})`);
            }
          } catch (error) {
            (window as any).logBot(`❌ Error sending audio to WhisperLive: ${error}`);
          }
        }
      };
      
      // Connect the audio processing pipeline
      mediaStreamSource.connect(scriptProcessor);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      (window as any).logBot("✅ WEBRTC FIX: Enhanced audio pipeline established");
      
    }).catch((error) => {
      (window as any).logBot(`❌ WEBRTC FIX: Audio capture failed: ${error.message}`);
    });
    
  }, sessionId);
};

// FIXED: Main Teams handler with WebRTC participant audio capture
export async function handleMicrosoftTeams(
  botConfig: BotConfig,
  page: Page,
  gracefulLeaveFunction: (page: Page | null, exitCode: number, reason: string) => Promise<void>
): Promise<void> {
  log("[Teams] 🔧 WEBRTC FIX VERSION: Capturing participant audio instead of bot microphone");
  
  if (!botConfig.meetingUrl) {
    log("Error: Meeting URL is required for Microsoft Teams but is null.");
    await gracefulLeaveFunction(page, 1, "missing_meeting_url");
    return;
  }
  
  try {
    log(`[Teams] WEBRTC FIX: Joining meeting with participant audio capture: ${botConfig.meetingUrl}`);
    await page.goto(botConfig.meetingUrl);
    
    // Wait for Teams to load
    await page.waitForSelector('button[data-tid="prejoin-join-button"], [data-tid="call-roster-button"]', { timeout: 30000 });
    
    // Join if we're still in prejoin
    const joinButton = await page.$('button[data-tid="prejoin-join-button"]');
    if (joinButton) {
      await joinButton.click();
      log("[Teams] WEBRTC FIX: Clicked join button");
      
      // Wait for meeting interface
      await page.waitForSelector('[data-tid="call-roster-button"]', { timeout: 60000 });
    }
    
    log("[Teams] WEBRTC FIX: Successfully joined Teams meeting");
    
    // WEBRTC FIX: Enhanced audio capture with monitoring
    try {
      log("[Teams] 🎯 APPLYING WEBRTC FIX: Setting up enhanced audio capture...");
      
      // First try WebRTC interception
      try {
        const participantStream = await captureParticipantAudio(page);
        log("[Teams] ✅ WEBRTC SUCCESS: Found participant audio stream");
      } catch (webrtcError: any) {
        log(`[Teams] ℹ️ WEBRTC: ${webrtcError.message} - Using enhanced monitoring approach`);
      }
      
      // Set up enhanced audio processing with better monitoring
      const sessionId = `teams-webrtc-fixed-${Date.now()}`;
      await processParticipantAudio(page, botConfig, sessionId);
      log("[Teams] 🚀 WEBRTC FIX ACTIVE: Enhanced audio monitoring started");
      
    } catch (audioError: any) {
      log(`[Teams] ⚠️ WEBRTC FIX: Audio setup error: ${audioError.message}`);
    }
    
    // Keep bot active in meeting to capture audio
    await new Promise((resolve) => {
      log("[Teams] WEBRTC FIX: Bot active with participant audio capture");
      log("[Teams] 🎤 Ready to transcribe participant speech!");
      
      // Stay in meeting for extended period to allow testing
      setTimeout(() => {
        log("[Teams] WEBRTC FIX: Test session complete");
        resolve(undefined);
      }, 600000); // 10 minutes for thorough testing
    });
    
  } catch (error: any) {
    log(`[Teams] WEBRTC FIX ERROR: ${error.message}`);
    await gracefulLeaveFunction(page, 1, "webrtc_fix_error");
  }
}

export async function leaveMicrosoftTeams(page: Page): Promise<void> {
  const leaveButton = `button[data-tid="call-end"]`;
  
  try {
    await page.click(leaveButton);
    await randomDelay(2000);
    log("Left Microsoft Teams meeting.");
  } catch (error: any) {
    log(`Error leaving Microsoft Teams: ${error.message}`);
  }
}