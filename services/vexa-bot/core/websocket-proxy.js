const WebSocket = require('ws');
const http = require('http');

console.log('🔧 Starting WebSocket Proxy Server for bot-to-WhisperLive communication...');

// Create HTTP server for proxy management
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store active proxy sessions
const proxySessions = new Map();

// Handle proxy session requests
server.on('request', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (req.method === 'POST' && url.pathname === '/proxy/init') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { sessionId, whisperLiveUrl } = JSON.parse(body);
        console.log(`🔗 Initializing proxy session: ${sessionId} -> ${whisperLiveUrl}`);
        
        // Create WebSocket connection to WhisperLive
        const whisperWs = new WebSocket(whisperLiveUrl || 'ws://localhost:9090');
        
        whisperWs.on('open', () => {
          console.log(`✅ Connected to WhisperLive for session: ${sessionId}`);
          proxySessions.set(sessionId, { whisperWs, connected: true });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, sessionId }));
        });
        
        whisperWs.on('error', (error) => {
          console.error(`❌ WhisperLive connection error for session ${sessionId}:`, error.message);
          proxySessions.delete(sessionId);
          
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: error.message,
            sessionId 
          }));
        });
        
        whisperWs.on('message', (data) => {
          // Handle responses from WhisperLive if needed
          console.log(`📝 WhisperLive response for session ${sessionId}:`, data.toString());
        });
        
        whisperWs.on('close', () => {
          console.log(`🔌 WhisperLive disconnected for session: ${sessionId}`);
          proxySessions.delete(sessionId);
        });
        
      } catch (error) {
        console.error('❌ Error parsing proxy init request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    
  } else if (req.method === 'POST' && url.pathname === '/proxy/send') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { sessionId, audioData } = JSON.parse(body);
        const session = proxySessions.get(sessionId);
        
        if (session && session.connected && session.whisperWs.readyState === WebSocket.OPEN) {
          // Forward audio data to WhisperLive
          const audioBuffer = Buffer.from(audioData, 'base64');
          session.whisperWs.send(audioBuffer);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, sessionId, bytes: audioBuffer.length }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Session not found or not connected',
            sessionId 
          }));
        }
        
      } catch (error) {
        console.error('❌ Error processing audio send request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    
  } else if (req.method === 'POST' && url.pathname === '/proxy/close') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { sessionId } = JSON.parse(body);
        const session = proxySessions.get(sessionId);
        
        if (session) {
          session.whisperWs.close();
          proxySessions.delete(sessionId);
          console.log(`🔌 Closed proxy session: ${sessionId}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, sessionId }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Session not found', sessionId }));
        }
        
      } catch (error) {
        console.error('❌ Error processing close request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start the proxy server
const PORT = process.env.PROXY_PORT || 8088;
const HOST = process.env.PROXY_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 WebSocket Proxy Server running on http://${HOST}:${PORT}`);
  console.log('📡 Ready to proxy bot audio to WhisperLive');
  console.log('🔗 Available endpoints:');
  console.log('   POST /proxy/init   - Initialize proxy session');
  console.log('   POST /proxy/send   - Send audio data to WhisperLive');
  console.log('   POST /proxy/close  - Close proxy session');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔌 Shutting down WebSocket Proxy Server...');
  
  // Close all active sessions
  for (const [sessionId, session] of proxySessions.entries()) {
    console.log(`🔌 Closing session: ${sessionId}`);
    session.whisperWs.close();
  }
  
  server.close(() => {
    console.log('✅ WebSocket Proxy Server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', process.kill.bind(process, process.pid, 'SIGTERM'));