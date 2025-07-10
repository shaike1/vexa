import { Page } from "playwright";
import { log, randomDelay } from "../utils";
import { BotConfig } from "../types";
import { v4 as uuidv4 } from "uuid";

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
    // Wait for either the leave button (in meeting) or the call controls
    await Promise.race([
      page.waitForSelector(leaveButton, { timeout }),
      page.waitForSelector('[data-tid="call-controls"]', { timeout }),
      page.waitForSelector('[data-tid="toggle-mute"]', { timeout })
    ]);
    log("Successfully admitted to the Teams meeting");
    return true;
  } catch {
    throw new Error(
      "Bot was not admitted into the Teams meeting within the timeout period"
    );
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
  // Teams-specific selectors
  const nameField = 'input[data-tid="prejoin-display-name-input"]';
  const joinButton = 'button[data-tid="prejoin-join-button"]';
  const microphoneButton = 'button[data-tid="toggle-mute"]';
  const cameraButton = 'button[data-tid="toggle-video"]';
  const joinNowButton = 'button[data-tid="prejoin-join-button"]';
  const useWebInsteadLink = 'a[href*="launcher=false"]';

  await page.goto(meetingUrl, { waitUntil: "networkidle" });
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

  // Wait for the name input field
  log("Waiting for name input field...");
  await page.waitForSelector(nameField, { timeout: 60000 });
  
  // Fill in the bot name
  await page.waitForTimeout(randomDelay(1000));
  await page.fill(nameField, botName);
  log(`Entered bot name: ${botName}`);

  // Turn off microphone and camera if they're on
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

  // Click join button
  await page.waitForSelector(joinButton, { timeout: 30000 });
  await page.click(joinButton);
  log(`${botName} attempting to join Teams meeting`);
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
              return reject(
                new Error(
                  "[Teams BOT Error] No active media elements found after multiple retries. Ensure the meeting media is playing."
                )
              );
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