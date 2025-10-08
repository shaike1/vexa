import { Page } from "playwright";
import { log, randomDelay } from "../utils";
import { BotConfig } from "../types";

// ENHANCED WEBRTC PARTICIPANT AUDIO CAPTURE - PHASE 2
const captureTeamsParticipantAudio = async (page: Page) => {
  log("🔧 PHASE 2 WEBRTC: Advanced participant audio stream interception");
  
  return await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      (window as any).logBot("🚀 ENHANCED WEBRTC: Deep participant audio capture starting");
      
      let capturedStream: MediaStream | null = null;
      let audioDetected = false;
      
      // Enhanced Strategy 1: Aggressive WebRTC Peer Connection Monitoring
      const originalRTCPeerConnection = (window as any).RTCPeerConnection;
      if (originalRTCPeerConnection) {
        (window as any).RTCPeerConnection = function(...args: any[]) {
          const pc = new originalRTCPeerConnection(...args);
          (window as any).logBot("🔗 ENHANCED: RTCPeerConnection intercepted with deep monitoring");
          
          // Monitor ALL tracks added to connection
          pc.addEventListener('track', (event: RTCTrackEvent) => {
            (window as any).logBot(`🎵 TRACK DETECTED: ${event.track.kind} - ID: ${event.track.id}`);
            
            if (event.track.kind === 'audio') {
              (window as any).logBot(`🎯 AUDIO TRACK FOUND: Settings: ${JSON.stringify(event.track.getSettings())}`);
              
              if (event.streams && event.streams.length > 0) {
                const stream = event.streams[0];
                const audioTracks = stream.getAudioTracks();
                
                if (audioTracks.length > 0) {
                  (window as any).logBot(`✅ ENHANCED: Captured audio track with ${audioTracks.length} tracks`);
                  capturedStream = stream;
                  audioDetected = true;
                  resolve(stream);
                }
              }
            }
          });
          
          // Monitor connection state changes
          pc.addEventListener('connectionstatechange', () => {
            (window as any).logBot(`🔗 Connection state: ${pc.connectionState}`);
          });
          
          // Monitor ICE connection state
          pc.addEventListener('iceconnectionstatechange', () => {
            (window as any).logBot(`🧊 ICE state: ${pc.iceConnectionState}`);
          });
          
          return pc;
        };
      }
      
      // Enhanced Strategy 2: DOM Audio Element Detection
      const findAudioElements = () => {
        (window as any).logBot("🔍 ENHANCED: Scanning for Teams audio elements");
        
        // Look for Teams-specific audio elements
        const selectors = [
          'audio[autoplay]',
          'video[autoplay]', 
          '[data-tid*="audio"]',
          '[class*="audio"]',
          'audio',
          'video'
        ];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element: Element, index: number) => {
            const mediaEl = element as HTMLMediaElement;
            (window as any).logBot(`🎬 Found ${selector}[${index}]: ${mediaEl.tagName} - src: ${mediaEl.src || 'srcObject'}`);
            
            if (mediaEl.srcObject instanceof MediaStream) {
              const stream = mediaEl.srcObject;
              const audioTracks = stream.getAudioTracks();
              
              if (audioTracks.length > 0 && !audioDetected) {
                (window as any).logBot(`🎵 ENHANCED: Found active audio stream in ${selector}[${index}]`);
                audioTracks.forEach((track, trackIndex) => {
                  (window as any).logBot(`   Track ${trackIndex}: ${track.label || 'unlabeled'} - enabled: ${track.enabled}`);
                });
                
                capturedStream = stream;
                audioDetected = true;
                resolve(stream);
              }
            }
          });
        });
      };
      
      // Enhanced Strategy 3: Teams Meeting Room Audio Detection
      const findTeamsMeetingAudio = () => {
        (window as any).logBot("🏢 ENHANCED: Searching for Teams meeting room audio");
        
        // Teams-specific selectors for meeting audio
        const teamsSelectors = [
          '[data-tid="roster-audio"]',
          '[class*="meeting-audio"]',
          '[class*="participant-audio"]',
          '[id*="audio"]',
          '[class*="call-audio"]'
        ];
        
        teamsSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            (window as any).logBot(`🎯 Found Teams audio elements: ${selector} (${elements.length} elements)`);
          }
        });
      };
      
      // Enhanced Strategy 4: getUserMedia Enhancement with More Options
      const enhancedGetUserMedia = async () => {
        (window as any).logBot("📱 ENHANCED: Trying advanced getUserMedia configurations");
        
        const configurations = [
          // High quality stereo
          { 
            audio: { 
              channelCount: 2,
              sampleRate: 48000,
              sampleSize: 16,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            } 
          },
          // Meeting optimized
          { 
            audio: { 
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              googEchoCancellation: false,
              googAutoGainControl: false,
              googNoiseSuppression: false
            } 
          },
          // Basic fallback
          { audio: true }
        ];
        
        for (const config of configurations) {
          try {
            (window as any).logBot(`🎤 Trying config: ${JSON.stringify(config)}`);
            const stream = await navigator.mediaDevices.getUserMedia(config);
            
            if (stream && stream.getAudioTracks().length > 0) {
              const track = stream.getAudioTracks()[0];
              (window as any).logBot(`✅ ENHANCED: Got audio track: ${track.label || 'unlabeled'}`);
              (window as any).logBot(`   Settings: ${JSON.stringify(track.getSettings())}`);
              
              if (!audioDetected) {
                capturedStream = stream;
                audioDetected = true;
                resolve(stream);
                return;
              }
            }
          } catch (error: any) {
            (window as any).logBot(`❌ Config failed: ${error.message}`);
          }
        }
      };
      
      // Execute all strategies
      findAudioElements();
      findTeamsMeetingAudio();
      
      // Periodic enhanced scanning
      const enhancedInterval = setInterval(() => {
        if (!audioDetected) {
          findAudioElements();
          findTeamsMeetingAudio();
        } else {
          clearInterval(enhancedInterval);
        }
      }, 2000);
      
      // Try getUserMedia after initial scan
      setTimeout(() => {
        if (!audioDetected) {
          enhancedGetUserMedia();
        }
      }, 5000);
      
      // Extended timeout with final attempt
      setTimeout(() => {
        if (!audioDetected) {
          (window as any).logBot("⚠️ ENHANCED: No participant audio found, trying final getUserMedia");
          clearInterval(enhancedInterval);
          enhancedGetUserMedia().then(() => {
            if (!audioDetected) {
              reject(new Error("Enhanced WebRTC: Could not capture participant audio"));
            }
          });
        }
      }, 30000);
    });
  });
};

// ENHANCED: Teams audio processing with advanced monitoring
const processEnhancedParticipantAudio = async (page: Page, botConfig: BotConfig, sessionId: string) => {
  log("🎵 ENHANCED PROCESSING: Advanced participant audio pipeline");
  
  await page.evaluate((sessionIdParam) => {
    (window as any).logBot("🚀 ENHANCED: Starting advanced audio processing pipeline");
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Enhanced getUserMedia with comprehensive monitoring
    navigator.mediaDevices.getUserMedia({ 
      audio: { 
        channelCount: 2,
        sampleRate: 48000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    }).then((stream) => {
      (window as any).logBot("🎤 ENHANCED: Advanced audio stream acquired");
      
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach((track, index) => {
        (window as any).logBot(`🎵 Track ${index}: ${track.label || 'unlabeled'} - State: ${track.readyState}`);
        (window as any).logBot(`   Settings: ${JSON.stringify(track.getSettings())}`);
        (window as any).logBot(`   Constraints: ${JSON.stringify(track.getConstraints())}`);
      });
      
      const mediaStreamSource = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(4096, 2, 2); // Stereo processing
      
      let sessionAudioStartTimeMs = Date.now();
      let audioChunksProcessed = 0;
      let lastNonZeroLevel = 0;
      let consecutiveSilence = 0;
      
      scriptProcessor.onaudioprocess = async (event) => {
        const inputDataL = event.inputBuffer.getChannelData(0);
        const inputDataR = event.inputBuffer.numberOfChannels > 1 ? 
                          event.inputBuffer.getChannelData(1) : inputDataL;
        
        // Enhanced level calculation (RMS)
        let sumL = 0, sumR = 0;
        for (let i = 0; i < inputDataL.length; i++) {
          sumL += inputDataL[i] * inputDataL[i];
          sumR += inputDataR[i] * inputDataR[i];
        }
        
        const rmsL = Math.sqrt(sumL / inputDataL.length);
        const rmsR = Math.sqrt(sumR / inputDataR.length);
        const averageRMS = (rmsL + rmsR) / 2;
        
        // Track silence/activity patterns
        if (averageRMS > 0.000001) {
          lastNonZeroLevel = averageRMS;
          consecutiveSilence = 0;
        } else {
          consecutiveSilence++;
        }
        
        // Enhanced logging every 50 chunks (more frequent)
        if (audioChunksProcessed % 50 === 0) {
          if (averageRMS > 0.000001) {
            (window as any).logBot(`🎵 ENHANCED AUDIO RMS: ${averageRMS.toFixed(8)} (L:${rmsL.toFixed(8)} R:${rmsR.toFixed(8)}) - REAL AUDIO!`);
          } else {
            (window as any).logBot(`🔇 ENHANCED AUDIO RMS: ${averageRMS.toFixed(8)} (silence streak: ${consecutiveSilence})`);
          }
          
          if (lastNonZeroLevel > 0) {
            (window as any).logBot(`📊 Last non-zero level: ${lastNonZeroLevel.toFixed(8)}`);
          }
        }
        
        audioChunksProcessed++;
        
        // Process audio with very sensitive threshold
        if (averageRMS > 0.0000001) { // Even more sensitive
          // Use left channel for mono output
          const data = new Float32Array(inputDataL);
          const targetLength = Math.round(data.length * (16000 / audioContext.sampleRate));
          const resampledData = new Float32Array(targetLength);
          
          // Enhanced resampling
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
            
            // More frequent success logging
            if (audioChunksProcessed % 200 === 0) {
              (window as any).logBot(`🚀 ENHANCED: Sent ${resampledData.length} samples (RMS: ${averageRMS.toFixed(8)})`);
            }
          } catch (error) {
            (window as any).logBot(`❌ Enhanced audio send error: ${error}`);
          }
        }
      };
      
      // Connect enhanced pipeline
      mediaStreamSource.connect(scriptProcessor);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      (window as any).logBot("✅ ENHANCED: Advanced stereo audio pipeline established");
      
    }).catch((error) => {
      (window as any).logBot(`❌ ENHANCED: Advanced audio capture failed: ${error.message}`);
    });
    
  }, sessionId);
};

// ENHANCED: Main Teams handler with Phase 2 WebRTC
export async function handleMicrosoftTeams(
  botConfig: BotConfig,
  page: Page,
  gracefulLeaveFunction: (page: Page | null, exitCode: number, reason: string) => Promise<void>
): Promise<void> {
  log("[Teams] 🚀 ENHANCED WEBRTC PHASE 2: Advanced participant audio capture");
  
  if (!botConfig.meetingUrl) {
    log("Error: Meeting URL is required for Microsoft Teams but is null.");
    await gracefulLeaveFunction(page, 1, "missing_meeting_url");
    return;
  }
  
  try {
    log(`[Teams] ENHANCED PHASE 2: Joining with advanced audio capture: ${botConfig.meetingUrl}`);
    await page.goto(botConfig.meetingUrl);
    
    // Wait for Teams to load
    await page.waitForSelector('button[data-tid="prejoin-join-button"], [data-tid="call-roster-button"]', { timeout: 30000 });
    
    // Join if we're still in prejoin
    const joinButton = await page.$('button[data-tid="prejoin-join-button"]');
    if (joinButton) {
      await joinButton.click();
      log("[Teams] ENHANCED: Clicked join button with advanced monitoring");
      
      // Wait for meeting interface
      await page.waitForSelector('[data-tid="call-roster-button"]', { timeout: 60000 });
    }
    
    log("[Teams] ENHANCED: Successfully joined - starting Phase 2 audio capture");
    
    // ENHANCED WEBRTC PHASE 2: Advanced participant audio capture
    try {
      log("[Teams] 🎯 PHASE 2: Attempting advanced participant audio capture...");
      const participantStream = await captureTeamsParticipantAudio(page);
      log("[Teams] ✅ ENHANCED SUCCESS: Advanced participant audio stream captured");
      
    } catch (audioError: any) {
      log(`[Teams] ℹ️ ENHANCED: Participant capture: ${audioError.message} - Using advanced monitoring`);
    }
    
    // Set up enhanced audio processing
    const sessionId = `teams-enhanced-${Date.now()}`;
    await processEnhancedParticipantAudio(page, botConfig, sessionId);
    log("[Teams] 🚀 ENHANCED ACTIVE: Phase 2 advanced audio monitoring started");
    
    // Keep bot active for extended testing
    await new Promise((resolve) => {
      log("[Teams] ENHANCED PHASE 2: Advanced WebRTC monitoring active");
      log("[Teams] 🎤 Enhanced sensitivity - ready for participant speech detection!");
      
      setTimeout(() => {
        log("[Teams] ENHANCED: Phase 2 test session complete");
        resolve(undefined);
      }, 900000); // 15 minutes for comprehensive testing
    });
    
  } catch (error: any) {
    log(`[Teams] ENHANCED ERROR: ${error.message}`);
    await gracefulLeaveFunction(page, 1, "enhanced_webrtc_error");
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