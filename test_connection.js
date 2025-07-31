const WebSocket = require('ws');

console.log('🧪 Testing WhisperLive connection...');

const ws = new WebSocket('ws://localhost:9090');

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  
  const initMsg = {
    uid: 'connection-test',
    language: 'en',
    task: 'transcribe',
    platform: 'teams',
    meeting_url: 'test-url',
    token: 'test-token',
    meeting_id: 'test-meeting'
  };
  
  ws.send(JSON.stringify(initMsg));
  console.log('📤 Sent initialization message');
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
});

ws.on('error', (err) => {
  console.log('❌ WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('⏰ Test timeout - closing');
  ws.close();
}, 5000);