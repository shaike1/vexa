const { runBot } = require('./dist/index.js');

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmNjMDIyMGUtMjNhOC00ZTA0LWEzMGMtZjkxMzI0NTk0MzEw%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%22408dd64d-22eb-4693-b56d-1f88675a3170%22%7d',
  platform: 'teams',
  botName: 'VexaAI-RealSpeech',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'final-speech-capture',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:9090',
  persistentMode: true,
  // Extended settings to prevent early leaving
  maxRecordingDurationMs: 1800000, // 30 minutes
  aloneTimeoutMs: 900000 // 15 minutes before leaving when alone
};

console.log('🎯 FINAL FIX: Starting bot with extended timeouts');
console.log('🔧 WhisperLive: Connected to Redis');
console.log('🔧 Bot timeout: 15 minutes (won\'t leave early)');
console.log('🆔 Session: final-speech-capture');
console.log('🎤 Ready to capture real speech!');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Real speech capture session completed');
  })
  .catch((error) => {
    console.error('❌ Speech capture error:', error);
  });