const { runBot } = require('./services/vexa-bot/core/dist/index.js');

const finalTestConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'VexaAI-LIVE-TRANSCRIPTION',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'live-transcription-session',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:9090',
  token: 'vexa-live-transcription-token',
  nativeMeetingId: 'live-transcription-meeting',
  automaticLeave: {
    enabled: false,
    timeout: 999999,
    waitingRoomTimeout: 600000,
    noOneJoinedTimeout: 600000,
    everyoneLeftTimeout: 600000
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