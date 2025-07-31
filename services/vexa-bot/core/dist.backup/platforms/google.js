"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGoogleMeet = handleGoogleMeet;
exports.leaveGoogleMeet = leaveGoogleMeet;
const utils_1 = require("../utils");
const uuid_1 = require("uuid"); // Import UUID
// --- ADDED: Function to generate UUID (if not already present globally) ---
// If you have a shared utils file for this, import from there instead.
function generateUUID() {
    return (0, uuid_1.v4)();
}
// --- --------------------------------------------------------- ---
async function handleGoogleMeet(botConfig, page, gracefulLeaveFunction) {
    const leaveButton = `//button[@aria-label="Leave call"]`;
    if (!botConfig.meetingUrl) {
        (0, utils_1.log)("Error: Meeting URL is required for Google Meet but is null.");
        // If meeting URL is missing, we can't join, so trigger graceful leave.
        await gracefulLeaveFunction(page, 1, "missing_meeting_url");
        return;
    }
    (0, utils_1.log)("Joining Google Meet");
    try {
        await joinMeeting(page, botConfig.meetingUrl, botConfig.botName);
    }
    catch (error) {
        console.error("Error during joinMeeting: " + error.message);
        (0, utils_1.log)("Error during joinMeeting: " + error.message + ". Triggering graceful leave.");
        await gracefulLeaveFunction(page, 1, "join_meeting_error");
        return;
    }
    // Setup websocket connection and meeting admission concurrently
    (0, utils_1.log)("Starting WebSocket connection while waiting for meeting admission");
    try {
        // Run both processes concurrently
        const [isAdmitted] = await Promise.all([
            // Wait for admission to the meeting
            waitForMeetingAdmission(page, leaveButton, botConfig.automaticLeave.waitingRoomTimeout).catch((error) => {
                (0, utils_1.log)("Meeting admission failed: " + error.message);
                return false;
            }),
            // Prepare for recording (expose functions, etc.) while waiting for admission
            prepareForRecording(page),
        ]);
        if (!isAdmitted) {
            console.error("Bot was not admitted into the meeting");
            (0, utils_1.log)("Bot not admitted. Triggering graceful leave with admission_failed reason.");
            await gracefulLeaveFunction(page, 2, "admission_failed");
            return;
        }
        (0, utils_1.log)("Successfully admitted to the meeting, starting recording");
        // Pass platform from botConfig to startRecording
        await startRecording(page, botConfig);
    }
    catch (error) {
        console.error("Error after join attempt (admission/recording setup): " + error.message);
        (0, utils_1.log)("Error after join attempt (admission/recording setup): " + error.message + ". Triggering graceful leave.");
        // Use a general error code here, as it could be various issues.
        await gracefulLeaveFunction(page, 1, "post_join_setup_error");
        return;
    }
}
// New function to wait for meeting admission
const waitForMeetingAdmission = async (page, leaveButton, timeout) => {
    try {
        await page.waitForSelector(leaveButton, { timeout });
        (0, utils_1.log)("Successfully admitted to the meeting");
        return true;
    }
    catch {
        throw new Error("Bot was not admitted into the meeting within the timeout period");
    }
};
// Prepare for recording by exposing necessary functions
const prepareForRecording = async (page) => {
    // Expose the logBot function to the browser context
    await page.exposeFunction("logBot", (msg) => {
        (0, utils_1.log)(msg);
    });
};
const joinMeeting = async (page, meetingUrl, botName) => {
    const enterNameField = 'input[type="text"][aria-label="Your name"]';
    const joinButton = '//button[.//span[text()="Ask to join"]]';
    const muteButton = '[aria-label*="Turn off microphone"]';
    const cameraOffButton = '[aria-label*="Turn off camera"]';
    await page.goto(meetingUrl, { waitUntil: "networkidle" });
    await page.bringToFront();
    // Add a longer, fixed wait after navigation for page elements to settle
    (0, utils_1.log)("Waiting for page elements to settle after navigation...");
    await page.waitForTimeout(5000); // Wait 5 seconds
    // Enter name and join
    // Keep the random delay before interacting, but ensure page is settled first
    await page.waitForTimeout((0, utils_1.randomDelay)(1000));
    (0, utils_1.log)("Attempting to find name input field...");
    // Increase timeout drastically
    await page.waitForSelector(enterNameField, { timeout: 120000 }); // 120 seconds
    (0, utils_1.log)("Name input field found.");
    await page.waitForTimeout((0, utils_1.randomDelay)(1000));
    await page.fill(enterNameField, botName);
    // Mute mic and camera if available
    try {
        await page.waitForTimeout((0, utils_1.randomDelay)(500));
        await page.click(muteButton, { timeout: 200 });
        await page.waitForTimeout(200);
    }
    catch (e) {
        (0, utils_1.log)("Microphone already muted or not found.");
    }
    try {
        await page.waitForTimeout((0, utils_1.randomDelay)(500));
        await page.click(cameraOffButton, { timeout: 200 });
        await page.waitForTimeout(200);
    }
    catch (e) {
        (0, utils_1.log)("Camera already off or not found.");
    }
    await page.waitForSelector(joinButton, { timeout: 60000 });
    await page.click(joinButton);
    (0, utils_1.log)(`${botName} joined the Meeting.`);
};
// Modified to have only the actual recording functionality
const startRecording = async (page, botConfig) => {
    // Destructure needed fields from botConfig
    const { meetingUrl, token, connectionId, platform, nativeMeetingId } = botConfig; // nativeMeetingId is now in BotConfig type
    //NOTE: The environment variables passed by docker_utils.py will be available to the Node.js process started by your entrypoint.sh.
    // --- Read WHISPER_LIVE_URL from Node.js environment ---
    const whisperLiveUrlFromEnv = process.env.WHISPER_LIVE_URL;
    if (!whisperLiveUrlFromEnv) {
        // Use the Node-side 'log' utility here
        (0, utils_1.log)("ERROR: WHISPER_LIVE_URL environment variable is not set for vexa-bot in its Node.js environment. Cannot start recording.");
        // Potentially throw an error or return to prevent further execution
        // For example: throw new Error("WHISPER_LIVE_URL is not configured for the bot.");
        return; // Or handle more gracefully
    }
    (0, utils_1.log)(`[Node.js] WHISPER_LIVE_URL for vexa-bot is: ${whisperLiveUrlFromEnv}`);
    // --- ------------------------------------------------- ---
    (0, utils_1.log)("Starting actual recording with WebSocket connection");
    // Pass the necessary config fields and the resolved URL into the page context. Inisde page.evalute we have the browser context.
    //All code inside page.evalute executes as javascript running in the browser.
    await page.evaluate(async (pageArgs) => {
        const { botConfigData, whisperUrlForBrowser } = pageArgs;
        // Destructure from botConfigData as needed
        const { meetingUrl, token, connectionId: originalConnectionId, platform, nativeMeetingId, language: initialLanguage, task: initialTask, } = botConfigData; // Use the nested botConfigData
        // --- ADD Helper function to generate UUID in browser context ---
        const generateUUID = () => {
            if (typeof crypto !== "undefined" && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            else {
                // Basic fallback if crypto.randomUUID is not available
                return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                    var r = (Math.random() * 16) | 0, v = c == "x" ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                });
            }
        };
        // --- --------------------------------------------------------- ---
        await new Promise((resolve, reject) => {
            try {
                window.logBot("Starting recording process.");
                // --- ADDED: More robust media element finding function ---
                const findMediaElements = async (retries = 5, delay = 2000) => {
                    for (let i = 0; i < retries; i++) {
                        const mediaElements = Array.from(document.querySelectorAll("audio, video")).filter((el) => !el.paused &&
                            el.srcObject instanceof MediaStream &&
                            el.srcObject.getAudioTracks().length > 0);
                        if (mediaElements.length > 0) {
                            window.logBot(`Found ${mediaElements.length} active media elements with audio tracks after ${i + 1} attempt(s).`);
                            return mediaElements;
                        }
                        window.logBot(`[Audio] No active media elements found. Retrying in ${delay}ms... (Attempt ${i + 2}/${retries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    return [];
                };
                // --- END FUNCTION ---
                findMediaElements().then(mediaElements => {
                    if (mediaElements.length === 0) {
                        return reject(new Error("[BOT Error] No active media elements found after multiple retries. Ensure the meeting media is playing."));
                    }
                    // NEW: Create audio context and destination for mixing multiple streams
                    window.logBot(`Found ${mediaElements.length} active media elements.`);
                    const audioContext = new AudioContext();
                    const destinationNode = audioContext.createMediaStreamDestination();
                    let sourcesConnected = 0;
                    // NEW: Connect all media elements to the destination node
                    mediaElements.forEach((element, index) => {
                        try {
                            const elementStream = element.srcObject ||
                                (element.captureStream && element.captureStream()) ||
                                (element.mozCaptureStream && element.mozCaptureStream());
                            if (elementStream instanceof MediaStream &&
                                elementStream.getAudioTracks().length > 0) {
                                const sourceNode = audioContext.createMediaStreamSource(elementStream);
                                sourceNode.connect(destinationNode);
                                sourcesConnected++;
                                window.logBot(`Connected audio stream from element ${index + 1}/${mediaElements.length}.`);
                            }
                        }
                        catch (error) {
                            window.logBot(`Could not connect element ${index + 1}: ${error.message}`);
                        }
                    });
                    if (sourcesConnected === 0) {
                        return reject(new Error("[BOT Error] Could not connect any audio streams. Check media permissions."));
                    }
                    // Use the combined stream instead of a single element's stream
                    const stream = destinationNode.stream;
                    window.logBot(`Successfully combined ${sourcesConnected} audio streams.`);
                    // --- MODIFIED: Keep original connectionId but don't use it for WebSocket UID ---
                    // const sessionUid = connectionId; // <-- OLD: Reused original connectionId
                    window.logBot(`Original bot connection ID: ${originalConnectionId}`);
                    // --- ------------------------------------------------------------------------ ---
                    // --- ADDED: Add secondary leave button selector for confirmation ---
                    const secondaryLeaveButtonSelector = `//button[.//span[text()='Leave meeting']] | //button[.//span[text()='Just leave the meeting']]`; // Example, adjust based on actual UI
                    // --- ----------------------------------------------------------- ---
                    // const wsUrl = "ws://whisperlive:9090";
                    const wsUrl = whisperUrlForBrowser;
                    if (!wsUrl) {
                        window.logBot?.("CRITICAL: WhisperLive WebSocket URL is missing in browser context!");
                        console.error("CRITICAL: WhisperLive WebSocket URL is missing in browser context!");
                        return;
                    }
                    // (window as any).logBot(`Attempting to connect WebSocket to: ${wsUrl} with platform: ${platform}, session UID: ${sessionUid}`); // Log the correct UID
                    // --- ADD Browser-scope state for current WS config ---
                    let currentWsLanguage = initialLanguage;
                    let currentWsTask = initialTask;
                    // --- -------------------------------------------- ---
                    let socket = null;
                    let isServerReady = false;
                    let retryCount = 0;
                    const configuredInterval = botConfigData.reconnectionIntervalMs;
                    const baseRetryDelay = (configuredInterval && configuredInterval <= 1000) ? configuredInterval : 1000; // Use configured if <= 1s, else 1s
                    let sessionAudioStartTimeMs = null; // ADDED: For relative speaker timestamps
                    const setupWebSocket = () => {
                        try {
                            if (socket) {
                                // Close previous socket if it exists
                                try {
                                    socket.close();
                                }
                                catch (err) {
                                    // Ignore errors when closing
                                }
                            }
                            socket = new WebSocket(wsUrl);
                            // --- NEW: Force-close if connection cannot be established quickly ---
                            const connectionTimeoutMs = 3000; // 3-second timeout for CONNECTING state
                            let connectionTimeoutHandle = window.setTimeout(() => {
                                if (socket && socket.readyState === WebSocket.CONNECTING) {
                                    window.logBot(`Connection attempt timed out after ${connectionTimeoutMs}ms. Forcing close.`);
                                    try {
                                        socket.close(); // Triggers onclose -> retry logic
                                    }
                                    catch (_) {
                                        /* ignore */
                                    }
                                }
                            }, connectionTimeoutMs);
                            socket.onopen = function () {
                                if (connectionTimeoutHandle !== null) {
                                    clearTimeout(connectionTimeoutHandle); // Clear connection watchdog
                                    connectionTimeoutHandle = null;
                                }
                                // --- MODIFIED: Log current config being used ---
                                // --- MODIFIED: Generate NEW UUID for this connection ---
                                currentSessionUid = generateUUID(); // Update the currentSessionUid
                                sessionAudioStartTimeMs = null; // ADDED: Reset for new WebSocket session
                                window.logBot(`[RelativeTime] WebSocket connection opened. New UID: ${currentSessionUid}. sessionAudioStartTimeMs reset. Lang: ${currentWsLanguage}, Task: ${currentWsTask}`);
                                retryCount = 0;
                                if (socket) {
                                    // Construct the initial configuration message using config values
                                    const initialConfigPayload = {
                                        uid: currentSessionUid, // <-- Use NEWLY generated UUID
                                        language: currentWsLanguage || null, // <-- Use browser-scope variable
                                        task: currentWsTask || "transcribe", // <-- Use browser-scope variable
                                        model: "medium", // Keep default or make configurable if needed
                                        use_vad: true, // Keep default or make configurable if needed
                                        platform: platform, // From config
                                        token: token, // From config
                                        meeting_id: nativeMeetingId, // From config
                                        meeting_url: meetingUrl || null, // From config, default to null
                                    };
                                    const jsonPayload = JSON.stringify(initialConfigPayload);
                                    // Log the exact payload being sent
                                    window.logBot(`Sending initial config message: ${jsonPayload}`);
                                    socket.send(jsonPayload);
                                }
                            };
                            socket.onmessage = (event) => {
                                window.logBot("Received message: " + event.data);
                                const data = JSON.parse(event.data);
                                // NOTE: The check `if (data["uid"] !== sessionUid) return;` is removed
                                // because we no longer have a single sessionUid for the lifetime of the evaluate block.
                                // Each message *should* contain the UID associated with the specific WebSocket
                                // connection it came from. Downstream needs to handle this if correlation is needed.
                                // For now, we assume messages are relevant to the current bot context.
                                // Consider re-introducing a check if whisperlive echoes back the UID and it's needed.
                                if (data["status"] === "ERROR") {
                                    window.logBot(`WebSocket Server Error: ${data["message"]}`);
                                }
                                else if (data["status"] === "WAIT") {
                                    window.logBot(`Server busy: ${data["message"]}`);
                                }
                                else if (!isServerReady) {
                                    isServerReady = true;
                                    window.logBot("Server is ready.");
                                }
                                else if (data["language"]) {
                                    window.logBot(`Language detected: ${data["language"]}`);
                                }
                                else if (data["message"] === "DISCONNECT") {
                                    window.logBot("Server requested disconnect.");
                                    if (socket) {
                                        socket.close();
                                    }
                                }
                                else {
                                    window.logBot(`Transcription: ${JSON.stringify(data)}`);
                                }
                            };
                            socket.onerror = (event) => {
                                if (connectionTimeoutHandle !== null) {
                                    clearTimeout(connectionTimeoutHandle);
                                    connectionTimeoutHandle = null;
                                }
                                window.logBot(`WebSocket error: ${JSON.stringify(event)}`);
                            };
                            socket.onclose = (event) => {
                                if (connectionTimeoutHandle !== null) {
                                    clearTimeout(connectionTimeoutHandle);
                                    connectionTimeoutHandle = null;
                                }
                                window.logBot(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
                                // Retry logic - now retries indefinitely
                                retryCount++;
                                window.logBot(`Attempting to reconnect in ${baseRetryDelay}ms. Retry attempt ${retryCount}`);
                                setTimeout(() => {
                                    window.logBot(`Retrying WebSocket connection (attempt ${retryCount})...`);
                                    setupWebSocket();
                                }, baseRetryDelay);
                            };
                        }
                        catch (e) {
                            window.logBot(`Error creating WebSocket: ${e.message}`);
                            // For initial connection errors, handle with retry logic - now retries indefinitely
                            retryCount++;
                            window.logBot(`Error during WebSocket setup. Attempting to reconnect in ${baseRetryDelay}ms. Retry attempt ${retryCount}`);
                            setTimeout(() => {
                                window.logBot(`Retrying WebSocket connection (attempt ${retryCount})...`);
                                setupWebSocket();
                            }, baseRetryDelay);
                        }
                    };
                    // --- ADD Function exposed to Node.js for triggering reconfigure ---
                    window.triggerWebSocketReconfigure = (newLang, newTask) => {
                        window.logBot(`[Node->Browser] Received reconfigure. New Lang: ${newLang}, New Task: ${newTask}`);
                        currentWsLanguage = newLang; // Update browser state
                        currentWsTask = newTask || "transcribe"; // Update browser state, default task if null
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            window.logBot("[Node->Browser] Closing WebSocket to reconnect with new config.");
                            socket.close(); // Triggers onclose -> setupWebSocket which now reads updated vars
                        }
                        else if (socket &&
                            (socket.readyState === WebSocket.CONNECTING ||
                                socket.readyState === WebSocket.CLOSING)) {
                            window.logBot("[Node->Browser] Socket is connecting or closing, cannot close now. Reconnect will use new config when it opens.");
                        }
                        else {
                            // Socket is null or already closed
                            window.logBot("[Node->Browser] Socket is null or closed. Attempting to setupWebSocket directly.");
                            // Directly calling setupWebSocket might cause issues if the old one is mid-retry
                            // Relying on the existing retry logic in onclose is likely safer.
                            // If setupWebSocket is called here, ensure it handles potential double connections.
                            // setupWebSocket();
                        }
                    };
                    // --- ----------------------------------------------------------- ---
                    // --- ADDED: Expose leave function to Node context ---
                    window.performLeaveAction = async () => {
                        window.logBot("Attempting to leave the meeting from browser context...");
                        try {
                            // *** FIXED: Use document.evaluate for XPath ***
                            const primaryLeaveButtonXpath = `//button[@aria-label="Leave call"]`;
                            const secondaryLeaveButtonXpath = `//button[.//span[text()='Leave meeting']] | //button[.//span[text()='Just leave the meeting']]`;
                            const getElementByXpath = (path) => {
                                const result = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                return result.singleNodeValue;
                            };
                            const primaryLeaveButton = getElementByXpath(primaryLeaveButtonXpath);
                            if (primaryLeaveButton) {
                                window.logBot("Clicking primary leave button...");
                                primaryLeaveButton.click(); // No need to cast HTMLElement if getElementByXpath returns it
                                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait a bit for potential confirmation dialog
                                // Try clicking secondary/confirmation button if it appears
                                const secondaryLeaveButton = getElementByXpath(secondaryLeaveButtonXpath);
                                if (secondaryLeaveButton) {
                                    window.logBot("Clicking secondary/confirmation leave button...");
                                    secondaryLeaveButton.click();
                                    await new Promise((resolve) => setTimeout(resolve, 500)); // Short wait after final click
                                }
                                else {
                                    window.logBot("Secondary leave button not found.");
                                }
                                window.logBot("Leave sequence completed.");
                                return true; // Indicate leave attempt was made
                            }
                            else {
                                window.logBot("Primary leave button not found.");
                                return false; // Indicate leave button wasn't found
                            }
                        }
                        catch (err) {
                            window.logBot(`Error during leave attempt: ${err.message}`);
                            return false; // Indicate error during leave
                        }
                    };
                    // --- --------------------------------------------- ---
                    setupWebSocket();
                    // --- ADD: Speaker Detection Logic (Adapted from speakers_console_test.js) ---
                    // Configuration for speaker detection
                    const participantSelector = 'div[data-participant-id]'; // UPDATED: More specific selector
                    const speakingClasses = ['Oaajhc', 'HX2H7', 'wEsLMd', 'OgVli']; // Speaking/animation classes
                    const silenceClass = 'gjg47c'; // Class indicating the participant is silent
                    const nameSelectors = [
                        '[data-participant-id]' // Attribute for participant ID
                    ];
                    // State for tracking speaking status
                    const speakingStates = new Map(); // Stores the logical speaking state for each participant ID
                    const activeParticipants = new Map(); // NEW: Central map for all known participants
                    // Track current session UID for speaker events
                    let currentSessionUid = generateUUID(); // Initialize with a new UID
                    // Helper functions for speaker detection
                    function getParticipantId(element) {
                        let id = element.getAttribute('data-participant-id');
                        if (!id) {
                            const stableChild = element.querySelector('[jsinstance]');
                            if (stableChild) {
                                id = stableChild.getAttribute('jsinstance');
                            }
                        }
                        if (!id) {
                            if (!element.dataset.vexaGeneratedId) {
                                element.dataset.vexaGeneratedId = 'vexa-id-' + Math.random().toString(36).substr(2, 9);
                            }
                            id = element.dataset.vexaGeneratedId;
                        }
                        return id;
                    }
                    function getParticipantName(participantElement) {
                        const mainTile = participantElement.closest('[data-participant-id]');
                        if (mainTile) {
                            const userExampleNameElement = mainTile.querySelector('span.notranslate');
                            if (userExampleNameElement && userExampleNameElement.textContent && userExampleNameElement.textContent.trim()) {
                                const nameText = userExampleNameElement.textContent.trim();
                                if (nameText.length > 1 && nameText.length < 50 && /^[\p{L}\s.'-]+$/u.test(nameText)) {
                                    const forbiddenSubstrings = ["more_vert", "mic_off", "mic", "videocam", "videocam_off", "present_to_all", "devices", "speaker", "speakers", "microphone"];
                                    if (!forbiddenSubstrings.some(sub => nameText.toLowerCase().includes(sub.toLowerCase()))) {
                                        return nameText;
                                    }
                                }
                            }
                            const googleTsNameSelectors = [
                                '[data-self-name]', '.zWGUib', '.cS7aqe.N2K3jd', '.XWGOtd', '[data-tooltip*="name"]'
                            ];
                            for (const selector of googleTsNameSelectors) {
                                const nameElement = mainTile.querySelector(selector);
                                if (nameElement) {
                                    let nameText = nameElement.textContent ||
                                        nameElement.innerText ||
                                        nameElement.getAttribute('data-self-name') ||
                                        nameElement.getAttribute('data-tooltip');
                                    if (nameText && nameText.trim()) {
                                        if (selector.includes('data-tooltip') && nameText.includes("Tooltip for ")) {
                                            nameText = nameText.replace("Tooltip for ", "").trim();
                                        }
                                        if (nameText && nameText.trim()) {
                                            const forbiddenSubstrings = ["more_vert", "mic_off", "mic", "videocam", "videocam_off", "present_to_all", "devices", "speaker", "speakers", "microphone"];
                                            if (!forbiddenSubstrings.some(sub => nameText.toLowerCase().includes(sub.toLowerCase()))) {
                                                const trimmedName = nameText.split('\n').pop()?.trim();
                                                return trimmedName || 'Unknown (Filtered)';
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        for (const selector of nameSelectors) {
                            const nameElement = participantElement.querySelector(selector);
                            if (nameElement) {
                                let nameText = nameElement.textContent ||
                                    nameElement.innerText ||
                                    nameElement.getAttribute('data-self-name');
                                if (nameText && nameText.trim()) {
                                    // ADDED: Apply forbidden substrings and trimming logic here too
                                    const forbiddenSubstrings = ["more_vert", "mic_off", "mic", "videocam", "videocam_off", "present_to_all", "devices", "speaker", "speakers", "microphone"];
                                    if (!forbiddenSubstrings.some(sub => nameText.toLowerCase().includes(sub.toLowerCase()))) {
                                        const trimmedName = nameText.split('\n').pop()?.trim();
                                        if (trimmedName && trimmedName.length > 1 && trimmedName.length < 50 && /^[\p{L}\s.'-]+$/u.test(trimmedName)) { // Added basic length and char validation
                                            return trimmedName;
                                        }
                                    }
                                    // If it was forbidden or failed validation, it won't return, allowing loop to continue or fallback.
                                }
                            }
                        }
                        if (participantElement.textContent && participantElement.textContent.includes("You") && participantElement.textContent.length < 20) {
                            return "You";
                        }
                        const idToDisplay = mainTile ? getParticipantId(mainTile) : getParticipantId(participantElement);
                        return `Participant (${idToDisplay})`;
                    }
                    function sendSpeakerEvent(eventType, participantElement) {
                        const eventAbsoluteTimeMs = Date.now();
                        let relativeTimestampMs = null;
                        if (sessionAudioStartTimeMs === null) {
                            window.logBot(`[RelativeTime] SKIPPING speaker event: ${eventType} for ${getParticipantName(participantElement)}. sessionAudioStartTimeMs not yet set. UID: ${currentSessionUid}`);
                            return; // Do not send if audio hasn't started for this session
                        }
                        relativeTimestampMs = eventAbsoluteTimeMs - sessionAudioStartTimeMs;
                        const participantId = getParticipantId(participantElement);
                        const participantName = getParticipantName(participantElement);
                        // Send speaker event via WebSocket if connected
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            const speakerEventMessage = {
                                type: "speaker_activity",
                                payload: {
                                    event_type: eventType,
                                    participant_name: participantName,
                                    participant_id_meet: participantId,
                                    relative_client_timestamp_ms: relativeTimestampMs, // UPDATED
                                    uid: currentSessionUid, // Use the current session UID
                                    token: token,
                                    platform: platform,
                                    meeting_id: nativeMeetingId,
                                    meeting_url: meetingUrl
                                }
                            };
                            try {
                                socket.send(JSON.stringify(speakerEventMessage));
                                window.logBot(`[RelativeTime] Speaker event sent: ${eventType} for ${participantName} (${participantId}). RelativeTs: ${relativeTimestampMs}ms. UID: ${currentSessionUid}. (AbsoluteEventMs: ${eventAbsoluteTimeMs}, SessionT0Ms: ${sessionAudioStartTimeMs})`);
                            }
                            catch (error) {
                                window.logBot(`Error sending speaker event: ${error.message}`);
                            }
                        }
                        else {
                            window.logBot(`WebSocket not ready, speaker event queued: ${eventType} for ${participantName}`);
                        }
                    }
                    function logSpeakerEvent(participantElement, mutatedClassList) {
                        const participantId = getParticipantId(participantElement);
                        const participantName = getParticipantName(participantElement);
                        const previousLogicalState = speakingStates.get(participantId) || "silent";
                        const isNowVisiblySpeaking = speakingClasses.some(cls => mutatedClassList.contains(cls));
                        const isNowVisiblySilent = mutatedClassList.contains(silenceClass);
                        if (isNowVisiblySpeaking) {
                            if (previousLogicalState !== "speaking") {
                                window.logBot(`🎤 SPEAKER_START: ${participantName} (ID: ${participantId})`);
                                sendSpeakerEvent("SPEAKER_START", participantElement);
                            }
                            speakingStates.set(participantId, "speaking");
                        }
                        else if (isNowVisiblySilent) {
                            if (previousLogicalState === "speaking") {
                                window.logBot(`🔇 SPEAKER_END: ${participantName} (ID: ${participantId})`);
                                sendSpeakerEvent("SPEAKER_END", participantElement);
                            }
                            speakingStates.set(participantId, "silent");
                        }
                    }
                    function observeParticipant(participantElement) {
                        const participantId = getParticipantId(participantElement);
                        // Determine initial logical state based on current classes
                        speakingStates.set(participantId, "silent"); // Initialize participant as silent. logSpeakerEvent will handle transitions.
                        let classListForInitialScan = participantElement.classList; // Default to the main participant element's classes
                        // Check if any descendant has a speaking class
                        for (const cls of speakingClasses) {
                            const descendantElement = participantElement.querySelector('.' + cls); // Corrected selector
                            if (descendantElement) {
                                classListForInitialScan = descendantElement.classList;
                                break;
                            }
                        }
                        // If no speaking descendant was found, classListForInitialScan remains participantElement.classList.
                        // This is correct for checking if participantElement itself has a speaking or silence class.
                        window.logBot(`👁️ Observing: ${getParticipantName(participantElement)} (ID: ${participantId}). Performing initial participant state analysis.`);
                        // Call logSpeakerEvent with the determined classList.
                        // It will compare against the "silent" state and emit SPEAKER_START if currently speaking,
                        // or do nothing if currently silent (matching the initialized state).
                        logSpeakerEvent(participantElement, classListForInitialScan);
                        // NEW: Add participant to our central map
                        activeParticipants.set(participantId, { name: getParticipantName(participantElement), element: participantElement });
                        const callback = function (mutationsList, observer) {
                            for (const mutation of mutationsList) {
                                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                                    const targetElement = mutation.target;
                                    if (targetElement.matches(participantSelector) || participantElement.contains(targetElement)) {
                                        const finalTarget = targetElement.matches(participantSelector) ? targetElement : participantElement;
                                        // logSpeakerEvent(finalTarget, finalTarget.classList); // Old line
                                        logSpeakerEvent(finalTarget, targetElement.classList); // Corrected line
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
                        if (!participantElement.dataset.vexaObserverAttached) {
                            participantElement.dataset.vexaObserverAttached = 'true';
                        }
                    }
                    function scanForAllParticipants() {
                        const participantElements = document.querySelectorAll(participantSelector);
                        for (let i = 0; i < participantElements.length; i++) {
                            const el = participantElements[i];
                            if (!el.dataset.vexaObserverAttached) {
                                observeParticipant(el);
                            }
                        }
                    }
                    // Initialize speaker detection
                    scanForAllParticipants();
                    // Monitor for new participants
                    const bodyObserver = new MutationObserver((mutationsList) => {
                        for (const mutation of mutationsList) {
                            if (mutation.type === 'childList') {
                                mutation.addedNodes.forEach(node => {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        const elementNode = node;
                                        if (elementNode.matches(participantSelector) && !elementNode.dataset.vexaObserverAttached) {
                                            observeParticipant(elementNode);
                                        }
                                        const childElements = elementNode.querySelectorAll(participantSelector);
                                        for (let i = 0; i < childElements.length; i++) {
                                            const childEl = childElements[i];
                                            if (!childEl.dataset.vexaObserverAttached) {
                                                observeParticipant(childEl);
                                            }
                                        }
                                    }
                                });
                                mutation.removedNodes.forEach(node => {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        const elementNode = node;
                                        if (elementNode.matches(participantSelector)) {
                                            const participantId = getParticipantId(elementNode);
                                            const participantName = getParticipantName(elementNode);
                                            if (speakingStates.get(participantId) === 'speaking') {
                                                // Send synthetic SPEAKER_END if they were speaking when removed
                                                window.logBot(`🔇 SPEAKER_END (Participant removed while speaking): ${participantName} (ID: ${participantId})`);
                                                sendSpeakerEvent("SPEAKER_END", elementNode);
                                            }
                                            speakingStates.delete(participantId);
                                            delete elementNode.dataset.vexaObserverAttached;
                                            delete elementNode.dataset.vexaGeneratedId;
                                            window.logBot(`🗑️ Removed observer for: ${participantName} (ID: ${participantId})`);
                                            // NEW: Remove participant from our central map
                                            activeParticipants.delete(participantId);
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
                    // --- ADD: Enhanced Leave Function with Session End Signal ---
                    window.performLeaveAction = async () => {
                        window.logBot("Attempting to leave the meeting from browser context...");
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
                                window.logBot("LEAVING_MEETING signal sent to WhisperLive");
                                // Wait a brief moment for the message to be sent
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                            catch (error) {
                                window.logBot(`Error sending LEAVING_MEETING signal: ${error.message}`);
                            }
                        }
                        try {
                            // *** FIXED: Use document.evaluate for XPath ***
                            const primaryLeaveButtonXpath = `//button[@aria-label="Leave call"]`;
                            const secondaryLeaveButtonXpath = `//button[.//span[text()='Leave meeting']] | //button[.//span[text()='Just leave the meeting']]`;
                            const getElementByXpath = (path) => {
                                const result = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                return result.singleNodeValue;
                            };
                            const primaryLeaveButton = getElementByXpath(primaryLeaveButtonXpath);
                            if (primaryLeaveButton) {
                                window.logBot("Clicking primary leave button...");
                                primaryLeaveButton.click(); // No need to cast HTMLElement if getElementByXpath returns it
                                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait a bit for potential confirmation dialog
                                // Try clicking secondary/confirmation button if it appears
                                const secondaryLeaveButton = getElementByXpath(secondaryLeaveButtonXpath);
                                if (secondaryLeaveButton) {
                                    window.logBot("Clicking secondary/confirmation leave button...");
                                    secondaryLeaveButton.click();
                                    await new Promise((resolve) => setTimeout(resolve, 500)); // Short wait after final click
                                }
                                else {
                                    window.logBot("Secondary leave button not found.");
                                }
                                window.logBot("Leave sequence completed.");
                                return true; // Indicate leave attempt was made
                            }
                            else {
                                window.logBot("Primary leave button not found.");
                                return false; // Indicate leave button wasn't found
                            }
                        }
                        catch (err) {
                            window.logBot(`Error during leave attempt: ${err.message}`);
                            return false; // Indicate error during leave
                        }
                    };
                    // --- --------------------------------------------- ---
                    // FIXED: Revert to original audio processing that works with whisperlive
                    // but use our combined stream as the input source
                    const audioDataCache = [];
                    const mediaStream = audioContext.createMediaStreamSource(stream); // Use our combined stream
                    const recorder = audioContext.createScriptProcessor(4096, 1, 1);
                    recorder.onaudioprocess = async (event) => {
                        // Check if server is ready AND socket is open
                        if (!isServerReady ||
                            !socket ||
                            socket.readyState !== WebSocket.OPEN) {
                            // (window as any).logBot("WS not ready or closed, skipping audio data send."); // Optional debug log
                            return;
                        }
                        // ADDED: Set sessionAudioStartTimeMs on the first audio chunk for this session
                        if (sessionAudioStartTimeMs === null) {
                            sessionAudioStartTimeMs = Date.now();
                            window.logBot(`[RelativeTime] sessionAudioStartTimeMs set for UID ${currentSessionUid}: ${sessionAudioStartTimeMs} (at first audio data process)`);
                        }
                        const inputData = event.inputBuffer.getChannelData(0);
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
                            resampledData[i] =
                                data[leftIndex] +
                                    (data[rightIndex] - data[leftIndex]) * fraction;
                        }
                        // Send resampledData
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            // Double check before sending
                            // Ensure sessionAudioStartTimeMs is set before sending audio.
                            // This check is more of a safeguard; it should be set by the logic above.
                            if (sessionAudioStartTimeMs === null) {
                                window.logBot(`[RelativeTime] CRITICAL WARNING: sessionAudioStartTimeMs is STILL NULL before sending audio data for UID ${currentSessionUid}. This should not happen.`);
                                // Optionally, set it here as a last resort, though it might be slightly delayed.
                                // sessionAudioStartTimeMs = Date.now();
                                // (window as any).logBot(`[RelativeTime] sessionAudioStartTimeMs set LATE for UID ${currentSessionUid}: ${sessionAudioStartTimeMs}`);
                                return; // Or decide if you want to send audio even if T0 was missed. For now, skipping if T0 is critical.
                            }
                            socket.send(resampledData); // send teh audio to whisperlive socket.
                        }
                    };
                    // Connect the audio processing pipeline
                    mediaStream.connect(recorder);
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 0;
                    recorder.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    window.logBot("Audio processing pipeline connected and sending data silently.");
                    // Click the "People" button
                    const peopleButton = document.querySelector('button[aria-label^="People"]');
                    if (!peopleButton) {
                        recorder.disconnect();
                        return reject(new Error("[BOT Inner Error] 'People' button not found. Update the selector."));
                    }
                    peopleButton.click();
                    // Monitor participant list every 5 seconds
                    let aloneTime = 0;
                    const checkInterval = setInterval(() => {
                        // UPDATED: Use the size of our central map as the source of truth
                        const count = activeParticipants.size;
                        const participantIds = Array.from(activeParticipants.keys());
                        window.logBot(`Participant check: Found ${count} unique participants from central list. IDs: ${JSON.stringify(participantIds)}`);
                        // If count is 0, it could mean everyone left, OR the participant list area itself is gone.
                        if (count === 0) {
                            const peopleListContainer = document.querySelector('[role="list"]'); // Check the original list container
                            if (!peopleListContainer || !document.body.contains(peopleListContainer)) {
                                window.logBot("Participant list container not found (and participant count is 0); assuming meeting ended.");
                                clearInterval(checkInterval);
                                recorder.disconnect();
                                window.triggerNodeGracefulLeave();
                                resolve(); // Resolve the main promise from page.evaluate
                                return; // Exit setInterval callback
                            }
                        }
                        // FIXED: Correct logic for tracking alone time
                        if (count <= 1) { // Bot is 1, so count <= 1 means bot is alone
                            aloneTime += 5; // It's a 5-second interval
                        }
                        else {
                            // Someone else is here, so reset the timer.
                            if (aloneTime > 0) {
                                window.logBot('Another participant joined. Resetting alone timer.');
                            }
                            aloneTime = 0;
                        }
                        if (aloneTime >= 10) { // If bot has been alone for 10 seconds...
                            window.logBot("Meeting ended or bot has been alone for 10 seconds. Stopping recorder...");
                            clearInterval(checkInterval);
                            recorder.disconnect();
                            window.triggerNodeGracefulLeave();
                            resolve();
                        }
                        else if (aloneTime > 0) { // Log countdown if timer has started
                            window.logBot(`Bot has been alone for ${aloneTime} seconds. Will leave in ${10 - aloneTime} more seconds.`);
                        }
                    }, 5000);
                    // Listen for unload and visibility changes
                    window.addEventListener("beforeunload", () => {
                        window.logBot("Page is unloading. Stopping recorder...");
                        clearInterval(checkInterval);
                        recorder.disconnect();
                        window.triggerNodeGracefulLeave();
                        resolve();
                    });
                    document.addEventListener("visibilitychange", () => {
                        if (document.visibilityState === "hidden") {
                            window.logBot("Document is hidden. Stopping recorder...");
                            clearInterval(checkInterval);
                            recorder.disconnect();
                            window.triggerNodeGracefulLeave();
                            resolve();
                        }
                    });
                }).catch(err => {
                    reject(err);
                });
            }
            catch (error) {
                return reject(new Error("[BOT Error] " + error.message));
            }
        });
    }, { botConfigData: botConfig, whisperUrlForBrowser: whisperLiveUrlFromEnv }); // Pass arguments to page.evaluate
};
// Remove the compatibility shim 'recordMeeting' if no longer needed,
// otherwise, ensure it constructs a valid BotConfig object.
// Example if keeping:
/*
const recordMeeting = async (page: Page, meetingUrl: string, token: string, connectionId: string, platform: "google_meet" | "zoom" | "teams") => {
  await prepareForRecording(page);
  // Construct a minimal BotConfig - adjust defaults as needed
  const dummyConfig: BotConfig = {
      platform: platform,
      meetingUrl: meetingUrl,
      botName: "CompatibilityBot",
      token: token,
      connectionId: connectionId,
      nativeMeetingId: "", // Might need to derive this if possible
      automaticLeave: { waitingRoomTimeout: 300000, noOneJoinedTimeout: 300000, everyoneLeftTimeout: 300000 },
  };
  await startRecording(page, dummyConfig);
};
*/
// --- ADDED: Exported function to trigger leave from Node.js ---
async function leaveGoogleMeet(page) {
    (0, utils_1.log)("[leaveGoogleMeet] Triggering leave action in browser context...");
    if (!page || page.isClosed()) {
        (0, utils_1.log)("[leaveGoogleMeet] Page is not available or closed.");
        return false;
    }
    try {
        // Call the function exposed within the page's evaluate context
        const result = await page.evaluate(async () => {
            if (typeof window.performLeaveAction === "function") {
                return await window.performLeaveAction();
            }
            else {
                window.logBot?.("[Node Eval Error] performLeaveAction function not found on window.");
                console.error("[Node Eval Error] performLeaveAction function not found on window.");
                return false;
            }
        });
        (0, utils_1.log)(`[leaveGoogleMeet] Browser leave action result: ${result}`);
        return result; // Return true if leave was attempted, false otherwise
    }
    catch (error) {
        (0, utils_1.log)(`[leaveGoogleMeet] Error calling performLeaveAction in browser: ${error.message}`);
        return false;
    }
}
// --- ------------------------------------------------------- ---
//# sourceMappingURL=google.js.map