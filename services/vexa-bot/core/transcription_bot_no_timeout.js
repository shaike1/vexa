const { runBot } = require('./dist/index.js');

// Override the bot's participant checking to prevent early leaving
const originalConsoleLog = console.log;
console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('Teams participant check') || message.includes('Teams bot has been alone')) {
    // Suppress participant check messages that trigger early leaving
    return;
  }
  originalConsoleLog.apply(console, args);
};

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmNjMDIyMGUtMjNhOC00ZTA0LWEzMGMtZjkxMzI0NTk0MzEw%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%22408dd64d-22eb-4693-b56d-1f88675a3170%22%7d',
  platform: 'teams',
  botName: 'VexaAI-Live-Test',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'real-speech-test',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:19090',
  persistentMode: true,
  // Try to disable participant checking
  skipParticipantCheck: true,
  aloneTimeoutMs: 1800000 // 30 minutes
};

console.log('🎯 Starting PERSISTENT bot to capture your real speech...');
console.log('🔧 Participant timeout detection DISABLED');
console.log('🎤 Session: real-speech-test');

runBot(transcriptionConfig)
  .then(() => {
    console.log('✅ Speech capture session completed');
  })
  .catch((error) => {
    console.error('❌ Speech capture error:', error);
  });