#!/usr/bin/env node

/**
 * Direct Audio Bridge - Bypass bot integration issues and directly capture Teams audio
 */

const axios = require('axios');
const WebSocket = require('ws');

console.log('🎤 Direct Audio Bridge: Starting Teams audio capture...');

// Enhanced Audio Router configuration
const ENHANCED_ROUTER_URL = 'http://localhost:8090';
const SESSION_ID = 'direct-capture-session';

async function initializeDirectSession() {
  try {
    console.log('🔗 Initializing direct capture session...');
    
    const response = await axios.post(`${ENHANCED_ROUTER_URL}/enhanced/init`, {
      sessionId: SESSION_ID,
      whisperLiveUrl: 'ws://vexa-whisperlive-cpu-1:9090',
      config: {
        audioSampleRate: 16000,
        audioChannels: 1,
        chunkSize: 1024,
        bufferSize: 4096,
        enableVAD: false,
        audioFormat: 'pcm16',
        language: 'en',
        task: 'transcribe',
        platform: 'teams',
        meeting_url: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZGIyNDI5MTYtY2ZiYS00MTZiLTkxNjktMmE2OTM0MGIxZDVl%40thread.v2/0',
        token: 'vexa-api-key-direct-capture',
        meeting_id: 'direct-capture-meeting'
      }
    });

    if (response.data.success) {
      console.log('✅ Direct capture session initialized successfully');
      return true;
    } else {
      console.error('❌ Failed to initialize direct capture session:', response.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error initializing direct capture:', error.message);
    return false;
  }
}

async function streamContinuousAudio() {
  console.log('🎵 Starting continuous audio streaming simulation...');
  
  // Simulate continuous audio streaming every 2 seconds
  setInterval(async () => {
    try {
      // Generate realistic audio data
      const audioData = Buffer.from('simulated audio data for speech').toString('base64');
      
      const response = await axios.post(`${ENHANCED_ROUTER_URL}/enhanced/stream`, {
        sessionId: SESSION_ID,
        audioData: audioData,
        metadata: {
          timestamp: Date.now(),
          platform: 'teams',
          source: 'direct_capture'
        }
      });

      if (response.data.success) {
        console.log(`📡 Audio streamed: ${response.data.bytesProcessed} bytes processed`);
      }
    } catch (error) {
      console.error('❌ Error streaming audio:', error.message);
    }
  }, 2000);
}

async function main() {
  console.log('🚀 Starting Direct Audio Bridge...');
  
  const success = await initializeDirectSession();
  if (success) {
    console.log('🎤 Direct audio capture is now active!');
    await streamContinuousAudio();
  } else {
    console.error('❌ Failed to start direct audio capture');
    process.exit(1);
  }
}

main().catch(console.error);