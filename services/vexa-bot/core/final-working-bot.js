// Final working bot - simplified approach
const { spawn } = require('child_process');
const WebSocket = require('ws');

console.log('🚀 Starting final working bot...');

const SESSION_ID = `final-working-${Date.now()}`;
const WHISPER_URL = 'ws://vexa-whisperlive-cpu-1:9090';

let whisperSocket = null;
let isReady = false;

// Connect to WhisperLive with correct format
function connectToWhisperLive() {
  console.log('🔌 Connecting to WhisperLive...');
  
  whisperSocket = new WebSocket(WHISPER_URL);
  
  whisperSocket.on('open', () => {
    console.log('✅ Connected to WhisperLive');
    
    const initMessage = {
      uid: SESSION_ID,
      language: 'en',
      task: 'transcribe',
      platform: 'teams',
      meeting_url: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
      token: `vexa-final-token-${SESSION_ID}`,
      meeting_id: `final-meeting-${SESSION_ID}`
    };
    
    console.log('📡 Sending init to WhisperLive...');
    whisperSocket.send(JSON.stringify(initMessage));
  });
  
  whisperSocket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 WhisperLive:', message);
      
      if (message.message === 'SERVER_READY' || message.status === 'SERVER_READY') {
        console.log('🟢 WhisperLive ready for audio!');
        isReady = true;
      }
      
      if (message.text) {
        console.log(`\n🎤 LIVE TRANSCRIPTION: "${message.text}"\n`);
      }
    } catch (error) {
      console.error('Error parsing WhisperLive message:', error);
    }
  });
  
  whisperSocket.on('error', (error) => {
    console.error('❌ WhisperLive error:', error);
  });
  
  whisperSocket.on('close', () => {
    console.log('🔌 WhisperLive connection closed');
    isReady = false;
  });
}

// Start WhisperLive connection
connectToWhisperLive();

// Start the existing bot in the background
console.log('🤖 Starting Teams bot in background...');

const botProcess = spawn('node', ['/app/dist/index.js'], {
  env: {
    ...process.env,
    BOT_CONFIG: JSON.stringify({
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
      platform: 'teams',
      botName: 'VexaAI-FinalWorking',
      language: 'en',
      task: 'transcribe',
      authMode: 'guest',
      connectionId: SESSION_ID,
      redisUrl: 'redis://vexa-redis-1:6379',
      whisperLiveUrl: WHISPER_URL,
      token: `vexa-final-token-${SESSION_ID}`,
      nativeMeetingId: `final-meeting-${SESSION_ID}`,
      automaticLeave: {
        enabled: false,
        timeout: 999999,
        waitingRoomTimeout: 300000,
        noOneJoinedTimeout: 300000,
        everyoneLeftTimeout: 300000
      }
    })
  },
  stdio: 'pipe'
});

botProcess.stdout.on('data', (data) => {
  console.log('[Bot]', data.toString().trim());
});

botProcess.stderr.on('data', (data) => {
  console.error('[Bot Error]', data.toString().trim());
});

console.log('✅ Final working bot started!');
console.log('🎤 This bot will join Teams and stream audio to WhisperLive');
console.log('📋 Check for admission request in your Teams meeting');

// Keepalive
setInterval(() => {
  if (isReady) {
    console.log('💓 Bot ready for transcription...');
  }
}, 30000);