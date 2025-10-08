// Browser Audio Service - Media Element Detection & Stream Combination
// Based on Vexa.ai v0.6 approach for Teams audio capture

export class BrowserAudioService {
  private audioContext: AudioContext | null = null;
  private combinedDestination: MediaStreamAudioDestinationNode | null = null;
  private sourceNodes: MediaStreamAudioSourceNode[] = [];
  private targetSampleRate: number;
  private bufferSize: number;
  private isInitialized: boolean = false;

  constructor(config: { targetSampleRate?: number; bufferSize?: number } = {}) {
    this.targetSampleRate = config.targetSampleRate || 16000;
    this.bufferSize = config.bufferSize || 4096;
  }

  /**
   * Find active media elements in Teams that contain participant audio
   * This is the KEY difference from getUserMedia approach
   */
  async findMediaElements(): Promise<HTMLMediaElement[]> {
    console.log('[BrowserAudioService] 🔍 Searching for Teams media elements...');
    
    // Find all audio and video elements
    const mediaElements = document.querySelectorAll('audio, video') as NodeListOf<HTMLMediaElement>;
    const activeElements: HTMLMediaElement[] = [];
    
    Array.from(mediaElements).forEach((element, index) => {
      console.log(`[BrowserAudioService] 📺 Checking element ${index}: ${element.tagName}`);
      
      // Check if element has active MediaStream source
      if (element.srcObject instanceof MediaStream) {
        const stream = element.srcObject;
        const audioTracks = stream.getAudioTracks();
        
        console.log(`[BrowserAudioService] 🎵 Element ${index} has ${audioTracks.length} audio tracks`);
        
        if (audioTracks.length > 0) {
          // Check if tracks are active/enabled
          const activeTracks = audioTracks.filter(track => 
            track.readyState === 'live' && track.enabled
          );
          
          if (activeTracks.length > 0) {
            console.log(`[BrowserAudioService] ✅ Found active media element with ${activeTracks.length} live audio tracks`);
            activeElements.push(element);
          }
        }
      }
    });
    
    console.log(`[BrowserAudioService] 🎯 Found ${activeElements.length} active media elements`);
    return activeElements;
  }

  /**
   * Create combined audio stream from multiple Teams media elements
   * This combines all participant streams into one for processing
   */
  async createCombinedAudioStream(mediaElements: HTMLMediaElement[]): Promise<MediaStream> {
    console.log(`[BrowserAudioService] 🎛️ Creating combined stream from ${mediaElements.length} elements`);
    
    if (mediaElements.length === 0) {
      throw new Error('No media elements provided for stream combination');
    }

    // Initialize audio context if not already done
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.targetSampleRate });
      console.log(`[BrowserAudioService] 🎵 AudioContext created with sample rate: ${this.audioContext.sampleRate}`);
    }

    // Create destination for combined stream
    this.combinedDestination = this.audioContext.createMediaStreamDestination();
    
    // Clean up any existing source nodes
    this.sourceNodes.forEach(node => node.disconnect());
    this.sourceNodes = [];

    // Connect each media element to the combined destination
    mediaElements.forEach((element, index) => {
      if (element.srcObject instanceof MediaStream) {
        try {
          const source = this.audioContext!.createMediaStreamSource(element.srcObject);
          source.connect(this.combinedDestination!);
          this.sourceNodes.push(source);
          
          console.log(`[BrowserAudioService] 🔗 Connected media element ${index} to combined stream`);
        } catch (error) {
          console.warn(`[BrowserAudioService] ⚠️ Failed to connect element ${index}:`, error);
        }
      }
    });

    const combinedStream = this.combinedDestination.stream;
    console.log(`[BrowserAudioService] ✅ Combined stream created with ${combinedStream.getAudioTracks().length} tracks`);
    
    this.isInitialized = true;
    return combinedStream;
  }

  /**
   * Setup audio data processor with RMS and peak calculation
   */
  async setupAudioDataProcessor(
    stream: MediaStream, 
    onAudioData: (audioData: Float32Array, rms: number, peak: number) => void
  ): Promise<void> {
    console.log('[BrowserAudioService] 🎙️ Setting up audio data processor...');
    
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
    
    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const audioData = inputBuffer.getChannelData(0);
      
      // Calculate RMS (Root Mean Square) for volume level
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i];
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      const rms = Math.sqrt(sum / audioData.length);
      
      // Copy audio data to new Float32Array
      const audioDataCopy = new Float32Array(audioData);
      
      // Call the callback with audio data and metrics
      onAudioData(audioDataCopy, rms, peak);
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
    
    console.log('[BrowserAudioService] ✅ Audio data processor setup complete');
  }

  /**
   * Calculate RMS (Root Mean Square) of audio data
   */
  calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Calculate peak amplitude of audio data
   */
  calculatePeak(audioData: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      peak = Math.max(peak, Math.abs(audioData[i]));
    }
    return peak;
  }

  /**
   * Check if service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null && this.combinedDestination !== null;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    console.log('[BrowserAudioService] 🧹 Cleaning up audio service...');
    
    this.sourceNodes.forEach(node => node.disconnect());
    this.sourceNodes = [];
    
    if (this.combinedDestination) {
      this.combinedDestination.disconnect();
      this.combinedDestination = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    console.log('[BrowserAudioService] ✅ Audio service cleanup complete');
  }
}

// Make available globally
(window as any).BrowserAudioService = BrowserAudioService;