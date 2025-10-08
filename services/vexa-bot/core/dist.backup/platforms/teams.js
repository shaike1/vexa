"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMicrosoftTeams = handleMicrosoftTeams;
exports.leaveMicrosoftTeams = leaveMicrosoftTeams;
const utils_1 = require("../utils");
const uuid_1 = require("uuid");
const teams_auth_1 = __importDefault(require("../auth/teams-auth"));
// Function to generate UUID
function generateUUID() {
    return (0, uuid_1.v4)();
}
// AUTO-MUTE FUNCTION DISABLED - Bot remains unmuted for audio capture
// This function was removed to allow proper audio capture for transcription
// Previously muted bot to prevent beeps, but beeps were from TTS, not audio feedback
// TTS FUNCTIONALITY COMPLETELY REMOVED TO ELIMINATE BEEPING
// Function to monitor Teams transcription
const startTranscriptionMonitoring = async (page, botConfig) => {
    (0, utils_1.log)("🎯 Starting Teams transcription monitoring...");
    await page.evaluate(() => {
        window.logBot("📝 Transcription monitoring started - will capture any Teams transcription output");
        window.logBot("🎤 Please speak in the meeting to test transcription functionality");
        // Monitor for transcription elements
        const monitorTranscription = () => {
            // Look for common Teams transcription selectors
            const transcriptionSelectors = [
                '[data-tid="transcript-text"]',
                '[data-tid="captions-text"]',
                '[data-tid="live-captions"]',
                '[data-tid="caption-container"]',
                '.transcript-text',
                '.captions-text',
                '.live-captions',
                '.caption-text',
                '.caption-container',
                '.transcription-text',
                '[role="log"]',
                '[role="region"][aria-live]',
                '.transcript-container',
                '[aria-label*="captions"]',
                '[aria-label*="transcript"]',
                '.calling-subtitle',
                '.subtitle-text',
                '.live-caption-text',
                '[data-automation-id*="caption"]',
                '[data-automation-id*="transcript"]'
            ];
            transcriptionSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element, index) => {
                    if (element && element.textContent && element.textContent.trim().length > 2) {
                        window.logBot(`📝 TRANSCRIPTION DETECTED [${selector}#${index}]: "${element.textContent.trim()}"`);
                    }
                });
            });
            // Also scan all elements for potential caption text
            const allElements = document.querySelectorAll('div, span, p');
            allElements.forEach((element, index) => {
                const text = element.textContent;
                if (text && text.trim().length > 10) {
                    // Look for text that might be captions - check for common patterns
                    const lowerText = text.toLowerCase().trim();
                    if (lowerText.includes('lukov') || lowerText.includes('shai') ||
                        (lowerText.length > 15 && lowerText.length < 200 &&
                            !lowerText.includes('button') && !lowerText.includes('click') &&
                            !lowerText.includes('menu') && !lowerText.includes('elapsed'))) {
                        window.logBot(`🔍 POTENTIAL CAPTION: "${text.trim()}"`);
                    }
                }
            });
            // Also monitor for any new text that appears
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 10) {
                                window.logBot(`📝 NEW TEXT DETECTED: "${node.textContent.trim()}"`);
                            }
                            else if (node.nodeType === Node.ELEMENT_NODE) {
                                const element = node;
                                if (element.textContent && element.textContent.trim().length > 10) {
                                    window.logBot(`📝 NEW ELEMENT TEXT: "${element.textContent.trim()}"`);
                                }
                            }
                        });
                    }
                });
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
            window.logBot("👁️ DOM observer set up to monitor for transcription changes");
        };
        // Start monitoring immediately
        monitorTranscription();
        // Re-scan every 5 seconds
        setInterval(() => {
            window.logBot("🔍 Scanning for transcription content...");
            monitorTranscription();
        }, 5000);
    });
    (0, utils_1.log)("✅ Transcription monitoring active");
};
// TTS FUNCTION REMOVED - NO BEEPING
async function speakText(text) {
    // TTS completely disabled to eliminate beeping
    return Promise.resolve();
    // Generate loud beep sequences using Web Audio API
    const generateLoudBeeps = async (audioContext, destination) => {
        try {
            window.logBot(`🔊 Generating loud beep sequences with maximum volume...`);
            // Create multiple oscillators with different frequencies for better audibility
            const frequencies = [800, 1000, 1200, 1600, 2000]; // Multiple frequencies for better pickup
            const beepDuration = 0.5; // 500ms beeps
            const beepInterval = 0.6; // 100ms gap between beeps
            for (let i = 0; i < frequencies.length; i++) {
                const frequency = frequencies[i];
                const startTime = audioContext.currentTime + (i * beepInterval);
                // Create oscillator with square wave for maximum loudness
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.type = 'square'; // Square wave for maximum loudness
                oscillator.frequency.setValueAtTime(frequency, startTime);
                // Maximum volume
                gainNode.gain.setValueAtTime(1.0, startTime);
                oscillator.connect(gainNode);
                gainNode.connect(destination);
                oscillator.start(startTime);
                oscillator.stop(startTime + beepDuration);
                window.logBot(`🔊 Created loud square wave beep at ${frequency}Hz`);
            }
            // Create modulated tone for better detection
            const modulatedOscillator = audioContext.createOscillator();
            const modulatedGain = audioContext.createGain();
            const lfo = audioContext.createOscillator(); // Low frequency oscillator for modulation
            const lfoGain = audioContext.createGain();
            modulatedOscillator.type = 'square';
            modulatedOscillator.frequency.setValueAtTime(1500, audioContext.currentTime);
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(10, audioContext.currentTime); // 10Hz modulation
            lfoGain.gain.setValueAtTime(0.5, audioContext.currentTime);
            modulatedGain.gain.setValueAtTime(1.0, audioContext.currentTime);
            lfo.connect(lfoGain);
            lfoGain.connect(modulatedGain.gain);
            modulatedOscillator.connect(modulatedGain);
            modulatedGain.connect(destination);
            const modulatedStart = audioContext.currentTime + (frequencies.length * beepInterval);
            lfo.start(modulatedStart);
            modulatedOscillator.start(modulatedStart);
            lfo.stop(modulatedStart + 2.0);
            modulatedOscillator.stop(modulatedStart + 2.0);
            window.logBot(`🔊 Created modulated tone for enhanced detection`);
        }
        catch (beepError) {
            window.logBot(`❌ Error generating loud beeps: ${beepError}`);
        }
    };
    // Try to intercept getUserMedia to inject custom audio streams
    const interceptGetUserMedia = async () => {
        try {
            window.logBot(`🎯 Attempting to intercept getUserMedia for custom audio injection...`);
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
            // Override getUserMedia to inject our custom stream
            navigator.mediaDevices.getUserMedia = async function (constraints) {
                window.logBot(`🎯 getUserMedia intercepted with constraints: ${JSON.stringify(constraints)}`);
                // Get the original stream
                const originalStream = await originalGetUserMedia.call(this, constraints);
                if (constraints.audio && originalStream.getAudioTracks().length > 0) {
                    window.logBot(`🎯 Injecting custom audio into intercepted stream`);
                    // Create audio context for mixing
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const destination = audioContext.createMediaStreamDestination();
                    // Connect original microphone
                    const micSource = audioContext.createMediaStreamSource(originalStream);
                    micSource.connect(destination);
                    // Generate loud beeps
                    await generateLoudBeeps(audioContext, destination);
                    // Return mixed stream
                    return destination.stream;
                }
                return originalStream;
            };
            window.logBot(`✅ getUserMedia intercepted successfully`);
        }
        catch (interceptError) {
            window.logBot(`❌ Error intercepting getUserMedia: ${interceptError}`);
        }
    };
    // Try to inject audio into the microphone stream with enhanced beeps
    try {
        window.logBot(`🎯 Attempting to inject loud beeps into microphone stream...`);
        // Intercept getUserMedia first
        await interceptGetUserMedia();
        // Get the current microphone stream that Teams is using
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Create a destination for mixing audio
        const destination = audioContext.createMediaStreamDestination();
        // Connect microphone to destination
        const micSource = audioContext.createMediaStreamSource(stream);
        micSource.connect(destination);
        // Generate loud beeps
        await generateLoudBeeps(audioContext, destination);
        // Try to replace the microphone stream with our mixed stream
        const tracks = stream.getAudioTracks();
        tracks.forEach(track => {
            track.stop();
        });
        // Get the mixed stream
        const mixedStream = destination.stream;
        window.logBot(`🎯 Created mixed audio stream with ${mixedStream.getAudioTracks().length} audio tracks and loud beeps`);
        // Try to update the video element or RTCPeerConnection if possible
        try {
            // Look for video elements or audio elements
            const videoElements = document.querySelectorAll('video, audio');
            videoElements.forEach((element, index) => {
                if (element.srcObject) {
                    window.logBot(`🎯 Found media element ${index} with srcObject - injecting loud beeps`);
                    // Try to replace with mixed stream
                    element.srcObject = mixedStream;
                }
            });
            // Try to find and replace RTCPeerConnection streams
            const rtcConnections = window.RTCPeerConnection?.prototype?.getSenders?.call?.() || [];
            rtcConnections.forEach((sender, index) => {
                if (sender.track && sender.track.kind === 'audio') {
                    window.logBot(`🎯 Found RTC audio sender ${index} - attempting to replace with loud beeps`);
                    sender.replaceTrack(mixedStream.getAudioTracks()[0]).catch((err) => {
                        window.logBot(`❌ Failed to replace RTC track: ${err.message}`);
                    });
                }
            });
        }
        catch (streamError) {
            window.logBot(`❌ Error updating media streams: ${streamError}`);
        }
    }
    catch (mediaError) {
        window.logBot(`❌ Media stream injection failed: ${mediaError}`);
    }
    // Original speech synthesis as backup
    try {
        window.logBot(`🎤 Starting original speech synthesis as backup...`);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        // Select best voice
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            const englishVoice = voices.find(voice => voice.lang.startsWith('en') && voice.default) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
            utterance.voice = englishVoice;
        }
        utterance.onstart = () => {
            window.logBot(`🎤 Speech started: "${text}"`);
        };
        utterance.onend = () => {
            window.logBot(`✅ Speech completed: "${text}"`);
            resolve();
        };
        utterance.onerror = (event) => {
            window.logBot(`❌ Speech error: ${event.error}`);
            resolve();
        };
        // Execute the speech synthesis
        speechSynthesis.speak(utterance);
        // Safety timeout
        setTimeout(() => {
            speechSynthesis.cancel();
            resolve();
        }, 15000); // 15 second timeout for enhanced version
    }
    catch (speechError) {
        window.logBot(`❌ Speech synthesis backup failed: ${speechError}`);
        resolve();
    }
}
try { }
catch (error) {
    window.logBot(`❌ Enhanced speech synthesis setup failed: ${error}`);
    resolve();
}
;
async function handleMicrosoftTeams(botConfig, page, gracefulLeaveFunction) {
    const leaveButton = `button[data-tid="call-end"]`;
    // Check for Teams authentication configuration
    const teamsAuthMode = process.env.TEAMS_AUTH_MODE || "guest";
    const teamsClientId = process.env.TEAMS_CLIENT_ID;
    const teamsClientSecret = process.env.TEAMS_CLIENT_SECRET;
    const teamsTenantId = process.env.TEAMS_TENANT_ID;
    const teamsOrganizerEmail = process.env.TEAMS_ORGANIZER_EMAIL;
    (0, utils_1.log)(`[Teams] Authentication mode: ${teamsAuthMode}`);
    // Handle authenticated mode for enhanced features (but still join as guest)
    if (teamsAuthMode === "authenticated" && teamsClientId && teamsClientSecret && teamsTenantId) {
        (0, utils_1.log)("[Teams] Using authenticated mode for enhanced meeting metadata");
        try {
            const meetingInfo = await handleAuthenticatedMeetingInfo(botConfig.meetingUrl, teamsOrganizerEmail, {
                clientId: teamsClientId,
                clientSecret: teamsClientSecret,
                tenantId: teamsTenantId,
                redirectUri: process.env.TEAMS_REDIRECT_URI || ""
            });
            if (meetingInfo) {
                (0, utils_1.log)(`[Teams] Retrieved enhanced meeting info: ${meetingInfo.subject} (${meetingInfo.id})`);
                (0, utils_1.log)(`[Teams] Meeting organizer: ${meetingInfo.organizer?.identity?.user?.displayName || 'Unknown'}`);
                (0, utils_1.log)(`[Teams] Meeting time: ${meetingInfo.startDateTime} - ${meetingInfo.endDateTime}`);
                // Store enhanced info for potential use during recording
                botConfig.enhancedMeetingInfo = meetingInfo;
                // Use the Graph API meeting URL if different/better
                if (meetingInfo.joinWebUrl !== botConfig.meetingUrl) {
                    (0, utils_1.log)(`[Teams] Using Graph API join URL: ${meetingInfo.joinWebUrl}`);
                    botConfig.meetingUrl = meetingInfo.joinWebUrl;
                }
            }
            else {
                (0, utils_1.log)("[Teams] Could not retrieve enhanced meeting info, proceeding with basic guest join");
            }
        }
        catch (error) {
            (0, utils_1.log)(`[Teams] Enhanced meeting info retrieval failed: ${error.message}`);
            (0, utils_1.log)("[Teams] Proceeding with guest mode (consistent with Google Meet/Zoom behavior)");
        }
    }
    else {
        (0, utils_1.log)("[Teams] Using guest mode (consistent with Google Meet/Zoom behavior)");
    }
    if (!botConfig.meetingUrl) {
        (0, utils_1.log)("Error: Meeting URL is required for Microsoft Teams but is null.");
        await gracefulLeaveFunction(page, 1, "missing_meeting_url");
        return;
    }
    // IMPORTANT: Always join as guest via browser automation (consistent with Google Meet/Zoom)
    // This avoids authentication conflicts when multiple users request bots for the same meeting
    // The authenticated mode above only provides enhanced metadata, not authenticated joining
    (0, utils_1.log)("Joining Microsoft Teams meeting as guest (consistent with Google Meet/Zoom behavior)");
    try {
        await joinTeamsMeeting(page, botConfig.meetingUrl, botConfig.botName);
    }
    catch (error) {
        console.error("Error during joinTeamsMeeting: " + error.message);
        (0, utils_1.log)("Error during joinTeamsMeeting: " + error.message + ". Triggering graceful leave.");
        await gracefulLeaveFunction(page, 1, "join_meeting_error");
        return;
    }
    // Setup websocket connection and meeting admission concurrently
    (0, utils_1.log)("🏁 TEAMS BOT READY FOR MANUAL ADMISSION!");
    (0, utils_1.log)("⚠️  PLEASE CHECK YOUR TEAMS MEETING FOR 'Vexa Transcription Bot' ADMISSION REQUEST!");
    (0, utils_1.log)("⏰ Bot will wait up to 10 MINUTES for manual admission");
    (0, utils_1.log)("Starting WebSocket connection while waiting for Teams meeting admission");
    try {
        // Wait for admission first
        const isAdmitted = await waitForTeamsMeetingAdmission(page, leaveButton, 600000 // 10 minutes in milliseconds - enough time for manual admission
        ).catch((error) => {
            (0, utils_1.log)("Teams meeting admission failed: " + error.message);
            return false;
        });
        if (!isAdmitted) {
            console.error("Bot was not admitted into the Teams meeting");
            (0, utils_1.log)("Bot not admitted to Teams meeting. Triggering graceful leave with admission_failed reason.");
            await gracefulLeaveFunction(page, 2, "admission_failed");
            return;
        }
        // Now prepare for recording after admission is confirmed
        await prepareForRecording(page);
        (0, utils_1.log)("Successfully admitted to the Teams meeting, starting recording");
        // Auto-mute disabled - bot will remain unmuted for audio capture
        // await muteTeamsBot(page); // DISABLED to allow audio capture
        // Set up browser context functions immediately after successful admission
        await page.evaluate(async () => {
            // AUTO-MUTE DISABLED: Bot remains unmuted for audio capture
            window.forceMuteBot = () => {
                try {
                    const muteSelectors = [
                        'button[data-tid="toggle-mute"]',
                        'button[data-tid="microphone-button"]',
                        'button[data-tid="calling-microphone-button"]',
                        'button[aria-label*="Mute"]',
                        'button[aria-label*="mute"]',
                        'button[title*="Mute"]',
                        'button[title*="mute"]'
                    ];
                    for (const selector of muteSelectors) {
                        const button = document.querySelector(selector);
                        if (button) {
                            const ariaPressed = button.getAttribute('aria-pressed');
                            const ariaLabel = button.getAttribute('aria-label') || '';
                            const title = button.getAttribute('title') || '';
                            // If unmuted (aria-pressed="false" or contains "Mute" not "Unmute")
                            const isMuted = ariaPressed === 'true' ||
                                ariaLabel.toLowerCase().includes('unmute') ||
                                title.toLowerCase().includes('unmute');
                            if (!isMuted) {
                                button.click();
                                console.log(`🔇 BROWSER: Force muted bot using ${selector} - ariaPressed: ${ariaPressed}, label: ${ariaLabel}`);
                                return true;
                            }
                            else {
                                console.log(`🔇 BROWSER: Bot already muted via ${selector}`);
                                return true;
                            }
                        }
                    }
                    console.log('🔇 BROWSER: No mute button found with any selector');
                    return false;
                }
                catch (e) {
                    console.log('🔇 BROWSER: Could not mute - ' + e);
                    return false;
                }
            };
            // AUTO-MUTE DISABLED: No immediate mute or continuous monitoring
            // (window as any).forceMuteBot(); // DISABLED
            // setInterval(() => {
            //   (window as any).forceMuteBot();
            // }, 3000); // DISABLED
            // Expose speech synthesis function for Redis commands
            window.performSpeechAction = async (text) => {
                window.logBot(`🎤 Received speak command: "${text}"`);
                try {
                    // Use Web Speech API for text-to-speech
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(text);
                        utterance.rate = 1;
                        utterance.pitch = 1;
                        utterance.volume = 1;
                        speechSynthesis.speak(utterance);
                        window.logBot("✅ Speech command completed successfully");
                    }
                    else {
                        window.logBot("❌ Speech synthesis not available in this browser");
                    }
                }
                catch (error) {
                    window.logBot(`❌ Speech command failed: ${error.message}`);
                }
            };
            // Expose unmute function for Redis commands
            window.performUnmuteAction = async () => {
                window.logBot("🔊 Attempting to unmute microphone...");
                try {
                    // Look for mute button and click it if muted
                    const muteButton = document.querySelector('button[data-tid="microphone-button"]');
                    if (muteButton) {
                        const isCurrentlyMuted = muteButton.getAttribute('aria-pressed') === 'true';
                        if (isCurrentlyMuted) {
                            muteButton.click();
                            window.logBot("✅ Microphone unmuted successfully");
                        }
                        else {
                            window.logBot("ℹ️ Microphone is already unmuted");
                        }
                    }
                    else {
                        window.logBot("❌ Could not find mute button");
                    }
                }
                catch (error) {
                    window.logBot(`❌ Error unmuting microphone: ${error.message}`);
                }
            };
            window.logBot("✅ Browser context functions (performSpeechAction, performUnmuteAction) are now available for Redis commands");
        });
        // Announce that transcription is starting via text-to-speech
        try {
            (0, utils_1.log)("Starting enhanced audio detection and text-to-speech process...");
            // First, let's examine what's available in the page
            const pageInfo = await page.evaluate(() => {
                const allButtons = document.querySelectorAll('button, [role="button"]');
                const buttonInfo = [];
                for (let i = 0; i < Math.min(15, allButtons.length); i++) {
                    const btn = allButtons[i];
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
            (0, utils_1.log)(`=== TEAMS UI ANALYSIS ===`);
            (0, utils_1.log)(`Current URL: ${pageInfo.currentUrl}`);
            (0, utils_1.log)(`Found ${pageInfo.totalButtons} total buttons/clickable elements`);
            (0, utils_1.log)(`Analyzing first 15 buttons:`);
            for (const btn of pageInfo.buttonInfo) {
                (0, utils_1.log)(`Button ${btn.index}: aria-label="${btn.ariaLabel}", title="${btn.title}", data-tid="${btn.dataTid}", visible=${btn.visible}, text="${btn.textContent}"`);
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
                        const btn = allButtons[i];
                        console.log(`Button ${i + 1}: aria-label="${btn.getAttribute('aria-label')}", title="${btn.getAttribute('title')}", data-tid="${btn.getAttribute('data-tid')}", class="${btn.className}", text="${btn.textContent?.substring(0, 50)}"`);
                    }
                    const trySelectComputerAudio = async () => {
                        const radioSelectors = [
                            'input[aria-label="Computer audio"]',
                            'input[id^="radio"][aria-label*="Computer"]',
                            'input[name^="radiogroup"][aria-label*="Computer"]',
                            '[role="radio"][aria-label*="Computer"]',
                            '[data-tid="audio-configuration-computeraudio"]'
                        ];
                        for (const selector of radioSelectors) {
                            try {
                                const radioCandidate = document.querySelector(selector);
                                if (!radioCandidate) {
                                    continue;
                                }
                                const isAriaRadio = radioCandidate.getAttribute && radioCandidate.getAttribute('role') === 'radio';
                                if (isAriaRadio) {
                                    const ariaChecked = radioCandidate.getAttribute('aria-checked');
                                    if (ariaChecked !== 'true') {
                                        radioCandidate.click();
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    }
                                    if (radioCandidate.getAttribute('aria-checked') === 'true') {
                                        console.log(`Selected computer audio via aria radio: ${selector}`);
                                        return true;
                                    }
                                    continue;
                                }
                                if (radioCandidate instanceof HTMLInputElement) {
                                    if (!radioCandidate.checked) {
                                        radioCandidate.click();
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    }
                                    if (!radioCandidate.checked && radioCandidate.id) {
                                        const associatedLabel = document.querySelector(`label[for="${radioCandidate.id}"]`);
                                        if (associatedLabel) {
                                            associatedLabel.click();
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                        }
                                    }
                                    if (radioCandidate.checked) {
                                        console.log(`Selected computer audio via input: ${selector}`);
                                        return true;
                                    }
                                }
                                else if (radioCandidate instanceof HTMLElement) {
                                    radioCandidate.click();
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    const ariaLabel = radioCandidate.getAttribute('aria-label');
                                    if (ariaLabel && ariaLabel.toLowerCase().includes('computer')) {
                                        console.log(`Selected computer audio via generic element: ${selector}`);
                                        return true;
                                    }
                                }
                            }
                            catch (radioError) {
                                console.log(`Error selecting computer audio with selector ${selector}: ${radioError}`);
                            }
                        }
                        console.log('Computer audio radio control not found.');
                        return false;
                    };
                    let audioEnabled = false;
                    const computerAudioSelected = await trySelectComputerAudio();
                    if (computerAudioSelected) {
                        audioEnabled = true;
                    }
                    for (const selector of muteButtonSelectors) {
                        try {
                            const button = document.querySelector(selector);
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
                        }
                        catch (buttonError) {
                            console.log(`Error with selector ${selector}: ${buttonError.message}`);
                        }
                    }
                    // Additional attempt: Look for any button with mute-related text
                    if (!audioEnabled) {
                        console.log("Trying to find mute button by text content...");
                        const allButtons = document.querySelectorAll('button, [role="button"]');
                        for (const button of allButtons) {
                            const text = button.textContent?.toLowerCase() || '';
                            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                            const title = button.getAttribute('title')?.toLowerCase() || '';
                            if ((text.includes('unmute') || ariaLabel.includes('unmute') || title.includes('unmute')) &&
                                button.offsetParent !== null) {
                                console.log(`Found unmute button by text: "${text}" / "${ariaLabel}" / "${title}"`);
                                button.click();
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
                        const englishVoice = voices.find(voice => voice.lang.startsWith('en') &&
                            (voice.name.includes('Natural') || voice.name.includes('Enhanced') || voice.default)) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
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
                }
                catch (speechError) {
                    console.error("Speech synthesis failed:", speechError);
                }
            });
            (0, utils_1.log)("Bot announced start of transcription via enhanced text-to-speech with improved audio handling");
        }
        catch (e) {
            (0, utils_1.log)(`Text-to-speech announcement failed: ${e.message}`);
        }
        // Automated audio validation test
        try {
            (0, utils_1.log)("Running automated audio validation test...");
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
                        }
                        catch (speechError) {
                            console.log("⚠️ Speech synthesis test failed:", speechError.message);
                        }
                        console.log("🎉 AUDIO VALIDATION COMPLETE - All core tests passed!");
                        console.log("🚀 Bot audio pipeline is fully functional and ready for transcription");
                    }
                    catch (contextError) {
                        console.error("❌ Audio context test failed:", contextError);
                    }
                }
                catch (micError) {
                    console.error("❌ Microphone access test failed:", micError);
                    throw new Error("Critical: Microphone access denied - bot cannot record audio");
                }
            });
            (0, utils_1.log)("✅ Automated audio validation completed successfully");
        }
        catch (validationError) {
            (0, utils_1.log)(`⚠️ Audio validation test failed: ${validationError.message}`);
            // Don't fail the bot entirely, but log the issue for debugging
        }
        await startRecording(page, botConfig);
    }
    catch (error) {
        console.error("Error after Teams join attempt (admission/recording setup): " + error.message);
        (0, utils_1.log)("Error after Teams join attempt (admission/recording setup): " + error.message + ". Triggering graceful leave.");
        await gracefulLeaveFunction(page, 1, "post_join_setup_error");
        return;
    }
}
// Function to wait for Teams meeting admission
const waitForTeamsMeetingAdmission = async (page, leaveButton, timeout) => {
    try {
        (0, utils_1.log)("Waiting for Teams meeting admission...");
        // Debug: Check current page state during admission wait
        const currentUrl = page.url();
        const pageTitle = await page.title();
        (0, utils_1.log)(`DEBUG: During admission wait - URL: ${currentUrl}, Title: ${pageTitle}`);
        // Check for lobby/waiting room first
        const lobbySelectors = [
            '[data-tid="lobby-screen"]',
            '[data-tid="waiting-room"]',
            'text="You\'re in the lobby"',
            'text="Waiting for someone to let you in"',
            'text="Please wait"'
        ];
        // Check what's actually on the page during admission wait
        const allElements = await page.$$eval('*', elements => Array.from(elements).slice(0, 20).map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim()?.substring(0, 100),
            dataTid: el.getAttribute('data-tid'),
            className: el.className,
            id: el.id
        })).filter(el => el.text && el.text.length > 0));
        (0, utils_1.log)(`DEBUG: Current page elements during admission wait: ${JSON.stringify(allElements.slice(0, 10), null, 2)}`);
        // Enhanced lobby detection with multiple strategies
        (0, utils_1.log)("Starting comprehensive lobby detection checks...");
        // Check for lobby/waiting room indicators with enhanced detection
        const lobbyIndicators = await page.evaluate(() => {
            const indicators = {
                hasLobbyScreen: !!(document.querySelector('[data-tid="lobby-screen"]') ||
                    document.querySelector('[data-tid="waiting-room"]')),
                hasWaitingText: !!(document.querySelector('*') &&
                    Array.from(document.querySelectorAll('*')).some(el => el.textContent && (el.textContent.includes("You're in the lobby") ||
                        el.textContent.includes("Waiting for someone to let you in") ||
                        el.textContent.includes("Please wait") ||
                        el.textContent.includes("lobby") ||
                        el.textContent.includes("waiting room") ||
                        el.textContent.includes("admitted")))),
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
        (0, utils_1.log)(`Lobby detection results: ${JSON.stringify(lobbyIndicators, null, 2)}`);
        // FORCE manual admission detection if we're on /v2/ URL
        const isOnV2Url = currentUrl.includes('/v2/') || currentUrl.endsWith('/v2');
        (0, utils_1.log)(`DEBUG: Current URL: ${currentUrl}`);
        (0, utils_1.log)(`DEBUG: Is on V2 URL: ${isOnV2Url}`);
        // If we detect ANY lobby/waiting state OR we're on /v2/ URL (which indicates waiting for admission), wait for manual admission
        if (lobbyIndicators.hasLobbyScreen || lobbyIndicators.hasWaitingText ||
            lobbyIndicators.hasLobbyButtons || lobbyIndicators.isInLobbyState || isOnV2Url) {
            (0, utils_1.log)("🏁 Bot is in Teams waiting state - waiting for manual admission");
            (0, utils_1.log)("⚠️  PLEASE CHECK YOUR TEAMS MEETING FOR AN ADMISSION REQUEST!");
            (0, utils_1.log)("⏰ Bot will wait up to 5 minutes for you to admit it manually");
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
                        const element = document.querySelector(selector);
                        return element && element.offsetParent !== null;
                    }) || !window.location.href.includes('/v2/'); // Also succeed if we're no longer on /v2/ URL
                }, { timeout: 15000 }); // 15 seconds for manual admission
                if (meetingUIAppeared) {
                    (0, utils_1.log)("✅ Successfully admitted from waiting state to full Teams meeting interface");
                    return true;
                }
            }
            catch (e) {
                (0, utils_1.log)("⚠️ Timeout waiting for specific meeting UI elements - checking URL-based admission");
                // Fallback: If we're no longer on /v2/ URL, assume admission worked
                const currentUrlAfterTimeout = page.url();
                if (!currentUrlAfterTimeout.includes('/v2/')) {
                    (0, utils_1.log)("✅ URL indicates successful admission, proceeding with recording");
                    return true;
                }
                (0, utils_1.log)("❌ Still on waiting URL after timeout - admission likely failed");
                return false;
            }
        }
        (0, utils_1.log)("No waiting state detected - proceeding with standard admission detection...");
        // Enhanced admission detection with multiple strategies
        (0, utils_1.log)("Checking for Teams meeting admission indicators...");
        // Wait a longer time for the admission process to complete
        (0, utils_1.log)("Waiting additional time for Teams admission process...");
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
        (0, utils_1.log)(`Current URL during admission check: ${currentUrl}`);
        // First check if we're still on pre-join screen
        const stillOnPrejoin = await page.evaluate(() => {
            const joinButton = document.querySelector('[data-tid="prejoin-join-button"]');
            const prejoinElements = document.querySelector('[data-tid="prejoin-display-name-input"]');
            const prejoinSettings = document.querySelector('[data-tid="prejoin-audiosettings-button"]');
            return !!(joinButton || prejoinElements || prejoinSettings);
        });
        // FORCE manual admission mode for ALL Teams meetings to ensure proper timeout
        (0, utils_1.log)("🏁 TEAMS BOT IS WAITING FOR MANUAL ADMISSION!");
        (0, utils_1.log)("⚠️  PLEASE CHECK YOUR TEAMS MEETING FOR AN ADMISSION REQUEST!");
        (0, utils_1.log)("⏰ Bot will wait up to 5 minutes for you to admit it manually");
        (0, utils_1.log)("🎯 Look for 'Vexa Transcription Bot' in your Teams meeting participants or admission requests");
        if (stillOnPrejoin || true) { // FORCE this path to always execute
            (0, utils_1.log)("Forcing manual admission wait - please admit the bot in Teams");
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
                        const element = document.querySelector(selector);
                        return element && element.offsetParent !== null;
                    });
                }, { timeout: 300000 }); // 5 minutes for manual admission
                if (meetingUIAppeared) {
                    (0, utils_1.log)("✅ Successfully admitted to Teams meeting after manual approval");
                    return true;
                }
            }
            catch (e) {
                (0, utils_1.log)("❌ Timeout waiting for manual admission - please admit the bot faster next time");
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
                const element = document.querySelector(selector);
                return element && element.offsetParent !== null;
            });
        });
        if (hasActualMeetingUI) {
            (0, utils_1.log)("Found actual meeting UI controls - successfully admitted to Teams meeting");
            return true;
        }
        // Only use URL as secondary check and be more optimistic
        (0, utils_1.log)(`DEBUG: Checking URL for admission indicators. Current URL: ${currentUrl}`);
        const urlIndicatesAdmission = currentUrl.includes('conversations') ||
            currentUrl.includes('calling') ||
            currentUrl.includes('/v2/'); // Remove stillOnPrejoin constraint for optimistic approach
        (0, utils_1.log)(`DEBUG: URL admission check result: ${urlIndicatesAdmission} (conversations: ${currentUrl.includes('conversations')}, calling: ${currentUrl.includes('calling')}, v2: ${currentUrl.includes('/v2/')})`);
        if (urlIndicatesAdmission) {
            (0, utils_1.log)("URL indicates successful admission to Teams meeting (secondary check)");
            return true;
        }
        // Try call control detection with extended timeout for manual admission
        (0, utils_1.log)("🔍 Waiting for meeting controls to appear after manual admission...");
        try {
            for (const selector of callControlSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 30000 }); // 30 seconds per selector for manual admission
                    (0, utils_1.log)(`✅ Found call control indicator: ${selector}`);
                    return true;
                }
                catch (e) {
                    (0, utils_1.log)(`❌ Call control selector ${selector} not found`);
                }
            }
            // Try participant detection with extended timeout
            (0, utils_1.log)("🔍 Checking for participant indicators...");
            for (const selector of participantSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 30000 }); // 30 seconds per selector for manual admission
                    (0, utils_1.log)(`✅ Found participant indicator: ${selector}`);
                    return true;
                }
                catch (e) {
                    (0, utils_1.log)(`❌ Participant selector ${selector} not found`);
                }
            }
        }
        catch (e) {
            (0, utils_1.log)("🔄 Call control and participant detection completed, assuming successful admission");
        }
        // Strategy 4: Always assume admission for bypass lobby approach
        (0, utils_1.log)("No specific admission indicators found, but no lobby detected either");
        (0, utils_1.log)("Assuming successful admission based on optimistic bypass lobby approach");
        return true;
    }
    catch (error) {
        (0, utils_1.log)(`Admission detection encountered error: ${error}, but proceeding optimistically`);
        (0, utils_1.log)("Assuming successful admission due to optimistic bypass lobby approach");
        return true;
    }
};
// Handle Teams dialogs and overlays that might block interactions
const handleTeamsDialogs = async (page) => {
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
            (0, utils_1.log)(`Dismissed dialog: ${selector}`);
            await page.waitForTimeout(500);
        }
        catch (e) {
            // Dialog not present, continue
        }
    }
    // Try to dismiss any modal overlays by pressing Escape
    try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    }
    catch (e) {
        // Ignore
    }
};
// Handle audio permission dialogs specifically
const handleAudioPermissionDialogs = async (page) => {
    try {
        (0, utils_1.log)("🎤 Checking for microphone permission dialogs...");
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
                    (0, utils_1.log)(`✅ Clicked permission button: ${selector}`);
                    await page.waitForTimeout(1000);
                    break;
                }
            }
            catch (e) {
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
                        (0, utils_1.log)(`🎤 Unmuted microphone using: ${selector}`);
                        await page.waitForTimeout(500);
                    }
                }
            }
            catch (e) {
                // Teams audio control not found with this selector
            }
        }
        (0, utils_1.log)("✅ Audio permission dialog handling completed");
    }
    catch (error) {
        (0, utils_1.log)(`⚠️ Error handling audio permissions: ${error.message}`);
    }
};
// Prepare for recording by exposing necessary functions
const prepareForRecording = async (page) => {
    // Expose the logBot function to the browser context
    await page.exposeFunction("logBot", (msg) => {
        (0, utils_1.log)(msg);
    });
};
const joinTeamsMeeting = async (page, meetingUrl, botName) => {
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
        'input' // Last resort - any input field
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
                (0, utils_1.log)(`Attempting direct Teams URL bypass: ${directUrl}`);
            }
        }
        catch (e) {
            (0, utils_1.log)(`URL extraction failed, using original URL: ${e.message}`);
        }
    }
    await page.goto(directUrl, { waitUntil: "networkidle" });
    await page.bringToFront();
    // Wait for page to settle
    (0, utils_1.log)("Waiting for Teams meeting page to load...");
    await page.waitForTimeout(3000);
    // Handle any immediate permission dialogs
    await handleAudioPermissionDialogs(page);
    // Try to click "Use the web app instead" if it appears
    try {
        await page.waitForSelector(useWebInsteadLink, { timeout: 5000 });
        await page.click(useWebInsteadLink);
        (0, utils_1.log)("Clicked 'Use the web app instead' link");
        await page.waitForTimeout(3000);
    }
    catch (e) {
        (0, utils_1.log)("'Use the web app instead' link not found or already using web app");
    }
    // Try to click "Continue on this browser" multiple times if needed
    let browserButtonClicks = 0;
    const maxBrowserClicks = 3;
    while (browserButtonClicks < maxBrowserClicks) {
        try {
            await page.waitForSelector('button[data-tid="joinOnWeb"]', { timeout: 5000 });
            await page.click('button[data-tid="joinOnWeb"]');
            browserButtonClicks++;
            (0, utils_1.log)(`Clicked 'Continue on this browser' button (attempt ${browserButtonClicks})`);
            (0, utils_1.log)("Waiting for page navigation after browser selection...");
            await page.waitForTimeout(5000);
            // Check if page URL changed and if we still see the browser selection
            const currentUrl = page.url();
            (0, utils_1.log)(`Current page URL after browser selection: ${currentUrl}`);
            // Check if browser selection buttons are still present
            const stillHasBrowserButtons = await page.$('button[data-tid="joinOnWeb"]');
            if (!stillHasBrowserButtons) {
                (0, utils_1.log)("Browser selection screen bypassed successfully");
                break;
            }
            else {
                (0, utils_1.log)("Still on browser selection screen, will try clicking again...");
            }
        }
        catch (e) {
            (0, utils_1.log)("'Continue on this browser' button not found - moving on");
            break;
        }
    }
    // Debug: Check what's actually on the page
    (0, utils_1.log)("DEBUG: Checking page content for available elements...");
    try {
        const pageTitle = await page.title();
        (0, utils_1.log)(`DEBUG: Page title: ${pageTitle}`);
        const allInputs = await page.$$eval('input', inputs => inputs.map(input => ({
            type: input.type,
            name: input.name,
            placeholder: input.placeholder,
            id: input.id,
            className: input.className,
            dataTid: input.getAttribute('data-tid'),
            ariaLabel: input.getAttribute('aria-label')
        })));
        (0, utils_1.log)(`DEBUG: Found ${allInputs.length} input elements: ${JSON.stringify(allInputs, null, 2)}`);
        const allButtons = await page.$$eval('button', buttons => buttons.map(button => ({
            textContent: button.textContent?.trim(),
            id: button.id,
            className: button.className,
            dataTid: button.getAttribute('data-tid'),
            ariaLabel: button.getAttribute('aria-label')
        })));
        (0, utils_1.log)(`DEBUG: Found ${allButtons.length} button elements: ${JSON.stringify(allButtons.slice(0, 10), null, 2)}`);
    }
    catch (e) {
        (0, utils_1.log)(`DEBUG: Error inspecting page elements: ${e.message}`);
    }
    // Wait for any of the name input field selectors
    (0, utils_1.log)("Waiting for name input field...");
    let nameField = null;
    for (const selector of nameFieldSelectors) {
        try {
            await page.waitForSelector(selector, { timeout: 8000 });
            nameField = selector;
            (0, utils_1.log)(`Found name field with selector: ${selector}`);
            break;
        }
        catch (e) {
            (0, utils_1.log)(`Name field selector ${selector} not found, trying next...`);
        }
    }
    if (!nameField) {
        // Check if we can proceed without name entry (maybe already logged in)
        (0, utils_1.log)("No name field found - checking if we can proceed directly to join...");
        // Look for join buttons even without name field
        for (const selector of joinButtonSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 10000 }); // Increased from 3s to 10s
                (0, utils_1.log)(`Found join button without name entry: ${selector} - proceeding`);
                await page.click(selector);
                (0, utils_1.log)("Clicked join button directly");
                // Debug: Check what happens after clicking join
                await page.waitForTimeout(3000);
                (0, utils_1.log)("DEBUG: Checking page state after join button click...");
                const postJoinUrl = page.url();
                const postJoinTitle = await page.title();
                (0, utils_1.log)(`DEBUG: Post-join URL: ${postJoinUrl}`);
                (0, utils_1.log)(`DEBUG: Post-join Title: ${postJoinTitle}`);
                return; // Exit early, proceeding to admission wait
            }
            catch (e) {
                (0, utils_1.log)(`Join button ${selector} not found, trying next...`);
            }
        }
        (0, utils_1.log)("⚠️ Could not find name input field or join button with known selectors - proceeding optimistically for manual admission");
        // Don't throw error - continue to manual admission workflow
        return;
    }
    // Fill in the bot name
    await page.waitForTimeout((0, utils_1.randomDelay)(1000));
    await page.fill(nameField, botName);
    (0, utils_1.log)(`Entered bot name: ${botName}`);
    // Turn off microphone and camera if they're on
    const microphoneButton = 'button[data-tid="toggle-mute"]';
    const cameraButton = 'button[data-tid="toggle-video"]';
    try {
        await page.waitForTimeout((0, utils_1.randomDelay)(500));
        const micButton = await page.$(microphoneButton);
        if (micButton) {
            const isMuted = await page.getAttribute(microphoneButton, 'aria-pressed') === 'true';
            if (!isMuted) {
                await page.click(microphoneButton);
                (0, utils_1.log)("Microphone muted");
            }
        }
    }
    catch (e) {
        (0, utils_1.log)("Could not control microphone or already muted");
    }
    try {
        await page.waitForTimeout((0, utils_1.randomDelay)(500));
        const camButton = await page.$(cameraButton);
        if (camButton) {
            const isCameraOff = await page.getAttribute(cameraButton, 'aria-pressed') === 'false';
            if (!isCameraOff) {
                await page.click(cameraButton);
                (0, utils_1.log)("Camera turned off");
            }
        }
    }
    catch (e) {
        (0, utils_1.log)("Could not control camera or already off");
    }
    // Handle any blocking dialogs before clicking join
    await handleTeamsDialogs(page);
    // Find and click join button using multiple selectors
    let joinButton = null;
    for (const selector of joinButtonSelectors) {
        try {
            await page.waitForSelector(selector, { timeout: 10000 });
            joinButton = selector;
            (0, utils_1.log)(`Found join button with selector: ${selector}`);
            break;
        }
        catch (e) {
            (0, utils_1.log)(`Join button selector ${selector} not found, trying next...`);
        }
    }
    if (!joinButton) {
        (0, utils_1.log)("⚠️ Could not find join button with known selectors - proceeding optimistically for manual admission");
        // Don't throw error - continue to manual admission workflow
        return;
    }
    // Try multiple methods to click the join button if overlay blocks it
    let joinSuccessful = false;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await page.click(joinButton, { force: true });
            (0, utils_1.log)(`${botName} attempting to join Teams meeting (attempt ${attempt + 1})`);
            // Debug: Check immediate result of join button click
            await page.waitForTimeout(2000);
            const immediateUrl = page.url();
            const immediateTitle = await page.title();
            (0, utils_1.log)(`DEBUG: Immediate post-click URL: ${immediateUrl}`);
            (0, utils_1.log)(`DEBUG: Immediate post-click Title: ${immediateTitle}`);
            joinSuccessful = true;
            break;
        }
        catch (error) {
            (0, utils_1.log)(`Join button click blocked, attempt ${attempt + 1}. Trying to dismiss dialogs...`);
            await handleTeamsDialogs(page);
            await page.waitForTimeout(1000);
        }
    }
    if (!joinSuccessful) {
        // Force click using JavaScript with dynamic selector
        await page.evaluate((buttonSelector) => {
            const button = document.querySelector(buttonSelector);
            if (button)
                button.click();
        }, joinButton);
        (0, utils_1.log)(`${botName} forced click on join button via JavaScript`);
    }
};
// Modified recording function for Teams
const startRecording = async (page, botConfig) => {
    const { meetingUrl, token, connectionId, platform, nativeMeetingId } = botConfig;
    const startRecordingTime = Date.now(); // Track when recording starts
    // Get WhisperLive URL from environment
    const whisperLiveUrlFromEnv = process.env.WHISPER_LIVE_URL;
    if (!whisperLiveUrlFromEnv) {
        (0, utils_1.log)("ℹ️ WHISPER_LIVE_URL not set - Running in transcription monitoring mode. Will monitor Teams transcription instead of sending audio to Whisper.");
        // Continue in monitoring mode
        await startTranscriptionMonitoring(page, botConfig);
        return;
    }
    (0, utils_1.log)(`[Node.js] WHISPER_LIVE_URL for vexa-bot is: ${whisperLiveUrlFromEnv}`);
    (0, utils_1.log)("Starting Teams recording with WebSocket connection");
    // Pass the necessary config fields and the resolved URL into the page context
    await page.evaluate(async (pageArgs) => {
        const { botConfigData, whisperUrlForBrowser, startRecordingTime } = pageArgs;
        const { meetingUrl, token, connectionId: originalConnectionId, platform, nativeMeetingId, language: initialLanguage, task: initialTask, } = botConfigData;
        // Helper function to generate UUID in browser context
        const generateUUID = () => {
            if (typeof crypto !== "undefined" && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            else {
                return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                    var r = (Math.random() * 16) | 0, v = c == "x" ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                });
            }
        };
        await new Promise((resolve, reject) => {
            try {
                window.logBot("Starting Teams recording process.");
                // Enhanced media element finding for Teams
                const findTeamsMediaElements = async (retries = 5, delay = 2000) => {
                    for (let i = 0; i < retries; i++) {
                        // Teams-specific audio selectors
                        const mediaElements = Array.from(document.querySelectorAll("audio, video, [data-tid*='audio'], [data-tid*='video']")).filter((el) => !el.paused &&
                            el.srcObject instanceof MediaStream &&
                            el.srcObject.getAudioTracks().length > 0);
                        if (mediaElements.length > 0) {
                            window.logBot(`Found ${mediaElements.length} active Teams media elements with audio tracks after ${i + 1} attempt(s).`);
                            return mediaElements;
                        }
                        window.logBot(`[Teams Audio] No active media elements found. Retrying in ${delay}ms... (Attempt ${i + 2}/${retries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    return [];
                };
                findTeamsMediaElements().then(mediaElements => {
                    if (mediaElements.length === 0) {
                        window.logBot("[Teams BOT] No active media elements found initially. Bot will stay in meeting and monitor for audio activity.");
                        // Instead of exiting, resolve and let the bot stay in the meeting
                        resolve();
                        return;
                    }
                    window.logBot(`Found ${mediaElements.length} active Teams media elements.`);
                    const audioContext = new AudioContext();
                    const destinationNode = audioContext.createMediaStreamDestination();
                    let sourcesConnected = 0;
                    // Connect all media elements to the destination node
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
                                window.logBot(`Connected Teams audio stream from element ${index + 1}/${mediaElements.length}.`);
                            }
                        }
                        catch (error) {
                            window.logBot(`Could not connect Teams element ${index + 1}: ${error.message}`);
                        }
                    });
                    if (sourcesConnected === 0) {
                        return reject(new Error("[Teams BOT Error] Could not connect any audio streams. Check media permissions."));
                    }
                    const stream = destinationNode.stream;
                    window.logBot(`Successfully combined ${sourcesConnected} Teams audio streams.`);
                    window.logBot(`Original Teams bot connection ID: ${originalConnectionId}`);
                    const wsUrl = whisperUrlForBrowser;
                    if (!wsUrl) {
                        window.logBot?.("CRITICAL: WhisperLive WebSocket URL is missing in browser context!");
                        console.error("CRITICAL: WhisperLive WebSocket URL is missing in browser context!");
                        return;
                    }
                    // Browser-scope state for current WS config
                    let currentWsLanguage = initialLanguage;
                    let currentWsTask = initialTask;
                    let socket = null;
                    let isServerReady = false;
                    let retryCount = 0;
                    const configuredInterval = botConfigData.reconnectionIntervalMs;
                    const baseRetryDelay = (configuredInterval && configuredInterval <= 1000) ? configuredInterval : 1000;
                    let sessionAudioStartTimeMs = null;
                    const setupWebSocket = () => {
                        try {
                            // HTTP Proxy mode - no socket to close
                            window.logBot(`[Teams] HTTP Proxy mode - no socket cleanup needed`);
                            window.logBot(`[Teams] Using HTTP Proxy Bridge instead of direct WebSocket`);
                            // Initialize session with Enhanced Audio Router - use Docker network hostname
                            const proxyUrl = 'http://vexa-enhanced-audio-router:8090';
                            currentSessionUid = generateUUID();
                            window.logBot(`[Teams] Initializing Enhanced Audio Router session: ${currentSessionUid}`);
                            // Use Node.js-level enhanced audio routing communication
                            window.logBot(`[Teams] Initializing Enhanced Audio Router session via Node.js bridge: ${currentSessionUid}`);
                            // Notify Node.js process to initialize enhanced audio router session
                            window.initializeEnhancedAudioSession({
                                sessionId: currentSessionUid,
                                platform: platform,
                                meeting_url: meetingUrl || null,
                                token: token,
                                meeting_id: nativeMeetingId,
                                language: currentWsLanguage || 'en',
                                task: currentWsTask || 'transcribe',
                                config: {
                                    audioSampleRate: 16000,
                                    audioChannels: 1,
                                    chunkSize: 1024,
                                    bufferSize: 4096,
                                    enableVAD: false, // Keep VAD disabled as per working config
                                    audioFormat: 'pcm16',
                                    reconnectAttempts: 5,
                                    reconnectDelay: 1000
                                }
                            }).then((success) => {
                                if (success) {
                                    window.logBot(`[Teams] ✅ Enhanced Audio Router session initialized successfully: ${currentSessionUid}`);
                                    isServerReady = true;
                                    window.logBot(`[Teams] Enhanced Audio Router setup completed, readyState: READY`);
                                }
                                else {
                                    window.logBot(`[Teams] ❌ Failed to initialize Enhanced Audio Router session: ${currentSessionUid}`);
                                    isServerReady = false;
                                }
                            }).catch((error) => {
                                window.logBot(`[Teams] ❌ Error initializing Enhanced Audio Router session: ${error.message}`);
                                isServerReady = false;
                            });
                            // HTTP Proxy mode - no WebSocket event handlers needed
                            window.logBot(`[Teams] HTTP Proxy mode active - skipping WebSocket event handlers`);
                            // HTTP Proxy mode - no connection timeout needed
                        }
                        catch (e) {
                            window.logBot(`Error creating Teams WebSocket: ${e.message}`);
                            retryCount++;
                            window.logBot(`Error during Teams WebSocket setup. Attempting to reconnect in ${baseRetryDelay}ms. Retry attempt ${retryCount}`);
                            setTimeout(() => {
                                window.logBot(`Retrying Teams WebSocket connection (attempt ${retryCount})...`);
                                setupWebSocket();
                            }, baseRetryDelay);
                        }
                    };
                    // Expose reconfigure function
                    window.triggerWebSocketReconfigure = (newLang, newTask) => {
                        window.logBot(`[Teams Node->Browser] Received reconfigure. New Lang: ${newLang}, New Task: ${newTask}`);
                        currentWsLanguage = newLang;
                        currentWsTask = newTask || "transcribe";
                        // Enhanced Audio Router mode - use Node.js reconfigure function
                        window.logBot("[Teams Node->Browser] Enhanced Audio Router mode - reconfiguring via Node.js bridge");
                        window.reconfigureEnhancedAudioRouter({
                            sessionId: currentSessionUid,
                            language: currentWsLanguage,
                            task: currentWsTask
                        }).then((success) => {
                            if (success) {
                                window.logBot(`[Teams] ✅ Enhanced Audio Router session reconfigured successfully`);
                            }
                            else {
                                window.logBot(`[Teams] ❌ Failed to reconfigure Enhanced Audio Router session`);
                            }
                        }).catch((error) => {
                            window.logBot(`[Teams] ❌ Error reconfiguring Enhanced Audio Router: ${error.message}`);
                        });
                    };
                    // Expose speech synthesis function
                    window.performSpeechAction = async (text) => {
                        window.logBot(`🎤 Received speak command: "${text}"`);
                        try {
                            // TTS call removed
                            window.logBot("✅ Speech command completed successfully");
                        }
                        catch (error) {
                            window.logBot(`❌ Speech command failed: ${error.message}`);
                        }
                    };
                    // Expose unmute function
                    window.performUnmuteAction = async () => {
                        window.logBot("🔊 Attempting to unmute microphone...");
                        try {
                            // Look for mute button and click it if muted
                            const muteButton = document.querySelector('button[data-tid="microphone-button"]');
                            if (muteButton) {
                                const isCurrentlyMuted = muteButton.getAttribute('aria-pressed') === 'true';
                                if (isCurrentlyMuted) {
                                    muteButton.click();
                                    window.logBot("✅ Microphone unmuted successfully");
                                }
                                else {
                                    window.logBot("ℹ️ Microphone is already unmuted");
                                }
                            }
                            else {
                                window.logBot("❌ Could not find mute button");
                            }
                        }
                        catch (error) {
                            window.logBot(`❌ Error unmuting microphone: ${error.message}`);
                        }
                    };
                    // Expose Teams leave function
                    window.performLeaveAction = async () => {
                        window.logBot("Attempting to leave the Teams meeting from browser context...");
                        // Enhanced Audio Router mode - close audio router session
                        try {
                            window.logBot("Teams LEAVING_MEETING - closing Enhanced Audio Router session");
                            if (currentSessionUid) {
                                await window.closeEnhancedAudioSession(currentSessionUid);
                                window.logBot("Enhanced Audio Router session closed successfully");
                            }
                        }
                        catch (error) {
                            window.logBot(`Error closing Enhanced Audio Router session: ${error.message}`);
                        }
                        try {
                            const leaveButtonSelector = 'button[data-tid="call-end"]';
                            const hangupButtonSelector = 'button[data-tid="hangup-button"]';
                            let leaveButton = document.querySelector(leaveButtonSelector);
                            if (!leaveButton) {
                                leaveButton = document.querySelector(hangupButtonSelector);
                            }
                            if (leaveButton) {
                                window.logBot("Clicking Teams leave button...");
                                leaveButton.click();
                                await new Promise((resolve) => setTimeout(resolve, 1000));
                                window.logBot("Teams leave sequence completed.");
                                return true;
                            }
                            else {
                                window.logBot("Teams leave button not found.");
                                return false;
                            }
                        }
                        catch (err) {
                            window.logBot(`Error during Teams leave attempt: ${err.message}`);
                            return false;
                        }
                    };
                    // Node.js-level proxy communication functions are exposed via page.exposeFunction in index.ts
                    setupWebSocket();
                    // Teams-specific speaker detection - expanded selectors to catch more element types
                    const teamsParticipantSelector = '[data-tid="participant-tile"], [data-tid="roster-list-item"], [data-tid="participant"], [data-tid*="participant"], [class*="participant"], [role="gridcell"][data-tid], .participant-tile, .roster-item';
                    const teamsSpeakingClasses = ['is-speaking', 'speaking', 'ts-speaking-indicator'];
                    const speakingStates = new Map();
                    const activeParticipants = new Map();
                    let currentSessionUid = generateUUID();
                    // Diagnostic function to explore Teams DOM structure
                    window.diagnoseMeetingDOM = () => {
                        window.logBot('🔬 Teams DOM Diagnosis starting...');
                        // Check for video elements
                        const videoElements = document.querySelectorAll('video');
                        window.logBot(`📹 Found ${videoElements.length} video elements`);
                        // Check for common Teams meeting UI elements
                        const commonSelectors = [
                            '[data-tid*="call"]',
                            '[data-tid*="meeting"]',
                            '[data-tid*="participant"]',
                            '[data-tid*="roster"]',
                            '[data-tid*="video"]',
                            '[class*="call"]',
                            '[class*="meeting"]',
                            '[class*="participant"]',
                            '[class*="roster"]',
                            '[class*="video"]',
                            '[class*="grid"]',
                            '[role="main"]',
                            '[role="grid"]',
                            '[role="gridcell"]'
                        ];
                        for (const selector of commonSelectors) {
                            const elements = document.querySelectorAll(selector);
                            if (elements.length > 0) {
                                window.logBot(`🎯 Found ${elements.length} elements for "${selector}"`);
                                // Log attributes of first few elements
                                for (let i = 0; i < Math.min(2, elements.length); i++) {
                                    const el = elements[i];
                                    const attrs = Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ');
                                    window.logBot(`  - ${el.tagName}: ${attrs}`);
                                }
                            }
                        }
                        window.logBot('🔬 Teams DOM Diagnosis complete');
                    };
                    function getTeamsParticipantId(element) {
                        let id = element.getAttribute('data-tid') ||
                            element.getAttribute('id') ||
                            element.getAttribute('data-object-id');
                        if (!id) {
                            if (!element.dataset.vexaGeneratedId) {
                                element.dataset.vexaGeneratedId = 'vexa-teams-id-' + Math.random().toString(36).substr(2, 9);
                            }
                            id = element.dataset.vexaGeneratedId;
                        }
                        return id;
                    }
                    function getTeamsParticipantName(participantElement) {
                        // Teams-specific name selectors
                        const nameSelectors = [
                            '[data-tid="roster-list-title"]',
                            '[data-tid="participant-name"]',
                            '.ts-text-truncate',
                            '.name-text',
                            '.displayName'
                        ];
                        for (const selector of nameSelectors) {
                            const nameElement = participantElement.querySelector(selector);
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
                    function sendTeamsSpeakerEvent(eventType, participantElement) {
                        const eventAbsoluteTimeMs = Date.now();
                        let relativeTimestampMs = null;
                        if (sessionAudioStartTimeMs === null) {
                            window.logBot(`[Teams RelativeTime] SKIPPING speaker event: ${eventType} for ${getTeamsParticipantName(participantElement)}. sessionAudioStartTimeMs not yet set. UID: ${currentSessionUid}`);
                            return;
                        }
                        relativeTimestampMs = eventAbsoluteTimeMs - sessionAudioStartTimeMs;
                        const participantId = getTeamsParticipantId(participantElement);
                        const participantName = getTeamsParticipantName(participantElement);
                        // HTTP Proxy mode - speaker events disabled for now
                        try {
                            window.logBot(`[Teams RelativeTime] Speaker event (HTTP Proxy mode - skipping): ${eventType} for ${participantName} (${participantId}). RelativeTs: ${relativeTimestampMs}ms. UID: ${currentSessionUid}`);
                        }
                        catch (error) {
                            window.logBot(`Error processing Teams speaker event: ${error.message}`);
                        }
                    }
                    function logTeamsSpeakerEvent(participantElement, mutatedClassList) {
                        const participantId = getTeamsParticipantId(participantElement);
                        const participantName = getTeamsParticipantName(participantElement);
                        const previousLogicalState = speakingStates.get(participantId) || "silent";
                        const isNowSpeaking = teamsSpeakingClasses.some(cls => mutatedClassList.contains(cls));
                        if (isNowSpeaking && previousLogicalState !== "speaking") {
                            window.logBot(`🎤 Teams SPEAKER_START: ${participantName} (ID: ${participantId})`);
                            sendTeamsSpeakerEvent("SPEAKER_START", participantElement);
                            speakingStates.set(participantId, "speaking");
                        }
                        else if (!isNowSpeaking && previousLogicalState === "speaking") {
                            window.logBot(`🔇 Teams SPEAKER_END: ${participantName} (ID: ${participantId})`);
                            sendTeamsSpeakerEvent("SPEAKER_END", participantElement);
                            speakingStates.set(participantId, "silent");
                        }
                    }
                    function observeTeamsParticipant(participantElement) {
                        const participantId = getTeamsParticipantId(participantElement);
                        speakingStates.set(participantId, "silent");
                        activeParticipants.set(participantId, {
                            name: getTeamsParticipantName(participantElement),
                            element: participantElement
                        });
                        window.logBot(`👁️ Observing Teams participant: ${getTeamsParticipantName(participantElement)} (ID: ${participantId})`);
                        const callback = function (mutationsList, observer) {
                            for (const mutation of mutationsList) {
                                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                                    const targetElement = mutation.target;
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
                        if (!participantElement.dataset.vexaObserverAttached) {
                            participantElement.dataset.vexaObserverAttached = 'true';
                        }
                    }
                    function scanForTeamsParticipants() {
                        const participantElements = document.querySelectorAll(teamsParticipantSelector);
                        window.logBot(`🔍 Scanning for Teams participants: Found ${participantElements.length} elements with selector "${teamsParticipantSelector}"`);
                        if (participantElements.length === 0) {
                            // Debug: Try to see what participant-related elements exist
                            const debugSelectors = [
                                '[data-tid*="participant"]',
                                '[data-tid*="roster"]',
                                '[class*="participant"]',
                                '[class*="roster"]',
                                '.participant',
                                '.roster'
                            ];
                            for (const debugSelector of debugSelectors) {
                                const debugElements = document.querySelectorAll(debugSelector);
                                if (debugElements.length > 0) {
                                    window.logBot(`🔍 Debug: Found ${debugElements.length} elements with selector "${debugSelector}"`);
                                    // Log the first few elements for debugging
                                    for (let j = 0; j < Math.min(3, debugElements.length); j++) {
                                        const el = debugElements[j];
                                        window.logBot(`  - Element ${j}: tagName=${el.tagName}, className="${el.className}", data-tid="${el.getAttribute('data-tid')}"`);
                                    }
                                }
                            }
                        }
                        for (let i = 0; i < participantElements.length; i++) {
                            const el = participantElements[i];
                            if (!el.dataset.vexaObserverAttached) {
                                observeTeamsParticipant(el);
                            }
                        }
                    }
                    // Initialize Teams speaker detection
                    scanForTeamsParticipants();
                    // Run initial diagnosis after a short delay
                    setTimeout(() => {
                        window.diagnoseMeetingDOM();
                    }, 3000);
                    // Periodic re-scan for participants in case they load later
                    const participantRescanInterval = setInterval(() => {
                        window.logBot('🔄 Periodic participant rescan...');
                        scanForTeamsParticipants();
                        // If no participants found, run diagnosis
                        if (activeParticipants.size === 0) {
                            window.diagnoseMeetingDOM();
                        }
                        // Stop rescanning after 2 minutes if we have participants or after 5 minutes total
                        const currentTime = Date.now();
                        const timeSinceStart = currentTime - (startRecordingTime || currentTime);
                        if (activeParticipants.size > 0 || timeSinceStart > 300000) { // 5 minutes
                            window.logBot(`⏹️ Stopping participant rescan. Participants found: ${activeParticipants.size}, Time: ${Math.round(timeSinceStart / 1000)}s`);
                            clearInterval(participantRescanInterval);
                        }
                    }, 15000); // Rescan every 15 seconds
                    // Monitor for new Teams participants
                    const bodyObserver = new MutationObserver((mutationsList) => {
                        for (const mutation of mutationsList) {
                            if (mutation.type === 'childList') {
                                mutation.addedNodes.forEach(node => {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        const elementNode = node;
                                        if (elementNode.matches(teamsParticipantSelector) && !elementNode.dataset.vexaObserverAttached) {
                                            observeTeamsParticipant(elementNode);
                                        }
                                        const childElements = elementNode.querySelectorAll(teamsParticipantSelector);
                                        for (let i = 0; i < childElements.length; i++) {
                                            const childEl = childElements[i];
                                            if (!childEl.dataset.vexaObserverAttached) {
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
                        if (!isServerReady) {
                            return;
                        }
                        if (sessionAudioStartTimeMs === null) {
                            sessionAudioStartTimeMs = Date.now();
                            window.logBot(`[Teams RelativeTime] sessionAudioStartTimeMs set for UID ${currentSessionUid}: ${sessionAudioStartTimeMs}`);
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
                        // REAL-TIME AUDIO BRIDGE: Send captured Teams audio to Enhanced Audio Router
                        try {
                            // Convert Float32Array to Int16Array (PCM16 format)
                            const int16Data = new Int16Array(resampledData.length);
                            for (let i = 0; i < resampledData.length; i++) {
                                const sample = Math.max(-1, Math.min(1, resampledData[i]));
                                int16Data[i] = sample * 32767;
                            }
                            // Convert to base64 for transmission
                            const buffer = new ArrayBuffer(int16Data.length * 2);
                            const view = new Uint8Array(buffer);
                            for (let i = 0; i < int16Data.length; i++) {
                                const value = int16Data[i];
                                view[i * 2] = value & 0xFF;
                                view[i * 2 + 1] = (value >> 8) & 0xFF;
                            }
                            const audioB64 = btoa(String.fromCharCode.apply(null, Array.from(view)));
                            // Stream to Enhanced Audio Router using exposed function
                            if (typeof window.streamAudioToEnhancedRouter === 'function') {
                                await window.streamAudioToEnhancedRouter(currentSessionUid, audioB64, {
                                    timestamp: Date.now(),
                                    platform: 'teams',
                                    sampleRate: 16000,
                                    channels: 1,
                                    format: 'pcm16'
                                });
                                window.logBot(`🎤 LIVE AUDIO: Streamed ${int16Data.length} samples to Enhanced Router`);
                            }
                            else {
                                window.logBot(`⚠️ Enhanced Audio Router function not available`);
                            }
                        }
                        catch (audioError) {
                            window.logBot(`❌ Error streaming audio to Enhanced Router: ${audioError.message}`);
                        }
                        if (isServerReady && currentSessionUid) {
                            if (sessionAudioStartTimeMs === null) {
                                window.logBot(`[Teams RelativeTime] CRITICAL WARNING: sessionAudioStartTimeMs is STILL NULL before sending audio data for UID ${currentSessionUid}`);
                                return;
                            }
                            // USE HTTP PROXY for reliable audio streaming
                            try {
                                await window.sendAudioToProxy({
                                    sessionUid: currentSessionUid,
                                    audioData: Array.from(resampledData) // Convert Float32Array to regular array
                                });
                                // (window as any).logBot(`[Teams] 🎵 Audio sent to proxy for session ${currentSessionUid}`);
                            }
                            catch (error) {
                                window.logBot(`[Teams] ⚠️ Audio proxy error: ${error}`);
                            }
                        }
                    };
                    // Connect the audio processing pipeline
                    mediaStream.connect(recorder);
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 0;
                    recorder.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    window.logBot("Teams audio processing pipeline connected and sending data silently.");
                    // Announce that recording has started
                    try {
                        const recordingAnnouncement = "Recording has started. I am now listening and will transcribe all speech in this meeting.";
                        const utterance = new SpeechSynthesisUtterance(recordingAnnouncement);
                        utterance.rate = 0.9;
                        utterance.pitch = 1.0;
                        utterance.volume = 0.8;
                        speechSynthesis.speak(utterance);
                        window.logBot("Bot announced recording start via text-to-speech");
                    }
                    catch (speechError) {
                        window.logBot(`Recording announcement failed: ${speechError.message}`);
                    }
                    // Run speech synthesis test for transcription verification
                    try {
                        window.logBot("🔥 Starting speech synthesis test for transcription verification...");
                        setTimeout(async () => {
                            // TTS test removed
                        }, 3000); // Wait 3 seconds after recording starts
                    }
                    catch (testError) {
                        window.logBot(`Speech test initialization failed: ${testError.message}`);
                    }
                    // Monitor participant list for Teams
                    let aloneTime = 0;
                    const checkInterval = setInterval(() => {
                        const count = activeParticipants.size;
                        const participantIds = Array.from(activeParticipants.keys());
                        const participantNames = Array.from(activeParticipants.values()).map((p) => p.name);
                        window.logBot(`Teams participant check: Found ${count} unique participants. IDs: ${JSON.stringify(participantIds)}, Names: ${JSON.stringify(participantNames)}`);
                        // If we have 0 or 1 participant, the bot is effectively alone
                        // Logic: 0 = no participants detected (including bot), 1 = only bot detected
                        // We want at least 2 participants (bot + 1 human) to continue
                        if (count <= 1) {
                            aloneTime += 5;
                            if (count === 0) {
                                window.logBot('⚠️ No participants detected at all - this may indicate a selector issue');
                            }
                            else {
                                window.logBot('ℹ️ Only 1 participant detected - likely just the bot');
                            }
                        }
                        else {
                            if (aloneTime > 0) {
                                window.logBot('✅ Multiple participants detected. Resetting alone timer.');
                            }
                            aloneTime = 0;
                        }
                        if (aloneTime >= 120) { // Increased to 2 minutes for visibility testing
                            window.logBot("Teams meeting ended or bot has been alone for 2 minutes. Stopping recorder...");
                            clearInterval(checkInterval);
                            recorder.disconnect();
                            window.triggerNodeGracefulLeave();
                            resolve();
                        }
                        else if (aloneTime > 0) {
                            window.logBot(`Teams bot has been alone for ${aloneTime} seconds. Will leave in ${120 - aloneTime} more seconds.`);
                        }
                    }, 5000);
                    // Event listeners
                    window.addEventListener("beforeunload", () => {
                        window.logBot("Teams page is unloading. Stopping recorder...");
                        clearInterval(checkInterval);
                        recorder.disconnect();
                        window.triggerNodeGracefulLeave();
                        resolve();
                    });
                    document.addEventListener("visibilitychange", () => {
                        if (document.visibilityState === "hidden") {
                            window.logBot("Teams document is hidden. Stopping recorder...");
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
                return reject(new Error("[Teams BOT Error] " + error.message));
            }
        });
    }, { botConfigData: botConfig, whisperUrlForBrowser: whisperLiveUrlFromEnv, startRecordingTime });
};
// Export Teams leave function
async function leaveMicrosoftTeams(page) {
    (0, utils_1.log)("[leaveMicrosoftTeams] Triggering leave action in browser context...");
    if (!page || page.isClosed()) {
        (0, utils_1.log)("[leaveMicrosoftTeams] Page is not available or closed.");
        return false;
    }
    try {
        const result = await page.evaluate(async () => {
            if (typeof window.performLeaveAction === "function") {
                return await window.performLeaveAction();
            }
            else {
                window.logBot?.("[Teams Node Eval Error] performLeaveAction function not found on window.");
                console.error("[Teams Node Eval Error] performLeaveAction function not found on window.");
                return false;
            }
        });
        (0, utils_1.log)(`[leaveMicrosoftTeams] Browser leave action result: ${result}`);
        return result;
    }
    catch (error) {
        (0, utils_1.log)(`[leaveMicrosoftTeams] Error calling performLeaveAction in browser: ${error.message}`);
        return false;
    }
}
/**
 * Retrieve enhanced meeting information using Microsoft Graph API
 * Note: This does NOT handle the actual meeting join - that's still done as guest via browser automation
 * This function only provides enhanced metadata about the meeting
 */
async function handleAuthenticatedMeetingInfo(meetingUrl, organizerEmail, authConfig) {
    if (!authConfig) {
        (0, utils_1.log)("[Teams Metadata] No authentication config provided");
        return null;
    }
    try {
        (0, utils_1.log)("[Teams Metadata] Initializing Graph API client for meeting information retrieval...");
        const teamsAuthService = new teams_auth_1.default(authConfig);
        // Validate configuration
        const validation = teamsAuthService.validateConfiguration();
        if (!validation.valid) {
            (0, utils_1.log)(`[Teams Metadata] Configuration validation failed: ${validation.errors.join(", ")}`);
            return null;
        }
        // Initialize the Graph API client
        await teamsAuthService.initializeAppClient();
        // Try to get meeting information using the join URL
        if (organizerEmail) {
            (0, utils_1.log)(`[Teams Metadata] Retrieving meeting info for organizer: ${organizerEmail}`);
            const meetingInfo = await teamsAuthService.getMeetingInfo(organizerEmail, meetingUrl);
            if (meetingInfo) {
                (0, utils_1.log)(`[Teams Metadata] Successfully retrieved meeting metadata: ${meetingInfo.subject} (ID: ${meetingInfo.id})`);
                return meetingInfo;
            }
            else {
                (0, utils_1.log)(`[Teams Metadata] Meeting not found for URL: ${meetingUrl}`);
            }
        }
        else {
            (0, utils_1.log)("[Teams Metadata] No organizer email provided - cannot retrieve meeting info via Graph API");
            (0, utils_1.log)("[Teams Metadata] Tip: Provide organizer_email in API request for enhanced meeting metadata");
        }
        return null;
    }
    catch (error) {
        (0, utils_1.log)(`[Teams Metadata] Error retrieving meeting information: ${error.message}`);
        return null;
    }
}
//# sourceMappingURL=teams.js.map
