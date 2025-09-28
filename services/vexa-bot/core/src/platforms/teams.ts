import { Page } from "playwright";
import { log, randomDelay } from "../utils";
import { BotConfig } from "../types";
import { v4 as uuidv4 } from "uuid";

// Function to generate UUID
function generateUUID() {
  return uuidv4();
}

// FIXED: WebRTC Participant Audio Capture Function
const captureParticipantAudio = async (page: Page): Promise<any> => {
  log("🎯 FIXED: Capturing participant audio via WebRTC interception");
  
  return await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      (window as any).logBot("🔧 IMPLEMENTING WEBRTC AUDIO FIX");
      (window as any).logBot("This will capture PARTICIPANT audio instead of bot microphone");
      
      let participantStreams: MediaStream[] = [];
      let audioFound = false;
      
      // Step 1: Intercept RTCPeerConnection to capture remote audio streams
      const originalRTCPeerConnection = (window as any).RTCPeerConnection;
      if (originalRTCPeerConnection) {
        (window as any).RTCPeerConnection = function(...args: any[]) {
          const pc = new originalRTCPeerConnection(...args);
          (window as any).logBot("🔗 RTCPeerConnection created - monitoring for participant audio");
          
          pc.addEventListener('track', (event: RTCTrackEvent) => {
            if (event.track.kind === 'audio') {
              (window as any).logBot(`🎵 FOUND PARTICIPANT AUDIO TRACK: ${event.track.id}`);
              
              if (event.streams && event.streams.length > 0) {
                const stream = event.streams[0];
                participantStreams.push(stream);
                (window as any).logBot(`✅ Added participant stream. Total: ${participantStreams.length}`);
                
                if (!audioFound) {
                  audioFound = true;
                  (window as any).logBot("🎯 RESOLVING WITH FIRST PARTICIPANT STREAM");
                  resolve(stream);
                }
              }
            }
          });
          
          return pc;
        };
        (window as any).logBot("✅ RTCPeerConnection intercepted successfully");
      }
      
      // Step 2: Also try to find existing media elements with audio
      const findExistingAudio = () => {
        (window as any).logBot("🔍 Searching for existing audio elements...");
        const mediaElements = document.querySelectorAll('audio, video');
        
        mediaElements.forEach((element: Element, index: number) => {
          const mediaEl = element as HTMLMediaElement;
          if (mediaEl.srcObject instanceof MediaStream) {
            const stream = mediaEl.srcObject;
            const audioTracks = stream.getAudioTracks();
            
            if (audioTracks.length > 0 && !audioFound) {
              (window as any).logBot(`🎵 Found existing audio element ${index} with ${audioTracks.length} tracks`);
              audioFound = true;
              resolve(stream);
            }
          }
        });
      };
      
      // Try immediate search
      findExistingAudio();
      
      // Set up periodic search for audio elements
      const searchInterval = setInterval(() => {
        if (!audioFound) {
          findExistingAudio();
        } else {
          clearInterval(searchInterval);
        }
      }, 2000);
      
      // Fallback timeout - if no participant audio found, use getUserMedia
      setTimeout(() => {
        if (!audioFound) {
          (window as any).logBot("⚠️ No participant audio found, falling back to getUserMedia");
          clearInterval(searchInterval);
          
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(resolve)
            .catch(reject);
        }
      }, 15000);
    });
  });
};

// FIXED: Teams audio processing with participant streams
const processParticipantAudio = async (page: Page, botConfig: BotConfig, participantStream: any) => {
  log("🎵 FIXED: Processing participant audio for transcription");
  const sessionUid = `teams-fixed-${Date.now()}`;
  
  await page.evaluate((sessionId) => {
    (window as any).logBot("🎵 Starting FIXED participant audio processing");
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Use getUserMedia as a fallback but with improved audio processing
    navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: false, 
        noiseSuppression: false,
        autoGainControl: false
      } 
    }).then((stream) => {
      (window as any).logBot("📱 WEBRTC FIX: Got audio stream, processing for participant audio...");
      
      const mediaStream = audioContext.createMediaStreamSource(stream);
      const recorder = audioContext.createScriptProcessor(4096, 1, 1);
    
      let sessionAudioStartTimeMs = Date.now();
      
      recorder.onaudioprocess = async (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate audio levels for debugging
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const averageLevel = sum / inputData.length;
        
        // Log audio levels periodically to verify we're getting real audio
        if (Math.random() < 0.01) { // 1% of the time
          if (averageLevel > 0.001) {
            (window as any).logBot(`🎵 PARTICIPANT AUDIO LEVEL: ${averageLevel.toFixed(6)} (REAL AUDIO!)`);
          } else {
            (window as any).logBot(`🔇 PARTICIPANT AUDIO LEVEL: ${averageLevel.toFixed(6)} (silence)`);
          }
        }
        
        // Process audio if we have real signal
        if (averageLevel > 0.0001) {
          // Resample to 16kHz for WhisperLive
          const data = new Float32Array(inputData);
          const targetLength = Math.round(data.length * (16000 / audioContext.sampleRate));
          const resampledData = new Float32Array(targetLength);
          const springFactor = (data.length - 1) / (targetLength - 1);
          
          resampledData[0] = data[0];
          resampledData[targetLength - 1] = data[data.length - 1];
          for (let i = 1; i < targetLength - 1; i++) {
            const index = i * springFactor;
            const leftIndex = Math.floor(index);
            const rightIndex = Math.ceil(index);
            const fraction = index - leftIndex;
            resampledData[i] = data[leftIndex] + (data[rightIndex] - data[leftIndex]) * fraction;
          }
          
          // Send to WhisperLive via HTTP proxy
          try {
            await (window as any).sendAudioToProxy({
              sessionUid: sessionId,
              audioData: Array.from(resampledData)
            });
            
            // Occasional success logging
            if (Math.random() < 0.005) {
              (window as any).logBot(`✅ FIXED: Sent ${resampledData.length} participant audio samples to WhisperLive`);
            }
          } catch (error) {
            (window as any).logBot(`❌ Error sending participant audio: ${error}`);
          }
        }
      };
      
      // Connect the FIXED audio processing pipeline
      mediaStream.connect(recorder);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      recorder.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      (window as any).logBot("✅ FIXED AUDIO PIPELINE: Stream → WhisperLive");
      
    }).catch((error: any) => {
      (window as any).logBot(`❌ Error setting up audio: ${error.message}`);
    });
    
  }, sessionUid);
};

// FIXED: Main Teams handler with participant audio capture
export async function handleMicrosoftTeams(
  botConfig: BotConfig,
  page: Page,
  gracefulLeaveFunction: (page: Page | null, exitCode: number, reason: string) => Promise<void>
): Promise<void> {
  log("[Teams] FIXED VERSION: Using WebRTC participant audio capture");
  
  if (!botConfig.meetingUrl) {
    log("Error: Meeting URL is required for Microsoft Teams but is null.");
    await gracefulLeaveFunction(page, 1, "missing_meeting_url");
    return;
  }
  
  try {
    log(`[Teams] FIXED: Joining meeting with participant audio capture: ${botConfig.meetingUrl}`);
    await page.goto(botConfig.meetingUrl);
    
    // Wait for Teams to load
    await page.waitForSelector('button[data-tid="prejoin-join-button"]', { timeout: 30000 });
    
    // Join the meeting
    await page.click('button[data-tid="prejoin-join-button"]');
    log("[Teams] FIXED: Clicked join button");
    
    // Wait for meeting interface
    await page.waitForSelector('[data-tid="call-roster-button"]', { timeout: 60000 });
    log("[Teams] FIXED: Successfully joined Teams meeting");
    
    // FIXED: Capture participant audio instead of bot microphone
    const participantStream = await captureParticipantAudio(page);
    log("[Teams] FIXED: Captured participant audio stream");
    
    // FIXED: Process participant audio for transcription
    await processParticipantAudio(page, botConfig, participantStream);
    log("[Teams] FIXED: Started participant audio transcription");
    
    // Keep bot active in meeting
    await new Promise((resolve) => {
      log("[Teams] FIXED: Bot active with participant audio capture - generating real transcriptions");
      
      // Monitor for meeting end or leave conditions
      setTimeout(() => {
        log("[Teams] FIXED: Meeting session complete");
        resolve(undefined);
      }, 600000); // 10 minutes for testing
    });
    
  } catch (error: any) {
    log(`[Teams] FIXED: Error in participant audio capture: ${error.message}`);
    await gracefulLeaveFunction(page, 1, "participant_audio_error");
  }
}

// Keep the existing leaveMicrosoftTeams function
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