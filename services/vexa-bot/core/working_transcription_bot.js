const { runBot } = require('./dist/index.js');

// Set all required environment variables for Vexa AI transcription
process.env.WHISPER_LIVE_URL = 'ws://localhost:9090';
process.env.WEBSOCKET_PROXY_HOST = 'websocket-proxy';
process.env.WEBSOCKET_PROXY_PORT = '8088';

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmNjMDIyMGUtMjNhOC00ZTA0LWEzMGMtZjkxMzI0NTk0MzEw%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%22408dd64d-22eb-4693-b56d-1f88675a3170%22%7d',
  platform: 'teams',
  botName: 'VexaAI-Working',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'working-vexa-transcription',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:9090',
  persistentMode: true,
  // Extended settings to prevent early leaving after participant detection fix
  maxRecordingDurationMs: 1800000, // 30 minutes
  aloneTimeoutMs: 300000 // 5 minutes before leaving when alone (fixed detection)
};

console.log('🎯 WORKING VEXA AI TRANSCRIPTION: Starting bot with full pipeline');
console.log('🔧 Environment WHISPER_LIVE_URL:', process.env.WHISPER_LIVE_URL);
console.log('🔧 WebSocket Proxy Host:', process.env.WEBSOCKET_PROXY_HOST);
console.log('🔧 WebSocket Proxy Port:', process.env.WEBSOCKET_PROXY_PORT);
console.log('🔧 Config whisperLiveUrl:', transcriptionConfig.whisperLiveUrl);
console.log('🆔 Session: working-vexa-transcription');
console.log('🎤 Ready for REAL Vexa AI speech transcription!');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Working Vexa AI transcription session completed');
  })
  .catch((error) => {
    console.error('❌ Working Vexa AI transcription error:', error);
  });