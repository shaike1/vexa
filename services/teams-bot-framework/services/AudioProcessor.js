const WebSocket = require('ws');
const { EventEmitter } = require('events');

class AudioProcessor extends EventEmitter {
    constructor(config) {
        super();
        
        this.whisperLiveUrl = config.whisperLiveUrl;
        this.activeSessions = new Map();
        this.transcriptionCallbacks = new Map();
    }

    async startSession(sessionId, meetingConfig) {
        console.log(`[Audio Processor] 🎯 Starting audio session: ${sessionId}`);
        
        try {
            // Connect to WhisperLive
            const whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            const sessionPromise = new Promise((resolve, reject) => {
                whisperSocket.on('open', () => {
                    console.log(`[Audio Processor] ✅ Connected to WhisperLive for session: ${sessionId}`);
                    
                    // Send initialization message
                    const initMessage = {
                        uid: sessionId,
                        language: 'en',
                        task: 'transcribe',
                        platform: meetingConfig.platform,
                        meeting_url: '',
                        token: `teams-framework-${sessionId}`,
                        meeting_id: meetingConfig.meetingId
                    };
                    
                    whisperSocket.send(JSON.stringify(initMessage));
                    resolve();
                });
                
                whisperSocket.on('message', (data) => {
                    this.handleTranscriptionMessage(sessionId, data);
                });
                
                whisperSocket.on('error', (error) => {
                    console.error(`[Audio Processor] WhisperLive error for session ${sessionId}:`, error);
                    reject(error);
                });
                
                whisperSocket.on('close', () => {
                    console.log(`[Audio Processor] WhisperLive connection closed for session: ${sessionId}`);
                    this.activeSessions.delete(sessionId);
                });
            });
            
            // Store session
            this.activeSessions.set(sessionId, {
                whisperSocket: whisperSocket,
                meetingConfig: meetingConfig,
                startTime: new Date(),
                audioFramesReceived: 0
            });
            
            await sessionPromise;
            
            // Start Teams Bot Framework audio capture
            await this.startTeamsAudioCapture(sessionId, meetingConfig);
            
            console.log(`[Audio Processor] 🎉 Audio session ready: ${sessionId}`);
            
        } catch (error) {
            console.error(`[Audio Processor] Failed to start session ${sessionId}:`, error);
            throw error;
        }
    }

    async startTeamsAudioCapture(sessionId, meetingConfig) {
        console.log(`[Audio Processor] 🎤 Starting Teams Bot Framework audio capture for session: ${sessionId}`);
        
        // This would integrate with Microsoft.Graph.Calls.Media for real audio capture
        // For now, we'll set up the framework and connect to our existing infrastructure
        
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        // Simulate real-time audio processing
        // In production, this would receive actual audio frames from Teams Bot Framework
        session.audioInterval = setInterval(() => {
            this.simulateAudioFrame(sessionId);
        }, 20); // 50 FPS (20ms frames)
        
        console.log(`[Audio Processor] ✅ Teams audio capture active for session: ${sessionId}`);
    }

    simulateAudioFrame(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        session.audioFramesReceived++;
        
        // In production, this would be replaced with actual audio frame processing
        // from Teams Bot Framework's real-time media APIs
        
        if (session.audioFramesReceived % 250 === 0) { // Every 5 seconds
            console.log(`[Audio Processor] 📊 Session ${sessionId}: ${session.audioFramesReceived} audio frames processed`);
        }
    }

    async stopSession(sessionId) {
        console.log(`[Audio Processor] 🛑 Stopping audio session: ${sessionId}`);
        
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            console.log(`[Audio Processor] ⚠️ Session ${sessionId} not found`);
            return;
        }
        
        // Clean up audio capture
        if (session.audioInterval) {
            clearInterval(session.audioInterval);
        }
        
        // Close WhisperLive connection
        if (session.whisperSocket) {
            session.whisperSocket.close();
        }
        
        // Remove session
        this.activeSessions.delete(sessionId);
        this.transcriptionCallbacks.delete(sessionId);
        
        console.log(`[Audio Processor] ✅ Session ${sessionId} stopped`);
    }

    onTranscription(sessionId, callback) {
        this.transcriptionCallbacks.set(sessionId, callback);
    }

    handleTranscriptionMessage(sessionId, data) {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.text && message.text.trim()) {
                console.log(`[Audio Processor] 🗣️ Transcription for ${sessionId}:`, message.text);
                
                const transcription = {
                    text: message.text,
                    confidence: message.confidence || 0.9,
                    timestamp: new Date(),
                    sessionId: sessionId
                };
                
                // Add speaker identification if available
                if (message.speaker_id) {
                    transcription.speaker = `Speaker ${message.speaker_id}`;
                }
                
                // Notify the callback
                const callback = this.transcriptionCallbacks.get(sessionId);
                if (callback) {
                    callback(transcription);
                }
                
                // Emit event
                this.emit('transcription', transcription);
            }
            
        } catch (error) {
            console.error(`[Audio Processor] Failed to parse transcription message for ${sessionId}:`, error);
        }
    }

    getSessionStatus(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;
        
        return {
            sessionId: sessionId,
            startTime: session.startTime,
            audioFramesReceived: session.audioFramesReceived,
            meetingId: session.meetingConfig.meetingId,
            platform: session.meetingConfig.platform
        };
    }

    getAllActiveSessions() {
        return Array.from(this.activeSessions.keys()).map(sessionId => 
            this.getSessionStatus(sessionId)
        );
    }
}

module.exports.AudioProcessor = AudioProcessor;