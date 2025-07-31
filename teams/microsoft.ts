import { Page } from 'playwright';
import { log, randomDelay } from '../utils';
import { BotConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Converts an original Teams URL to a special format for joining the meeting
 * Based on the generate_new_url function from util.py
 */
function generateTeamsUrl(originalUrl: string): string {
  try {
    // Parse the original URL
    const url = new URL(originalUrl);
    const path = url.pathname;
    
    // Create new path with prefix
    const newPath = `/v2/?meetingjoin=true#${path}`;
    
    // Add additional parameters to existing query string
    url.searchParams.append('anon', 'true');
    url.searchParams.append('deeplinkId', uuidv4());
    
    // Build the new URL
    const newUrl = new URL(`https://teams.microsoft.com${newPath}${url.search}`);
    
    log(`Transformed URL: ${newUrl.toString()}`);
    return newUrl.toString();
  } catch (error: any) {
    log(`Error generating URL: ${error.message}`);
    return originalUrl; // Return original URL in case of error
  }
}

export async function handleMicrosoftTeams(botConfig: BotConfig, page: Page): Promise<void> {
  const leaveButton = `//button[@aria-label='Leave (Ctrl+Shift+H)']`;

  if (!botConfig.meetingUrl) {
    log('Error: Meeting URL required for Microsoft Teams but is null.');
    return;
  }

  log('Joining Microsoft Teams');
  try {
    await joinMeeting(page, botConfig.meetingUrl, botConfig.botName);
  } catch (error: any) {
    console.error(error.message);
    return;
  }

  // Setup websocket connection and meeting admission concurrently
  log("Starting WebSocket connection while waiting for meeting admission");
  try {
    // Run both processes concurrently
    const [isAdmitted] = await Promise.all([
      // Wait for admission to the meeting
      waitForMeetingAdmission(page, leaveButton, botConfig.automaticLeave.waitingRoomTimeout)
        .catch(error => {
          log("Meeting admission failed: " + error.message);
          return false;
        }),
      
      // Prepare for recording (expose functions, etc.) while waiting for admission
      prepareForRecording(page)
    ]);

    if (!isAdmitted) {
      console.error("Bot was not admitted to the meeting");
      return;
    }

    log("Successfully admitted to the meeting, starting recording");
    await startRecording(page, botConfig);
  } catch (error: any) {
    console.error(error.message);
    return;
  }
}

// Function to wait for meeting admission
const waitForMeetingAdmission = async (page: Page, leaveButton: string, timeout: number): Promise<boolean> => {
  try {
    // Based on recording_process.py, we wait for the "myself-video" element
    // make a screenshot
    await page.screenshot({ path: 'page1.png' });
    // wait for 10 seconds
    await page.waitForTimeout(10000);
    // save content to html file
    await page.screenshot({ path: 'page2.png' });
    await page.waitForSelector('div[data-tid="myself-video"]', { timeout: 10000 });
    await page.screenshot({ path: 'page3.png' });
    await page.waitForSelector('div[data-tid="myself-video"]', { timeout: 10000 });
    await page.screenshot({ path: 'page4.png' });
    log("Successfully admitted to the meeting");
    return true;
  } catch {
    throw new Error("Bot was not admitted to the meeting within the timeout period");
  }
};

// Prepare recording by exposing necessary functions
const prepareForRecording = async (page: Page): Promise<void> => {
  // Expose logBot function to browser context
  await page.exposeFunction('logBot', (msg: string) => {
    log(msg);
  });
};

const joinMeeting = async (page: Page, meetingUrl: string, botName: string) => {
  // Selectors based on recording_process.py
  const continueButton = 'button[class*="fui-Button"]';
  const nameField = 'input[data-tid="prejoin-display-name-input"]';
  const joinButton = '#prejoin-join-button';

  // Alternative approach for navigation
  log("Using original URL instead of transformed URL");
  
  try {
    // First try with original URL
    await page.goto(meetingUrl, { 
      waitUntil: "domcontentloaded",
      timeout: 60000 
    });
    // make a screenshot
    await page.screenshot({ path: 'gotoMeetingLink.png' });

    // Check if we are on the name entry page (direct modern Teams)
    const isOnNameEntryPage = await page.$(nameField).then(Boolean).catch(() => false);
    
    if (isOnNameEntryPage) {
      log("Original URL successfully loaded the entry page directly");
    } else {
      // If we don't find the name field, try with transformed URL
      const transformedUrl = generateTeamsUrl(meetingUrl);
      log(`Original URL: ${meetingUrl}`);
      log(`Trying with transformed URL: ${transformedUrl}`);
      
      // Load transformed URL with longer timeout and DOM content loading wait
      await page.goto(transformedUrl, { 
        waitUntil: "domcontentloaded", 
        timeout: 60000
      });
      await page.screenshot({ path: 'gotoMeetingLink2.png' });
      
      // Wait for page to load sufficiently (alternative approach to networkidle)
      log("Page loaded, additional wait for stabilization...");
      await page.waitForTimeout(8000); // Fixed wait of 8 seconds
      await page.screenshot({ path: 'gotoMeetingLink3.png' });
    }
    
    // Use element detection instead of relying on networkidle
    await page.bringToFront();
    
    // Search for continue button with multiple attempts
    log("Looking for 'Continue without audio or video' button...");
    const continueButtonSelector = [
      'button[class*="fui-Button"]',
      'button[data-tid="prejoin-join-button"]', 
      'button:has-text("Continue")', 
      'button:has-text("Continue")' // Try in English too
    ];
    
    let buttonFound = false;
    for (const selector of continueButtonSelector) {
      try {
        const isVisible = await page.waitForSelector(selector, { 
          timeout: 10000,
          state: 'visible'
        }).then(() => true).catch(() => false);
        
        if (isVisible) {
          log(`Button found with selector: ${selector}`);
          await page.click(selector);
          buttonFound = true;
          log("'Continue without audio or video' button clicked.");
          break;
        }
      } catch (error) {
        log(`Selector ${selector} not found.`);
      }
    }
    await page.screenshot({ path: 'gotoMeetingLink4.png' });
    if (!buttonFound) {
      log("No 'Continue' button found, attempting to proceed with name entry");
    }
    
    // Wait a bit before looking for name field
    await page.waitForTimeout(2000);
    
    // Search for name field with multiple attempts
    log("Looking for name entry field...");
    const nameFieldSelector = [
      'input[data-tid="prejoin-display-name-input"]',
      'input[placeholder*="name"]',
      'input[placeholder*="name"]'
    ];
    
    let nameFieldFound = false;
    for (const selector of nameFieldSelector) {
      try {
        const isVisible = await page.waitForSelector(selector, { 
          timeout: 10000,
          state: 'visible'
        }).then(() => true).catch(() => false);
        
        if (isVisible) {
          log(`Name field found with selector: ${selector}`);
          await page.fill(selector, botName);
          
          // Verify name was entered correctly
          const enteredText = await page.$eval(selector, el => (el as HTMLInputElement).value)
                              .catch(() => "");
            
          if (enteredText !== botName) {
            await page.fill(selector, botName);
          }
          
          nameFieldFound = true;
          log(`Name entered: ${botName}`);
          break;
        }
      } catch (error) {
        log(`Field selector ${selector} not found.`);
      }
    }
    
    if (!nameFieldFound) {
      log("WARNING: Name field not found, attempting to continue anyway");
    }
    
    // Search for Join button with multiple attempts
    log("Looking for 'Join now' button...");
    const joinButtonSelector = [
      '#prejoin-join-button',
      'button[data-tid="prejoin-join-button"]',
      'button:has-text("Join")',
      'button:has-text("Join")',  // Try in English too
      'button.join-btn'
    ];
    await page.screenshot({ path: 'gotoMeetingLink5.png' });
    let joinButtonFound = false;
    for (const selector of joinButtonSelector) {
      try {
        const isVisible = await page.waitForSelector(selector, { 
          timeout: 10000,
          state: 'visible' 
        }).then(() => true).catch(() => false);
        
        if (isVisible) {
          log(`Join button found with selector: ${selector}`);
          await page.click(selector);
          joinButtonFound = true;
          log(`${botName} has joined the meeting.`);
          break;
        }
      } catch (error) {
        log(`Button selector ${selector} not found.`);
      }
    }
    
    if (!joinButtonFound) {
      throw new Error("Could not find button to join the meeting");
    }
    
  } catch (error: any) {
    log(`Error while attempting to join meeting: ${error.message}`);
    throw error;
  }
}

// Function to start recording
const startRecording = async (page: Page, botConfig: BotConfig) => {
  // Extract necessary fields from botConfig
  const { meetingUrl, token, connectionId, platform, nativeMeetingId } = botConfig;

  log("Starting recording with WebSocket connection");

  // Pass necessary configuration fields to page context
  await page.evaluate(async (config: BotConfig) => {
    const { meetingUrl, token, connectionId, platform, nativeMeetingId } = config;

    const option = {
      language: null,
      task: "transcribe",
      modelSize: "medium",
      useVad: true,
    };

    await new Promise<void>((resolve, reject) => {
      try {
        (window as any).logBot("Starting recording process.");
        
        // Improved method to find media elements in Teams
        // Teams elements may have specific attributes or be in different structures
        const findMediaElements = () => {
          // Search for all audio and video elements
          const standardMedia = Array.from(document.querySelectorAll("audio, video"));
          (window as any).logBot(`Standard media elements found: ${standardMedia.length}`);
          
          // Also search for Teams-specific elements that may contain audio streams
          const teamsMediaContainers = Array.from(document.querySelectorAll('[data-tid*="video"], [data-tid*="audio"], .video-element, .ts-video-container'));
          (window as any).logBot(`Teams media containers found: ${teamsMediaContainers.length}`);
          
          // Explore iframes that might contain media elements
          let iframeMedia: HTMLElement[] = [];
          try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                  const mediaInIframe = Array.from(iframeDoc.querySelectorAll('audio, video'));
                  iframeMedia = [...iframeMedia, ...mediaInIframe as any];
                }
              } catch (err) {
                // Ignore errors accessing iframes (same-origin policy)
              }
            });
            (window as any).logBot(`Media elements found in iframes: ${iframeMedia.length}`);
          } catch (err: any) {
            (window as any).logBot(`Error while searching in iframes: ${err.message}`);
          }
          
          // Combine all potential elements
          return [...standardMedia, ...teamsMediaContainers, ...iframeMedia];
        };
        
        // Get all potential media elements
        const allPotentialMedia = findMediaElements();
        (window as any).logBot(`Total potential media elements: ${allPotentialMedia.length}`);
        
        // Filter for active elements
        const mediaElements = allPotentialMedia.filter(
          (el: any) => !el.paused || el.currentTime > 0 || (el.srcObject && el.srcObject.active)
        );
        
        (window as any).logBot(`${mediaElements.length} active media elements found.`);
        
        if (mediaElements.length === 0) {
          // If no active elements found, try capturing audio from entire document
          (window as any).logBot("No active media elements found, attempting to capture audio from document.");
          
          try {
            // Alternative method: capture audio from entire document
            navigator.mediaDevices.getDisplayMedia({ 
              video: false,
              audio: true
            }).then(stream => {
              (window as any).logBot("Audio stream captured from document.");
              processAudioStream(stream);
            }).catch(err => {
              return reject(new Error(`[BOT Error] Unable to capture audio: ${err.message}`));
            });
            return; // Don't reject here, we're waiting for getDisplayMedia response
          } catch (err: any) {
            return reject(new Error(`[BOT Error] Alternative audio capture failed: ${err.message}`));
          }
        }
        
        // Create audio context and destination to mix multiple streams
        const audioContext = new AudioContext();
        const destinationNode = audioContext.createMediaStreamDestination();
        let sourcesConnected = 0;

        // Function to process audio stream once obtained
        const processAudioStream = (stream: MediaStream) => {
          try {
            // Create audio context and process stream
            const context = new AudioContext();
            const mediaStream = context.createMediaStreamSource(stream);
            const recorder = context.createScriptProcessor(4096, 1, 1);
            
            // Setup audio processing and WebSocket connection
            setupWebSocketAndAudioProcessing(stream, recorder, context);
            
            // Connect audio processing pipeline
            mediaStream.connect(recorder);
            recorder.connect(context.destination);
            
            (window as any).logBot("Audio processing pipeline connected and sending data.");
          } catch (error: any) {
            (window as any).logBot(`Error processing audio stream: ${error.message}`);
            reject(new Error(`[BOT Error] ${error.message}`));
          }
        };

        // Connect all media elements to destination node
        mediaElements.forEach((element: any, index: number) => {
          try {
            // Try to get media stream in different ways
            let elementStream = null;
            
            // Method 1: direct srcObject
            if (element.srcObject instanceof MediaStream) {
              elementStream = element.srcObject;
              (window as any).logBot(`Method 1: srcObject available for element ${index+1}.`);
            } 
            // Method 2: captureStream (Chrome)
            else if (typeof element.captureStream === 'function') {
              try {
                elementStream = element.captureStream();
                (window as any).logBot(`Method 2: captureStream used for element ${index+1}.`);
              } catch (e: any) {
                (window as any).logBot(`captureStream failed: ${e.message}`);
              }
            }
            // Method 3: mozCaptureStream (Firefox)
            else if (typeof element.mozCaptureStream === 'function') {
              try {
                elementStream = element.mozCaptureStream();
                (window as any).logBot(`Method 3: mozCaptureStream used for element ${index+1}.`);
              } catch (e: any) {
                (window as any).logBot(`mozCaptureStream failed: ${e.message}`);
              }
            }
            
            if (elementStream instanceof MediaStream) {
              if (elementStream.getAudioTracks().length > 0) {
                const sourceNode = audioContext.createMediaStreamSource(elementStream);
                sourceNode.connect(destinationNode);
                sourcesConnected++;
                (window as any).logBot(`Audio stream connected from element ${index+1}/${mediaElements.length}.`);
              } else {
                (window as any).logBot(`Element ${index+1} has stream but no audio tracks.`);
              }
            } else {
              (window as any).logBot(`Unable to get stream from element ${index+1}.`);
            }
          } catch (error: any) {
            (window as any).logBot(`Unable to connect element ${index+1}: ${error.message}`);
          }
        });

        if (sourcesConnected === 0) {
          (window as any).logBot("No sources connected, trying alternative audio capture method...");
          
          // Try alternative method before failing
          try {
            navigator.mediaDevices.getDisplayMedia({ 
              video: false,
              audio: true
            }).then(stream => {
              (window as any).logBot("Audio stream captured from document with getDisplayMedia.");
              processAudioStream(stream);
            }).catch(err => {
              return reject(new Error(`[BOT Error] Unable to capture audio: ${err.message}`));
            });
            return; // Don't reject here, we're waiting for getDisplayMedia response
          } catch (err: any) {
            return reject(new Error(`[BOT Error] Unable to connect audio streams and alternative method failed: ${err.message}`));
          }
        } else {
          // Use combined stream instead of single element stream
          const stream = destinationNode.stream;
          (window as any).logBot(`${sourcesConnected} audio streams successfully combined.`);
          
          // Process audio stream
          processAudioStream(stream);
        }
        
        // WebSocket setup and audio processing
        function setupWebSocketAndAudioProcessing(stream: MediaStream, recorder: ScriptProcessorNode, context: AudioContext) {
          // Ensure meetingUrl is not null before using btoa
          const uniquePart = connectionId || btoa(nativeMeetingId || meetingUrl || '');
          const structuredId = `${platform}_${uniquePart}`;

          const wsUrl = "ws://whisperlive:9090";
          (window as any).logBot(`Attempting WebSocket connection to: ${wsUrl} with platform: ${platform}`);
          
          let socket: WebSocket | null = null;
          let isServerReady = false;
          let language = option.language;
          let retryCount = 0;
          const maxRetries = 5;
          const retryDelay = 2000;
          
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
              
              socket.onopen = function() {
                (window as any).logBot("WebSocket connection opened.");
                retryCount = 0;

                if (socket) {
                  const handshakePayload = {
                      uid: structuredId,
                      language: null,
                      task: "transcribe",
                      model: "medium",
                      use_vad: true,
                      platform: platform,
                      token: token,
                      meeting_id: nativeMeetingId,
                      meeting_url: meetingUrl
                  };

                  const jsonPayload = JSON.stringify(handshakePayload);
                  (window as any).logBot(`DEBUG: Sending Handshake payload: ${jsonPayload}`);
                  socket.send(jsonPayload);
                }
              };

              socket.onmessage = (event) => {
                (window as any).logBot("Message received: " + event.data);
                const data = JSON.parse(event.data);
                if (data["uid"] !== structuredId) return;
                if (data["status"] === "ERROR") {
                  (window as any).logBot(`WebSocket server error: ${data["message"]}`);
                } else if (data["status"] === "WAIT") {
                  (window as any).logBot(`Server busy: ${data["message"]}`);
                } else if (!isServerReady) {
                  isServerReady = true;
                  (window as any).logBot("Server ready.");
                } else if (language === null && data["language"]) {
                  (window as any).logBot(`Language detected: ${data["language"]}`);
                } else if (data["message"] === "DISCONNECT") {
                  (window as any).logBot("Server requested disconnection.");
                  if (socket) {
                    socket.close();
                  }
                } else {
                  (window as any).logBot(`Transcription: ${JSON.stringify(data)}`);
                }
              };

              socket.onerror = (event) => {
                (window as any).logBot(`WebSocket error: ${JSON.stringify(event)}`);
              };

              socket.onclose = (event) => {
                (window as any).logBot(
                  `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`
                );
                
                // Retry logic
                if (retryCount < maxRetries) {
                  const exponentialDelay = retryDelay * Math.pow(2, retryCount);
                  retryCount++;
                  (window as any).logBot(`Reconnection attempt in ${exponentialDelay}ms. Try ${retryCount}/${maxRetries}`);
                  
                  setTimeout(() => {
                    (window as any).logBot(`Retrying WebSocket connection (${retryCount}/${maxRetries})...`);
                    setupWebSocket();
                  }, exponentialDelay);
                } else {
                  (window as any).logBot("Maximum WebSocket reconnection attempts reached. Giving up.");
                }
              };
            } catch (e: any) {
              (window as any).logBot(`Error creating WebSocket: ${e.message}`);
              // For initial connection errors, handle with retry logic
              if (retryCount < maxRetries) {
                const exponentialDelay = retryDelay * Math.pow(2, retryCount);
                retryCount++;
                (window as any).logBot(`Reconnection attempt in ${exponentialDelay}ms. Try ${retryCount}/${maxRetries}`);
                
                setTimeout(() => {
                  (window as any).logBot(`Retrying WebSocket connection (${retryCount}/${maxRetries})...`);
                  setupWebSocket();
                }, exponentialDelay);
              } else {
                return reject(new Error(`Failed to create WebSocket after ${maxRetries} attempts: ${e.message}`));
              }
            }
          };
          
          setupWebSocket();

          // Audio processing for whisperlive
          recorder.onaudioprocess = async (event) => {
            // Check if server is ready AND socket is open
            if (!isServerReady || !socket || socket.readyState !== WebSocket.OPEN) {
                return;
            }
            const inputData = event.inputBuffer.getChannelData(0);
            const data = new Float32Array(inputData);
            const targetLength = Math.round(data.length * (16000 / context.sampleRate));
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
            
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(resampledData);
            }
          };
          
          // Participant monitoring - adapted for Teams
          let aloneTime = 0;
          const checkInterval = setInterval(() => {
            // Based on recording_process.py - check roster button
            const rosterButton = document.querySelector('span[data-tid="roster-button-tile"]');
            if (!rosterButton) {
              (window as any).logBot("Participant list not found; assuming meeting is over.");
              clearInterval(checkInterval);
              recorder.disconnect();
              resolve();
              return;
            }
            
            try {
              const participantCount = parseInt(rosterButton.textContent || "0", 10);
              (window as any).logBot("Participant count: " + participantCount);

              if (participantCount <= 1) {
                aloneTime += 5;
                (window as any).logBot("Bot appears to be alone for " + aloneTime + " seconds...");
              } else {
                aloneTime = 0;
              }

              if (aloneTime >= 10 || participantCount === 0) {
                (window as any).logBot("Meeting ended or bot alone for too long. Stopping recorder...");
                clearInterval(checkInterval);
                recorder.disconnect();
                resolve();
              }
            } catch (error) {
              (window as any).logBot("Error checking participants: " + error);
            }
            
            // Also check other recording_process.py stop conditions
            const waitingMessage = document.querySelector('span[id="call-status"]');
            const removedMessage = document.querySelector('h1[id="calling-retry-screen-title"]');
            
            if (waitingMessage || removedMessage) {
              (window as any).logBot("Detected waiting or removal message. Stopping recorder...");
              clearInterval(checkInterval);
              recorder.disconnect();
              resolve();
            }
            
          }, 5000);

          // Listen for unload events and visibility changes
          window.addEventListener("beforeunload", () => {
            (window as any).logBot("Page is unloading. Stopping recorder...");
            clearInterval(checkInterval);
            recorder.disconnect();
            resolve();
          });
          
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
              (window as any).logBot("Document is hidden. Stopping recorder...");
              clearInterval(checkInterval);
              recorder.disconnect();
              resolve();
            }
          });
        }
      } catch (error: any) {
        return reject(new Error("[BOT Error] " + error.message));
      }
    });
  }, botConfig);
}; 