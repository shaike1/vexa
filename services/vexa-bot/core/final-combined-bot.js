// FINAL COMBINED BOT - Teams audio capture + WhisperLive connection
const WebSocket = require('ws');
const { spawn } = require('child_process');

console.log('🚀 FINAL COMBINED BOT - Starting complete solution...');

const SESSION_ID = `final-combined-${Date.now()}`;
const WHISPER_URL = 'ws://vexa-whisperlive-cpu-1:9090';

let whisperSocket = null;
let isWhisperReady = false;
let botProcess = null;

// Part 1: Working WhisperLive connection
function connectToWhisperLive() {
  console.log('🔌 [Part 1] Connecting to WhisperLive with proven format...');
  
  whisperSocket = new WebSocket(WHISPER_URL);
  
  whisperSocket.on('open', () => {
    console.log('✅ [Part 1] Connected to WhisperLive');
    
    // Use the EXACT format that worked in our tests
    const initMessage = {
      uid: SESSION_ID,
      language: 'en',
      task: 'transcribe',
      platform: 'teams',
      meeting_url: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
      token: `vexa-final-combined-${SESSION_ID}`,
      meeting_id: `final-combined-meeting-${SESSION_ID}`
    };
    
    console.log('📡 [Part 1] Sending proven init format...');
    whisperSocket.send(JSON.stringify(initMessage));
  });
  
  whisperSocket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 [WhisperLive]', message);
      
      if (message.message === 'SERVER_READY' || message.status === 'SERVER_READY') {
        console.log('🟢 [Part 1] WhisperLive ready for audio!');
        isWhisperReady = true;
      }
      
      if (message.text) {
        console.log(`\n🎤 LIVE TRANSCRIPTION: "${message.text}"\n`);
      }
    } catch (error) {
      console.error('[WhisperLive] Error parsing message:', error);
    }
  });
  
  whisperSocket.on('error', (error) => {
    console.error('❌ [Part 1] WhisperLive error:', error);
    isWhisperReady = false;
    setTimeout(connectToWhisperLive, 3000);
  });
  
  whisperSocket.on('close', () => {
    console.log('🔌 [Part 1] WhisperLive closed, reconnecting...');
    isWhisperReady = false;
    setTimeout(connectToWhisperLive, 3000);
  });
}

// Part 2: Start Teams bot with audio capture
function startTeamsBot() {
  console.log('🤖 [Part 2] Starting Teams bot with audio capture...');
  
  const botConfig = {
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
    platform: 'teams',
    botName: 'VexaAI-FinalCombined',
    language: 'en',
    task: 'transcribe',
    authMode: 'guest',
    connectionId: SESSION_ID,
    redisUrl: 'redis://vexa-redis-1:6379',
    whisperLiveUrl: WHISPER_URL,
    token: `vexa-final-combined-${SESSION_ID}`,
    nativeMeetingId: `final-combined-meeting-${SESSION_ID}`,
    automaticLeave: {
      enabled: false,
      timeout: 999999,
      waitingRoomTimeout: 300000,
      noOneJoinedTimeout: 300000,
      everyoneLeftTimeout: 300000
    }
  };

  // Start the Teams bot process
  const env = {
    ...process.env,
    BOT_CONFIG: JSON.stringify(botConfig),
    NODE_ENV: 'production'
  };

  botProcess = spawn('node', ['/app/dist/index.js'], {
    env: env,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: '/app'
  });

  botProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log('[Teams Bot]', output);
    
    // Look for successful audio capture
    if (output.includes('Successfully combined') && output.includes('audio streams')) {
      console.log('🎵 [Part 2] TEAMS AUDIO CAPTURE SUCCESS!');
    }
  });

  botProcess.stderr.on('data', (data) => {
    const error = data.toString().trim();
    if (!error.includes('pulseaudio') && !error.includes('conf-parser')) {
      console.error('[Teams Bot Error]', error);
    }
  });

  botProcess.on('close', (code) => {
    console.log(`[Teams Bot] Process exited with code ${code}`);
  });
}

// Start both parts
console.log('🚀 Starting final combined solution...');

// Start WhisperLive connection first
connectToWhisperLive();

// Start Teams bot after a short delay
setTimeout(() => {
  startTeamsBot();
}, 2000);

// Monitor status
setInterval(() => {
  const whisperStatus = isWhisperReady ? '✅ Ready' : '❌ Not Ready';
  const botStatus = botProcess ? '✅ Running' : '❌ Not Running';
  
  console.log(`💓 Status Check - WhisperLive: ${whisperStatus}, Teams Bot: ${botStatus}`);
  
  if (isWhisperReady && botProcess) {
    console.log('🎉 BOTH PARTS WORKING - Ready for transcription!');
  }
}, 20000);

console.log('✅ Final combined bot started');
console.log('🎤 This combines Teams audio capture + WhisperLive connection');
console.log('📋 Bot will join Teams meeting and stream audio for transcription');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down final combined bot...');
  
  if (whisperSocket) {
    whisperSocket.close();
  }
  
  if (botProcess) {
    botProcess.kill('SIGTERM');
  }
  
  process.exit(0);
});