// Teams selectors based on Vexa.ai v0.6 approach
// Centralized MS Teams selectors and indicators
// Keep this file free of runtime logic; export constants only.

export const teamsInitialAdmissionIndicators: string[] = [
  // Most reliable indicators: Leave buttons that actually exist in Teams meetings
  'button[id="hangup-button"]',
  'button[data-tid="hangup-main-btn"]', 
  'button[aria-label="Leave"]',
  '[role="toolbar"] button[aria-label*="Leave"]',
  'button[aria-label*="Leave"]'
];

export const teamsWaitingRoomIndicators: string[] = [
  // Pre-join screen specific text (generic patterns)
  'text="Someone will let you in shortly"',
  'text*="Someone will let you in shortly"', // Generic pattern for any bot name
  'text="You\'re in the lobby"',
  'text="Waiting for someone to let you in"',
  'text="Please wait until someone admits you"',
  'text="Wait for someone to admit you"',
  'text="Waiting to be admitted"',
  'text="Your request to join has been sent"',
  
  // Pre-join screen specific elements
  'button:has-text("Join now")',
  'button:has-text("Cancel")',
  'text="Microsoft Teams meeting"',
  
  // Pre-join screen specific aria labels
  '[aria-label*="waiting"]',
  '[aria-label*="lobby"]',
  '[aria-label*="Join now"]',
  '[aria-label*="Cancel"]',
  
  // Pre-join screen specific classes/attributes
  '[data-tid*="pre-join"]',
  '[data-tid*="lobby"]',
  '[data-tid*="waiting"]',
  
  // Error states
  'text="Meeting not found"',
  'text="Unable to join"'
];

export const teamsAdmissionIndicators: string[] = [
  // Most reliable indicators - meeting-specific elements that don't exist in pre-join
  'div:has-text("In this meeting")',
  'div[aria-label*="In this meeting"]',
  'div:has-text("Waiting in lobby")',
  'div[aria-label*="Waiting in lobby"]',
  
  // Meeting toolbar with specific controls (not pre-join toolbar)
  '[role="toolbar"] button[aria-label*="Share"]',
  '[role="toolbar"] button[aria-label*="Present"]',
  '[role="toolbar"] button[aria-label*="Leave"]',
  '[role="toolbar"] button[aria-label*="End meeting"]',
  
  // Meeting navigation tabs (active in meeting, not pre-join)
  'button[aria-label*="Chat"]:not([disabled])',
  'button[aria-label*="People"]:not([disabled])',
  'button[aria-label*="Participants"]:not([disabled])',
  
  // Meeting-specific audio/video controls (enabled, not pre-join disabled state)
  'button[aria-label*="Turn off microphone"]:not([disabled])',
  'button[aria-label*="Turn on microphone"]:not([disabled])',
  'button[aria-label*="Turn off camera"]:not([disabled])',
  'button[aria-label*="Turn on camera"]:not([disabled])',
  
  // Meeting-specific UI elements
  '[data-tid*="meeting-controls"]',
  '[data-tid*="call-controls"]',
  '[data-tid*="meeting-toolbar"]',
  '[data-tid*="participants-panel"]',
  
  // Meeting-specific data attributes
  '[data-tid*="meeting"]',
  '[data-tid*="call"]'
];

// Teams voice level detection selectors (PRIMARY for audio)
export const teamsVoiceLevelSelectors: string[] = [
  '[data-tid="voice-level-stream-outline"]'
];

// Teams speaking indicators (primary voice level detection)
export const teamsSpeakingIndicators: string[] = [
  '[data-tid="voice-level-stream-outline"]'
];

// Teams participant detection
export const teamsParticipantSelectors: string[] = [
  '[data-tid*="participant"]',
  '[aria-label*="participant"]',
  '[data-tid*="roster"]',
  '[data-tid*="roster-item"]',
  '[data-tid*="video-tile"]',
  '[data-tid*="videoTile"]',
  '[data-tid*="participant-tile"]',
  '[data-tid*="participantTile"]',
  '[role="listitem"]',
  '.participant-tile',
  '.video-tile',
  '.roster-item'
];

// Teams speaking class names
export const teamsSpeakingClassNames: string[] = [
  'speaking', 'active-speaker', 'speaker-active', 'speaking-indicator',
  'audio-active', 'mic-active', 'microphone-active', 'voice-active',
  'speaking-border', 'speaking-glow', 'speaking-highlight',
  'participant-speaking', 'user-speaking', 'speaker-indicator'
];

// Teams name selectors for participant identification
export const teamsNameSelectors: string[] = [
  // Look for the actual name div structure
  'div[class*="___2u340f0"]', // The actual name div class pattern
  '[data-tid*="display-name"]',
  '[data-tid*="participant-name"]',
  '[data-tid*="user-name"]',
  '[aria-label*="name"]',
  '.participant-name',
  '.display-name',
  '.user-name',
  '.roster-item-name',
  '.video-tile-name',
  'span[title]',
  '[title*="name"]',
  '.ms-Persona-primaryText',
  '.ms-Persona-secondaryText'
];

// Teams leave button selectors
export const teamsLeaveSelectors: string[] = [
  // WORKING SELECTORS FIRST - confirmed from logs
  'button[id="hangup-button"]', // ✅ CONFIRMED WORKING - successfully clicked in logs
  
  // Teams-specific leave/hangup buttons
  'button[data-tid="hangup-main-btn"]',
  
  // Cancel buttons (for awaiting admission/waiting room)
  'button[aria-label="Cancel"]',
  'button:has-text("Cancel")',
  
  // Leave buttons (for active meetings)
  'button[aria-label="Leave"]',
  'button:has-text("Leave")',
  
  // More specific leave patterns
  'button[aria-label*="Leave"]',
  'button[aria-label*="leave"]',
  '[role="toolbar"] button[aria-label*="Leave"]',
  
  // End meeting alternatives
  'button[aria-label*="End meeting"]',
  'button:has-text("End meeting")',
  'button[aria-label*="Hang up"]',
  'button:has-text("Hang up")',
  
  // Close/dismiss alternatives
  'button:has-text("Close")',
  'button[aria-label="Close"]',
  'button:has-text("Dismiss")',
  'button[aria-label="Dismiss"]',
  
  // Generic cancel patterns
  'button[aria-label*="Cancel"]',
  'button[data-tid*="cancel"]',
  '[role="button"]:has-text("Cancel")',
  
  // Confirmation dialog buttons
  '[role="dialog"] button:has-text("Leave")',
  '[role="dialog"] button:has-text("End meeting")',
  '[role="alertdialog"] button:has-text("Leave")',
  
  // Fallback patterns
  'input[type="button"][value="Cancel"]',
  'input[type="submit"][value="Cancel"]'
];

// Teams UI interaction selectors
export const teamsContinueButtonSelectors: string[] = [
  'button:has-text("Continue")'
];

export const teamsJoinButtonSelectors: string[] = [
  'button:has-text("Join")',
  'button:has-text("Join now")'
];

export const teamsCameraButtonSelectors: string[] = [
  'button[aria-label*="Turn off camera"]',
  'button[aria-label*="Turn on camera"]'
];

export const teamsNameInputSelectors: string[] = [
  'input[placeholder*="name"]',
  'input[placeholder*="Name"]',
  'input[type="text"]'
];