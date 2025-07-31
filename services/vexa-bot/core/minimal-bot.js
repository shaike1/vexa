// Minimal Teams bot using existing container
const WebSocket = require('ws');

console.log('🚀 Starting minimal Teams transcription bot...');

const WHISPER_URL = 'ws://vexa-whisperlive-cpu-1:9090';
const SESSION_ID = `minimal-${Date.now()}`;

// Connect to WhisperLive
console.log('🔌 Connecting to WhisperLive...');

const ws = new WebSocket(WHISPER_URL);

ws.on('open', () => {
  console.log('✅ Connected to WhisperLive');
  
  // Initialize session
  const initMessage = {
    uid: SESSION_ID,
    language: 'en',
    task: 'transcribe',
    model: 'small',
    use_vad: false,
    save_output_recording: false,
    return_timestamps: true,
    platform: 'teams',
    meeting_url: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
    token: `minimal-token-${SESSION_ID}`,
    meeting_id: SESSION_ID
  };
  
  console.log('📡 Sending init message to WhisperLive...');
  ws.send(JSON.stringify(initMessage));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 WhisperLive message:', message);
    
    if (message.message === 'SERVER_READY') {
      console.log('🟢 WhisperLive is ready for audio!');
    }
    
    if (message.text) {
      console.log(`\n🎤 TRANSCRIPTION: "${message.text}"\n`);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
});

console.log('✅ Minimal bot running - testing WhisperLive connection...');
console.log('📋 Check if WhisperLive accepts the connection with all required fields');

// Keep alive
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('💓 Connection alive - waiting for audio...');
  } else {
    console.log('❌ Connection lost');
  }
}, 30000);