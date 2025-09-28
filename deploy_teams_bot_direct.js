#!/usr/bin/env node

const { runBot } = require('./services/vexa-bot/core/dist/index.js');

// Get meeting URL from command line argument
const meetingUrl = process.argv[2];

if (!meetingUrl) {
  console.error('Usage: node deploy_teams_bot_direct.js <teams_meeting_url>');
  console.error('Example: node deploy_teams_bot_direct.js "https://teams.microsoft.com/meet/..."');
  process.exit(1);
}

const fixedBotConfig = {
  meetingUrl: meetingUrl,
  platform: 'teams',
  botName: 'VexaAI-AudioFixed-Direct',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: `audio-fixed-${Date.now()}`,
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:8090',
  token: 'vexa-teams-audio-fixed',
  nativeMeetingId: `teams-fixed-${Date.now()}`,
  audioSettings: {
    sampleRate: 16000,
    channels: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  },
  automaticLeave: {
    enabled: false,
    timeout: 1800000,
    waitingRoomTimeout: 300000,
    noOneJoinedTimeout: 300000,
    everyoneLeftTimeout: 300000
  }
};

console.log('🎯 DEPLOYING TEAMS AUDIO FIXED BOT - DIRECT MODE');
console.log('================================================');
console.log('');
console.log(`📱 Meeting: ${meetingUrl}`);
console.log(`🔧 Bot: ${fixedBotConfig.botName}`);
console.log(`🔌 WebSocket: ${fixedBotConfig.whisperLiveUrl}`);
console.log(`📊 Redis: ${fixedBotConfig.redisUrl}`);
console.log('');
console.log('🚀 FIXES APPLIED:');
console.log('  ✅ Real participant audio capture (not bot microphone)');
console.log('  ✅ Enhanced audio processing with level monitoring');
console.log('  ✅ Proper resampling for WhisperLive compatibility'); 
console.log('  ✅ Session consistency and error handling');
console.log('');
console.log('🎵 Expected Log Messages:');
console.log('  - "🎵 PARTICIPANT AUDIO LEVEL: 0.045231 (REAL AUDIO!)"');
console.log('  - "✅ FIXED: Sent 4096 participant audio samples to WhisperLive"');
console.log('  - "✅ FIXED AUDIO PIPELINE: Stream → WhisperLive"');
console.log('');
console.log('⏳ Starting bot...');

runBot(fixedBotConfig)
  .then(() => {
    console.log('✅ Teams Audio Fixed Bot completed successfully');
    console.log('📋 Bot should have captured and transcribed real participant speech');
  })
  .catch((error) => {
    console.error('❌ Teams Audio Fixed Bot error:', error);
    console.error('');
    console.error('🔍 Common issues:');
    console.error('  1. Check if WhisperLive service is running and accessible');
    console.error('  2. Verify Redis connectivity');
    console.error('  3. Ensure bot is admitted to the Teams meeting');
    console.error('  4. Check meeting URL is valid and active');
    process.exit(1);
  });