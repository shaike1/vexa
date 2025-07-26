const { runBot } = require('./services/vexa-bot/core/dist/index.js');

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZDRiYjQwMjUtOWZjNC00ODlhLWIyY2ItYmI4MjBhMWFjNWFj%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'Vexa-Direct-Join',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'direct-join-session',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:8090',
  token: 'token',
  automaticLeave: {
    enabled: false,
    timeout: 999999
  }
};

console.log('🎯 Starting Direct Join Bot...');
console.log('📱 Bot: Vexa-Direct-Join');
console.log('🔌 WebSocket: ws://localhost:8090');
console.log('🚀 Using direct meeting join approach!');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Direct join bot completed');
  })
  .catch((error) => {
    console.error('❌ Direct join bot error:', error);
  });