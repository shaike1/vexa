import { Page } from "playwright";
import { log, randomDelay } from "../utils";
import { BotConfig } from "../types";
import {
  teamsContinueButtonSelectors,
  teamsJoinButtonSelectors,
  teamsCameraButtonSelectors,
  teamsNameInputSelectors,
  teamsAdmissionIndicators,
  teamsWaitingRoomIndicators,
  teamsLeaveSelectors
} from "./teams-selectors";

// Vexa.ai v0.6 Teams Implementation with Media Element Audio Capture
export const handleMicrosoftTeams = async (botConfig: BotConfig, page: Page): Promise<void> => {
  log("🚀 VEXA.AI v0.6 TEAMS: Starting enhanced Teams bot with media element audio capture");

  try {
    // Step 1: Join the meeting
    await joinMicrosoftTeamsVexa(page, botConfig);
    
    // Step 2: Wait for admission
    await waitForTeamsAdmissionVexa(page, botConfig);
    
    // Step 3: Setup audio capture using media elements
    await setupTeamsAudioCaptureVexa(page, botConfig);
    
    // Step 4: Start monitoring (keep bot alive)
    await monitorTeamsMeetingVexa(page, botConfig);
    
  } catch (error: any) {
    log(`❌ VEXA.AI TEAMS ERROR: ${error.message}`);
    throw error;
  }
};

// Join Teams meeting using Vexa.ai approach
async function joinMicrosoftTeamsVexa(page: Page, botConfig: BotConfig): Promise<void> {
  log(`🔗 VEXA.AI TEAMS: Navigating to meeting: ${botConfig.meetingUrl}`);
  
  // Navigate to Teams meeting
  await page.goto(botConfig.meetingUrl!, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  log("🔍 VEXA.AI TEAMS: Looking for continue button...");
  try {
    const continueButton = page.locator(teamsContinueButtonSelectors[0]).first();
    await continueButton.waitFor({ timeout: 10000 });
    await continueButton.click();
    log("✅ VEXA.AI TEAMS: Clicked continue button");
    await page.waitForTimeout(500);
  } catch (error) {
    log("ℹ️ VEXA.AI TEAMS: Continue button not found, continuing...");
  }

  log("🚪 VEXA.AI TEAMS: Looking for join button...");
  try {
    const joinButton = page.locator(teamsJoinButtonSelectors[0]).first();
    await joinButton.waitFor({ timeout: 10000 });
    await joinButton.click();
    log("✅ VEXA.AI TEAMS: Clicked join button");
    await page.waitForTimeout(500);
  } catch (error) {
    log("ℹ️ VEXA.AI TEAMS: Join button not found, continuing...");
  }

  log("📷 VEXA.AI TEAMS: Trying to turn off camera...");
  try {
    const cameraButton = page.locator(teamsCameraButtonSelectors[0]);
    await cameraButton.waitFor({ timeout: 5000 });
    await cameraButton.click();
    log("✅ VEXA.AI TEAMS: Camera turned off");
  } catch (error) {
    log("ℹ️ VEXA.AI TEAMS: Camera button not found or already off");
  }

  log("📝 VEXA.AI TEAMS: Trying to set display name...");
  try {
    const nameInput = page.locator(teamsNameInputSelectors.join(', ')).first();
    await nameInput.waitFor({ timeout: 5000 });
    await nameInput.fill(botConfig.botName);
    log(`✅ VEXA.AI TEAMS: Display name set to "${botConfig.botName}"`);
  } catch (error) {
    log("ℹ️ VEXA.AI TEAMS: Display name input not found, continuing...");
  }

  log("🚀 VEXA.AI TEAMS: Looking for final join button...");
  try {
    const finalJoinButton = page.locator(teamsJoinButtonSelectors.join(', ')).first();
    await finalJoinButton.waitFor({ timeout: 10000 });
    await finalJoinButton.click();
    log("✅ VEXA.AI TEAMS: Clicked final join button");
    await page.waitForTimeout(1000);
  } catch (error) {
    log("ℹ️ VEXA.AI TEAMS: Final join button not found");
  }
}

// Wait for admission using Vexa.ai indicators
async function waitForTeamsAdmissionVexa(page: Page, botConfig: BotConfig): Promise<void> {
  log("⏳ VEXA.AI TEAMS: Waiting for meeting admission...");
  
  const maxWaitTime = 120000; // 2 minutes
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check if we're admitted to the meeting
    const isAdmitted = await page.evaluate((indicators) => {
      return indicators.some(selector => {
        try {
          return document.querySelector(selector) !== null;
        } catch {
          return false;
        }
      });
    }, teamsAdmissionIndicators);
    
    if (isAdmitted) {
      log("✅ VEXA.AI TEAMS: Successfully admitted to meeting!");
      return;
    }
    
    // Check if we're still in waiting room
    const isWaiting = await page.evaluate((indicators) => {
      return indicators.some(selector => {
        try {
          return document.querySelector(selector) !== null;
        } catch {
          return false;
        }
      });
    }, teamsWaitingRoomIndicators);
    
    if (isWaiting) {
      log("⏸️ VEXA.AI TEAMS: Still in waiting room...");
    }
    
    await page.waitForTimeout(2000);
  }
  
  throw new Error("VEXA.AI TEAMS: Admission timeout - not admitted within 2 minutes");
}

// Setup audio capture using Vexa.ai media element approach
async function setupTeamsAudioCaptureVexa(page: Page, botConfig: BotConfig): Promise<void> {
  log("🎵 VEXA.AI TEAMS: Setting up media element audio capture...");
  
  // Load browser utilities
  await page.addInitScript(`
    // Browser Audio Service (inline for immediate availability)
    class BrowserAudioService {
      constructor(config = {}) {
        this.targetSampleRate = config.targetSampleRate || 16000;
        this.bufferSize = config.bufferSize || 4096;
        this.audioContext = null;
        this.combinedDestination = null;
        this.sourceNodes = [];
        this.isInitialized = false;
      }
      
      async findMediaElements() {
        console.log('[BrowserAudioService] 🔍 Searching for Teams media elements...');
        const mediaElements = document.querySelectorAll('audio, video');
        const activeElements = [];
        
        Array.from(mediaElements).forEach((element, index) => {
          if (element.srcObject instanceof MediaStream) {
            const audioTracks = element.srcObject.getAudioTracks();
            if (audioTracks.length > 0) {
              const activeTracks = audioTracks.filter(track => 
                track.readyState === 'live' && track.enabled
              );
              if (activeTracks.length > 0) {
                console.log('[BrowserAudioService] ✅ Found active media element with audio');
                activeElements.push(element);
              }
            }
          }
        });
        
        console.log('[BrowserAudioService] 🎯 Found ' + activeElements.length + ' active media elements');
        return activeElements;
      }
      
      async createCombinedAudioStream(mediaElements) {
        console.log('[BrowserAudioService] 🎛️ Creating combined stream from ' + mediaElements.length + ' elements');
        
        if (mediaElements.length === 0) {
          throw new Error('No media elements provided for stream combination');
        }

        if (!this.audioContext) {
          this.audioContext = new AudioContext({ sampleRate: this.targetSampleRate });
          console.log('[BrowserAudioService] 🎵 AudioContext created with sample rate: ' + this.audioContext.sampleRate);
        }

        this.combinedDestination = this.audioContext.createMediaStreamDestination();
        
        this.sourceNodes.forEach(node => node.disconnect());
        this.sourceNodes = [];

        mediaElements.forEach((element, index) => {
          if (element.srcObject instanceof MediaStream) {
            try {
              const source = this.audioContext.createMediaStreamSource(element.srcObject);
              source.connect(this.combinedDestination);
              this.sourceNodes.push(source);
              console.log('[BrowserAudioService] 🔗 Connected media element ' + index + ' to combined stream');
            } catch (error) {
              console.warn('[BrowserAudioService] ⚠️ Failed to connect element ' + index + ':', error);
            }
          }
        });

        const combinedStream = this.combinedDestination.stream;
        console.log('[BrowserAudioService] ✅ Combined stream created with ' + combinedStream.getAudioTracks().length + ' tracks');
        
        this.isInitialized = true;
        return combinedStream;
      }
      
      isReady() {
        return this.isInitialized && this.audioContext !== null && this.combinedDestination !== null;
      }
    }
    
    // WhisperLive Service (simplified inline version)
    class BrowserWhisperLiveService {
      constructor(config, stubbornMode = false) {
        this.whisperLiveUrl = config.whisperLiveUrl;
        this.stubbornMode = stubbornMode;
        this.websocket = null;
        this.isReady = false;
        this.reconnectAttempts = 0;
      }
      
      async initializeWithStubbornReconnection(platform) {
        console.log('[BrowserWhisperLiveService] 🚀 Starting stubborn reconnection for ' + platform + '...');
        return new Promise((resolve, reject) => {
          this.connectWithRetry(resolve, reject);
        });
      }
      
      connectWithRetry(resolve, reject) {
        console.log('[BrowserWhisperLiveService] 🔗 Connection attempt ' + (this.reconnectAttempts + 1) + '...');
        
        try {
          this.websocket = new WebSocket(this.whisperLiveUrl);
          
          this.websocket.onopen = () => {
            console.log('[BrowserWhisperLiveService] ✅ WebSocket connected successfully');
            this.isReady = true;
            this.reconnectAttempts = 0;
            resolve(this.whisperLiveUrl);
          };
          
          this.websocket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log('[BrowserWhisperLiveService] 📨 Received transcription:', data);
              
              if (data.message) {
                // Store transcription for retrieval
                window.lastTranscription = data.message;
                window.transcriptionTimestamp = Date.now();
              }
            } catch (error) {
              console.warn('[BrowserWhisperLiveService] ⚠️ Failed to parse message:', error);
            }
          };
          
          this.websocket.onerror = (error) => {
            console.error('[BrowserWhisperLiveService] ❌ WebSocket error:', error);
            this.isReady = false;
          };
          
          this.websocket.onclose = (event) => {
            console.warn('[BrowserWhisperLiveService] 🔌 WebSocket closed: ' + event.code);
            this.isReady = false;
            
            if (this.stubbornMode || this.reconnectAttempts < 10) {
              this.reconnectAttempts++;
              setTimeout(() => this.connectWithRetry(resolve, reject), 2000);
            } else {
              reject(new Error('WebSocket connection failed permanently'));
            }
          };
        } catch (error) {
          console.error('[BrowserWhisperLiveService] ❌ Failed to create WebSocket:', error);
          this.reconnectAttempts++;
          setTimeout(() => this.connectWithRetry(resolve, reject), 2000);
        }
      }
      
      sendAudioData(audioData) {
        if (!this.isReady || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
          return;
        }
        
        try {
          const buffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
          this.websocket.send(buffer);
        } catch (error) {
          console.error('[BrowserWhisperLiveService] ❌ Failed to send audio data:', error);
          this.isReady = false;
        }
      }
      
      isServiceReady() {
        return this.isReady && this.websocket !== null && this.websocket.readyState === WebSocket.OPEN;
      }
    }
    
    // Make services available globally
    window.BrowserAudioService = BrowserAudioService;
    window.BrowserWhisperLiveService = BrowserWhisperLiveService;
    
    console.log('✅ VEXA.AI Browser utilities loaded');
  `);

  // Wait for page to load and then initialize audio
  await page.waitForTimeout(3000);
  
  const audioSetupResult = await page.evaluate(async (whisperUrl) => {
    try {
      console.log('🎵 VEXA.AI: Starting media element audio setup...');
      
      // Initialize services
      const audioService = new window.BrowserAudioService({
        targetSampleRate: 16000,
        bufferSize: 4096
      });
      
      const whisperLiveService = new window.BrowserWhisperLiveService({
        whisperLiveUrl: whisperUrl
      }, true); // Enable stubborn mode
      
      // Initialize WhisperLive connection
      console.log('🔗 VEXA.AI: Connecting to WhisperLive...');
      await whisperLiveService.initializeWithStubbornReconnection("Teams");
      
      // Find media elements with retry
      let mediaElements = [];
      let attempts = 0;
      const maxAttempts = 10;
      
      while (mediaElements.length === 0 && attempts < maxAttempts) {
        mediaElements = await audioService.findMediaElements();
        if (mediaElements.length === 0) {
          console.log('⏳ VEXA.AI: No media elements found, waiting... (attempt ' + (attempts + 1) + ')');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        attempts++;
      }
      
      if (mediaElements.length === 0) {
        throw new Error('No active media elements found after ' + maxAttempts + ' attempts');
      }
      
      // Create combined audio stream
      console.log('🎛️ VEXA.AI: Creating combined audio stream...');
      const combinedStream = await audioService.createCombinedAudioStream(mediaElements);
      
      // Setup audio processing
      console.log('🎙️ VEXA.AI: Setting up audio processing...');
      const source = audioService.audioContext.createMediaStreamSource(combinedStream);
      const processor = audioService.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        
        // Calculate RMS for monitoring
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
          sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);
        
        // Only send if we have audio and connection is ready
        if (rms > 0.001 && whisperLiveService.isServiceReady()) {
          const audioDataCopy = new Float32Array(audioData);
          whisperLiveService.sendAudioData(audioDataCopy);
        }
      };
      
      source.connect(processor);
      processor.connect(audioService.audioContext.destination);
      
      // Store references globally for monitoring
      window.vexaAudioService = audioService;
      window.vexaWhisperLiveService = whisperLiveService;
      
      console.log('✅ VEXA.AI: Audio capture setup complete!');
      return { success: true, mediaElementCount: mediaElements.length };
      
    } catch (error) {
      console.error('❌ VEXA.AI: Audio setup failed:', error);
      return { success: false, error: error.message };
    }
  }, botConfig.whisperLiveUrl);

  if (audioSetupResult.success) {
    log(`✅ VEXA.AI TEAMS: Audio capture setup successful with ${audioSetupResult.mediaElementCount} media elements`);
  } else {
    throw new Error(`VEXA.AI TEAMS: Audio setup failed: ${audioSetupResult.error}`);
  }
}

// Monitor Teams meeting
async function monitorTeamsMeetingVexa(page: Page, botConfig: BotConfig): Promise<void> {
  log("👀 VEXA.AI TEAMS: Starting meeting monitoring...");
  
  // Monitor for removal or meeting end
  const monitoringInterval = setInterval(async () => {
    try {
      // Check for transcriptions
      const transcriptionStatus = await page.evaluate(() => {
        if (window.lastTranscription && window.transcriptionTimestamp) {
          const age = Date.now() - window.transcriptionTimestamp;
          return {
            hasTranscription: true,
            lastMessage: window.lastTranscription,
            ageMs: age
          };
        }
        return { hasTranscription: false };
      });
      
      if (transcriptionStatus.hasTranscription) {
        log(`📝 VEXA.AI TEAMS: Latest transcription (${Math.round(transcriptionStatus.ageMs / 1000)}s ago): ${transcriptionStatus.lastMessage}`);
      }
      
    } catch (error) {
      log(`⚠️ VEXA.AI TEAMS: Monitoring error: ${error}`);
    }
  }, 10000); // Check every 10 seconds
  
  // Keep the bot running
  await new Promise(() => {}); // Run indefinitely
}

// Leave Teams meeting
export const leaveMicrosoftTeams = async (page: Page): Promise<boolean> => {
  log("🚪 VEXA.AI TEAMS: Attempting to leave meeting...");
  
  try {
    // Try each leave button selector
    for (const selector of teamsLeaveSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click();
          log(`✅ VEXA.AI TEAMS: Successfully clicked leave button: ${selector}`);
          return true;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    log("⚠️ VEXA.AI TEAMS: No leave button found");
    return false;
    
  } catch (error: any) {
    log(`❌ VEXA.AI TEAMS: Leave failed: ${error.message}`);
    return false;
  }
};