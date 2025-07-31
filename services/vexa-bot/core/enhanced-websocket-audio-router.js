const WebSocket = require('ws');
const http = require('http');
const { Transform } = require('stream');
const EventEmitter = require('events');

console.log('🎧 Starting Enhanced WebSocket Audio Router for real-time Teams->WhisperLive streaming...');

/**
 * Enhanced Audio Router inspired by meetingbot architecture
 * Features:
 * - Real-time audio streaming (not file-based like meetingbot)
 * - Multiple session management with unique routing
 * - Audio chunk buffering and optimization
 * - Connection health monitoring
 * - Automatic reconnection with exponential backoff
 * - Audio quality metrics and monitoring
 */
class EnhancedAudioRouter extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.connectionMetrics = new Map();
    this.audioBuffers = new Map();
    this.healthChecks = new Map();
  }

  /**
   * Initialize a new audio routing session
   * @param {string} sessionId - Unique session identifier
   * @param {string} whisperLiveUrl - WhisperLive WebSocket URL
   * @param {object} config - Session configuration
   */
  async initializeSession(sessionId, whisperLiveUrl, config = {}) {
    console.log(`🔗 Initializing enhanced audio session: ${sessionId} -> ${whisperLiveUrl}`);
    
    // Default configuration optimized for Teams audio
    const sessionConfig = {
      audioSampleRate: config.audioSampleRate || 16000,
      audioChannels: config.audioChannels || 1,
      chunkSize: config.chunkSize || 1024,
      bufferSize: config.bufferSize || 4096,
      reconnectAttempts: config.reconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 1000,
      enableVAD: config.enableVAD || false, // Keep VAD disabled as per working config
      audioFormat: config.audioFormat || 'pcm16',
      language: config.language || 'en',
      task: config.task || 'transcribe',
      ...config
    };

    try {
      // Create WebSocket connection to WhisperLive with enhanced configuration
      const whisperWs = new WebSocket(whisperLiveUrl, {
        headers: {
          'User-Agent': 'VexaAI-Enhanced-Audio-Router/1.0',
          'X-Session-ID': sessionId,
          'X-Audio-Config': JSON.stringify(sessionConfig)
        }
      });

      // Create audio buffer for this session
      const audioBuffer = new AudioBuffer(sessionConfig.bufferSize);
      this.audioBuffers.set(sessionId, audioBuffer);

      // Initialize connection metrics
      this.connectionMetrics.set(sessionId, {
        connected: false,
        lastActivity: Date.now(),
        bytesTransferred: 0,
        reconnectAttempts: 0,
        audioChunksProcessed: 0,
        errors: 0
      });

      // Set up WebSocket event handlers
      whisperWs.on('open', () => {
        console.log(`✅ Enhanced connection established for session: ${sessionId}`);
        
        // Send initial configuration to WhisperLive
        const initMessage = {
          uid: sessionId,
          language: sessionConfig.language,
          task: sessionConfig.task,
          model: "small",
          use_vad: sessionConfig.enableVAD,
          save_output_recording: false,
          return_timestamps: true,
          platform: sessionConfig.platform || "teams",
          meeting_url: sessionConfig.meeting_url || "https://teams.microsoft.com/default",
          token: sessionConfig.token || "vexa-api-key-default",
          meeting_id: sessionConfig.meeting_id || sessionId
        };
        
        whisperWs.send(JSON.stringify(initMessage));
        
        // Update session status
        const session = {
          whisperWs,
          config: sessionConfig,
          connected: true,
          startTime: Date.now(),
          lastAudioTime: null
        };
        
        this.activeSessions.set(sessionId, session);
        this.updateMetrics(sessionId, { connected: true, lastActivity: Date.now() });
        
        // Start health monitoring
        this.startHealthMonitoring(sessionId);
        
        this.emit('sessionConnected', sessionId);
      });

      whisperWs.on('message', (data) => {
        this.handleWhisperLiveResponse(sessionId, data);
        this.updateMetrics(sessionId, { lastActivity: Date.now() });
      });

      whisperWs.on('error', (error) => {
        console.error(`❌ WhisperLive connection error for session ${sessionId}:`, error.message);
        this.updateMetrics(sessionId, { errors: this.connectionMetrics.get(sessionId).errors + 1 });
        this.handleConnectionError(sessionId, error);
      });

      whisperWs.on('close', (code, reason) => {
        console.log(`🔌 WhisperLive connection closed for session ${sessionId}: ${code} - ${reason}`);
        this.handleConnectionClose(sessionId, code, reason);
      });

      return { success: true, sessionId, config: sessionConfig };

    } catch (error) {
      console.error(`❌ Failed to initialize session ${sessionId}:`, error);
      return { success: false, error: error.message, sessionId };
    }
  }

  /**
   * Stream audio data to WhisperLive with enhanced processing
   * @param {string} sessionId - Session identifier
   * @param {Buffer|string} audioData - Raw audio data or base64 encoded
   * @param {object} metadata - Optional audio metadata
   */
  async streamAudio(sessionId, audioData, metadata = {}) {
    const session = this.activeSessions.get(sessionId);
    const buffer = this.audioBuffers.get(sessionId);
    
    if (!session || !session.connected || session.whisperWs.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ Session ${sessionId} not ready for audio streaming`);
      return { success: false, error: 'Session not ready' };
    }

    try {
      // Convert audio data to buffer if needed
      let audioBuffer;
      if (typeof audioData === 'string') {
        audioBuffer = Buffer.from(audioData, 'base64');
      } else {
        audioBuffer = audioData;
      }

      // Add to session audio buffer for processing
      buffer.addChunk(audioBuffer);
      
      // Process buffered audio chunks
      const processedChunks = buffer.getProcessedChunks(session.config.chunkSize);
      
      for (const chunk of processedChunks) {
        // Apply audio processing if needed (filtering, normalization, etc.)
        const processedChunk = this.processAudioChunk(chunk, session.config);
        
        // Send to WhisperLive
        session.whisperWs.send(processedChunk);
        
        // Update metrics
        this.updateMetrics(sessionId, {
          bytesTransferred: this.connectionMetrics.get(sessionId).bytesTransferred + chunk.length,
          audioChunksProcessed: this.connectionMetrics.get(sessionId).audioChunksProcessed + 1,
          lastActivity: Date.now()
        });
      }

      // Update session activity
      session.lastAudioTime = Date.now();
      
      return { 
        success: true, 
        sessionId, 
        bytesProcessed: audioBuffer.length,
        chunksProcessed: processedChunks.length 
      };

    } catch (error) {
      console.error(`❌ Error streaming audio for session ${sessionId}:`, error);
      this.updateMetrics(sessionId, { errors: this.connectionMetrics.get(sessionId).errors + 1 });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process individual audio chunk with quality enhancements
   */
  processAudioChunk(chunk, config) {
    // Apply any audio processing here (noise reduction, normalization, etc.)
    // For now, pass through as-is to maintain compatibility
    return chunk;
  }

  /**
   * Handle WhisperLive responses and transcriptions
   */
  handleWhisperLiveResponse(sessionId, data) {
    try {
      const response = JSON.parse(data.toString());
      
      // Log transcription results
      if (response.message === 'TRANSCRIPTION' && response.segment) {
        console.log(`📝 ENHANCED TRANSCRIPTION [${sessionId}]: "${response.segment}"`);
        this.emit('transcription', sessionId, response.segment, response);
      }
      
      // Handle other response types
      if (response.message === 'SERVER_READY') {
        console.log(`🚀 WhisperLive server ready for session: ${sessionId}`);
        this.emit('serverReady', sessionId);
      }
      
      if (response.message === 'TASK_COMPLETED') {
        console.log(`✅ Transcription task completed for session: ${sessionId}`);
        this.emit('taskCompleted', sessionId, response);
      }

    } catch (error) {
      console.error(`❌ Error parsing WhisperLive response for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle connection errors with automatic recovery
   */
  async handleConnectionError(sessionId, error) {
    const session = this.activeSessions.get(sessionId);
    const metrics = this.connectionMetrics.get(sessionId);
    
    if (!session || !metrics) return;

    console.log(`🔄 Attempting to recover session ${sessionId} after error...`);
    
    if (metrics.reconnectAttempts < session.config.reconnectAttempts) {
      const delay = session.config.reconnectDelay * Math.pow(2, metrics.reconnectAttempts);
      
      setTimeout(async () => {
        console.log(`🔄 Reconnection attempt ${metrics.reconnectAttempts + 1} for session ${sessionId}`);
        this.updateMetrics(sessionId, { reconnectAttempts: metrics.reconnectAttempts + 1 });
        
        // Attempt to reinitialize the session
        const result = await this.initializeSession(sessionId, session.whisperWs.url, session.config);
        if (!result.success) {
          this.emit('sessionFailed', sessionId, error);
        }
      }, delay);
    } else {
      console.error(`❌ Max reconnection attempts reached for session ${sessionId}`);
      this.closeSession(sessionId);
      this.emit('sessionFailed', sessionId, error);
    }
  }

  /**
   * Handle connection close events
   */
  handleConnectionClose(sessionId, code, reason) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.connected = false;
      this.updateMetrics(sessionId, { connected: false });
    }
    
    this.stopHealthMonitoring(sessionId);
    this.emit('sessionClosed', sessionId, code, reason);
  }

  /**
   * Start health monitoring for a session
   */
  startHealthMonitoring(sessionId) {
    const healthCheck = setInterval(() => {
      const session = this.activeSessions.get(sessionId);
      const metrics = this.connectionMetrics.get(sessionId);
      
      if (!session || !metrics) {
        clearInterval(healthCheck);
        return;
      }

      // Check if session is stale (no activity for 30 seconds)
      const timeSinceActivity = Date.now() - metrics.lastActivity;
      if (timeSinceActivity > 30000) {
        console.warn(`⚠️ Session ${sessionId} appears stale (${timeSinceActivity}ms since last activity)`);
        
        // Send ping to keep connection alive
        if (session.connected && session.whisperWs.readyState === WebSocket.OPEN) {
          session.whisperWs.ping();
        }
      }

      // Log session metrics every 60 seconds
      if (Date.now() % 60000 < 5000) {
        console.log(`📊 Session ${sessionId} metrics:`, {
          connected: metrics.connected,
          bytesTransferred: metrics.bytesTransferred,
          audioChunksProcessed: metrics.audioChunksProcessed,
          errors: metrics.errors,
          uptime: Date.now() - session.startTime
        });
      }
    }, 5000);

    this.healthChecks.set(sessionId, healthCheck);
  }

  /**
   * Stop health monitoring for a session
   */
  stopHealthMonitoring(sessionId) {
    const healthCheck = this.healthChecks.get(sessionId);
    if (healthCheck) {
      clearInterval(healthCheck);
      this.healthChecks.delete(sessionId);
    }
  }

  /**
   * Update connection metrics
   */
  updateMetrics(sessionId, updates) {
    const current = this.connectionMetrics.get(sessionId) || {};
    this.connectionMetrics.set(sessionId, { ...current, ...updates });
  }

  /**
   * Close a session and clean up resources
   */
  closeSession(sessionId) {
    console.log(`🔌 Closing enhanced audio session: ${sessionId}`);
    
    const session = this.activeSessions.get(sessionId);
    if (session && session.whisperWs) {
      session.whisperWs.close();
    }
    
    // Clean up resources
    this.activeSessions.delete(sessionId);
    this.audioBuffers.delete(sessionId);
    this.connectionMetrics.delete(sessionId);
    this.stopHealthMonitoring(sessionId);
    
    this.emit('sessionClosed', sessionId);
    
    return { success: true, sessionId };
  }

  /**
   * Get session status and metrics
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    const metrics = this.connectionMetrics.get(sessionId);
    
    if (!session || !metrics) {
      return { exists: false };
    }

    return {
      exists: true,
      connected: session.connected,
      metrics,
      config: session.config,
      uptime: Date.now() - session.startTime
    };
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    const sessions = {};
    for (const [sessionId, session] of this.activeSessions.entries()) {
      sessions[sessionId] = this.getSessionStatus(sessionId);
    }
    return sessions;
  }
}

/**
 * Audio Buffer class for managing streaming audio chunks
 */
class AudioBuffer {
  constructor(maxSize = 4096) {
    this.buffer = Buffer.alloc(0);
    this.maxSize = maxSize;
  }

  addChunk(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    
    // Prevent buffer from growing too large
    if (this.buffer.length > this.maxSize * 2) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }

  getProcessedChunks(chunkSize) {
    const chunks = [];
    let offset = 0;
    
    while (offset + chunkSize <= this.buffer.length) {
      chunks.push(this.buffer.slice(offset, offset + chunkSize));
      offset += chunkSize;
    }
    
    // Keep remaining data in buffer
    this.buffer = this.buffer.slice(offset);
    
    return chunks;
  }
}

// Create enhanced router instance
const audioRouter = new EnhancedAudioRouter();

// Create HTTP server for enhanced proxy management
const server = http.createServer();

// Handle enhanced proxy session requests
server.on('request', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (req.method === 'POST' && url.pathname === '/enhanced/init') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { sessionId, whisperLiveUrl, config } = JSON.parse(body);
        console.log(`🔗 Enhanced initialization request: ${sessionId} -> ${whisperLiveUrl}`);
        
        const result = await audioRouter.initializeSession(sessionId, whisperLiveUrl, config);
        
        res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        
      } catch (error) {
        console.error('❌ Error in enhanced init request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    
  } else if (req.method === 'POST' && url.pathname === '/enhanced/stream') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { sessionId, audioData, metadata } = JSON.parse(body);
        
        const result = await audioRouter.streamAudio(sessionId, audioData, metadata);
        
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        
      } catch (error) {
        console.error('❌ Error in enhanced stream request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    
  } else if (req.method === 'POST' && url.pathname === '/enhanced/close') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { sessionId } = JSON.parse(body);
        
        const result = audioRouter.closeSession(sessionId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        
      } catch (error) {
        console.error('❌ Error in enhanced close request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    
  } else if (req.method === 'GET' && url.pathname === '/enhanced/status') {
    try {
      const sessionId = url.searchParams.get('sessionId');
      
      let result;
      if (sessionId) {
        result = audioRouter.getSessionStatus(sessionId);
      } else {
        result = audioRouter.getAllSessions();
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      
    } catch (error) {
      console.error('❌ Error in status request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start the enhanced proxy server
const PORT = process.env.ENHANCED_PROXY_PORT || 8090;
const HOST = process.env.ENHANCED_PROXY_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Enhanced WebSocket Audio Router running on http://${HOST}:${PORT}`);
  console.log('🎧 Features: Real-time streaming, session management, health monitoring');
  console.log('🔗 Enhanced endpoints:');
  console.log('   POST /enhanced/init     - Initialize enhanced audio session');
  console.log('   POST /enhanced/stream   - Stream audio with quality processing');
  console.log('   POST /enhanced/close    - Close session with cleanup');
  console.log('   GET  /enhanced/status   - Get session status and metrics');
});

// Handle enhanced router events
audioRouter.on('transcription', (sessionId, text, response) => {
  console.log(`🎯 ENHANCED TRANSCRIPTION [${sessionId}]: "${text}"`);
});

audioRouter.on('sessionConnected', (sessionId) => {
  console.log(`✅ Enhanced session connected: ${sessionId}`);
});

audioRouter.on('sessionClosed', (sessionId) => {
  console.log(`🔌 Enhanced session closed: ${sessionId}`);
});

audioRouter.on('sessionFailed', (sessionId, error) => {
  console.error(`❌ Enhanced session failed: ${sessionId} - ${error.message}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔌 Shutting down Enhanced WebSocket Audio Router...');
  
  // Close all active sessions
  const sessions = audioRouter.getAllSessions();
  for (const sessionId of Object.keys(sessions)) {
    console.log(`🔌 Closing enhanced session: ${sessionId}`);
    audioRouter.closeSession(sessionId);
  }
  
  server.close(() => {
    console.log('✅ Enhanced WebSocket Audio Router stopped');
    process.exit(0);
  });
});

process.on('SIGINT', process.kill.bind(process, process.pid, 'SIGTERM'));

module.exports = { EnhancedAudioRouter, AudioBuffer };