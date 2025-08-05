const WebSocket = require('ws');
const http = require('http');

console.log('[Bridge] Starting WebSocket bridge server...');

const BOT_CONFIG = JSON.parse(process.env.BOT_CONFIG || '{}');
const BRIDGE_PORT = 8080;
const WHISPERLIVE_URL = BOT_CONFIG.whisperLiveUrl || 'ws://vexa-whisperlive-cpu-2:9090';

console.log('[Bridge] WhisperLive URL:', WHISPERLIVE_URL);
console.log('[Bridge] Bot Config:', BOT_CONFIG);

let whisperWs = null;
let isInitialized = false;

// Initialize WhisperLive connection
function connectToWhisperLive() {
  console.log('[Bridge] Connecting to WhisperLive...');
  
  whisperWs = new WebSocket(WHISPERLIVE_URL);
  
  whisperWs.on('open', () => {
    console.log('[Bridge] ✅ Connected to WhisperLive');
    
    // Send initialization message
    const initMessage = {
      uid: BOT_CONFIG.connectionId || 'bridge-session',
      language: BOT_CONFIG.language || 'en',
      task: BOT_CONFIG.task || 'transcribe',
      platform: BOT_CONFIG.platform || 'teams',
      meeting_url: BOT_CONFIG.meetingUrl || '',
      token: BOT_CONFIG.token || 'bridge-token',
      meeting_id: BOT_CONFIG.nativeMeetingId || 'bridge-meeting'
    };
    
    console.log('[Bridge] Sending init message:', initMessage);
    whisperWs.send(JSON.stringify(initMessage));
  });
  
  whisperWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[Bridge] WhisperLive response:', message);
      
      if (message.status === 'SERVER_READY') {
        isInitialized = true;
        console.log('[Bridge] ✅ WhisperLive ready for audio');
      }
      
      if (message.text) {
        console.log('[Bridge] 🗣️ TRANSCRIPTION:', message.text);
      }
    } catch (error) {
      console.log('[Bridge] Error parsing WhisperLive message:', error.message);
    }
  });
  
  whisperWs.on('error', (error) => {
    console.log('[Bridge] ❌ WhisperLive error:', error.message);
    isInitialized = false;
  });
  
  whisperWs.on('close', () => {
    console.log('[Bridge] WhisperLive connection closed, reconnecting in 5s...');
    isInitialized = false;
    setTimeout(connectToWhisperLive, 5000);
  });
}

// HTTP server for browser communication
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'POST' && req.url === '/audio') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      if (isInitialized && whisperWs && whisperWs.readyState === WebSocket.OPEN) {
        try {
          // Parse the JSON data from the bot
          const audioRequest = JSON.parse(body);
          const { sessionUid, audioData } = audioRequest;
          
          console.log('[Bridge] Received audio for session:', sessionUid, 'length:', audioData.length);
          
          // Check if audio contains actual sound (not just silence)
          const hasSound = audioData.some(sample => Math.abs(sample) > 0.01);
          
          if (hasSound) {
            console.log('[Bridge] 🎯 REAL AUDIO DETECTED! Processing...');
          } else {
            console.log('[Bridge] 🔇 Silent audio, skipping...');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, silent: true }));
            return;
          }
          
          // Convert Float32Array data to Int16 PCM bytes
          const int16Data = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            int16Data[i] = sample * 32767;
          }
          
          // Convert to raw bytes
          const buffer = new ArrayBuffer(int16Data.length * 2);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < int16Data.length; i++) {
            const value = int16Data[i];
            view[i * 2] = value & 0xFF;
            view[i * 2 + 1] = (value >> 8) & 0xFF;
          }
          
          // Forward raw audio bytes to WhisperLive
          whisperWs.send(view);
          console.log('[Bridge] Forwarded', view.length, 'bytes to WhisperLive for session', sessionUid);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, bytes: view.length, session: sessionUid }));
        } catch (error) {
          console.log('[Bridge] Error processing audio:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'WhisperLive not ready',
          initialized: isInitialized,
          wsState: whisperWs ? whisperWs.readyState : null
        }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      whisperlive_connected: whisperWs && whisperWs.readyState === WebSocket.OPEN,
      initialized: isInitialized,
      bot_config: BOT_CONFIG.connectionId
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(BRIDGE_PORT, () => {
  console.log(`[Bridge] HTTP server listening on port ${BRIDGE_PORT}`);
  connectToWhisperLive();
});

process.on('SIGTERM', () => {
  console.log('[Bridge] Shutting down...');
  if (whisperWs) whisperWs.close();
  server.close();
  process.exit(0);
});