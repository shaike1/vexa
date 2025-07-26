const { runBot } = require('./services/vexa-bot/core/dist/index.js');

const finalTestConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZDRiYjQwMjUtOWZjNC00ODlhLWIyY2ItYmI4MjBhMWFjNWFj%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'Vexa-Final-Test',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'final-test-session',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:9090',
  token: 'token',
  nativeMeetingId: 'final-test',
  automaticLeave: {
    enabled: true,
    timeout: 3600,
    waitingRoomTimeout: 300000,
    noOneJoinedTimeout: 300000,
    everyoneLeftTimeout: 300000
  }
};

console.log('🎯 Starting FINAL LIVE TEST...');
console.log('📱 Bot: Vexa-Final-Test'); 
console.log('🔊 READY FOR YOUR LIVE SPEECH!');
console.log('🎤 Speak clearly into your microphone!');

runBot(finalTestConfig)
  .then(() => {
    console.log('✅ Final test completed');
  })
  .catch((error) => {
    console.error('❌ Final test error:', error);
  });