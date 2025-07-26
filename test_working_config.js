const { runBot } = require('./services/vexa-bot/core/dist/index.js');

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_OTg2NWEyZWEtYTA1Mi00MmFkLTlkZGEtOGMxODhjMGNlOWYw%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'VO Assist-Working-Test',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'working-test-session',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:8090', // Use WebSocket proxy port
  persistentMode: true
};

console.log('🎯 Testing with working configuration approach...');
console.log('📱 Bot: VO Assist-Working-Test');
console.log('🔌 WebSocket: ws://localhost:8090 (WebSocket proxy)');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Working config test completed');
  })
  .catch((error) => {
    console.error('❌ Working config test error:', error);
  });