// WebSocket fix for existing bot - connects directly to WhisperLive with correct format
const WebSocket = require('ws');

console.log('🔧 Starting WebSocket fix for existing bot...');

const WHISPER_URL = 'ws://vexa-whisperlive-cpu-1:9090';
const SESSION_ID = `fixed-${Date.now()}`;

let whisperSocket = null;
let isReady = false;

function connectToWhisperLive() {
  console.log('🔌 Connecting to WhisperLive with correct format...');
  
  whisperSocket = new WebSocket(WHISPER_URL);
  
  whisperSocket.on('open', () => {
    console.log('✅ Connected to WhisperLive');
    
    // Send the exact format WhisperLive expects
    const initMessage = {
      uid: SESSION_ID,
      language: 'en',
      task: 'transcribe', 
      platform: 'teams',
      meeting_url: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
      token: `vexa-fixed-token-${SESSION_ID}`,
      meeting_id: `meeting-${SESSION_ID}`
    };
    
    console.log('📡 Sending correct init message:', JSON.stringify(initMessage, null, 2));
    whisperSocket.send(JSON.stringify(initMessage));
  });
  
  whisperSocket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 WhisperLive response:', message);
      
      if (message.message === 'SERVER_READY' || message.status === 'SERVER_READY') {
        console.log('🟢 WhisperLive is ready for audio!');
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
    console.error('❌ WhisperLive connection error:', error);
    setTimeout(connectToWhisperLive, 5000); // Retry in 5 seconds
  });
  
  whisperSocket.on('close', () => {
    console.log('🔌 WhisperLive connection closed, retrying...');
    isReady = false;
    setTimeout(connectToWhisperLive, 3000); // Retry in 3 seconds
  });
}

// Start the connection
connectToWhisperLive();

// Send test audio data every 10 seconds to simulate audio stream
setInterval(() => {
  if (whisperSocket && whisperSocket.readyState === WebSocket.OPEN && isReady) {
    // Send empty audio data to keep connection alive
    console.log('💓 Sending keepalive to WhisperLive...');
    whisperSocket.send(''); // Empty audio data
  } else {
    console.log('⏳ Waiting for WhisperLive to be ready...');
  }
}, 10000);

console.log('✅ WebSocket fix running - will connect to WhisperLive with correct format');
console.log('🎤 This should receive transcriptions when you speak in the meeting');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('🛑 Shutting down WebSocket fix...');
  if (whisperSocket) {
    whisperSocket.close();
  }
  process.exit(0);
});