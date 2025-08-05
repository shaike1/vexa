const WebSocket = require('ws');

console.log('[Simple Bridge] Starting simple WebSocket bridge...');

const WHISPERLIVE_URL = 'ws://vexa-whisperlive-cpu-2:9090';
const BRIDGE_PORT = 8771;

let whisperConnections = new Map(); // sessionId -> WhisperLive WebSocket

// Create WebSocket server for clients
const wss = new WebSocket.Server({ port: BRIDGE_PORT });

console.log(`[Simple Bridge] Bridge server listening on port ${BRIDGE_PORT}`);
console.log(`[Simple Bridge] WhisperLive target: ${WHISPERLIVE_URL}`);

wss.on('connection', (clientWs) => {
    console.log('[Simple Bridge] 🔗 New client connected');
    
    let sessionId = null;
    let whisperWs = null;
    
    clientWs.on('message', (data) => {
        try {
            // Try to parse as JSON (init message)
            const message = JSON.parse(data.toString());
            console.log('[Simple Bridge] 📨 Client message:', message);
            
            if (message.type === 'init' || message.uid) {
                // This is an initialization message
                sessionId = message.session_id || message.uid || `session-${Date.now()}`;
                
                console.log(`[Simple Bridge] 🚀 Initializing session: ${sessionId}`);
                
                // Create new WhisperLive connection for this session
                whisperWs = new WebSocket(WHISPERLIVE_URL);
                whisperConnections.set(sessionId, whisperWs);
                
                whisperWs.on('open', () => {
                    console.log(`[Simple Bridge] ✅ Connected to WhisperLive for session ${sessionId}`);
                    
                    // Send WhisperLive initialization
                    const whisperInit = {
                        uid: sessionId,
                        language: message.language || 'en',
                        task: message.task || 'transcribe',
                        platform: message.platform || 'bridge',
                        meeting_url: message.meeting_url || 'bridge://audio-capture',
                        token: message.token || 'bridge-audio-token',
                        meeting_id: message.meeting_id || `bridge-${Date.now()}`
                    };
                    
                    console.log(`[Simple Bridge] 📤 Sending WhisperLive init:`, whisperInit);
                    whisperWs.send(JSON.stringify(whisperInit));
                });
                
                whisperWs.on('message', (whisperData) => {
                    try {
                        const whisperMessage = JSON.parse(whisperData.toString());
                        console.log(`[Simple Bridge] 🗣️ WhisperLive [${sessionId}]:`, whisperMessage);
                        
                        // Forward transcription results back to client
                        if (whisperMessage.message === 'SERVER_READY') {
                            console.log(`[Simple Bridge] ✅ WhisperLive ready for session ${sessionId}`);
                            clientWs.send(JSON.stringify({ status: 'ready', session: sessionId }));
                        } else if (whisperMessage.text) {
                            const transcription = {
                                type: 'transcription',
                                text: whisperMessage.text,
                                partial: whisperMessage.partial || false,
                                session: sessionId
                            };
                            console.log(`[Simple Bridge] 📢 TRANSCRIPTION [${sessionId}]: "${whisperMessage.text}"`);
                            clientWs.send(JSON.stringify(transcription));
                        }
                    } catch (error) {
                        // Binary data from WhisperLive
                        console.log(`[Simple Bridge] 📦 WhisperLive binary data [${sessionId}]`);
                    }
                });
                
                whisperWs.on('error', (error) => {
                    console.error(`[Simple Bridge] ❌ WhisperLive error [${sessionId}]:`, error);
                });
                
                whisperWs.on('close', () => {
                    console.log(`[Simple Bridge] 🔌 WhisperLive disconnected [${sessionId}]`);
                    whisperConnections.delete(sessionId);
                });
            }
            
        } catch (error) {
            // Not JSON - assume it's binary audio data
            if (whisperWs && whisperWs.readyState === WebSocket.OPEN) {
                whisperWs.send(data);
                
                // Log occasionally 
                if (Math.random() < 0.01) { // 1% of the time
                    console.log(`[Simple Bridge] 🎵 Audio forwarded [${sessionId}]: ${data.length} bytes`);
                }
            } else {
                console.log(`[Simple Bridge] ⚠️ Audio received but WhisperLive not ready [${sessionId}]`);
            }
        }
    });
    
    clientWs.on('close', () => {
        console.log(`[Simple Bridge] 🔌 Client disconnected [${sessionId}]`);
        if (whisperWs) {
            whisperWs.close();
            whisperConnections.delete(sessionId);
        }
    });
    
    clientWs.on('error', (error) => {
        console.error(`[Simple Bridge] ❌ Client error [${sessionId}]:`, error);
    });
});

console.log('[Simple Bridge] 🎯 Simple bridge ready for connections');
console.log('[Simple Bridge] Connect desktop audio to: ws://localhost:8771');