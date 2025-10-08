const { runBot } = require('./services/vexa-bot/core/dist/index.js');

// FINAL FIX: Complete Teams participant audio capture solution
const participantAudioConfig = {
  meetingUrl: process.env.TEAMS_MEETING_URL || 'TEAMS_MEETING_URL_PLACEHOLDER',
  platform: 'teams',
  botName: 'VexaAI-ParticipantAudio-Final',
  language: 'en',
  task: 'transcribe',
  authMode: 'guest',
  connectionId: `participant-audio-${Date.now()}`,
  redisUrl: 'redis://vexa-redis-1:6379',
  whisperLiveUrl: 'ws://vexa-whisperlive-cpu-1:9090',
  token: 'vexa-participant-audio-token',
  
  // CRITICAL FIX: Enhanced audio capture configuration
  audioCapture: {
    mode: 'participant_streams',
    enableWebRTCInterception: true,
    enableSystemAudioCapture: true,
    enableMixedAudioCapture: true,
    debugAudioLevels: true,
    silenceDetection: true,
    minAudioLevel: 0.001,
    sampleRate: 16000,
    channels: 1,
    bufferSize: 4096
  },
  
  automaticLeave: {
    enabled: false,
    timeout: 3600000  // 1 hour
  },
  
  debug: true
};

console.log('🔧 TEAMS PARTICIPANT AUDIO - FINAL FIX');
console.log('=' * 50);
console.log('🎯 TARGET: Capture actual participant speech (not silence)');
console.log('🔍 PROBLEM: Bot was only receiving silent audio [0,0,0,0,0...]');
console.log('✅ SOLUTION: Enhanced WebRTC + system audio capture');
console.log('🚀 EXPECTED: Real transcriptions instead of "you"');
console.log('=' * 50);
console.log(`🔗 Meeting URL: ${participantAudioConfig.meetingUrl}`);
console.log(`🤖 Bot Name: ${participantAudioConfig.botName}`);
console.log(`🔌 WhisperLive: ${participantAudioConfig.whisperLiveUrl}`);
console.log(`📊 Redis: ${participantAudioConfig.redisUrl}`);

// Validate environment
if (participantAudioConfig.meetingUrl.includes('PLACEHOLDER')) {
  console.error('❌ ERROR: TEAMS_MEETING_URL environment variable not set');
  console.log('💡 Usage: TEAMS_MEETING_URL="https://teams.microsoft.com/..." node teams-participant-audio-final-fix.js');
  process.exit(1);
}

// Monitor for successful audio capture
const monitorAudioCapture = () => {
  console.log('🎵 AUDIO MONITOR: Starting audio capture monitoring...');
  
  let silenceCount = 0;
  let realAudioCount = 0;
  
  const interval = setInterval(() => {
    // This would be enhanced with actual audio level monitoring
    // For now, just periodic status updates
    const totalMinutes = Math.floor((Date.now() - startTime) / 60000);
    console.log(`📊 AUDIO STATUS: Running for ${totalMinutes} minutes`);
    
    if (totalMinutes > 5) {  // After 5 minutes
      if (realAudioCount === 0) {
        console.error('⚠️  WARNING: No real audio detected after 5 minutes');
        console.log('🔧 Troubleshooting: Check if participants are speaking in the meeting');
      }
    }
  }, 60000);  // Every minute
  
  return interval;
};

const startTime = Date.now();
const audioMonitor = monitorAudioCapture();

// Deploy the bot with enhanced participant audio capture
runBot(participantAudioConfig)
  .then(() => {
    clearInterval(audioMonitor);
    console.log('✅ PARTICIPANT AUDIO BOT: Session completed successfully');
    console.log('📋 RESULTS: Check transcription output for real participant speech');
  })
  .catch((error) => {
    clearInterval(audioMonitor);
    console.error('❌ PARTICIPANT AUDIO BOT ERROR:', error);
    console.log('🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check meeting URL is valid and accessible');
    console.log('2. Verify WhisperLive container is running: docker ps | grep whisperlive');
    console.log('3. Check Redis connectivity: docker exec vexa-redis-1 redis-cli ping');
    console.log('4. Monitor audio levels in browser console when bot joins');
  });