const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration based on solid solutions
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream' }));

const PORT = 8090;
const WHISPERLIVE_URL = process.env.WHISPER_LIVE_URL || 'ws://whisperlive-cpu:9090';

// Store active WebSocket connections per session
const sessions = new Map();

console.log(`🚀 WebSocket Proxy Bridge starting on port ${PORT}`);
console.log(`📡 Forwarding to WhisperLive: ${WHISPERLIVE_URL}`);

// Initialize session with WebSocket connection to WhisperLive
app.post('/initialize', async (req, res) => {
  const { uid, platform, meeting_url, token, meeting_id, language, task } = req.body;
  
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }
  
  console.log(`🔌 Initializing session ${uid} for platform ${platform}`);
  
  try {
    const ws = new WebSocket(WHISPERLIVE_URL);
    
    ws.on('open', () => {
      console.log(`✅ WebSocket connected for session ${uid}`);
      
      // Send initial config to WhisperLive
      const config = {
        uid,
        platform: platform || 'teams',
        meeting_url: meeting_url || null,
        token: token || null,
        meeting_id: meeting_id || uid,
        language: language || 'en',
        task: task || 'transcribe',
        model: 'medium',
        use_vad: true
      };
      
      ws.send(JSON.stringify(config));
      console.log(`📤 Sent config for session ${uid}:`, config);
    });
    
    ws.on('message', (data) => {
      const message = data.toString();
      console.log(`📥 Received from WhisperLive for ${uid}:`, message);
      
      // Store the latest message for this session
      if (sessions.has(uid)) {
        sessions.get(uid).lastMessage = message;
      }
    });
    
    ws.on('error', (error) => {
      handleWebSocketError(uid, error, 'during operation');
    });
    
    ws.on('close', () => {
      console.log(`🔌 WebSocket closed for session ${uid}`);
      sessions.delete(uid);
    });
    
    // Store session
    sessions.set(uid, { 
      ws, 
      lastMessage: null,
      created: Date.now()
    });
    
    res.json({ status: 'initialized', uid });
    
  } catch (error) {
    handleWebSocketError(uid, error, 'during initialization');
    res.status(500).json({ 
      error: 'Failed to initialize WebSocket connection',
      details: error.message,
      session_id: uid
    });
  }
});

// Send audio data to WhisperLive
app.post('/audio', (req, res) => {
  const { sessionUid, audioData } = req.body;
  
  if (!sessionUid) {
    return res.status(400).json({ error: 'Missing sessionUid parameter' });
  }
  
  const session = sessions.get(sessionUid);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (session.ws.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: 'WebSocket not ready' });
  }
  
  // Convert audio data array to Buffer and send to WhisperLive
  const audioBuffer = Buffer.from(audioData);
  session.ws.send(audioBuffer);
  
  // Return latest transcription message if available
  const response = session.lastMessage ? 
    { status: 'sent', transcription: session.lastMessage } : 
    { status: 'sent' };
    
  res.json(response);
});

// Get latest transcription for a session
app.get('/transcription/:uid', (req, res) => {
  const { uid } = req.params;
  const session = sessions.get(uid);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ 
    transcription: session.lastMessage || null,
    status: session.ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'
  });
});

// Reconfigure session
app.post('/reconfigure', (req, res) => {
  const { uid, language, task } = req.body;
  
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }
  
  const session = sessions.get(uid);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (session.ws.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: 'WebSocket not ready' });
  }
  
  // Send reconfiguration message to WhisperLive
  const config = {
    uid,
    language: language || 'en',
    task: task || 'transcribe',
    model: 'medium',
    use_vad: true
  };
  
  session.ws.send(JSON.stringify(config));
  console.log(`🔄 Reconfigured session ${uid}:`, config);
  
  res.json({ status: 'reconfigured', uid });
});

// Close session
app.post('/close', (req, res) => {
  const { uid } = req.body;
  
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }
  
  const session = sessions.get(uid);
  
  if (session) {
    session.ws.close();
    sessions.delete(uid);
    console.log(`🗑️ Closed session ${uid}`);
  }
  
  res.json({ status: 'closed' });
});

// Legacy close endpoint for backward compatibility
app.delete('/session/:uid', (req, res) => {
  const { uid } = req.params;
  const session = sessions.get(uid);
  
  if (session) {
    session.ws.close();
    sessions.delete(uid);
    console.log(`🗑️ Closed session ${uid}`);
  }
  
  res.json({ status: 'closed' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    sessions: sessions.size,
    whisperlive_url: WHISPERLIVE_URL
  });
});

// Enhanced error handling and connection management based on proven solutions
const handleWebSocketError = (sessionId, error, context = '') => {
  console.error(`❌ WebSocket error for session ${sessionId} ${context}:`, error.message);
  const session = sessions.get(sessionId);
  if (session) {
    session.lastError = { message: error.message, timestamp: Date.now(), context };
  }
};

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('🔄 Graceful shutdown initiated...');
  
  // Close all active WebSocket connections
  for (const [sessionId, session] of sessions.entries()) {
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      console.log(`🔌 Closing session ${sessionId}`);
      session.ws.close();
    }
  }
  
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Enhanced server startup with proper error handling
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Enhanced WebSocket Proxy Bridge running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Forwarding to WhisperLive: ${WHISPERLIVE_URL}`);
  console.log(`🔒 CORS enabled for all origins`);
});