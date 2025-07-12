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

  // Handle authenticated mode
  if (teamsAuthMode === "authenticated" && teamsClientId && teamsClientSecret && teamsTenantId) {
    log("[Teams] Using authenticated mode with Microsoft Graph API");
    
    try {
      const meetingInfo = await handleAuthenticatedTeamsJoin(
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
        log(`[Teams] Successfully retrieved meeting info via Graph API: ${meetingInfo.subject}`);
        // Use the Graph API meeting URL if different
        if (meetingInfo.joinWebUrl !== botConfig.meetingUrl) {
          log(`[Teams] Using Graph API join URL: ${meetingInfo.joinWebUrl}`);
          botConfig.meetingUrl = meetingInfo.joinWebUrl;
        }
      }
    } catch (error: any) {
      log(`[Teams] Authentication failed, falling back to guest mode: ${error.message}`);
      // Continue with guest mode
    }
  }

  if (!botConfig.meetingUrl) {
    log("Error: Meeting URL is required for Microsoft Teams but is null.");
    await gracefulLeaveFunction(page, 1, "missing_meeting_url");
    return;
  }

  log("Joining Microsoft Teams meeting");
  try {
    await joinTeamsMeeting(page, botConfig.meetingUrl, botConfig.botName);
  } catch (error: any) {
    console.error("Error during joinTeamsMeeting: " + error.message);
    log("Error during joinTeamsMeeting: " + error.message + ". Triggering graceful leave.");
    await gracefulLeaveFunction(page, 1, "join_meeting_error");
    return;
  }

  // Setup websocket connection and meeting admission concurrently
  log("Starting WebSocket connection while waiting for Teams meeting admission");
  try {
    // Run both processes concurrently
    const [isAdmitted] = await Promise.all([
      // Wait for admission to the meeting
      waitForTeamsMeetingAdmission(
        page,
        leaveButton,
        botConfig.automaticLeave.waitingRoomTimeout
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

    // Check if we're in a lobby
    for (const selector of lobbySelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        log("Bot is in Teams lobby/waiting room - waiting for admission");
        log("PLEASE CHECK YOUR TEAMS MEETING FOR AN ADMISSION REQUEST!");
        // Wait longer for lobby admission
        await page.waitForSelector(leaveButton, { timeout: timeout });
        log("Admitted from lobby to Teams meeting");
        return true;
      } catch (e) {
        log(`Lobby selector ${selector} not found`);
      }
    }
    
    // Wait for either the leave button (in meeting) or the call controls
    await Promise.race([
      page.waitForSelector(leaveButton, { timeout }),
      page.waitForSelector('[data-tid="call-controls"]', { timeout }),
      page.waitForSelector('[data-tid="toggle-mute"]', { timeout }),
      page.waitForSelector('[data-tid="calling-roster-cell"]', { timeout })
    ]);
    
    // Double-check we're actually in the meeting, not just pre-join
    const actuallyInMeeting = await page.$('[data-tid="call-controls"]') || 
                             await page.$('[data-tid="toggle-mute"]') ||
                             await page.$('[data-tid="calling-roster-cell"]');
    
    if (actuallyInMeeting) {
      log("Successfully admitted to the Teams meeting");
      return true;
    } else {
      log("Found meeting elements but may not be fully admitted");
      return false;
    }
    
  } catch {
    throw new Error(
      "Bot was not admitted into the Teams meeting within the timeout period"
    );
  }
};

// Handle Teams dialogs and overlays that might block interactions
const handleTeamsDialogs = async (page: Page): Promise<void> => {
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
        await page.waitForSelector(selector, { timeout: 3000 });
        log(`Found join button without name entry: ${selector} - proceeding`);
        await page.click(selector);
        log("Clicked join button directly");
        return; // Exit early, proceeding to admission wait
      } catch (e) {
        log(`Join button ${selector} not found, trying next...`);
      }
    }
    
    throw new Error("Could not find name input field or join button with any known selector");
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
    throw new Error("Could not find join button with any known selector");
  }
  
  // Try multiple methods to click the join button if overlay blocks it
  let joinSuccessful = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.click(joinButton, { force: true });
      log(`${botName} attempting to join Teams meeting (attempt ${attempt + 1})`);
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

                socket = new WebSocket(wsUrl);

                const connectionTimeoutMs = 3000;
                let connectionTimeoutHandle: number | null = window.setTimeout(() => {
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

              if (aloneTime >= 10) {
                (window as any).logBot(
                  "Teams meeting ended or bot has been alone for 10 seconds. Stopping recorder..."
                );
                clearInterval(checkInterval);
                recorder.disconnect();
                (window as any).triggerNodeGracefulLeave();
                resolve();
              } else if (aloneTime > 0) {
                (window as any).logBot(
                  `Teams bot has been alone for ${aloneTime} seconds. Will leave in ${10 - aloneTime} more seconds.`
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
 * Handle authenticated Teams meeting join using Microsoft Graph API
 */
async function handleAuthenticatedTeamsJoin(
  meetingUrl: string,
  organizerEmail?: string,
  authConfig?: TeamsAuthConfig
): Promise<OnlineMeetingInfo | null> {
  if (!authConfig) {
    log("[Teams Auth] No authentication config provided");
    return null;
  }

  try {
    log("[Teams Auth] Initializing Teams Graph API client...");
    
    const teamsAuthService = new TeamsAuthService(authConfig);
    
    // Validate configuration
    const validation = teamsAuthService.validateConfiguration();
    if (!validation.valid) {
      log(`[Teams Auth] Configuration validation failed: ${validation.errors.join(", ")}`);
      return null;
    }

    // Initialize the Graph API client
    await teamsAuthService.initializeAppClient();

    // Try to get meeting information using the join URL
    if (organizerEmail) {
      log(`[Teams Auth] Retrieving meeting info for organizer: ${organizerEmail}`);
      
      const meetingInfo = await teamsAuthService.getMeetingInfo(organizerEmail, meetingUrl);
      
      if (meetingInfo) {
        log(`[Teams Auth] Found meeting: ${meetingInfo.subject} (ID: ${meetingInfo.id})`);
        return meetingInfo;
      } else {
        log(`[Teams Auth] Meeting not found for URL: ${meetingUrl}`);
      }
    } else {
      log("[Teams Auth] No organizer email provided - cannot retrieve meeting info via Graph API");
    }

    return null;
  } catch (error: any) {
    log(`[Teams Auth] Authentication error: ${error.message}`);
    return null;
  }
}