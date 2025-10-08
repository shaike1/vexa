// Fixed Teams Audio Capture - Diagnostic Version
// This version will show us exactly what audio we're capturing

const { runBot } = require('./services/vexa-bot/core/dist/index.js');

const diagnosticConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/PLACEHOLDER_URL',
  platform: 'teams',
  botName: 'VexaAI-Audio-Diagnostic',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'diagnostic-audio-session',
  redisUrl: 'redis://vexa-redis-1:6379',
  whisperLiveUrl: 'ws://vexa-whisperlive-cpu-1:9090',
  token: 'diagnostic-token',
  nativeMeetingId: 'diagnostic-meeting',
  automaticLeave: {
    enabled: false,
    timeout: 999999,
    waitingRoomTimeout: 300000,
    noOneJoinedTimeout: 300000,
    everyoneLeftTimeout: 300000
  }
};

console.log('🔍 TEAMS AUDIO DIAGNOSTIC BOT');
console.log('============================');
console.log('This bot will help us understand the audio capture issue.');
console.log('');
console.log('🎯 What this bot will show:');
console.log('  ✅ Audio levels from current capture method');
console.log('  ✅ Whether we\'re getting real audio or silence');  
console.log('  ✅ What WhisperLive receives');
console.log('  ✅ Why transcriptions show "You"');
console.log('');
console.log('📋 Instructions:');
console.log('  1. Deploy this bot to a Teams meeting');
console.log('  2. Join the meeting yourself');
console.log('  3. Speak clearly in the meeting');
console.log('  4. Watch the bot logs for audio level diagnostics');
console.log('');
console.log('🚀 Expected Results:');
console.log('  ❌ Current: "Audio Level: 0.000000 (SILENCE)"');
console.log('  ✅ After fix: "Audio Level: 0.045231 (REAL AUDIO)"');
console.log('');

// Patch the bot config to add our diagnostic webhook
diagnosticConfig.botManagerCallbackUrl = 'http://diagnostic-webhook:8080/bot-events';

console.log('🎯 Starting diagnostic bot...');
console.log('📱 Bot: VexaAI-Audio-Diagnostic');
console.log('🔌 WhisperLive: ws://vexa-whisperlive-cpu-1:9090');
console.log('💾 Redis: redis://vexa-redis-1:6379');
console.log('🤖 This will help us fix the "You" transcription issue!');

runBot(diagnosticConfig)
  .then(() => {
    console.log('✅ Diagnostic bot completed - check logs for audio analysis');
  })
  .catch((error) => {
    console.error('❌ Diagnostic bot error:', error);
  });