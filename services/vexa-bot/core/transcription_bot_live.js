const { runBot } = require('./dist/index.js');

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_OGNjMDBhZTAtMjY3YS00MDdlLWIwNDMtODBkNWU2ODk3NTI5%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'VexaAI-Transcription',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'transcription-bot-live-session',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:19090', // Through Traefik proxy
  persistentMode: true // Stay in meeting longer
};

console.log('🎯 Starting live transcription bot for Teams meeting...');
console.log('📱 Meeting URL configured');
console.log('🤖 Bot name: VexaAI-Transcription');
console.log('🔌 All services are now running:');
console.log('   ✅ WhisperLive: whisperlive-cpu');
console.log('   ✅ WebSocket Proxy: websocket-proxy'); 
console.log('   ✅ Transcription Collector: processing data');
console.log('   ✅ API Authentication: working');

runBot(transcriptionConfig)
  .then(() => {
    console.log('🎉 Live transcription bot session completed');
  })
  .catch((error) => {
    console.error('❌ Live transcription bot error:', error);
  });