const { runBot } = require('./services/vexa-bot/core/dist/index.js');

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZDRiYjQwMjUtOWZjNC00ODlhLWIyY2ItYmI4MjBhMWFjNWFj%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'Vexa-Audio-Fixed',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'audio-fixed-session',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:8090',
  token: 'token',
  audioSettings: {
    sampleRate: 16000,
    channels: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
};

console.log('🎯 Starting Final Working Vexa Bot...');
console.log('📱 Bot: Vexa-Final-Working');
console.log('🔌 WebSocket: ws://localhost:8090 (VIA WEBSOCKET PROXY)');
console.log('🚀 This should establish the connection and work!');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Final working bot completed');
  })
  .catch((error) => {
    console.error('❌ Final working bot error:', error);
  });