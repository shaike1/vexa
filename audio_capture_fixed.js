const { runBot } = require('./services/vexa-bot/core/dist/index.js');

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZDRiYjQwMjUtOWZjNC00ODlhLWIyY2ItYmI4MjBhMWFjNWFj%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'VexaAI-Transcription',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'direct-audio-session',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:8090',  // WebSocket proxy (only available port) 
  token: 'vexa-api-key-transcription-2024',
  automaticLeave: {
    enabled: false,
    timeout: 999999
  },
  audioSettings: {
    sampleRate: 16000,
    channels: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  },
  textToSpeech: {
    enabled: false,  // Disable TTS to stop beeping
    announceJoin: false,
    announceLeave: false,
    announceRecording: false
  }
};

// Set environment variable for WhisperLive URL
process.env.WHISPER_LIVE_URL = 'ws://localhost:8090';

console.log('🎯 Starting Direct Audio Capture Fix Bot...');
console.log('📱 Bot: Vexa-Direct-Audio-Fix'); 
console.log('🔌 WebSocket: ws://localhost:8090 (WebSocket proxy)');
console.log('🔊 Focus: DIRECT audio capture via host networking');
console.log('🤖 This should capture Teams audio properly!');
console.log('🔧 WHISPER_LIVE_URL env var (DIRECT):', process.env.WHISPER_LIVE_URL);

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Direct audio fix bot completed');
  })
  .catch((error) => {
    console.error('❌ Direct audio fix bot error:', error);
  });