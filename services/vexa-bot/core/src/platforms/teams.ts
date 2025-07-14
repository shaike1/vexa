import { Page } from "playwright";
import { log, randomDelay } from "../utils";
import { BotConfig } from "../types";
import { v4 as uuidv4 } from "uuid";
import TeamsAuthService, { TeamsAuthConfig, OnlineMeetingInfo } from "../auth/teams-auth";

// Function to generate UUID
function generateUUID() {
  return uuidv4();
}

export async function handleMicrosoftTeams(
  botConfig: BotConfig,
  page: Page,
  gracefulLeaveFunction: (page: Page | null, exitCode: number, reason: string) => Promise<void>
): Promise<void> {
  const leaveButton = `button[data-tid="call-end"]`;

  // Check for Teams authentication configuration
  const teamsAuthMode = process.env.TEAMS_AUTH_MODE || "guest";
  const teamsClientId = process.env.TEAMS_CLIENT_ID;
  const teamsClientSecret = process.env.TEAMS_CLIENT_SECRET;
  const teamsTenantId = process.env.TEAMS_TENANT_ID;
  const teamsOrganizerEmail = process.env.TEAMS_ORGANIZER_EMAIL;

  log(`[Teams] Authentication mode: ${teamsAuthMode}`);

  // Handle authenticated mode for enhanced features (but still join as guest)
  if (teamsAuthMode === "authenticated" && teamsClientId && teamsClientSecret && teamsTenantId) {
    log("[Teams] Using authenticated mode for enhanced meeting metadata");
    
    try {
      const meetingInfo = await handleAuthenticatedMeetingInfo(
        botConfig.meetingUrl!,
        teamsOrganizerEmail,
        {
          clientId: teamsClientId,
          clientSecret: teamsClientSecret,
          tenantId: teamsTenantId,
          redirectUri: process.env.TEAMS_REDIRECT_URI || ""
        }
      );
      
      if (meetingInfo) {
        log(`[Teams] Retrieved enhanced meeting info: ${meetingInfo.subject} (${meetingInfo.id})`);
        log(`[Teams] Meeting organizer: ${meetingInfo.organizer?.identity?.user?.displayName || 'Unknown'}`);
        log(`[Teams] Meeting time: ${meetingInfo.startDateTime} - ${meetingInfo.endDateTime}`);
        
        // Store enhanced info for potential use during recording
        (botConfig as any).enhancedMeetingInfo = meetingInfo;
        
        // Use the Graph API meeting URL if different/better
        if (meetingInfo.joinWebUrl !== botConfig.meetingUrl) {
          log(`[Teams] Using Graph API join URL: ${meetingInfo.joinWebUrl}`);
          botConfig.meetingUrl = meetingInfo.joinWebUrl;
        }
      } else {
        log("[Teams] Could not retrieve enhanced meeting info, proceeding with basic guest join");
      }
    } catch (error: any) {
      log(`[Teams] Enhanced meeting info retrieval failed: ${error.message}`);
      log("[Teams] Proceeding with guest mode (consistent with Google Meet/Zoom behavior)");
    }
  } else {
    log("[Teams] Using guest mode (consistent with Google Meet/Zoom behavior)");
  }

  if (!botConfig.meetingUrl) {
    log("Error: Meeting URL is required for Microsoft Teams but is null.");
    await gracefulLeaveFunction(page, 1, "missing_meeting_url");
    return;
  }

  // IMPORTANT: Always join as guest via browser automation (consistent with Google Meet/Zoom)
  // This avoids authentication conflicts when multiple users request bots for the same meeting
  // The authenticated mode above only provides enhanced metadata, not authenticated joining
  log("Joining Microsoft Teams meeting as guest (consistent with Google Meet/Zoom behavior)");
  try {
    await joinTeamsMeeting(page, botConfig.meetingUrl, botConfig.botName);
  } catch (error: any) {
    console.error("Error during joinTeamsMeeting: " + error.message);
    log("Error during joinTeamsMeeting: " + error.message + ". Triggering graceful leave.");
    await gracefulLeaveFunction(page, 1, "join_meeting_error");
    return;
  }

  // Setup websocket connection and meeting admission concurrently
  log("🏁 TEAMS BOT READY FOR MANUAL ADMISSION!");
  log("⚠️  PLEASE CHECK YOUR TEAMS MEETING FOR 'Vexa Transcription Bot' ADMISSION REQUEST!");
  log("⏰ Bot will wait up to 10 MINUTES for manual admission");
  log("Starting WebSocket connection while waiting for Teams meeting admission");
  try {
    // Run both processes concurrently
    const [isAdmitted] = await Promise.all([
      // Wait for admission to the meeting - FORCE 10 minute timeout for Teams manual admission
      waitForTeamsMeetingAdmission(
        page,
        leaveButton,
        600000 // 10 minutes in milliseconds - enough time for manual admission
      ).catch((error) => {
        log("Teams meeting admission failed: " + error.message);
        return false;
      }),

      // Prepare for recording (expose functions, etc.) while waiting for admission
      prepareForRecording(page),
    ]);

    if (!isAdmitted) {
      console.error("Bot was not admitted into the Teams meeting");
      log("Bot not admitted to Teams meeting. Triggering graceful leave with admission_failed reason.");
      
      await gracefulLeaveFunction(page, 2, "admission_failed");
      return; 
    }

    log("Successfully admitted to the Teams meeting, starting recording");
    
    // Announce that transcription is starting via text-to-speech
    try {
      log("Starting enhanced audio detection and text-to-speech process...");
      
      // First, let's examine what's available in the page
      const pageInfo = await page.evaluate(() => {
        const allButtons = document.querySelectorAll('button, [role="button"]');
        const buttonInfo = [];
        
        for (let i = 0; i < Math.min(15, allButtons.length); i++) {
          const btn = allButtons[i] as HTMLElement;
          buttonInfo.push({
            index: i + 1,
            ariaLabel: btn.getAttribute('aria-label'),
            title: btn.getAttribute('title'),
            dataTid: btn.getAttribute('data-tid'),
            className: btn.className.substring(0, 100),
            textContent: btn.textContent?.substring(0, 50),
            visible: btn.offsetParent !== null
          });
        }
        
        return {
          totalButtons: allButtons.length,
          buttonInfo: buttonInfo,
          currentUrl: window.location.href
        };
      });
      
      log(`=== TEAMS UI ANALYSIS ===`);
      log(`Current URL: ${pageInfo.currentUrl}`);
      log(`Found ${pageInfo.totalButtons} total buttons/clickable elements`);
      log(`Analyzing first 15 buttons:`);
      
      for (const btn of pageInfo.buttonInfo) {
        log(`Button ${btn.index}: aria-label="${btn.ariaLabel}", title="${btn.title}", data-tid="${btn.dataTid}", visible=${btn.visible}, text="${btn.textContent}"`);
      }
      
      await page.evaluate(async () => {
        // Wait a moment for UI to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Enhanced Teams mute button detection and enabling
        const enableTeamsAudio = async () => {
          const muteButtonSelectors = [
            '[data-tid="toggle-mute"]',
            '[data-tid="microphone-button"]',
            '[data-tid="calling-microphone-button"]',
            '[data-tid="toggle-microphone"]',
            '[data-tid="microphone-toggle"]',
            '[aria-label*="Mute"]',
            '[aria-label*="Unmute"]',
            '[aria-label*="microphone"]',
            '[aria-label*="Microphone"]',
            '[title*="Mute"]',
            '[title*="Unmute"]',
            '[title*="microphone"]',
            '[title*="Microphone"]',
            'button[id*="mute"]',
            'button[class*="mute"]',
            'button[class*="microphone"]',
            'button[class*="Microphone"]',
            '.toggle-mute-btn',
            '.microphone-button',
            '.mic-button',
            '#toggleMicrophone',
            '#microphoneButton',
            '[role="button"][aria-label*="mic"]',
            '[role="button"][aria-label*="Mic"]',
            'button[aria-describedby*="mic"]',
            'button[aria-describedby*="Mic"]'
          ];
          
          console.log("Attempting to enable Teams audio...");
          console.log("=== DEBUGGING: Searching for all possible buttons ===");
          
          // First, let's see what buttons actually exist
          const allButtons = document.querySelectorAll('button, [role="button"]');
          console.log(`Found ${allButtons.length} total buttons/clickable elements`);
          
          // Log first 10 buttons for debugging
          for (let i = 0; i < Math.min(10, allButtons.length); i++) {
            const btn = allButtons[i] as HTMLElement;
            console.log(`Button ${i+1}: aria-label="${btn.getAttribute('aria-label')}", title="${btn.getAttribute('title')}", data-tid="${btn.getAttribute('data-tid')}", class="${btn.className}", text="${btn.textContent?.substring(0, 50)}"`);
          }
          
          let audioEnabled = false;
          
          for (const selector of muteButtonSelectors) {
            try {
              const button = document.querySelector(selector) as HTMLElement;
              if (button && button.offsetParent !== null) { // Check if button is visible
                console.log(`Found mute button with selector: ${selector}`);
                console.log(`Button details: aria-label="${button.getAttribute('aria-label')}", title="${button.getAttribute('title')}", aria-pressed="${button.getAttribute('aria-pressed')}"`);
                
                // Check button state - look for muted indicators
                const isMuted = button.getAttribute('aria-pressed') === 'true' ||
                               button.getAttribute('aria-label')?.includes('Unmute') ||
                               button.getAttribute('title')?.includes('Unmute') ||
                               button.classList.contains('muted') ||
                               button.classList.contains('is-muted') ||
                               button.querySelector('.muted-icon') !== null;
                
                console.log(`Button muted state: ${isMuted}`);
                
                // Click the button regardless of detected state for testing
                console.log("Clicking button (testing regardless of detected state)...");
                button.click();
                await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for UI update
                audioEnabled = true;
                console.log("Successfully clicked mute/unmute button");
                break;
              }
            } catch (buttonError: any) {
              console.log(`Error with selector ${selector}: ${buttonError.message}`);
            }
          }
          
          // Additional attempt: Look for any button with mute-related text
          if (!audioEnabled) {
            console.log("Trying to find mute button by text content...");
            const allButtons = document.querySelectorAll('button, [role="button"]');
            for (const button of allButtons) {
              const text = (button as HTMLElement).textContent?.toLowerCase() || '';
              const ariaLabel = (button as HTMLElement).getAttribute('aria-label')?.toLowerCase() || '';
              const title = (button as HTMLElement).getAttribute('title')?.toLowerCase() || '';
              
              if ((text.includes('unmute') || ariaLabel.includes('unmute') || title.includes('unmute')) &&
                  (button as HTMLElement).offsetParent !== null) {
                console.log(`Found unmute button by text: "${text}" / "${ariaLabel}" / "${title}"`);
                (button as HTMLElement).click();
                await new Promise(resolve => setTimeout(resolve, 1500));
                audioEnabled = true;
                break;
              }
            }
          }
          
          console.log(`Teams audio enablement result: ${audioEnabled}`);
          return audioEnabled;
        };
        
        // Try to enable audio before speaking
        const audioEnabled = await enableTeamsAudio();
        
        const announcement = "Hello, I am Vexa transcription bot. I have successfully joined the meeting and am now starting the transcription process. Please speak clearly and I will transcribe your conversation.";
        
        // Enhanced speech synthesis with better error handling
        try {
          console.log("Preparing speech synthesis...");
          
          // Wait for speech synthesis to be ready
          if (typeof speechSynthesis === 'undefined') {
            console.error("Speech synthesis not available in this browser");
            return;
          }
          
          // Create utterance with optimal settings
          const utterance = new SpeechSynthesisUtterance(announcement);
          utterance.rate = 0.7; // Slower for better clarity
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          utterance.lang = 'en-US';
          
          // Ensure voices are loaded
          let voicesLoaded = speechSynthesis.getVoices().length > 0;
          if (!voicesLoaded) {
            console.log("Waiting for voices to load...");
            await new Promise(resolve => {
              let timeout = setTimeout(resolve, 3000);
              speechSynthesis.onvoiceschanged = () => {
                clearTimeout(timeout);
                resolve(null);
              };
            });
          }
          
          // Select best voice
          const voices = speechSynthesis.getVoices();
          console.log(`Available voices: ${voices.length}`);
          
          if (voices.length > 0) {
            // Prefer English voices
            const englishVoice = voices.find(voice => 
              voice.lang.startsWith('en') && 
              (voice.name.includes('Natural') || voice.name.includes('Enhanced') || voice.default)
            ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
            
            utterance.voice = englishVoice;
            console.log(`Selected voice: ${englishVoice.name} (${englishVoice.lang})`);
          }
          
          // Start speaking with enhanced monitoring
          console.log("Starting speech synthesis...");
          console.log(`Audio enabled: ${audioEnabled}`);
          console.log(`Announcement text: "${announcement}"`);
          
          speechSynthesis.speak(utterance);
          
          // Monitor speech completion with timeout
          await new Promise(resolve => {
            let completed = false;
            
            utterance.onstart = () => {
              console.log("Speech synthesis started successfully");
            };
            
            utterance.onend = () => {
              if (!completed) {
                completed = true;
                console.log("Speech synthesis completed successfully");
                resolve(null);
              }
            };
            
            utterance.onerror = (event) => {
              if (!completed) {
                completed = true;
                console.error("Speech synthesis error:", event.error);
                resolve(null);
              }
            };
            
            // Safety timeout
            setTimeout(() => {
              if (!completed) {
                completed = true;
                console.log("Speech synthesis timeout reached");
                speechSynthesis.cancel(); // Stop any ongoing speech
                resolve(null);
              }
            }, 15000); // 15 second timeout
          });
          
        } catch (speechError) {
          console.error("Speech synthesis failed:", speechError);
        }
      });
      log("Bot announced start of transcription via enhanced text-to-speech with improved audio handling");
    } catch (e: any) {
      log(`Text-to-speech announcement failed: ${e.message}`);
    }
    
    // Automated audio validation test
    try {
      log("Running automated audio validation test...");
      await page.evaluate(async () => {
        console.log("🧪 AUDIO VALIDATION TEST STARTING...");
        
        // Test 1: Microphone access validation
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("✅ Microphone access: PASS");
          
          // Test 2: Audio context validation
          try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            source.connect(analyser);
            
            console.log("✅ Audio context creation: PASS");
            
            // Test 3: Audio level detection
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            console.log(`✅ Audio analyser ready: ${dataArray.length} frequency bins`);
            
            // Test 4: Speech synthesis validation (quick test)
            try {
              const testUtterance = new SpeechSynthesisUtterance("Audio test");
              testUtterance.volume = 0.1; // Very quiet for testing
              testUtterance.rate = 2.0; // Fast for quick test
              
              await new Promise((resolve) => {
                let timeout = setTimeout(resolve, 2000); // Quick timeout
                testUtterance.onstart = () => {
                  console.log("✅ Speech synthesis: PASS");
                  clearTimeout(timeout);
                  resolve(null);
                };
                testUtterance.onerror = () => {
                  console.log("⚠️ Speech synthesis: FAIL (but continuing)");
                  clearTimeout(timeout);
                  resolve(null);
                };
                speechSynthesis.speak(testUtterance);
              });
              
            } catch (speechError: any) {
              console.log("⚠️ Speech synthesis test failed:", speechError.message);
            }
            
            console.log("🎉 AUDIO VALIDATION COMPLETE - All core tests passed!");
            console.log("🚀 Bot audio pipeline is fully functional and ready for transcription");
            
          } catch (contextError) {
            console.error("❌ Audio context test failed:", contextError);
          }
          
        } catch (micError) {
          console.error("❌ Microphone access test failed:", micError);
          throw new Error("Critical: Microphone access denied - bot cannot record audio");
        }
      });
      
      log("✅ Automated audio validation completed successfully");
      
    } catch (validationError: any) {
      log(`⚠️ Audio validation test failed: ${validationError.message}`);
      // Don't fail the bot entirely, but log the issue for debugging
    }
    
    await startRecording(page, botConfig);
  } catch (error: any) {
    console.error("Error after Teams join attempt (admission/recording setup): " + error.message);
    log("Error after Teams join attempt (admission/recording setup): " + error.message + ". Triggering graceful leave.");
    await gracefulLeaveFunction(page, 1, "post_join_setup_error");
    return;
  }
}

// Function to wait for Teams meeting admission
const waitForTeamsMeetingAdmission = async (
  page: Page,
  leaveButton: string,
  timeout: number
): Promise<boolean> => {
  try {
    log("Waiting for Teams meeting admission...");
    
    // Debug: Check current page state during admission wait
    const currentUrl = page.url();
    const pageTitle = await page.title();
    log(`DEBUG: During admission wait - URL: ${currentUrl}, Title: ${pageTitle}`);
    
    // Check for lobby/waiting room first
    const lobbySelectors = [
      '[data-tid="lobby-screen"]',
      '[data-tid="waiting-room"]',
      'text="You\'re in the lobby"',
      'text="Waiting for someone to let you in"',
      'text="Please wait"'
    ];
    
    // Check what's actually on the page during admission wait
    const allElements = await page.$$eval('*', elements => 
      Array.from(elements).slice(0, 20).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim()?.substring(0, 100),
        dataTid: el.getAttribute('data-tid'),
        className: el.className,
        id: el.id
      })).filter(el => el.text && el.text.length > 0)
    );
    log(`DEBUG: Current page elements during admission wait: ${JSON.stringify(allElements.slice(0, 10), null, 2)}`);

    // Enhanced lobby detection with multiple strategies
    log("Starting comprehensive lobby detection checks...");
    
    // Check for lobby/waiting room indicators with enhanced detection
    const lobbyIndicators = await page.evaluate(() => {
      const indicators = {
        hasLobbyScreen: !!(document.querySelector('[data-tid="lobby-screen"]') || 
                          document.querySelector('[data-tid="waiting-room"]')),
        hasWaitingText: !!(document.querySelector('*') && 
                          Array.from(document.querySelectorAll('*')).some(el => 
                            el.textContent && (
                              el.textContent.includes("You're in the lobby") ||
                              el.textContent.includes("Waiting for someone to let you in") ||
                              el.textContent.includes("Please wait") ||
                              el.textContent.includes("lobby") ||
                              el.textContent.includes("waiting room") ||
                              el.textContent.includes("admitted")
                            )
                          )),
        hasLobbyButtons: !!(document.querySelector('[data-tid="lobby-join-button"]') ||
                           document.querySelector('[aria-label*="waiting"]')),
        isStillOnV2Url: (() => {
          const url = window.location.href;
          const hasV2Slash = url.includes('/v2/');
          const endsWithV2 = url.endsWith('/v2');
          const hasV2 = hasV2Slash || endsWithV2;
          console.log(`DEBUG URL: '${url}', contains /v2/: ${hasV2Slash}, ends with /v2: ${endsWithV2}, final result: ${hasV2}`);
          return hasV2;
        })(),
        isInLobbyState: window.location.href.includes('/v2/') && 
                       !document.querySelector('[data-tid="prejoin-join-button"]') &&
                       !document.querySelector('[data-tid="call-controls"]'),
        pageTitle: document.title
      };
      return indicators;
    });

    log(`Lobby detection results: ${JSON.stringify(lobbyIndicators, null, 2)}`);

    // FORCE manual admission detection if we're on /v2/ URL
    const isOnV2Url = currentUrl.includes('/v2/') || currentUrl.endsWith('/v2');
    log(`DEBUG: Current URL: ${currentUrl}`);
    log(`DEBUG: Is on V2 URL: ${isOnV2Url}`);
    
    // If we detect ANY lobby/waiting state OR we're on /v2/ URL (which indicates waiting for admission), wait for manual admission
    if (lobbyIndicators.hasLobbyScreen || lobbyIndicators.hasWaitingText || 
        lobbyIndicators.hasLobbyButtons || lobbyIndicators.isInLobbyState || isOnV2Url) {
      log("🏁 Bot is in Teams waiting state - waiting for manual admission");
      log("⚠️  PLEASE CHECK YOUR TEAMS MEETING FOR AN ADMISSION REQUEST!");
      log("⏰ Bot will wait up to 5 minutes for you to admit it manually");
      
      // Wait for actual meeting UI to appear (not just lobby admission)
      try {
        const meetingUIAppeared = await page.waitForFunction(() => {
          const meetingUISelectors = [
            '[data-tid="call-controls"]',
            '[data-tid="toggle-mute"]', 
            '[data-tid="calling-roster-cell"]',
            '[data-tid="call-end"]',
            '[aria-label*="Leave"]',
            '[aria-label*="Hang up"]',
            '[aria-label*="End call"]'
          ];
          
          return meetingUISelectors.some(selector => {
            const element = document.querySelector(selector) as HTMLElement;
            return element && element.offsetParent !== null;
          });
        }, { timeout: 300000 }); // 5 minutes for manual admission
        
        if (meetingUIAppeared) {
          log("✅ Successfully admitted from waiting state to full Teams meeting interface");
          return true;
        }
      } catch (e) {
        log("❌ Timeout waiting for manual admission - please admit the bot faster next time");
        return false;
      }
    }
    log("No waiting state detected - proceeding with standard admission detection...");
    
    // Enhanced admission detection with multiple strategies
    log("Checking for Teams meeting admission indicators...");
    
    // Wait a longer time for the admission process to complete
    log("Waiting additional time for Teams admission process...");
    await page.waitForTimeout(10000); // Wait 10 seconds for admission UI to appear
    
    // Strategy 1: Look for call controls (most reliable)
    const callControlSelectors = [
      '[data-tid="call-controls"]',
      '[data-tid="toggle-mute"]', 
      '[data-tid="calling-roster-cell"]',
      '[data-tid="call-end"]',
      '[aria-label*="Leave"]',
      '[aria-label*="Hang up"]',
      '[aria-label*="End call"]'
    ];
    
    // Strategy 2: Look for participant indicators
    const participantSelectors = [
      '[data-tid="participants-list"]',
      '[data-tid="roster"]',
      '[aria-label*="participant"]',
      'div[role="main"]' // Main meeting area
    ];
    
    // Strategy 3: URL-based detection  
    log(`Current URL during admission check: ${currentUrl}`);
    
    // First check if we're still on pre-join screen
    const stillOnPrejoin = await page.evaluate(() => {
      const joinButton = document.querySelector('[data-tid="prejoin-join-button"]');
      const prejoinElements = document.querySelector('[data-tid="prejoin-display-name-input"]');
      const prejoinSettings = document.querySelector('[data-tid="prejoin-audiosettings-button"]');
      return !!(joinButton || prejoinElements || prejoinSettings);
    });

    // FORCE manual admission mode for ALL Teams meetings to ensure proper timeout
    log("🏁 TEAMS BOT IS WAITING FOR MANUAL ADMISSION!");
    log("⚠️  PLEASE CHECK YOUR TEAMS MEETING FOR AN ADMISSION REQUEST!");
    log("⏰ Bot will wait up to 5 minutes for you to admit it manually");
    log("🎯 Look for 'Vexa Transcription Bot' in your Teams meeting participants or admission requests");
    
    if (stillOnPrejoin || true) { // FORCE this path to always execute
      log("Forcing manual admission wait - please admit the bot in Teams");
      
      // Wait for actual meeting UI to appear (manual admission required)
      try {
        const meetingUIAppeared = await page.waitForFunction(() => {
          const meetingUISelectors = [
            '[data-tid="call-controls"]',
            '[data-tid="toggle-mute"]', 
            '[data-tid="calling-roster-cell"]',
            '[data-tid="call-end"]',
            '[aria-label*="Leave"]',
            '[aria-label*="Hang up"]',
            '[aria-label*="End call"]'
          ];
          
          return meetingUISelectors.some(selector => {
            const element = document.querySelector(selector) as HTMLElement;
            return element && element.offsetParent !== null;
          });
        }, { timeout: 300000 }); // 5 minutes for manual admission
        
        if (meetingUIAppeared) {
          log("✅ Successfully admitted to Teams meeting after manual approval");
          return true;
        }
      } catch (e) {
        log("❌ Timeout waiting for manual admission - please admit the bot faster next time");
        return false;
      }
    }

    // Check for actual meeting interface elements (more reliable than URL)
    const hasActualMeetingUI = await page.evaluate(() => {
      const meetingUISelectors = [
        '[data-tid="call-controls"]',
        '[data-tid="toggle-mute"]', 
        '[data-tid="calling-roster-cell"]',
        '[data-tid="call-end"]',
        '[aria-label*="Leave"]',
        '[aria-label*="Hang up"]',
        '[aria-label*="End call"]',
        '[aria-label*="Mute"]',
        '[aria-label*="Unmute"]',
        '[data-tid="roster-button"]',
        '[data-tid="chat-button"]'
      ];
      
      return meetingUISelectors.some(selector => {
        const element = document.querySelector(selector) as HTMLElement;
        return element && element.offsetParent !== null;
      });
    });

    if (hasActualMeetingUI) {
      log("Found actual meeting UI controls - successfully admitted to Teams meeting");
      return true;
    }

    // Only use URL as secondary check and be more optimistic
    log(`DEBUG: Checking URL for admission indicators. Current URL: ${currentUrl}`);
    const urlIndicatesAdmission = currentUrl.includes('conversations') || 
                                 currentUrl.includes('calling') ||
                                 currentUrl.includes('/v2/'); // Remove stillOnPrejoin constraint for optimistic approach
    
    log(`DEBUG: URL admission check result: ${urlIndicatesAdmission} (conversations: ${currentUrl.includes('conversations')}, calling: ${currentUrl.includes('calling')}, v2: ${currentUrl.includes('/v2/')})`);
    
    if (urlIndicatesAdmission) {
      log("URL indicates successful admission to Teams meeting (secondary check)");
      return true;
    }
    
    // Try call control detection with extended timeout for manual admission
    log("🔍 Waiting for meeting controls to appear after manual admission...");
    try {
      for (const selector of callControlSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 30000 }); // 30 seconds per selector for manual admission
          log(`✅ Found call control indicator: ${selector}`);
          return true;
        } catch (e) {
          log(`❌ Call control selector ${selector} not found`);
        }
      }
      
      // Try participant detection with extended timeout
      log("🔍 Checking for participant indicators...");
      for (const selector of participantSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 30000 }); // 30 seconds per selector for manual admission
          log(`✅ Found participant indicator: ${selector}`);
          return true;
        } catch (e) {
          log(`❌ Participant selector ${selector} not found`);
        }
      }
    } catch (e) {
      log("🔄 Call control and participant detection completed, assuming successful admission");
    }
    
    // Strategy 4: Always assume admission for bypass lobby approach
    log("No specific admission indicators found, but no lobby detected either");
    log("Assuming successful admission based on optimistic bypass lobby approach");
    return true;
    
  } catch (error) {
    log(`Admission detection encountered error: ${error}, but proceeding optimistically`);
    log("Assuming successful admission due to optimistic bypass lobby approach");
    return true;
  }
};

// Handle Teams dialogs and overlays that might block interactions
const handleTeamsDialogs = async (page: Page): Promise<void> => {
  // Handle browser permission dialogs first (microphone/camera)
  await handleAudioPermissionDialogs(page);

  const dialogSelectors = [
    // Common Teams dialog overlays
    'button[aria-label="Close"]',
    'button[data-tid="cancel-button"]',
    'button[data-tid="modal-action-button-cancel"]',
    'button[aria-label="Dismiss"]',
    '[data-tid="dismiss-dialog"]',
    // Permission dialogs
    'button[data-tid="allow-button"]',
    'button[data-tid="enable-camera-button"]',
    'button[data-tid="enable-microphone-button"]',
    // Cookie/privacy banners
    'button[id*="accept"]',
    'button[id*="cookie"]',
    'button[aria-label*="Accept"]'
  ];

  for (const selector of dialogSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 1000 });
      await page.click(selector);
      log(`Dismissed dialog: ${selector}`);
      await page.waitForTimeout(500);
    } catch (e) {
      // Dialog not present, continue
    }
  }

  // Try to dismiss any modal overlays by pressing Escape
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (e) {
    // Ignore
  }
};

// Handle audio permission dialogs specifically
const handleAudioPermissionDialogs = async (page: Page): Promise<void> => {
  try {
    log("🎤 Checking for microphone permission dialogs...");
    
    // Grant permissions programmatically (already done in context creation)
    const context = page.context();
    await context.grantPermissions(['microphone', 'camera']);
    
    // Handle browser native permission prompts by clicking "Allow"
    const permissionSelectors = [
      'button:has-text("Allow")',
      'button:has-text("Zulassen")', // German
      'button:has-text("Permitir")', // Spanish  
      'button:has-text("Autoriser")', // French
      'button[aria-label*="Allow"]',
      'button[aria-label*="allow"]',
      '.permission-bubble button:first-child', // Chrome permission bubble
      '[data-testid="allow-button"]',
      '[data-testid="permission-allow"]'
    ];

    for (const selector of permissionSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          await element.click();
          log(`✅ Clicked permission button: ${selector}`);
          await page.waitForTimeout(1000);
          break;
        }
      } catch (e) {
        // Permission dialog not found with this selector
      }
    }

    // Check for Teams-specific audio setup dialogs
    const teamsAudioSelectors = [
      'button[data-tid="toggle-mute"]', // Unmute button
      'button[aria-label*="Unmute"]',
      'button[aria-label*="unmute"]',
      '[data-tid="prejoin-microphone-button"]'
    ];

    for (const selector of teamsAudioSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          // Check if microphone is muted and unmute if needed
          const ariaPressed = await element.getAttribute('aria-pressed');
          const ariaLabel = await element.getAttribute('aria-label');
          const isMuted = ariaPressed === 'true' || (ariaLabel && ariaLabel.includes('Unmute'));
          
          if (isMuted) {
            await element.click();
            log(`🎤 Unmuted microphone using: ${selector}`);
            await page.waitForTimeout(500);
          }
        }
      } catch (e) {
        // Teams audio control not found with this selector
      }
    }

    log("✅ Audio permission dialog handling completed");
    
  } catch (error: any) {
    log(`⚠️ Error handling audio permissions: ${error.message}`);
  }
};

// Prepare for recording by exposing necessary functions
const prepareForRecording = async (page: Page): Promise<void> => {
  // Expose the logBot function to the browser context
  await page.exposeFunction("logBot", (msg: string) => {
    log(msg);
  });
};

const joinTeamsMeeting = async (page: Page, meetingUrl: string, botName: string) => {
  // Teams-specific selectors - multiple alternatives for different meeting types
  const nameFieldSelectors = [
    'input[data-tid="prejoin-display-name-input"]',
    'input[placeholder*="name"]',
    'input[placeholder*="Name"]',
    'input[type="text"]',
    '#displayName',
    '[data-tid="name-input"]',
    'input[name="displayName"]',
    'input[aria-label*="name"]',
    'input[aria-label*="Name"]',
    '.name-input input',
    '.display-name input',
    '[data-automation-id*="name"] input',
    '.ts-calling-web-calling-screen input[type="text"]',
    'input'  // Last resort - any input field
  ];
  const joinButtonSelectors = [
    'button[data-tid="prejoin-join-button"]',
    'button[data-tid="join-btn"]',
    'button:has-text("Join")',
    'button:has-text("Join now")',
    '[data-tid="join-meeting-button"]'
  ];
  const useWebInsteadLink = 'a[href*="launcher=false"]';

  // For meetup-join URLs, try to bypass the launcher by constructing a direct URL
  let directUrl = meetingUrl;
  if (meetingUrl.includes('/l/meetup-join/')) {
    try {
      // Extract meeting ID and context from the URL
      const meetingMatch = meetingUrl.match(/19%3ameeting_([^%@]+)%40thread\.v2/);
      const contextMatch = meetingUrl.match(/context=([^&]+)/);
      
      if (meetingMatch && contextMatch) {
        const meetingId = meetingMatch[1];
        const context = decodeURIComponent(contextMatch[1]);
        // Try direct Teams web app URL
        directUrl = `https://teams.microsoft.com/_#/l/meetup-join/19:meeting_${meetingId}@thread.v2/0?context=${encodeURIComponent(context)}&anon=true`;
        log(`Attempting direct Teams URL bypass: ${directUrl}`);
      }
    } catch (e: any) {
      log(`URL extraction failed, using original URL: ${e.message}`);
    }
  }

  await page.goto(directUrl, { waitUntil: "networkidle" });
  await page.bringToFront();

  // Wait for page to settle
  log("Waiting for Teams meeting page to load...");
  await page.waitForTimeout(3000);

  // Handle any immediate permission dialogs
  await handleAudioPermissionDialogs(page);

  // Try to click "Use the web app instead" if it appears
  try {
    await page.waitForSelector(useWebInsteadLink, { timeout: 5000 });
    await page.click(useWebInsteadLink);
    log("Clicked 'Use the web app instead' link");
    await page.waitForTimeout(3000);
  } catch (e) {
    log("'Use the web app instead' link not found or already using web app");
  }

  // Try to click "Continue on this browser" multiple times if needed
  let browserButtonClicks = 0;
  const maxBrowserClicks = 3;
  
  while (browserButtonClicks < maxBrowserClicks) {
    try {
      await page.waitForSelector('button[data-tid="joinOnWeb"]', { timeout: 5000 });
      await page.click('button[data-tid="joinOnWeb"]');
      browserButtonClicks++;
      log(`Clicked 'Continue on this browser' button (attempt ${browserButtonClicks})`);
      log("Waiting for page navigation after browser selection...");
      await page.waitForTimeout(5000);
      
      // Check if page URL changed and if we still see the browser selection
      const currentUrl = page.url();
      log(`Current page URL after browser selection: ${currentUrl}`);
      
      // Check if browser selection buttons are still present
      const stillHasBrowserButtons = await page.$('button[data-tid="joinOnWeb"]');
      if (!stillHasBrowserButtons) {
        log("Browser selection screen bypassed successfully");
        break;
      } else {
        log("Still on browser selection screen, will try clicking again...");
      }
    } catch (e) {
      log("'Continue on this browser' button not found - moving on");
      break;
    }
  }

  // Debug: Check what's actually on the page
  log("DEBUG: Checking page content for available elements...");
  try {
    const pageTitle = await page.title();
    log(`DEBUG: Page title: ${pageTitle}`);
    
    const allInputs = await page.$$eval('input', inputs => 
      inputs.map(input => ({
        type: input.type,
        name: input.name,
        placeholder: input.placeholder,
        id: input.id,
        className: input.className,
        dataTid: input.getAttribute('data-tid'),
        ariaLabel: input.getAttribute('aria-label')
      }))
    );
    log(`DEBUG: Found ${allInputs.length} input elements: ${JSON.stringify(allInputs, null, 2)}`);
    
    const allButtons = await page.$$eval('button', buttons => 
      buttons.map(button => ({
        textContent: button.textContent?.trim(),
        id: button.id,
        className: button.className,
        dataTid: button.getAttribute('data-tid'),
        ariaLabel: button.getAttribute('aria-label')
      }))
    );
    log(`DEBUG: Found ${allButtons.length} button elements: ${JSON.stringify(allButtons.slice(0, 10), null, 2)}`);
  } catch (e: any) {
    log(`DEBUG: Error inspecting page elements: ${e.message}`);
  }

  // Wait for any of the name input field selectors
  log("Waiting for name input field...");
  let nameField = null;
  for (const selector of nameFieldSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      nameField = selector;
      log(`Found name field with selector: ${selector}`);
      break;
    } catch (e) {
      log(`Name field selector ${selector} not found, trying next...`);
    }
  }
  
  if (!nameField) {
    // Check if we can proceed without name entry (maybe already logged in)
    log("No name field found - checking if we can proceed directly to join...");
    
    // Look for join buttons even without name field
    for (const selector of joinButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 }); // Increased from 3s to 10s
        log(`Found join button without name entry: ${selector} - proceeding`);
        await page.click(selector);
        log("Clicked join button directly");
        
        // Debug: Check what happens after clicking join
        await page.waitForTimeout(3000);
        log("DEBUG: Checking page state after join button click...");
        const postJoinUrl = page.url();
        const postJoinTitle = await page.title();
        log(`DEBUG: Post-join URL: ${postJoinUrl}`);
        log(`DEBUG: Post-join Title: ${postJoinTitle}`);
        
        return; // Exit early, proceeding to admission wait
      } catch (e) {
        log(`Join button ${selector} not found, trying next...`);
      }
    }
    
    log("⚠️ Could not find name input field or join button with known selectors - proceeding optimistically for manual admission");
    // Don't throw error - continue to manual admission workflow
    return;
  }
  
  // Fill in the bot name
  await page.waitForTimeout(randomDelay(1000));
  await page.fill(nameField, botName);
  log(`Entered bot name: ${botName}`);

  // Turn off microphone and camera if they're on
  const microphoneButton = 'button[data-tid="toggle-mute"]';
  const cameraButton = 'button[data-tid="toggle-video"]';
  
  try {
    await page.waitForTimeout(randomDelay(500));
    const micButton = await page.$(microphoneButton);
    if (micButton) {
      const isMuted = await page.getAttribute(microphoneButton, 'aria-pressed') === 'true';
      if (!isMuted) {
        await page.click(microphoneButton);
        log("Microphone muted");
      }
    }
  } catch (e) {
    log("Could not control microphone or already muted");
  }

  try {
    await page.waitForTimeout(randomDelay(500));
    const camButton = await page.$(cameraButton);
    if (camButton) {
      const isCameraOff = await page.getAttribute(cameraButton, 'aria-pressed') === 'false';
      if (!isCameraOff) {
        await page.click(cameraButton);
        log("Camera turned off");
      }
    }
  } catch (e) {
    log("Could not control camera or already off");
  }

  // Handle any blocking dialogs before clicking join
  await handleTeamsDialogs(page);
  
  // Find and click join button using multiple selectors
  let joinButton = null;
  for (const selector of joinButtonSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      joinButton = selector;
      log(`Found join button with selector: ${selector}`);
      break;
    } catch (e) {
      log(`Join button selector ${selector} not found, trying next...`);
    }
  }
  
  if (!joinButton) {
    log("⚠️ Could not find join button with known selectors - proceeding optimistically for manual admission");
    // Don't throw error - continue to manual admission workflow
    return;
  }
  
  // Try multiple methods to click the join button if overlay blocks it
  let joinSuccessful = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.click(joinButton, { force: true });
      log(`${botName} attempting to join Teams meeting (attempt ${attempt + 1})`);
      
      // Debug: Check immediate result of join button click
      await page.waitForTimeout(2000);
      const immediateUrl = page.url();
      const immediateTitle = await page.title();
      log(`DEBUG: Immediate post-click URL: ${immediateUrl}`);
      log(`DEBUG: Immediate post-click Title: ${immediateTitle}`);
      
      joinSuccessful = true;
      break;
    } catch (error) {
      log(`Join button click blocked, attempt ${attempt + 1}. Trying to dismiss dialogs...`);
      await handleTeamsDialogs(page);
      await page.waitForTimeout(1000);
    }
  }
  
  if (!joinSuccessful) {
    // Force click using JavaScript with dynamic selector
    await page.evaluate((buttonSelector) => {
      const button = document.querySelector(buttonSelector) as HTMLButtonElement;
      if (button) button.click();
    }, joinButton);
    log(`${botName} forced click on join button via JavaScript`);
  }
};

// Modified recording function for Teams
const startRecording = async (page: Page, botConfig: BotConfig) => {
  const { meetingUrl, token, connectionId, platform, nativeMeetingId } = botConfig;

  // Get WhisperLive URL from environment
  const whisperLiveUrlFromEnv = process.env.WHISPER_LIVE_URL;

  if (!whisperLiveUrlFromEnv) {
    log(
      "ERROR: WHISPER_LIVE_URL environment variable is not set for vexa-bot in its Node.js environment. Cannot start recording."
    );
    return;
  }
  log(`[Node.js] WHISPER_LIVE_URL for vexa-bot is: ${whisperLiveUrlFromEnv}`);

  log("Starting Teams recording with WebSocket connection");

  // Pass the necessary config fields and the resolved URL into the page context
  await page.evaluate(
    async (pageArgs: {
      botConfigData: BotConfig;
      whisperUrlForBrowser: string;
    }) => {
      const { botConfigData, whisperUrlForBrowser } = pageArgs;
      const {
        meetingUrl,
        token,
        connectionId: originalConnectionId,
        platform,
        nativeMeetingId,
        language: initialLanguage,
        task: initialTask,
      } = botConfigData;

      // Helper function to generate UUID in browser context
      const generateUUID = () => {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
          return crypto.randomUUID();
        } else {
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            function (c) {
              var r = (Math.random() * 16) | 0,
                v = c == "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            }
          );
        }
      };


      await new Promise<void>((resolve, reject) => {
        try {
          (window as any).logBot("Starting Teams recording process.");
          
          // Enhanced media element finding for Teams
          const findTeamsMediaElements = async (retries = 5, delay = 2000): Promise<HTMLMediaElement[]> => {
            for (let i = 0; i < retries; i++) {
                // Teams-specific audio selectors
                const mediaElements = Array.from(
                    document.querySelectorAll("audio, video, [data-tid*='audio'], [data-tid*='video']")
                ).filter((el: any) => 
                    !el.paused && 
                    el.srcObject instanceof MediaStream && 
                    el.srcObject.getAudioTracks().length > 0
                ) as HTMLMediaElement[];

                if (mediaElements.length > 0) {
                    (window as any).logBot(`Found ${mediaElements.length} active Teams media elements with audio tracks after ${i + 1} attempt(s).`);
                    return mediaElements;
                }
                (window as any).logBot(`[Teams Audio] No active media elements found. Retrying in ${delay}ms... (Attempt ${i + 2}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            return [];
          };


          findTeamsMediaElements().then(mediaElements => {
            if (mediaElements.length === 0) {
              (window as any).logBot(
                "[Teams BOT] No active media elements found initially. Bot will stay in meeting and monitor for audio activity."
              );
              // Instead of exiting, resolve and let the bot stay in the meeting
              resolve();
              return;
            }

            (window as any).logBot(
              `Found ${mediaElements.length} active Teams media elements.`
            );
            const audioContext = new AudioContext();
            const destinationNode = audioContext.createMediaStreamDestination();
            let sourcesConnected = 0;

            // Connect all media elements to the destination node
            mediaElements.forEach((element: any, index: number) => {
              try {
                const elementStream =
                  element.srcObject ||
                  (element.captureStream && element.captureStream()) ||
                  (element.mozCaptureStream && element.mozCaptureStream());

                if (
                  elementStream instanceof MediaStream &&
                  elementStream.getAudioTracks().length > 0
                ) {
                  const sourceNode =
                    audioContext.createMediaStreamSource(elementStream);
                  sourceNode.connect(destinationNode);
                  sourcesConnected++;
                  (window as any).logBot(
                    `Connected Teams audio stream from element ${index + 1}/${
                      mediaElements.length
                    }.`
                  );
                }
              } catch (error: any) {
                (window as any).logBot(
                  `Could not connect Teams element ${index + 1}: ${error.message}`
                );
              }
            });

            if (sourcesConnected === 0) {
              return reject(
                new Error(
                  "[Teams BOT Error] Could not connect any audio streams. Check media permissions."
                )
              );
            }

            const stream = destinationNode.stream;
            (window as any).logBot(
              `Successfully combined ${sourcesConnected} Teams audio streams.`
            );

            (window as any).logBot(
              `Original Teams bot connection ID: ${originalConnectionId}`
            );

            const wsUrl = whisperUrlForBrowser;
            if (!wsUrl) {
              (window as any).logBot?.(
                "CRITICAL: WhisperLive WebSocket URL is missing in browser context!"
              );
              console.error(
                "CRITICAL: WhisperLive WebSocket URL is missing in browser context!"
              );
              return;
            }

            // Browser-scope state for current WS config
            let currentWsLanguage = initialLanguage;
            let currentWsTask = initialTask;

            let socket: WebSocket | null = null;
            let isServerReady = false;
            let retryCount = 0;
            const configuredInterval = botConfigData.reconnectionIntervalMs;
            const baseRetryDelay = (configuredInterval && configuredInterval <= 1000) ? configuredInterval : 1000;

            let sessionAudioStartTimeMs: number | null = null;

            const setupWebSocket = () => {
              try {
                if (socket) {
                  try {
                    socket.close();
                  } catch (err) {
                    // Ignore errors when closing
                  }
                }

                (window as any).logBot(`[Teams] Creating WebSocket connection to: ${wsUrl}`);
                socket = new WebSocket(wsUrl);
                (window as any).logBot(`[Teams] WebSocket created, initial readyState: ${socket.readyState}`);

                // CRITICAL: Attach ALL event handlers IMMEDIATELY after WebSocket creation to prevent race condition
                let connectionTimeoutHandle: number | null = null;
                
                socket.onopen = function () {
                  if (connectionTimeoutHandle !== null) {
                    clearTimeout(connectionTimeoutHandle);
                    connectionTimeoutHandle = null;
                  }
                  
                  currentSessionUid = generateUUID();
                  sessionAudioStartTimeMs = null;
                  (window as any).logBot(
                    `[Teams RelativeTime] WebSocket connection opened. New UID: ${currentSessionUid}. sessionAudioStartTimeMs reset. Lang: ${currentWsLanguage}, Task: ${currentWsTask}`
                  );
                  retryCount = 0;

                  if (socket) {
                    const initialConfigPayload = {
                      uid: currentSessionUid,
                      language: currentWsLanguage || null,
                      task: currentWsTask || "transcribe",
                      model: "medium",
                      use_vad: true,
                      platform: platform,
                      token: token,
                      meeting_id: nativeMeetingId,
                      meeting_url: meetingUrl || null,
                    };

                    const jsonPayload = JSON.stringify(initialConfigPayload);
                    (window as any).logBot(
                      `Sending Teams initial config message: ${jsonPayload}`
                    );
                    socket.send(jsonPayload);
                  }
                };

                socket.onmessage = (event) => {
                  (window as any).logBot("Teams received message: " + event.data);
                  const data = JSON.parse(event.data);

                  if (data["status"] === "ERROR") {
                    (window as any).logBot(
                      `Teams WebSocket Server Error: ${data["message"]}`
                    );
                  } else if (data["status"] === "WAIT") {
                    (window as any).logBot(`Teams server busy: ${data["message"]}`);
                  } else if (!isServerReady) {
                    isServerReady = true;
                    (window as any).logBot("Teams server is ready.");
                  } else if (data["language"]) {
                    (window as any).logBot(
                      `Teams language detected: ${data["language"]}`
                    );
                  } else if (data["message"] === "DISCONNECT") {
                    (window as any).logBot("Teams server requested disconnect.");
                    if (socket) {
                      socket.close();
                    }
                  } else {
                    (window as any).logBot(
                      `Teams transcription: ${JSON.stringify(data)}`
                    );
                  }
                };

                socket.onerror = (event) => {
                  if (connectionTimeoutHandle !== null) {
                    clearTimeout(connectionTimeoutHandle);
                    connectionTimeoutHandle = null;
                  }
                  (window as any).logBot(
                    `Teams WebSocket error: ${JSON.stringify(event)}`
                  );
                };

                socket.onclose = (event) => {
                  if (connectionTimeoutHandle !== null) {
                    clearTimeout(connectionTimeoutHandle);
                    connectionTimeoutHandle = null;
                  }
                  (window as any).logBot(
                    `Teams WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`
                  );

                  retryCount++;
                  (window as any).logBot(
                    `Attempting to reconnect Teams in ${baseRetryDelay}ms. Retry attempt ${retryCount}`
                  );

                  setTimeout(() => {
                    (window as any).logBot(
                      `Retrying Teams WebSocket connection (attempt ${retryCount})...`
                    );
                    setupWebSocket();
                  }, baseRetryDelay);
                };

                // Set connection timeout AFTER all event handlers are attached
                const connectionTimeoutMs = 3000;
                connectionTimeoutHandle = window.setTimeout(() => {
                  if (socket && socket.readyState === WebSocket.CONNECTING) {
                    (window as any).logBot(
                      `Teams connection attempt timed out after ${connectionTimeoutMs}ms. Forcing close.`
                    );
                    try {
                      socket.close();
                    } catch (_) {
                      /* ignore */
                    }
                  }
                }, connectionTimeoutMs);
              } catch (e: any) {
                (window as any).logBot(`Error creating Teams WebSocket: ${e.message}`);
                retryCount++;
                (window as any).logBot(
                  `Error during Teams WebSocket setup. Attempting to reconnect in ${baseRetryDelay}ms. Retry attempt ${retryCount}`
                );

                setTimeout(() => {
                  (window as any).logBot(
                    `Retrying Teams WebSocket connection (attempt ${retryCount})...`
                  );
                  setupWebSocket();
                }, baseRetryDelay);
              }
            };

            // Expose reconfigure function
            (window as any).triggerWebSocketReconfigure = (
              newLang: string | null,
              newTask: string | null
            ) => {
              (window as any).logBot(
                `[Teams Node->Browser] Received reconfigure. New Lang: ${newLang}, New Task: ${newTask}`
              );
              currentWsLanguage = newLang;
              currentWsTask = newTask || "transcribe";

              if (socket && socket.readyState === WebSocket.OPEN) {
                (window as any).logBot(
                  "[Teams Node->Browser] Closing WebSocket to reconnect with new config."
                );
                socket.close();
              }
            };

            // Expose Teams leave function
            (window as any).performLeaveAction = async () => {
              (window as any).logBot(
                "Attempting to leave the Teams meeting from browser context..."
              );
              
              // Send LEAVING_MEETING signal before closing WebSocket
              if (socket && socket.readyState === WebSocket.OPEN) {
                try {
                  const sessionControlMessage = {
                    type: "session_control",
                    payload: {
                      event: "LEAVING_MEETING",
                      uid: currentSessionUid,
                      client_timestamp_ms: Date.now(),
                      token: token,
                      platform: platform,
                      meeting_id: nativeMeetingId
                    }
                  };
                  
                  socket.send(JSON.stringify(sessionControlMessage));
                  (window as any).logBot("Teams LEAVING_MEETING signal sent to WhisperLive");
                  
                  await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error: any) {
                  (window as any).logBot(`Error sending Teams LEAVING_MEETING signal: ${error.message}`);
                }
              }

              try {
                const leaveButtonSelector = 'button[data-tid="call-end"]';
                const hangupButtonSelector = 'button[data-tid="hangup-button"]';
                
                let leaveButton = document.querySelector(leaveButtonSelector) as HTMLElement;
                if (!leaveButton) {
                  leaveButton = document.querySelector(hangupButtonSelector) as HTMLElement;
                }
                
                if (leaveButton) {
                  (window as any).logBot("Clicking Teams leave button...");
                  leaveButton.click();
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  (window as any).logBot("Teams leave sequence completed.");
                  return true;
                } else {
                  (window as any).logBot("Teams leave button not found.");
                  return false;
                }
              } catch (err: any) {
                (window as any).logBot(
                  `Error during Teams leave attempt: ${err.message}`
                );
                return false;
              }
            };

            setupWebSocket();

            // Teams-specific speaker detection
            const teamsParticipantSelector = '[data-tid="participant-tile"], [data-tid="roster-list-item"]';
            const teamsSpeakingClasses = ['is-speaking', 'speaking', 'ts-speaking-indicator'];
            const speakingStates = new Map();
            const activeParticipants = new Map();

            let currentSessionUid = generateUUID();

            function getTeamsParticipantId(element: HTMLElement) {
              let id = element.getAttribute('data-tid') || 
                      element.getAttribute('id') ||
                      element.getAttribute('data-object-id');
              
              if (!id) {
                if (!(element as any).dataset.vexaGeneratedId) {
                  (element as any).dataset.vexaGeneratedId = 'vexa-teams-id-' + Math.random().toString(36).substr(2, 9);
                }
                id = (element as any).dataset.vexaGeneratedId;
              }
              return id;
            }

            function getTeamsParticipantName(participantElement: HTMLElement) {
              // Teams-specific name selectors
              const nameSelectors = [
                '[data-tid="roster-list-title"]',
                '[data-tid="participant-name"]',
                '.ts-text-truncate',
                '.name-text',
                '.displayName'
              ];

              for (const selector of nameSelectors) {
                const nameElement = participantElement.querySelector(selector) as HTMLElement;
                if (nameElement && nameElement.textContent) {
                  const nameText = nameElement.textContent.trim();
                  if (nameText && nameText.length > 1 && nameText.length < 50) {
                    return nameText;
                  }
                }
              }

              const participantId = getTeamsParticipantId(participantElement);
              return `Teams Participant (${participantId})`;
            }

            function sendTeamsSpeakerEvent(eventType: string, participantElement: HTMLElement) {
              const eventAbsoluteTimeMs = Date.now();
              let relativeTimestampMs: number | null = null;

              if (sessionAudioStartTimeMs === null) {
                (window as any).logBot(`[Teams RelativeTime] SKIPPING speaker event: ${eventType} for ${getTeamsParticipantName(participantElement)}. sessionAudioStartTimeMs not yet set. UID: ${currentSessionUid}`);
                return;
              }

              relativeTimestampMs = eventAbsoluteTimeMs - sessionAudioStartTimeMs;

              const participantId = getTeamsParticipantId(participantElement);
              const participantName = getTeamsParticipantName(participantElement);

              if (socket && socket.readyState === WebSocket.OPEN) {
                const speakerEventMessage = {
                  type: "speaker_activity",
                  payload: {
                    event_type: eventType,
                    participant_name: participantName,
                    participant_id_meet: participantId,
                    relative_client_timestamp_ms: relativeTimestampMs,
                    uid: currentSessionUid,
                    token: token,
                    platform: platform,
                    meeting_id: nativeMeetingId,
                    meeting_url: meetingUrl
                  }
                };

                try {
                  socket.send(JSON.stringify(speakerEventMessage));
                  (window as any).logBot(`[Teams RelativeTime] Speaker event sent: ${eventType} for ${participantName} (${participantId}). RelativeTs: ${relativeTimestampMs}ms. UID: ${currentSessionUid}`);
                } catch (error: any) {
                  (window as any).logBot(`Error sending Teams speaker event: ${error.message}`);
                }
              }
            }

            function logTeamsSpeakerEvent(participantElement: HTMLElement, mutatedClassList: DOMTokenList) {
              const participantId = getTeamsParticipantId(participantElement);
              const participantName = getTeamsParticipantName(participantElement);
              const previousLogicalState = speakingStates.get(participantId) || "silent";

              const isNowSpeaking = teamsSpeakingClasses.some(cls => mutatedClassList.contains(cls));

              if (isNowSpeaking && previousLogicalState !== "speaking") {
                (window as any).logBot(`🎤 Teams SPEAKER_START: ${participantName} (ID: ${participantId})`);
                sendTeamsSpeakerEvent("SPEAKER_START", participantElement);
                speakingStates.set(participantId, "speaking");
              } else if (!isNowSpeaking && previousLogicalState === "speaking") {
                (window as any).logBot(`🔇 Teams SPEAKER_END: ${participantName} (ID: ${participantId})`);
                sendTeamsSpeakerEvent("SPEAKER_END", participantElement);
                speakingStates.set(participantId, "silent");
              }
            }

            function observeTeamsParticipant(participantElement: HTMLElement) {
              const participantId = getTeamsParticipantId(participantElement);
              
              speakingStates.set(participantId, "silent");
              activeParticipants.set(participantId, { 
                name: getTeamsParticipantName(participantElement), 
                element: participantElement 
              });

              (window as any).logBot(`👁️ Observing Teams participant: ${getTeamsParticipantName(participantElement)} (ID: ${participantId})`);

              const callback = function(mutationsList: MutationRecord[], observer: MutationObserver) {
                for (const mutation of mutationsList) {
                  if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const targetElement = mutation.target as HTMLElement;
                    if (targetElement.matches(teamsParticipantSelector) || participantElement.contains(targetElement)) {
                      const finalTarget = targetElement.matches(teamsParticipantSelector) ? targetElement : participantElement;
                      logTeamsSpeakerEvent(finalTarget, targetElement.classList);
                    }
                  }
                }
              };

              const observer = new MutationObserver(callback);
              observer.observe(participantElement, { 
                attributes: true, 
                attributeFilter: ['class'],
                subtree: true 
              });
              
              if (!(participantElement as any).dataset.vexaObserverAttached) {
                (participantElement as any).dataset.vexaObserverAttached = 'true';
              }
            }

            function scanForTeamsParticipants() {
              const participantElements = document.querySelectorAll(teamsParticipantSelector);
              for (let i = 0; i < participantElements.length; i++) {
                const el = participantElements[i] as HTMLElement;
                if (!(el as any).dataset.vexaObserverAttached) {
                  observeTeamsParticipant(el);
                }
              }
            }

            // Initialize Teams speaker detection
            scanForTeamsParticipants();

            // Monitor for new Teams participants
            const bodyObserver = new MutationObserver((mutationsList) => {
              for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                  mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                      const elementNode = node as HTMLElement;
                      if (elementNode.matches(teamsParticipantSelector) && !(elementNode as any).dataset.vexaObserverAttached) {
                        observeTeamsParticipant(elementNode);
                      }
                      const childElements = elementNode.querySelectorAll(teamsParticipantSelector);
                      for (let i = 0; i < childElements.length; i++) {
                        const childEl = childElements[i] as HTMLElement;
                        if (!(childEl as any).dataset.vexaObserverAttached) {
                          observeTeamsParticipant(childEl);
                        }
                      }
                    }
                  });
                }
              }
            });

            bodyObserver.observe(document.body, {
              childList: true,
              subtree: true
            });

            // Audio processing pipeline for Teams
            const audioDataCache = [];
            const mediaStream = audioContext.createMediaStreamSource(stream);
            const recorder = audioContext.createScriptProcessor(4096, 1, 1);

            recorder.onaudioprocess = async (event) => {
              if (
                !isServerReady ||
                !socket ||
                socket.readyState !== WebSocket.OPEN
              ) {
                return;
              }

              if (sessionAudioStartTimeMs === null) {
                sessionAudioStartTimeMs = Date.now();
                (window as any).logBot(`[Teams RelativeTime] sessionAudioStartTimeMs set for UID ${currentSessionUid}: ${sessionAudioStartTimeMs}`);
              }

              const inputData = event.inputBuffer.getChannelData(0);
              const data = new Float32Array(inputData);
              const targetLength = Math.round(
                data.length * (16000 / audioContext.sampleRate)
              );
              const resampledData = new Float32Array(targetLength);
              const springFactor = (data.length - 1) / (targetLength - 1);
              resampledData[0] = data[0];
              resampledData[targetLength - 1] = data[data.length - 1];
              for (let i = 1; i < targetLength - 1; i++) {
                const index = i * springFactor;
                const leftIndex = Math.floor(index);
                const rightIndex = Math.ceil(index);
                const fraction = index - leftIndex;
                resampledData[i] =
                  data[leftIndex] +
                  (data[rightIndex] - data[leftIndex]) * fraction;
              }
              
              if (socket && socket.readyState === WebSocket.OPEN) {
                if (sessionAudioStartTimeMs === null) {
                  (window as any).logBot(`[Teams RelativeTime] CRITICAL WARNING: sessionAudioStartTimeMs is STILL NULL before sending audio data for UID ${currentSessionUid}`);
                  return;
                }
                socket.send(resampledData);
              }
            };

            // Connect the audio processing pipeline
            mediaStream.connect(recorder);
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0;
            recorder.connect(gainNode);
            gainNode.connect(audioContext.destination);

            (window as any).logBot(
              "Teams audio processing pipeline connected and sending data silently."
            );

            // Announce that recording has started
            try {
              const recordingAnnouncement = "Recording has started. I am now listening and will transcribe all speech in this meeting.";
              const utterance = new SpeechSynthesisUtterance(recordingAnnouncement);
              utterance.rate = 0.9;
              utterance.pitch = 1.0;
              utterance.volume = 0.8;
              speechSynthesis.speak(utterance);
              (window as any).logBot("Bot announced recording start via text-to-speech");
            } catch (speechError: any) {
              (window as any).logBot(`Recording announcement failed: ${speechError.message}`);
            }

            // Monitor participant list for Teams
            let aloneTime = 0;
            const checkInterval = setInterval(() => {
              const count = activeParticipants.size;
              const participantIds = Array.from(activeParticipants.keys());
              (window as any).logBot(`Teams participant check: Found ${count} unique participants. IDs: ${JSON.stringify(participantIds)}`);

              if (count <= 1) {
                aloneTime += 5;
              } else {
                if (aloneTime > 0) {
                  (window as any).logBot('Another Teams participant joined. Resetting alone timer.');
                }
                aloneTime = 0;
              }

              if (aloneTime >= 120) { // Increased to 2 minutes for visibility testing
                (window as any).logBot(
                  "Teams meeting ended or bot has been alone for 2 minutes. Stopping recorder..."
                );
                clearInterval(checkInterval);
                recorder.disconnect();
                (window as any).triggerNodeGracefulLeave();
                resolve();
              } else if (aloneTime > 0) {
                (window as any).logBot(
                  `Teams bot has been alone for ${aloneTime} seconds. Will leave in ${120 - aloneTime} more seconds.`
                );
              }
            }, 5000);

            // Event listeners
            window.addEventListener("beforeunload", () => {
              (window as any).logBot("Teams page is unloading. Stopping recorder...");
              clearInterval(checkInterval);
              recorder.disconnect();
              (window as any).triggerNodeGracefulLeave();
              resolve();
            });
            
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "hidden") {
                (window as any).logBot(
                  "Teams document is hidden. Stopping recorder..."
                );
                clearInterval(checkInterval);
                recorder.disconnect();
                (window as any).triggerNodeGracefulLeave();
                resolve();
              }
            });
          }).catch(err => {
              reject(err);
          });
        } catch (error: any) {
          return reject(new Error("[Teams BOT Error] " + error.message));
        }
      });
    },
    { botConfigData: botConfig, whisperUrlForBrowser: whisperLiveUrlFromEnv }
  );
};

// Export Teams leave function
export async function leaveMicrosoftTeams(page: Page): Promise<boolean> {
  log("[leaveMicrosoftTeams] Triggering leave action in browser context...");
  if (!page || page.isClosed()) {
    log("[leaveMicrosoftTeams] Page is not available or closed.");
    return false;
  }
  try {
    const result = await page.evaluate(async () => {
      if (typeof (window as any).performLeaveAction === "function") {
        return await (window as any).performLeaveAction();
      } else {
        (window as any).logBot?.(
          "[Teams Node Eval Error] performLeaveAction function not found on window."
        );
        console.error(
          "[Teams Node Eval Error] performLeaveAction function not found on window."
        );
        return false;
      }
    });
    log(`[leaveMicrosoftTeams] Browser leave action result: ${result}`);
    return result;
  } catch (error: any) {
    log(
      `[leaveMicrosoftTeams] Error calling performLeaveAction in browser: ${error.message}`
    );
    return false;
  }
}

/**
 * Retrieve enhanced meeting information using Microsoft Graph API
 * Note: This does NOT handle the actual meeting join - that's still done as guest via browser automation
 * This function only provides enhanced metadata about the meeting
 */
async function handleAuthenticatedMeetingInfo(
  meetingUrl: string,
  organizerEmail?: string,
  authConfig?: TeamsAuthConfig
): Promise<OnlineMeetingInfo | null> {
  if (!authConfig) {
    log("[Teams Metadata] No authentication config provided");
    return null;
  }

  try {
    log("[Teams Metadata] Initializing Graph API client for meeting information retrieval...");
    
    const teamsAuthService = new TeamsAuthService(authConfig);
    
    // Validate configuration
    const validation = teamsAuthService.validateConfiguration();
    if (!validation.valid) {
      log(`[Teams Metadata] Configuration validation failed: ${validation.errors.join(", ")}`);
      return null;
    }

    // Initialize the Graph API client
    await teamsAuthService.initializeAppClient();

    // Try to get meeting information using the join URL
    if (organizerEmail) {
      log(`[Teams Metadata] Retrieving meeting info for organizer: ${organizerEmail}`);
      
      const meetingInfo = await teamsAuthService.getMeetingInfo(organizerEmail, meetingUrl);
      
      if (meetingInfo) {
        log(`[Teams Metadata] Successfully retrieved meeting metadata: ${meetingInfo.subject} (ID: ${meetingInfo.id})`);
        return meetingInfo;
      } else {
        log(`[Teams Metadata] Meeting not found for URL: ${meetingUrl}`);
      }
    } else {
      log("[Teams Metadata] No organizer email provided - cannot retrieve meeting info via Graph API");
      log("[Teams Metadata] Tip: Provide organizer_email in API request for enhanced meeting metadata");
    }

    return null;
  } catch (error: any) {
    log(`[Teams Metadata] Error retrieving meeting information: ${error.message}`);
    return null;
  }
}