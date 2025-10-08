// Teams Speaker Detection based on Vexa.ai v0.6 approach
// Uses voice-level-stream-outline visibility for speaker detection

import {
  teamsParticipantSelectors,
  teamsVoiceLevelSelectors,
  teamsSpeakingClassNames,
  teamsNameSelectors
} from '../platforms/teams-selectors';

export class TeamsSpeakerDetection {
  private participants: Map<string, ParticipantInfo> = new Map();
  private lastSpeakerChangeTime: number = 0;
  private speakerChangeCallback: ((speakerName: string, isStart: boolean) => void) | null = null;
  private monitoringInterval: number | null = null;
  private mutationObserver: MutationObserver | null = null;

  constructor() {
    console.log('[TeamsSpeakerDetection] 🎤 Initializing Teams speaker detection...');
  }

  /**
   * Start monitoring for speaker changes
   */
  startMonitoring(onSpeakerChange: (speakerName: string, isStart: boolean) => void): void {
    console.log('[TeamsSpeakerDetection] 🔍 Starting speaker monitoring...');
    
    this.speakerChangeCallback = onSpeakerChange;
    
    // Start periodic participant scanning
    this.monitoringInterval = window.setInterval(() => {
      this.scanForSpeakerChanges();
    }, 500); // Check every 500ms
    
    // Setup mutation observer for real-time changes
    this.setupMutationObserver();
    
    console.log('[TeamsSpeakerDetection] ✅ Speaker monitoring started');
  }

  /**
   * Setup mutation observer for real-time voice level changes
   */
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        // Check if voice level indicators changed
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          const target = mutation.target as Element;
          if (target.matches('[data-tid="voice-level-stream-outline"]')) {
            shouldScan = true;
          }
        }
        
        // Check for added/removed participant elements
        if (mutation.type === 'childList') {
          const hasParticipantChanges = Array.from(mutation.addedNodes)
            .concat(Array.from(mutation.removedNodes))
            .some(node => node instanceof Element && 
              teamsParticipantSelectors.some(selector => node.matches(selector)));
          
          if (hasParticipantChanges) {
            shouldScan = true;
          }
        }
      });
      
      if (shouldScan) {
        // Use requestAnimationFrame for smooth performance
        requestAnimationFrame(() => this.scanForSpeakerChanges());
      }
    });
    
    // Observe the entire document for changes
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    console.log('[TeamsSpeakerDetection] 👁️ Mutation observer setup complete');
  }

  /**
   * Scan for speaker changes using voice level detection
   */
  private scanForSpeakerChanges(): void {
    try {
      const currentParticipants = this.detectCurrentParticipants();
      const currentTime = Date.now();
      
      // Check for speaking state changes
      currentParticipants.forEach((participant, participantId) => {
        const previous = this.participants.get(participantId);
        
        if (!previous) {
          // New participant
          this.participants.set(participantId, participant);
          console.log(`[TeamsSpeakerDetection] 👤 New participant: ${participant.name}`);
        } else if (previous.isSpeaking !== participant.isSpeaking) {
          // Speaking state changed
          this.participants.set(participantId, participant);
          
          // Debounce rapid changes (minimum 200ms between changes)
          if (currentTime - this.lastSpeakerChangeTime > 200) {
            console.log(`[TeamsSpeakerDetection] 🎤 Speaker change: ${participant.name} ${participant.isSpeaking ? 'started' : 'stopped'} speaking`);
            
            if (this.speakerChangeCallback) {
              this.speakerChangeCallback(participant.name, participant.isSpeaking);
            }
            
            this.lastSpeakerChangeTime = currentTime;
          }
        }
      });
      
      // Remove participants that are no longer visible
      const currentIds = new Set(currentParticipants.keys());
      for (const [id, participant] of this.participants) {
        if (!currentIds.has(id)) {
          console.log(`[TeamsSpeakerDetection] 👋 Participant left: ${participant.name}`);
          this.participants.delete(id);
        }
      }
      
    } catch (error) {
      console.warn('[TeamsSpeakerDetection] ⚠️ Error during speaker scan:', error);
    }
  }

  /**
   * Detect current participants and their speaking state
   */
  private detectCurrentParticipants(): Map<string, ParticipantInfo> {
    const participants = new Map<string, ParticipantInfo>();
    
    // Find all participant containers
    const participantElements = document.querySelectorAll(teamsParticipantSelectors.join(', '));
    
    participantElements.forEach((element, index) => {
      try {
        const participantInfo = this.analyzeParticipantElement(element as HTMLElement, index);
        if (participantInfo) {
          participants.set(participantInfo.id, participantInfo);
        }
      } catch (error) {
        console.warn(`[TeamsSpeakerDetection] ⚠️ Error analyzing participant ${index}:`, error);
      }
    });
    
    return participants;
  }

  /**
   * Analyze a participant element to extract speaking state
   */
  private analyzeParticipantElement(element: HTMLElement, index: number): ParticipantInfo | null {
    // Extract participant name
    const name = this.extractParticipantName(element) || `Participant ${index + 1}`;
    
    // Generate unique ID (use name + element position as fallback)
    const id = this.generateParticipantId(element, name);
    
    // Determine speaking state using voice level detection
    const isSpeaking = this.isParticipantSpeaking(element);
    
    return {
      id,
      name,
      isSpeaking,
      element,
      lastUpdate: Date.now()
    };
  }

  /**
   * Check if participant is speaking using voice level indicator
   * KEY INSIGHT: VISIBLE outline = SILENT, HIDDEN outline = SPEAKING
   */
  private isParticipantSpeaking(participantElement: HTMLElement): boolean {
    // Primary method: voice-level-stream-outline visibility
    const voiceLevelElement = participantElement.querySelector('[data-tid="voice-level-stream-outline"]');
    if (voiceLevelElement) {
      const isVisible = this.isElementVisible(voiceLevelElement as HTMLElement);
      // INVERTED LOGIC: visible outline means silent, hidden means speaking
      const isSpeaking = !isVisible;
      
      if (isSpeaking) {
        console.log('[TeamsSpeakerDetection] 🎤 Voice level indicates speaking (outline hidden)');
      }
      
      return isSpeaking;
    }
    
    // Fallback: class-based detection
    return this.checkSpeakingClasses(participantElement);
  }

  /**
   * Check if element is visible
   */
  private isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }

  /**
   * Fallback method: check for speaking-related classes
   */
  private checkSpeakingClasses(element: HTMLElement): boolean {
    const classList = element.className.toLowerCase();
    return teamsSpeakingClassNames.some(className => 
      classList.includes(className.toLowerCase())
    );
  }

  /**
   * Extract participant name from element
   */
  private extractParticipantName(element: HTMLElement): string | null {
    for (const selector of teamsNameSelectors) {
      try {
        const nameElement = element.querySelector(selector);
        if (nameElement) {
          const name = nameElement.textContent?.trim() || nameElement.getAttribute('title')?.trim();
          if (name && name.length > 0 && name !== 'undefined') {
            return name;
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    return null;
  }

  /**
   * Generate unique participant ID
   */
  private generateParticipantId(element: HTMLElement, name: string): string {
    // Try to use stable identifier from element
    const dataId = element.getAttribute('data-tid') || 
                   element.getAttribute('data-participant-id') ||
                   element.getAttribute('data-user-id');
    
    if (dataId) {
      return dataId;
    }
    
    // Fallback: use name + position hash
    const rect = element.getBoundingClientRect();
    const positionHash = `${Math.round(rect.top)}-${Math.round(rect.left)}`;
    return `${name}-${positionHash}`;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    console.log('[TeamsSpeakerDetection] 🛑 Stopping speaker monitoring...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    this.participants.clear();
    this.speakerChangeCallback = null;
    
    console.log('[TeamsSpeakerDetection] ✅ Speaker monitoring stopped');
  }

  /**
   * Get current participants info
   */
  getCurrentParticipants(): ParticipantInfo[] {
    return Array.from(this.participants.values());
  }
}

interface ParticipantInfo {
  id: string;
  name: string;
  isSpeaking: boolean;
  element: HTMLElement;
  lastUpdate: number;
}

// Make available globally
(window as any).TeamsSpeakerDetection = TeamsSpeakerDetection;