// WhisperLive Service with Stubborn Reconnection
// Based on Vexa.ai v0.6 approach for reliable WebSocket connections

export class BrowserWhisperLiveService {
  private websocket: WebSocket | null = null;
  private whisperLiveUrl: string;
  private stubbornMode: boolean;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 50; // Very persistent
  private reconnectInterval: number = 2000; // Start with 2 seconds
  private isReady: boolean = false;
  private reconnectTimer: number | null = null;

  constructor(config: { whisperLiveUrl: string }, stubbornMode: boolean = false) {
    this.whisperLiveUrl = config.whisperLiveUrl;
    this.stubbornMode = stubbornMode;
    console.log(`[BrowserWhisperLiveService] 🎯 Initializing with URL: ${this.whisperLiveUrl}, Stubborn: ${stubbornMode}`);
  }

  /**
   * Initialize with stubborn reconnection - NEVER GIVES UP!
   */
  async initializeWithStubbornReconnection(platform: string): Promise<string> {
    console.log(`[BrowserWhisperLiveService] 🚀 Starting stubborn reconnection for ${platform}...`);
    
    return new Promise((resolve, reject) => {
      this.connectWithRetry(resolve, reject);
    });
  }

  /**
   * Connect with exponential backoff retry
   */
  private connectWithRetry(resolve: (url: string) => void, reject: (error: Error) => void): void {
    if (!this.stubbornMode && this.reconnectAttempts >= this.maxReconnectAttempts) {
      reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`));
      return;
    }

    console.log(`[BrowserWhisperLiveService] 🔗 Connection attempt ${this.reconnectAttempts + 1}...`);

    try {
      this.websocket = new WebSocket(this.whisperLiveUrl);

      this.websocket.onopen = () => {
        console.log('[BrowserWhisperLiveService] ✅ WebSocket connected successfully');
        this.isReady = true;
        this.reconnectAttempts = 0; // Reset on successful connection
        this.reconnectInterval = 2000; // Reset interval
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        
        resolve(this.whisperLiveUrl);
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[BrowserWhisperLiveService] 📨 Received:', data);
          
          // Handle transcription messages
          if (data.message) {
            // Emit transcription event for the application to handle
            const transcriptionEvent = new CustomEvent('whisper-transcription', {
              detail: { message: data.message, timestamp: Date.now() }
            });
            document.dispatchEvent(transcriptionEvent);
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
        console.warn(`[BrowserWhisperLiveService] 🔌 WebSocket closed: ${event.code} - ${event.reason}`);
        this.isReady = false;
        
        // In stubborn mode, always try to reconnect
        if (this.stubbornMode || this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(resolve, reject);
        } else {
          reject(new Error('WebSocket connection failed permanently'));
        }
      };

    } catch (error) {
      console.error('[BrowserWhisperLiveService] ❌ Failed to create WebSocket:', error);
      this.scheduleReconnect(resolve, reject);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(resolve: (url: string) => void, reject: (error: Error) => void): void {
    this.reconnectAttempts++;
    
    // Exponential backoff with jitter (max 30 seconds)
    const baseInterval = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts), 30000);
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    const delay = baseInterval + jitter;
    
    console.log(`[BrowserWhisperLiveService] ⏳ Scheduling reconnect ${this.reconnectAttempts} in ${Math.round(delay)}ms...`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.connectWithRetry(resolve, reject);
    }, delay);
  }

  /**
   * Send audio chunk metadata
   */
  sendAudioChunkMetadata(chunkLength: number, sampleRate: number): void {
    if (!this.isReady || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[BrowserWhisperLiveService] ⚠️ Cannot send metadata - WebSocket not ready');
      return;
    }

    const metadata = {
      type: 'audio_metadata',
      chunk_length: chunkLength,
      sample_rate: sampleRate,
      timestamp: Date.now()
    };

    try {
      this.websocket.send(JSON.stringify(metadata));
    } catch (error) {
      console.error('[BrowserWhisperLiveService] ❌ Failed to send metadata:', error);
      this.isReady = false;
    }
  }

  /**
   * Send audio data
   */
  sendAudioData(audioData: Float32Array): void {
    if (!this.isReady || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[BrowserWhisperLiveService] ⚠️ Cannot send audio - WebSocket not ready');
      return;
    }

    try {
      // Convert Float32Array to ArrayBuffer for transmission
      const buffer = audioData.buffer.slice(
        audioData.byteOffset,
        audioData.byteOffset + audioData.byteLength
      );
      
      this.websocket.send(buffer);
    } catch (error) {
      console.error('[BrowserWhisperLiveService] ❌ Failed to send audio data:', error);
      this.isReady = false;
    }
  }

  /**
   * Check if service is ready to send data
   */
  isServiceReady(): boolean {
    return this.isReady && this.websocket !== null && this.websocket.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): string {
    if (!this.websocket) return 'disconnected';
    
    switch (this.websocket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }

  /**
   * Cleanup and close connection
   */
  dispose(): void {
    console.log('[BrowserWhisperLiveService] 🧹 Cleaning up WhisperLive service...');
    
    this.isReady = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING) {
        this.websocket.close(1000, 'Service disposing');
      }
      this.websocket = null;
    }
    
    console.log('[BrowserWhisperLiveService] ✅ WhisperLive service cleanup complete');
  }
}

// Make available globally
(window as any).BrowserWhisperLiveService = BrowserWhisperLiveService;