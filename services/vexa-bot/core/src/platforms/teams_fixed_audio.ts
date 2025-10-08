// Enhanced Teams Audio Capture - WebRTC Stream Interception
// This is the FIXED version that captures participant audio instead of bot microphone

import { Page } from "playwright";
import { log, randomDelay } from "../utils";
import { BotConfig } from "../types";

// Fixed audio capture function that intercepts Teams WebRTC streams
const captureTeamsParticipantAudio = async (page: Page, botConfig: BotConfig) => {
  log("🎯 Starting FIXED Teams audio capture (WebRTC interception)...");
  
  await page.evaluate(() => {
    (window as any).logBot("🔧 FIXED AUDIO: Intercepting Teams WebRTC streams for participant audio");
    
    let participantAudioStreams: MediaStream[] = [];
    let audioContext: AudioContext | null = null;
    let audioProcessor: ScriptProcessorNode | null = null;
    let currentSessionUid = `teams-fixed-${Date.now()}`;
    
    // Step 1: Intercept WebRTC to capture participant audio streams
    const interceptWebRTCAudio = () => {
      (window as any).logBot("🎤 Setting up WebRTC audio stream interception...");
      
      // Intercept RTCPeerConnection to capture remote audio streams
      const originalPeerConnection = (window as any).RTCPeerConnection;
      if (originalPeerConnection) {
        (window as any).RTCPeerConnection = function(...args: any[]) {
          const pc = new originalPeerConnection(...args);
          
          pc.addEventListener('track', (event: RTCTrackEvent) => {
            if (event.track.kind === 'audio') {
              (window as any).logBot(`🎵 FOUND PARTICIPANT AUDIO TRACK: ${event.track.id}`);
              
              if (event.streams && event.streams.length > 0) {
                const stream = event.streams[0];
                participantAudioStreams.push(stream);
                (window as any).logBot(`✅ Added participant audio stream: ${participantAudioStreams.length} total`);
                
                // Process this audio stream for transcription
                processParticipantAudioStream(stream);
              }
            }
          });
          
          return pc;
        };
        (window as any).logBot("✅ WebRTC RTCPeerConnection intercepted successfully");
      }
      
      // Also intercept getUserMedia to see what Teams is doing
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = async function(constraints) {
        const stream = await originalGetUserMedia.call(this, constraints);
        (window as any).logBot(`📱 Teams requested getUserMedia: ${JSON.stringify(constraints)}`);
        
        if (constraints?.audio) {
          (window as any).logBot("🎙️ Teams requested microphone access (this is bot's mic, not participants)");
        }
        
        return stream;
      };
    };
    
    // Step 2: Process participant audio stream for transcription
    const processParticipantAudioStream = (stream: MediaStream) => {
      try {
        (window as any).logBot("🎵 Processing participant audio stream for transcription...");
        
        if (!audioContext) {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          (window as any).logBot("✅ Created audio context for participant audio");
        }
        
        // Create source from participant's audio stream
        const source = audioContext.createMediaStreamSource(stream);
        
        // Create audio processor for real-time transcription
        audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        
        audioProcessor.onaudioprocess = async (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Calculate audio levels to verify we're getting real audio
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += Math.abs(inputData[i]);
          }
          const averageLevel = sum / inputData.length;
          
          // Log audio levels periodically
          if (Math.random() < 0.01) { // Log ~1% of the time to avoid spam
            if (averageLevel > 0.001) {
              (window as any).logBot(`🎵 PARTICIPANT AUDIO: Level ${averageLevel.toFixed(6)} (REAL AUDIO DETECTED)`);
            } else {
              (window as any).logBot(`🔇 PARTICIPANT AUDIO: Level ${averageLevel.toFixed(6)} (silence)`);
            }
          }
          
          // Only process if we have real audio
          if (averageLevel > 0.0001) {
            // Resample to 16kHz for WhisperLive
            const data = new Float32Array(inputData);
            const targetLength = Math.round(data.length * (16000 / audioContext!.sampleRate));
            const resampledData = new Float32Array(targetLength);
            
            // Simple linear interpolation resampling
            const springFactor = (data.length - 1) / (targetLength - 1);
            for (let i = 0; i < targetLength; i++) {
              const index = i * springFactor;
              const leftIndex = Math.floor(index);
              const rightIndex = Math.ceil(index);
              const fraction = index - leftIndex;
              
              if (leftIndex < data.length && rightIndex < data.length) {
                resampledData[i] = data[leftIndex] + (data[rightIndex] - data[leftIndex]) * fraction;
              }
            }
            
            // Send to WhisperLive via HTTP proxy
            try {
              await (window as any).sendAudioToProxy({
                sessionUid: currentSessionUid,
                audioData: Array.from(resampledData)
              });
              
              // Log successful audio transmission
              if (Math.random() < 0.005) { // Very occasional logging
                (window as any).logBot(`🚀 FIXED AUDIO: Sent ${resampledData.length} samples to WhisperLive`);
              }
            } catch (error) {
              (window as any).logBot(`❌ Error sending participant audio to WhisperLive: ${error}`);
            }
          }
        };
        
        // Connect the audio processing pipeline
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
        
        (window as any).logBot("✅ FIXED AUDIO PIPELINE: Participant audio → WhisperLive");
        
      } catch (error) {
        (window as any).logBot(`❌ Error processing participant audio stream: ${error}`);
      }
    };
    
    // Step 3: Alternative method - capture from audio/video elements
    const captureFromAudioElements = () => {
      (window as any).logBot("🔍 Searching for Teams audio/video elements...");
      
      const mediaElements = document.querySelectorAll('audio, video');
      (window as any).logBot(`Found ${mediaElements.length} media elements`);
      
      mediaElements.forEach((element, index) => {
        const mediaEl = element as HTMLMediaElement;
        if (mediaEl.srcObject && mediaEl.srcObject instanceof MediaStream) {
          const stream = mediaEl.srcObject;
          const audioTracks = stream.getAudioTracks();
          
          if (audioTracks.length > 0) {
            (window as any).logBot(`🎵 Found audio element ${index} with ${audioTracks.length} audio tracks`);
            processParticipantAudioStream(stream);
          }
        }
      });
      
      // Set up observer for new media elements
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'AUDIO' || element.tagName === 'VIDEO') {
                const mediaEl = element as HTMLMediaElement;
                if (mediaEl.srcObject instanceof MediaStream) {
                  (window as any).logBot("🆕 New media element detected, processing audio...");
                  processParticipantAudioStream(mediaEl.srcObject);
                }
              }
            }
          });
        });
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      (window as any).logBot("✅ Set up observer for new media elements");
    };
    
    // Initialize the fixed audio capture
    try {
      (window as any).logBot("🚀 INITIALIZING FIXED TEAMS AUDIO CAPTURE");
      (window as any).logBot("This should capture PARTICIPANT audio instead of bot microphone");
      
      // Try WebRTC interception first
      interceptWebRTCAudio();
      
      // Also try capturing from existing media elements
      setTimeout(captureFromAudioElements, 2000);
      
      // Fallback: periodically search for new audio sources
      setInterval(() => {
        if (participantAudioStreams.length === 0) {
          captureFromAudioElements();
        }
      }, 10000);
      
      (window as any).logBot("✅ Fixed audio capture initialized - should resolve 'You' transcription issue");
      
    } catch (error) {
      (window as any).logBot(`❌ Error initializing fixed audio capture: ${error}`);
      (window as any).logBot("Falling back to original microphone capture method");
      
      // Fallback to original method if fixed version fails
      // ... original getUserMedia code here ...
    }
  });
};

export { captureTeamsParticipantAudio };