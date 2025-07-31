const WebSocket = require('ws');

console.log('🔌 Testing WhisperLive connection...');

const ws = new WebSocket('ws://vexa-whisperlive-cpu-1:9090');

ws.on('open', () => {
  console.log('✅ Connected to WhisperLive');
  
  // Try minimal init message first
  ws.send(JSON.stringify({
    uid: 'test-123',
    language: 'en', 
    task: 'transcribe'
  }));
});

ws.on('message', (data) => {
  console.log('📥 WhisperLive:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

setTimeout(() => process.exit(0), 5000);