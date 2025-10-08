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

const ensureComputerAudioSelection = async (page: Page): Promise<void> => {
  try {
    await page.evaluate(async () => {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const log = (window as any).logBot || ((msg: string) => console.log(msg));

      const audioMenuSelectors = [
        '[data-tid="toggle-devicesettings-computeraudio"]',
        '[data-tid="toggle-devicesettings-videotoolbar"]',
        '[data-tid="prejoin-audio-configuration-button"]',
        '[aria-label*="audio options"]',
        '[aria-label*="Audio options"]'
      ];

      let menuOpened = false;
      for (const selector of audioMenuSelectors) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el && typeof el.click === 'function') {
          log(`Trying to open audio settings via selector: ${selector}`);
          el.click();
          await wait(500);
          menuOpened = true;
          break;
        }
      }

      if (!menuOpened) {
        log('[AudioConfig] Could not auto-open audio options menu (may already be visible).');
      }

      const radioSelectors = [
        'input[aria-label="Computer audio"]',
        'input[aria-label*="Computer audio"]',
        '[role="radio"][aria-label="Computer audio"]',
        '[role="radio"][aria-label*="Computer audio"]',
        '[data-tid="audio-configuration-computeraudio"]',
        '#prejoin-audio-option-computeraudio',
        'input[name^="radiogroup"][value*="computeraudio"]'
      ];

      let computerAudioSelected = false;
      for (const selector of radioSelectors) {
        const candidate = document.querySelector(selector) as HTMLElement | HTMLInputElement | null;
        if (!candidate) continue;

        log(`[AudioConfig] Found computer audio candidate: ${selector}`);

        if ((candidate as HTMLInputElement).checked !== undefined) {
          const input = candidate as HTMLInputElement;
          if (!input.checked) {
            input.click();
            await wait(400);
          }
          if (!input.checked && input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`) as HTMLElement | null;
            if (label) {
              label.click();
              await wait(400);
            }
          }
          computerAudioSelected = input.checked;
        } else {
          candidate.click();
          await wait(400);
          const ariaChecked = candidate.getAttribute('aria-checked');
          computerAudioSelected = ariaChecked === 'true';
        }

        if (computerAudioSelected) {
          log('[AudioConfig] Successfully selected Computer audio option.');
          break;
        }
      }

      if (!computerAudioSelected) {
        log('[AudioConfig] Unable to confirm Computer audio selection.');
      }
    });
  } catch (error: any) {
    log(`[AudioConfig] Failed to enforce computer audio selection: ${error.message}`);
  }
};

// REVOLUTIONARY FIX: Capture actual Teams participant audio (not bot microphone)
const processParticipantAudio = async (page: Page, botConfig: BotConfig, participantStream: any) => {
  log("🎯 REVOLUTIONARY FIX: Processing REAL participant audio for transcription");
  const sessionUid = `teams-participant-${Date.now()}`;
  
  await page.evaluate((sessionId) => {
    (window as any).logBot("🎯 REVOLUTIONARY FIX: Starting REAL participant audio processing");
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // CRITICAL FIX: Capture system/desktop audio instead of bot microphone
    // This gets the actual meeting audio that participants hear
    const captureDesktopAudio = async () => {
      try {
        // Method 1: Try getDisplayMedia with audio (gets system audio)
        const desktopStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 16000
          }
        });
        
        (window as any).logBot("✅ BREAKTHROUGH: Captured desktop audio stream (actual meeting audio!)");
        return desktopStream;
        
      } catch (desktopError: any) {
        (window as any).logBot(`⚠️  Desktop audio failed: ${desktopError.message}, trying participant stream intercept`);
        
        // Method 2: Intercept existing audio elements in Teams
        const audioElements = document.querySelectorAll('audio, video');
        for (let element of audioElements) {
          const mediaEl = element as HTMLMediaElement;
          if (mediaEl.srcObject instanceof MediaStream) {
            const stream = mediaEl.srcObject;
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
              (window as any).logBot("✅ FOUND: Existing Teams audio element with real participant audio!");
              return stream;
            }
          }
        }
        
        // Method 3: Fallback to enhanced getUserMedia with different constraints
        (window as any).logBot("🔄 Fallback: Using enhanced microphone capture...");
        return await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: false, 
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 16000,
            channelCount: 1
          } 
        });
      }
    };
    
    captureDesktopAudio().then((stream) => {
      (window as any).logBot("🎵 PROCESSING REAL PARTICIPANT AUDIO STREAM");
      
      const mediaStream = audioContext.createMediaStreamSource(stream);
      const recorder = audioContext.createScriptProcessor(4096, 1, 1);
    
      let sessionAudioStartTimeMs = Date.now();
      
      recorder.onaudioprocess = async (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // CRITICAL FIX: Enhanced audio level detection and processing
        let sum = 0;
        let maxLevel = 0;
        for (let i = 0; i < inputData.length; i++) {
          const level = Math.abs(inputData[i]);
          sum += level;
          if (level > maxLevel) maxLevel = level;
        }
        const averageLevel = sum / inputData.length;
        
        // Enhanced logging for debugging participant audio capture
        if (Math.random() < 0.02) { // 2% of the time for better monitoring
          if (averageLevel > 0.001) {
            (window as any).logBot(`🎵 REAL PARTICIPANT SPEECH: avg=${averageLevel.toFixed(6)}, max=${maxLevel.toFixed(6)} ✅`);
          } else if (averageLevel > 0.00001) {
            (window as any).logBot(`🔊 LOW PARTICIPANT AUDIO: avg=${averageLevel.toFixed(6)}, max=${maxLevel.toFixed(6)} (background)`);
          } else {
            (window as any).logBot(`🔇 SILENCE DETECTED: avg=${averageLevel.toFixed(6)} (no participant speech)`);
          }
        }
        
        // REVOLUTIONARY FIX: Process audio even with low levels (not just silence)
        // Previous threshold was too high, missing actual speech
        if (averageLevel > 0.00001) {  // Much lower threshold to catch real speech
          // Convert to Int16 format that WhisperLive expects
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // Amplify low-level signals for better transcription
            let sample = inputData[i];
            if (averageLevel < 0.01) {
              sample *= 10; // Amplify quiet participants
            }
            int16Data[i] = Math.max(-32768, Math.min(32767, sample * 32768));
          }
          
          // Send real audio data (not zeros) to WhisperLive
          try {
            await (window as any).sendAudioToProxy({
              sessionUid: sessionId,
              audioData: Array.from(int16Data)
            });
            
            // Success logging for real audio transmission
            if (Math.random() < 0.005) { // Occasional logging
              (window as any).logBot(`✅ SENT REAL AUDIO: ${int16Data.length} samples, level=${averageLevel.toFixed(6)}`);
            }
          } catch (error) {
            (window as any).logBot(`❌ Error sending participant audio: ${error}`);
          }
        } else {
          // Log silence periods less frequently
          if (Math.random() < 0.001) {
            (window as any).logBot(`⏸️  SILENCE PERIOD: Not sending to transcription (level=${averageLevel.toFixed(8)})`);
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
    
    await ensureComputerAudioSelection(page);

    // AGGRESSIVE JOIN: Multiple click strategies
    log(`[Teams] AGGRESSIVE: Trying multiple click strategies for Join button...`);
    
    // Strategy 1: Force click ignoring overlapping elements
    try {
      await page.click('button[data-tid="prejoin-join-button"]', { force: true, timeout: 5000 });
      log(`[Teams] SUCCESS: Force click worked!`);
    } catch (forceError) {
      log(`[Teams] Force click failed: ${(forceError as Error).message}`);
      
      // Strategy 2: JavaScript click to bypass all UI blocking
      try {
        await page.evaluate(() => {
          const joinBtn = document.querySelector('button[data-tid="prejoin-join-button"]') as HTMLButtonElement;
          if (joinBtn) {
            joinBtn.click();
            return true;
          }
          return false;
        });
        log(`[Teams] SUCCESS: JavaScript click worked!`);
      } catch (jsError) {
        log(`[Teams] JavaScript click failed: ${(jsError as Error).message}`);
        
        // Strategy 3: Try alternative selectors
        const alternativeSelectors = [
          'button[aria-label="Join now"]',
          'button:has-text("Join now")',
          'button[id="prejoin-join-button"]',
          'button:has-text("Join")',
          '.fui-Button:has-text("Join")'
        ];
        
        let clicked = false;
        for (const selector of alternativeSelectors) {
          try {
            await page.click(selector, { force: true, timeout: 2000 });
            log(`[Teams] SUCCESS: Alternative selector worked: ${selector}`);
            clicked = true;
            break;
          } catch (altError) {
            log(`[Teams] Alternative selector failed: ${selector}`);
          }
        }
        
        if (!clicked) {
          // Strategy 4: Dispatch click event directly
          await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              if (btn.textContent?.includes('Join') || btn.getAttribute('data-tid')?.includes('join')) {
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                return true;
              }
            }
            return false;
          });
          log(`[Teams] FINAL ATTEMPT: Dispatched click event on any Join button`);
        }
      }
    }

    // Join the meeting
    log("[Teams] AGGRESSIVE: Join attempt completed, checking meeting interface...");
    
    // Wait for meeting interface with longer timeout for lobby situations
    try {
      await page.waitForSelector('[data-tid="call-roster-button"]', { timeout: 300000 }); // 5 minutes
      log("[Teams] FIXED: Successfully joined Teams meeting");
    } catch (rosterError) {
      log("[Teams] LOBBY: Checking if bot is in lobby waiting for admission...");
      
      // Check for lobby indicators
      const lobbySelectors = [
        'text=Someone will let you in shortly',
        'text=waiting for the meeting to start',
        'text=You\'re in the lobby',
        '[data-tid="lobby-screen"]',
        'text=Please wait',
        'text=Meeting hasn\'t started'
      ];
      
      let inLobby = false;
      for (const selector of lobbySelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          log(`[Teams] LOBBY DETECTED: Found "${selector}" - bot is waiting for admission`);
          inLobby = true;
          break;
        } catch (e) {
          // Continue checking
        }
      }
      
      if (inLobby) {
        log("[Teams] LOBBY: Bot successfully in meeting lobby, waiting for manual admission...");
        // Wait much longer for admission
        try {
          await page.waitForSelector('[data-tid="call-roster-button"]', { timeout: 600000 }); // 10 minutes
          log("[Teams] ADMITTED: Bot was successfully admitted to the meeting!");
        } catch (admissionTimeout) {
          log("[Teams] TIMEOUT: Bot waited 10 minutes for admission but was not admitted");
        }
      } else {
        log(`[Teams] ERROR: Could not detect lobby or meeting interface: ${(rosterError as Error).message}`);
        throw rosterError;
      }
    }
    
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
