const { runBot } = require('./dist/index.js');

// Set environment variable for WhisperLive
process.env.WHISPER_LIVE_URL = 'ws://localhost:9090';

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZGVjYzJkM2YtYWYzMy00NGViLTljNTEtYmM4MjYwYmFjNjc3%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'VexaAI-Transcriptor',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'vexa-real-transcription',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:9090',
  persistentMode: true,
  // Extended settings to prevent early leaving
  maxRecordingDurationMs: 1800000, // 30 minutes
  aloneTimeoutMs: 900000 // 15 minutes before leaving when alone
};

console.log('🎯 VEXA TRANSCRIPTION: Starting bot with proper WhisperLive connection');
console.log('🔧 Environment WHISPER_LIVE_URL:', process.env.WHISPER_LIVE_URL);
console.log('🔧 Config whisperLiveUrl:', transcriptionConfig.whisperLiveUrl);
console.log('🆔 Session: vexa-real-transcription');
console.log('🎤 Ready to capture and transcribe real speech via Vexa AI!');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Vexa transcription session completed');
  })
  .catch((error) => {
    console.error('❌ Vexa transcription error:', error);
  });